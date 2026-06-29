'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'

/*
 * INTENCION: Server Actions para operaciones sobre quotes.
 * Actualmente contiene una sola accion: createDemoQuote().
 * Este archivo crecera con acciones como updateQuoteStatus, addQuoteNote, etc.
 *
 * POR QUE 'use server':
 *   Las Server Actions de Next.js 15 se ejecutan en el servidor.
 *   Esto es critico porque:
 *   1. El cliente Supabase usa las cookies de sesion del request (SSR seguro).
 *   2. No exponemos el anon key ni el service role en el bundle del cliente.
 *   3. Las mutaciones pasan por el servidor antes de tocar la DB.
 *
 * SEGURIDAD:
 *   - No se usa service_role_key. Todas las queries usan el cliente del usuario.
 *   - El RLS de Supabase aplica automaticamente: authenticated solo puede insertar
 *     en la tabla del producer al que pertenece (get_my_producer_ids()).
 *   - No se exponen datos PII del prospect en los retornos.
 *
 * Ver: supabase/migrations/001_base_multitenant_schema.sql (politicas prospects_insert, quotes_insert)
 * Ver: supabase/migrations/002_grants.sql (GRANTs para el rol authenticated)
 * Ver: lib/producers/get-current-producer-context.ts (funcion reutilizada aqui)
 * Ver: docs/00-ai-context/CODING_RULES.md (reglas de comentarios)
 */

// ============================================================
// Constantes de la cotizacion demo
// ============================================================

/*
 * DEMO_PHONE: Numero de telefono ficticio para el prospect demo local.
 * Usamos el formato E.164 con un numero de Uruguay claramente invalido
 * (8 ceros no es un numero movil real) para que sea imposible contactar
 * a alguien real por error.
 *
 * La tabla prospects tiene UNIQUE (producer_id, phone), lo que nos da
 * idempotencia gratis: el segundo intento de crear este prospect
 * puede detectarse con SELECT antes del INSERT.
 */
const DEMO_PHONE = '+59800000000'

/*
 * DEMO_ORIGIN_CHANNEL: Marcador en la columna origin_channel para identificar
 * cotizaciones demo. Permite filtrar o excluir estas quotes en reportes reales.
 * No existe como enum — origin_channel es TEXT libre en el schema v2.0.
 */
const DEMO_ORIGIN_CHANNEL = 'demo_local'

// ============================================================
// Tipos de retorno
// ============================================================

export type DemoQuoteResult =
  | {
      success: true
      quoteId: string
      /**
       * true si la quote ya existia y no se creo una nueva.
       * Permite que la UI muestre un mensaje diferente al usuario.
       */
      isExisting: boolean
    }
  | {
      success: false
      /**
       * 'unauthenticated': la sesion expiro o no existe.
       * 'no_producer': el usuario no pertenece a ningun producer todavia.
       * 'query_failed': error de Supabase (ver logs del servidor para codigo).
       */
      error: 'unauthenticated' | 'no_producer' | 'query_failed'
      message: string
    }

// ============================================================
// Server Action: createDemoQuote
// ============================================================

/**
 * INTENCION: Crear una cotizacion demo (prospect + quote) asociada al producer
 * del usuario autenticado. Diseñada para desarrollo local — no envia mensajes,
 * no integra WhatsApp, no usa datos reales.
 *
 * FLUJO:
 *   1. Obtener producer context (valida sesion + membresia en producer_members).
 *   2. Buscar si ya existe el prospect demo por (producer_id, phone).
 *   3. Si no existe, insertar prospect demo.
 *   4. Buscar si ya existe una quote demo (origin_channel = 'demo_local').
 *   5. Si ya existe, retornar { isExisting: true } — idempotente.
 *   6. Si no existe, insertar quote demo.
 *   7. Retornar { success: true, quoteId }.
 *
 * IDEMPOTENCIA:
 *   La funcion es segura de llamar multiples veces:
 *   - Prospect: detectado por SELECT antes del INSERT (UNIQUE producer_id, phone).
 *   - Quote: detectado por SELECT antes del INSERT (por origin_channel = 'demo_local').
 *   Esto evita duplicados al re-ejecutar en desarrollo.
 *
 * SALIDAS:
 *   @returns {DemoQuoteResult} — success:true con quoteId, o success:false con error.
 *
 * ERRORES POSIBLES:
 *   - Sin sesion → error: 'unauthenticated'
 *   - Sin producer en producer_members → error: 'no_producer'
 *   - Error de Supabase en cualquier query → error: 'query_failed'
 *
 * SEGURIDAD / PRIVACIDAD:
 *   - No usa service role. Usa createClient() (cliente del usuario).
 *   - RLS aplica: el INSERT de prospect verifica get_my_producer_ids().
 *   - El phone y full_name son datos ficticios — no son PII real.
 *   - No loguear producer_id en logs de error (dato interno sensible).
 *
 * DATO TECNICO:
 *   La tabla quotes NO tiene un campo 'quote_reference' en el schema v2.0.
 *   Usamos origin_channel = 'demo_local' como marcador de identificacion.
 *   El quote_reference ficticio se guarda en risk_description como nota.
 */
export async function createDemoQuote(): Promise<DemoQuoteResult> {
  const supabase = await createClient()

  // ── Paso 1: Obtener producer context ─────────────────────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    return {
      success: false,
      error: 'unauthenticated',
      message: 'Sesion expirada. Por favor, inicia sesion nuevamente.',
    }
  }

  if (!ctx.hasProducer || !ctx.membership) {
    return {
      success: false,
      error: 'no_producer',
      message:
        'Tu usuario no esta asociado a ningun producer. Ejecuta el seed local primero.',
    }
  }

  const producerId = ctx.membership.producer_id

  // ── Paso 2: Buscar prospect demo existente ───────────────────────────────
  /*
   * Usamos SELECT antes de INSERT (no upsert) porque:
   * - upsert con ignoreDuplicates:true no retorna el row existente via .single()
   * - Queremos el id del prospect existente para crear la quote
   * - La race condition es aceptable en desarrollo local (un solo usuario)
   *
   * NOTA SOBRE TYPE ASSERTIONS:
   *   Mismo problema que en get-current-producer-context.ts y get-quotes-for-current-producer.ts:
   *   Supabase TypeScript infiere 'never' para .data en schemas complejos.
   *   Accedemos a .data sin desestructuracion y casteamos explicitamente.
   *   Para .insert(), la inferencia de Insert tambien produce 'never', por lo que
   *   casteamos el objeto de datos con 'as any' (el objeto esta correctamente tipado
   *   segun el schema — solo el generador de tipos de Supabase falla en inferirlo).
   *   Ver: lib/producers/get-current-producer-context.ts (patron identico)
   */
  type ProspectIdRow = { id: string }

  const existingProspectResult = await supabase
    .from('prospects')
    .select('id')
    .eq('producer_id', producerId)
    .eq('phone', DEMO_PHONE)
    .maybeSingle()

  // Cast necesario: .data inferido como 'never' por el generador de tipos de Supabase
  const existingProspect = existingProspectResult.data as ProspectIdRow | null

  if (existingProspectResult.error) {
    console.error('[quotes:action] Error buscando prospect demo — code:', existingProspectResult.error.code)
    return {
      success: false,
      error: 'query_failed',
      message: 'Error buscando prospect demo. Ver logs del servidor.',
    }
  }

  // ── Paso 3: Crear prospect demo si no existe ─────────────────────────────
  let prospectId: string

  if (existingProspect) {
    // El prospect ya existe — reutilizarlo (comportamiento idempotente)
    prospectId = existingProspect.id
  } else {
    /*
     * Insertar prospect demo.
     * consent_status: 'granted' — requerido para que el sistema pueda
     * "contactar" al prospect (en produccion real, requiere relacion previa con el producer).
     * En demo local, es un flag ficticio sin implicacion legal.
     *
     * RLS: prospects_insert requiere producer_id IN get_my_producer_ids().
     * El cliente del usuario (no service role) puede insertar porque tenemos
     * la membresia validada y GRANTs en migration 002.
     *
     * 'as any' en el objeto: la inferencia del Insert type falla con 'never' en
     * el generador de tipos de Supabase 2.x. El objeto esta correctamente tipado
     * segun Database['public']['Tables']['prospects']['Insert']. Solo la inferencia
     * generica falla — no hay peligro de datos incorrectos en runtime.
     */
    const newProspectResult = await supabase
      .from('prospects')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        producer_id: producerId,
        full_name: 'Prospecto Demo Local',
        phone: DEMO_PHONE,
        consent_status: 'granted' as const,
        opt_out: false,
      } as any)
      .select('id')
      .single()

    // Cast necesario: .data inferido como 'never'
    const newProspect = newProspectResult.data as ProspectIdRow | null

    if (newProspectResult.error || !newProspect) {
      console.error('[quotes:action] Error insertando prospect demo — code:', newProspectResult.error?.code)
      return {
        success: false,
        error: 'query_failed',
        message: 'Error creando prospect demo. Ver logs del servidor.',
      }
    }

    prospectId = newProspect.id
  }

  // ── Paso 4: Verificar si ya existe una quote demo ────────────────────────
  /*
   * Filtramos por (producer_id, origin_channel = 'demo_local') para idempotencia.
   * Limitamos a 1 resultado — solo nos importa si existe alguna.
   */
  type QuoteIdRow = { id: string }

  const existingQuoteResult = await supabase
    .from('quotes')
    .select('id')
    .eq('producer_id', producerId)
    .eq('origin_channel', DEMO_ORIGIN_CHANNEL)
    .limit(1)
    .maybeSingle()

  // Cast necesario: .data inferido como 'never'
  const existingQuote = existingQuoteResult.data as QuoteIdRow | null

  if (existingQuoteResult.error) {
    console.error('[quotes:action] Error buscando quote demo — code:', existingQuoteResult.error.code)
    return {
      success: false,
      error: 'query_failed',
      message: 'Error buscando quote demo existente. Ver logs del servidor.',
    }
  }

  // ── Paso 5: Quote ya existe — retornar sin duplicar ──────────────────────
  if (existingQuote) {
    return {
      success: true,
      quoteId: existingQuote.id,
      isExisting: true,
    }
  }

  // ── Paso 6: Crear quote demo ─────────────────────────────────────────────
  /*
   * Datos de la cotizacion demo:
   * - insurance_type: 'auto' — el tipo mas comun en Uruguay
   * - status: 'pending_follow_up' — estado inicial del flujo de seguimiento
   * - currency: 'UYU' — pesos uruguayos (mercado local)
   * - quoted_amount: 5000 — valor ficticio, claramente bajo para ser obvio
   * - risk_description: incluye 'DEMO-LOCAL' para identificacion rapida
   * - insurer_name: 'Aseguradora Demo' — ficticio
   * - origin_channel: DEMO_ORIGIN_CHANNEL ('demo_local') — marcador de idempotencia
   * - internal_notes: advertencia clara de que es demo
   *
   * NOTA: quote_date requiere formato DATE (YYYY-MM-DD), no ISO completo con hora.
   *
   * RLS: quotes_insert requiere producer_id IN get_my_producer_ids().
   * 'as any' en el objeto: misma razon que en el insert de prospect — inferencia falla.
   */
  const today = new Date().toISOString().split('T')[0] // Formato DATE: YYYY-MM-DD

  const newQuoteResult = await supabase
    .from('quotes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      prospect_id: prospectId,
      insurance_type: 'auto' as const,
      quote_date: today,
      currency: 'UYU',
      quoted_amount: 5000,
      status: 'pending_follow_up' as const,
      risk_description: '[DEMO-LOCAL-001] Toyota Hilux 2022 — Cotizacion ficticia para desarrollo',
      insurer_name: 'Aseguradora Demo',
      origin_channel: DEMO_ORIGIN_CHANNEL,
      internal_notes: 'COTIZACION DE PRUEBA LOCAL — No contactar al prospect. Ver docs/05-architecture/LOCAL_SEEDING.md',
    } as any)
    .select('id')
    .single()

  // Cast necesario: .data inferido como 'never'
  const newQuote = newQuoteResult.data as QuoteIdRow | null

  if (newQuoteResult.error || !newQuote) {
    console.error('[quotes:action] Error insertando quote demo — code:', newQuoteResult.error?.code)
    return {
      success: false,
      error: 'query_failed',
      message: 'Error creando quote demo. Ver logs del servidor.',
    }
  }

  return {
    success: true,
    quoteId: newQuote.id,
    isExisting: false,
  }
}
