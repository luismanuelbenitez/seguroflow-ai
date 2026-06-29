'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import type { Database } from '@/types/database'

/*
 * INTENCION: Server Actions para operaciones sobre quotes.
 * Contiene: createDemoQuote() — creacion rapida de quote ficticia para validacion local.
 *           createManualQuote() — ingesta manual de cotizacion real desde formulario.
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

// ============================================================
// Tipos compartidos para el formulario manual
// ============================================================

/*
 * Campos que pueden tener errores de validacion en el formulario de cotizacion manual.
 * Deben coincidir exactamente con el atributo 'name' de los inputs del formulario.
 * Ver: components/dashboard/quote-form.tsx
 */
type ManualQuoteField =
  | 'full_name'
  | 'phone'
  | 'email'
  | 'insurance_type'
  | 'quote_date'
  | 'quoted_amount'

/**
 * Resultado de la Server Action createManualQuote.
 * Espejea AuthActionResult del login para consistencia en toda la app.
 *
 * FLUJO DE USO CON useActionState:
 *   - Si isError: true → el formulario muestra los errores y permanece en la pagina.
 *   - Si success: true → el Server Action llama redirect('/dashboard/quotes').
 *     Esto significa que el resultado nunca llega al cliente en el caso exitoso.
 *   - fieldErrors: errores especificos por campo (nombre, telefono, etc.)
 *
 * DECISION: redirect() en el Server Action, no en el cliente.
 *   Esto simplifica el Client Component — no necesita detectar success y navegar.
 *   Ver: app/dashboard/quotes/new/page.tsx, components/dashboard/quote-form.tsx
 */
export type ManualQuoteResult = {
  message: string
  isError: boolean
  fieldErrors?: Partial<Record<ManualQuoteField, string>>
}

/**
 * Estado inicial para useActionState en el componente QuoteForm.
 * message vacio = sin feedback todavia.
 */
// MANUAL_QUOTE_INITIAL_STATE se define en components/dashboard/quote-form.tsx
// No puede exportarse desde 'use server' — solo async functions son exportables.

// ============================================================
// Helpers de validacion (privados a este modulo)
// ============================================================

/*
 * Valores validos del enum insurance_type en el schema v2.0.
 * Definidos aqui para validacion server-side — el enum de TS no es disponible
 * en runtime, solo en compile-time.
 * Ver: types/database.ts — Database['public']['Enums']['insurance_type']
 */
const VALID_INSURANCE_TYPES: Database['public']['Enums']['insurance_type'][] = [
  'auto',
  'home',
  'life',
  'commercial',
  'other',
]

/*
 * Valores validos del enum consent_status en el schema v2.0.
 * Ver: types/database.ts — Database['public']['Enums']['consent_status']
 */
const VALID_CONSENT_STATUSES: Database['public']['Enums']['consent_status'][] = [
  'unknown',
  'granted',
  'revoked',
]

/**
 * INTENCION: Validar y normalizar un numero de telefono al formato E.164.
 *
 * FORMATO E.164: + seguido de 8 a 15 digitos. Sin espacios, guiones ni parentesis.
 * Ejemplos validos: +59899123456, +15551234567, +442012345678
 * Ejemplos invalidos: 099123456 (sin +), +598 99 (con espacios), +1 (muy corto)
 *
 * NORMALIZACION: Se eliminan espacios y guiones comunes antes de validar.
 * Esto permite que el usuario ingrese "+598 99 123 456" y el sistema lo procese.
 *
 * @param raw Telefono ingresado por el usuario (posiblemente con espacios)
 * @returns { normalized: string } si valido, o { error: string } si invalido
 */
function validatePhone(raw: string): { normalized: string } | { error: string } {
  // Eliminar espacios, guiones y parentesis para normalizar antes de validar
  // Mantenemos el + inicial y solo eliminamos los caracteres de formato
  const normalized = raw.trim().replace(/[\s\-()]/g, '')

  if (!normalized.startsWith('+')) {
    return { error: 'El telefono debe empezar con + seguido del codigo de pais. Ej: +59899123456' }
  }

  // El resto (despues del +) debe ser solo digitos
  const digits = normalized.slice(1)
  if (!/^\d+$/.test(digits)) {
    return { error: 'El telefono solo puede contener digitos luego del +. Ej: +59899123456' }
  }

  if (digits.length < 8 || digits.length > 15) {
    return { error: `El telefono debe tener entre 8 y 15 digitos luego del + (tiene ${digits.length})` }
  }

  return { normalized }
}

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

// ============================================================
// Server Action: createManualQuote
// ============================================================

/**
 * INTENCION: Crear una cotizacion manual (prospect + quote) desde el formulario
 * en /dashboard/quotes/new. A diferencia de createDemoQuote(), los datos vienen
 * del usuario (no son fijos) y la funcion hace validacion completa de los campos.
 *
 * FLUJO:
 *   1. Obtener producer context (valida sesion + membresia).
 *   2. Leer y validar todos los campos del FormData.
 *   3. Buscar prospect existente por (producer_id, phone) — deduplicacion.
 *   4. Si no existe, insertar prospect con los datos del formulario.
 *   5. Insertar quote asociada al producer y al prospect.
 *   6. En exito → redirect('/dashboard/quotes') — el resultado NUNCA llega al cliente.
 *   7. En error → retornar { isError: true, message, fieldErrors }.
 *
 * FIRMA COMPATIBLE CON useActionState:
 *   useActionState requiere (prevState, formData) como firma.
 *   prevState es el resultado anterior — no se usa en esta accion
 *   pero debe aparecer como primer parametro.
 *
 * DEDUPLICACION DE PROSPECTS:
 *   La tabla prospects tiene UNIQUE (producer_id, phone).
 *   Si ya existe un prospect con ese telefono en el producer, se reutiliza.
 *   Esto es intencional: el mismo cliente puede tener varias cotizaciones
 *   (por ejemplo, auto y hogar) sin duplicar su registro.
 *
 * ORIGIN_CHANNEL:
 *   Todas las cotizaciones creadas por este formulario tienen origin_channel = 'manual'.
 *   Esto las distingue de las que vienen de webhooks ('webhook') o del seed demo ('demo_local').
 *
 * NOTA SOBRE TYPE ASSERTIONS:
 *   Identico al patron de createDemoQuote — Supabase infiere 'never' para
 *   .data y para los objetos de .insert() con el schema generado.
 *   Ver: get-current-producer-context.ts (misma razon, mismo workaround)
 *
 * SEGURIDAD:
 *   - No usa service role.
 *   - RLS aplica en INSERT de prospects y quotes.
 *   - Los datos del formulario son PII (nombre, telefono) — no loguear en produccion.
 *   - El telefono se normaliza a E.164 antes de guardar para consistencia.
 *
 * PRIVACIDAD:
 *   - full_name y phone son PII del prospect. No loguear ni exponer en errores.
 *   - Solo se loguan codigos de error de Supabase, no datos del formulario.
 *
 * @param _prevState Estado anterior de useActionState (ignorado, requerido por la firma)
 * @param formData FormData del formulario en components/dashboard/quote-form.tsx
 */
export async function createManualQuote(
  _prevState: ManualQuoteResult,
  formData: FormData
): Promise<ManualQuoteResult> {
  const supabase = await createClient()

  // ── Paso 1: Obtener y validar producer context ───────────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    return {
      message: 'Tu sesion expiro. Recarga la pagina e inicia sesion nuevamente.',
      isError: true,
    }
  }

  if (!ctx.hasProducer || !ctx.membership) {
    return {
      message: 'Tu usuario no esta asociado a ningun producer. Ejecuta el seed local primero.',
      isError: true,
    }
  }

  const producerId = ctx.membership.producer_id

  // ── Paso 2: Leer campos del FormData ────────────────────────────────────
  /*
   * Todos los campos son strings en FormData. La conversion a tipos correctos
   * (number, Date) se hace aqui antes de la validacion.
   */
  const rawFullName = (formData.get('full_name') as string | null)?.trim() ?? ''
  const rawPhone = (formData.get('phone') as string | null) ?? ''
  const rawEmail = (formData.get('email') as string | null)?.trim() ?? ''
  const rawInsuranceType = (formData.get('insurance_type') as string | null) ?? ''
  const rawQuoteDate = (formData.get('quote_date') as string | null)?.trim() ?? ''
  const rawQuotedAmount = (formData.get('quoted_amount') as string | null)?.trim() ?? ''
  const rawCurrency = (formData.get('currency') as string | null)?.trim() ?? 'UYU'
  const rawRiskDescription = (formData.get('risk_description') as string | null)?.trim() ?? ''
  const rawInternalNotes = (formData.get('internal_notes') as string | null)?.trim() ?? ''
  const rawConsentStatus = (formData.get('consent_status') as string | null) ?? 'granted'

  // ── Paso 3: Validar campos ───────────────────────────────────────────────
  /*
   * Acumulamos todos los errores de campo antes de retornar.
   * Esto permite mostrar todos los problemas al usuario de una sola vez
   * en lugar de uno por submit.
   */
  const fieldErrors: Partial<Record<ManualQuoteField, string>> = {}

  // Nombre del prospecto — requerido
  if (!rawFullName || rawFullName.length < 2) {
    fieldErrors.full_name = 'El nombre es requerido (minimo 2 caracteres)'
  }

  // Telefono — requerido, formato E.164
  const phoneValidation = validatePhone(rawPhone)
  if ('error' in phoneValidation) {
    fieldErrors.phone = phoneValidation.error
  }

  // Email — opcional, validacion basica si se proporciona
  if (rawEmail) {
    /*
     * Regex minimo para email — no RFC completo.
     * El objetivo es detectar errores obvios (sin @, sin punto en dominio).
     * La validacion real ocurre cuando Supabase Auth envie correos.
     */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      fieldErrors.email = 'El formato del email no es valido'
    }
  }

  // Tipo de seguro — requerido, debe ser un valor del enum
  if (!rawInsuranceType || !VALID_INSURANCE_TYPES.includes(rawInsuranceType as Database['public']['Enums']['insurance_type'])) {
    fieldErrors.insurance_type = 'Selecciona un tipo de seguro valido'
  }

  // Fecha de cotizacion — requerida, formato YYYY-MM-DD
  if (!rawQuoteDate) {
    fieldErrors.quote_date = 'La fecha de cotizacion es requerida'
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawQuoteDate)) {
    fieldErrors.quote_date = 'La fecha debe estar en formato YYYY-MM-DD'
  }

  // Monto cotizado — opcional, si se proporciona debe ser numero positivo
  let parsedAmount: number | null = null
  if (rawQuotedAmount) {
    const asNumber = parseFloat(rawQuotedAmount)
    if (isNaN(asNumber) || asNumber <= 0) {
      fieldErrors.quoted_amount = 'El monto debe ser un numero mayor a 0'
    } else {
      parsedAmount = asNumber
    }
  }

  // Si hay errores de campo, retornar sin tocar la DB
  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: 'Hay errores en el formulario. Corrigelos antes de continuar.',
      isError: true,
      fieldErrors,
    }
  }

  // Valores ya validados y tipados correctamente para los INSERTs
  const normalizedPhone = ('normalized' in phoneValidation) ? phoneValidation.normalized : rawPhone
  const insuranceType = rawInsuranceType as Database['public']['Enums']['insurance_type']
  const consentStatus = VALID_CONSENT_STATUSES.includes(rawConsentStatus as Database['public']['Enums']['consent_status'])
    ? (rawConsentStatus as Database['public']['Enums']['consent_status'])
    : 'granted' // fallback seguro si el valor enviado no es valido

  // ── Paso 4: Buscar prospect existente por (producer_id, phone) ───────────
  /*
   * DEDUPLICACION: Si ya existe un prospect con ese telefono en este producer,
   * reutilizamos su id en lugar de crear un duplicado.
   * La tabla tiene UNIQUE (producer_id, phone), por lo que no puede haber dos.
   *
   * PRIVACIDAD: No logueamos el telefono ni el nombre en el console.error.
   */
  type ProspectIdRow = { id: string }

  const existingProspectResult = await supabase
    .from('prospects')
    .select('id')
    .eq('producer_id', producerId)
    .eq('phone', normalizedPhone)
    .maybeSingle()

  // Cast necesario: Supabase infiere 'never' para .data en schemas complejos
  const existingProspect = existingProspectResult.data as ProspectIdRow | null

  if (existingProspectResult.error) {
    console.error('[quotes:createManual] Error buscando prospect — code:', existingProspectResult.error.code)
    return {
      message: 'Error al verificar el prospecto en la base de datos. Intenta nuevamente.',
      isError: true,
    }
  }

  // ── Paso 5: Crear prospect si no existe ─────────────────────────────────
  let prospectId: string

  if (existingProspect) {
    /*
     * Prospect existente — reutilizamos su id.
     * El nombre y email del formulario se ignoran para no sobreescribir
     * datos de un prospect ya existente sin intencion del usuario.
     * En una version futura podria haber un flujo de edicion de prospect.
     */
    prospectId = existingProspect.id
  } else {
    /*
     * Insertar nuevo prospect con los datos del formulario.
     *
     * consent_status: viene del formulario (default 'granted').
     * opt_out: false — el prospect se acaba de ingresar, no ha pedido opt-out.
     *
     * 'as any' en el objeto: la inferencia del Insert type falla con 'never'
     * en el generador de tipos de Supabase 2.x con schemas complejos.
     * El objeto esta correctamente tipado segun
     * Database['public']['Tables']['prospects']['Insert'].
     * Solo la inferencia generica falla — no hay riesgo de datos incorrectos.
     * Ver: lib/producers/get-current-producer-context.ts (patron identico)
     */
    const newProspectResult = await supabase
      .from('prospects')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        producer_id: producerId,
        full_name: rawFullName,
        phone: normalizedPhone,
        email: rawEmail || null,         // null si el campo esta vacio
        consent_status: consentStatus,
        opt_out: false,
      } as any)
      .select('id')
      .single()

    // Cast necesario: Supabase infiere 'never' para .data
    const newProspect = newProspectResult.data as ProspectIdRow | null

    if (newProspectResult.error || !newProspect) {
      console.error('[quotes:createManual] Error insertando prospect — code:', newProspectResult.error?.code)
      return {
        message: 'Error al crear el prospecto. Verifica que el telefono no este duplicado e intenta nuevamente.',
        isError: true,
      }
    }

    prospectId = newProspect.id
  }

  // ── Paso 6: Insertar la quote ────────────────────────────────────────────
  /*
   * origin_channel = 'manual': marca que esta quote fue creada desde el formulario.
   * Permite distinguirla de quotes creadas por webhook o por el seed demo.
   *
   * risk_description: usada tambien para guardar la "referencia de cotizacion"
   * ya que la tabla quotes NO tiene un campo quote_reference en el schema v2.0.
   * Ver: docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md
   *
   * 'as any' en el objeto: misma razon que en el prospect — inferencia produce 'never'.
   */
  type QuoteIdRow = { id: string }

  const newQuoteResult = await supabase
    .from('quotes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      prospect_id: prospectId,
      insurance_type: insuranceType,
      quote_date: rawQuoteDate,
      currency: rawCurrency || 'UYU',
      quoted_amount: parsedAmount,         // null si no se proporciono
      status: 'pending_follow_up',         // estado inicial siempre
      risk_description: rawRiskDescription || null,
      internal_notes: rawInternalNotes || null,
      origin_channel: 'manual',
    } as any)
    .select('id')
    .single()

  // Cast necesario: Supabase infiere 'never' para .data
  const newQuote = newQuoteResult.data as QuoteIdRow | null

  if (newQuoteResult.error || !newQuote) {
    console.error('[quotes:createManual] Error insertando quote — code:', newQuoteResult.error?.code)
    return {
      message: 'Error al crear la cotizacion. Ver logs del servidor para detalles.',
      isError: true,
    }
  }

  // ── Paso 7: Registrar evento de creacion en quote_events ────────────────
  /*
   * INTENCION: Insertar el evento inicial 'quote_created' como primera entrada
   * del timeline de la quote. Toda cotizacion manual tiene al menos un evento
   * de auditoria desde su creacion.
   *
   * VALORES:
   *   - event_type: 'quote_created' — TEXT libre, no enum.
   *   - actor: 'producer' — el producer creo la quote desde el formulario.
   *   - previous_status: null — no habia estado previo (es nueva).
   *   - new_status: 'pending_follow_up' — estado inicial siempre.
   *
   * NOTA SOBRE metadata:
   *   La tabla quote_events NO tiene columna metadata en el schema v2.0.
   *   Ver: types/database.ts — quote_events.Row (columnas reales).
   *
   * DEGRADACION ELEGANTE:
   *   Si falla, logueamos pero NO interrumpimos el flujo. La quote ya fue creada.
   *   Solo el audit log falla — el producer llega al dashboard con la quote visible.
   *
   * PATRON 'as any':
   *   Supabase TS infiere 'never' para .insert() en schemas complejos.
   *   Identico al patron en app/actions/approvals.ts (event_type = 'message_approved').
   *
   * Ver: app/dashboard/quotes/[quoteId]/page.tsx (timeline que muestra este evento)
   * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
   */
  const eventResult = await supabase
    .from('quote_events')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      quote_id: newQuote.id,
      event_type: 'quote_created',
      actor: 'producer' as const,
      previous_status: null,
      new_status: 'pending_follow_up' as const,
      description: 'Cotizacion manual creada desde el dashboard local.',
    } as any)

  if (eventResult.error) {
    // Error no critico: quote creada bien, solo falla el audit log.
    console.error('[quotes:createManual] Error insertando evento quote_created — code:', eventResult.error.code)
  }

  /*
   * EXITO: redirect a la lista de cotizaciones.
   *
   * IMPORTANTE: redirect() lanza una excepcion especial (NEXT_REDIRECT) que
   * Next.js intercepta y convierte en una respuesta 3xx. Esto significa que
   * la funcion nunca retorna en el caso exitoso.
   *
   * El useActionState en el cliente NO recibe ningun valor en este caso —
   * el browser simplemente navega a /dashboard/quotes.
   *
   * INTENCION: No mostrar un mensaje de exito en el formulario; el usuario ve
   * directamente la lista con la nueva cotizacion incluida, lo que confirma visualmente
   * que se creo correctamente.
   */
  redirect('/dashboard/quotes')
}
