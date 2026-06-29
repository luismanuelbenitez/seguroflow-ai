import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/*
 * INTENCION: Helper server-side para obtener los items del outbox local.
 * El outbox contiene quotes en estado 'pending_approval' con un mensaje aprobado
 * pendiente de envio simulado. No interactua con WhatsApp real.
 *
 * LOGICA DE ELEGIBILIDAD (sin migraciones, con columnas reales del schema v2.0):
 *   - status = 'pending_approval': estado que resulta de la cola de aprobacion.
 *   - approved_message IS NOT NULL: el producer ya reviso y guardo el texto.
 *   - Prospects con opt_out = true: se incluyen en el resultado pero se marcan
 *     para bloquear la simulacion en la UI y en el Server Action.
 *     (Consistent con la cola de aprobacion — misma logica de presentacion.)
 *
 * POR QUE DOS QUERIES SEPARADAS (en lugar de JOIN con select string complejo):
 *   Supabase TypeScript infiere 'never' para .data cuando el select string
 *   contiene relaciones anidadas en schemas complejos (833+ lineas en database.ts).
 *   El patron de dos queries separadas con type assertions explicitas es el
 *   workaround establecido en este proyecto. Ver: lib/quotes/get-approval-queue.ts.
 *
 * COLUMNAS VERIFICADAS EN types/database.ts (2026-06-29):
 *   quotes: id, status, insurance_type, risk_description, quoted_amount, currency,
 *           quote_date, approved_message, insurer_name, prospect_id, producer_id,
 *           updated_at
 *   prospects: id, full_name, phone, opt_out, producer_id
 *   Enums confirmados:
 *     quote_status incluye 'pending_approval' y 'contacted'
 *     delivery_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
 *     message_direction: 'outbound' | 'inbound'
 *
 * SEGURIDAD:
 *   - createClient() usa la sesion del usuario (no service role).
 *   - .eq('producer_id', producerId) + RLS = doble barrera.
 *   - producerId viene de getCurrentProducerContext() (llamador validado).
 *   - No se usan datos de otros producers en ningun momento.
 *
 * PRIVACIDAD:
 *   - full_name, phone son PII (Ley 18.331, Uruguay).
 *   - Se exponen al producer porque son sus propios clientes.
 *   - No loguear en errores — solo codigos de error de Supabase.
 *
 * Ver: app/dashboard/outbox/page.tsx (unico llamador)
 * Ver: app/actions/outbox.ts (simulateSendApprovedMessage — accion de envio)
 * Ver: lib/quotes/get-approval-queue.ts (patron identico de dos queries)
 * Ver: types/database.ts (columnas reales y enums)
 */

// ============================================================
// Tipos locales para las queries
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']
type QuoteStatus = Database['public']['Enums']['quote_status']
type InsuranceType = Database['public']['Enums']['insurance_type']

/*
 * Columnas de quote que necesitamos para el outbox.
 * Incluimos approved_message (obligatorio — es el mensaje a "enviar").
 * Incluimos updated_at para ordenar por mas antiguo primero (mas urgente).
 */
type OutboxQuoteRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'insurance_type'
  | 'risk_description'
  | 'quoted_amount'
  | 'currency'
  | 'quote_date'
  | 'approved_message'
  | 'insurer_name'
  | 'prospect_id'
>

/*
 * Columnas de prospect que necesitamos para el outbox.
 * opt_out es critico — bloquea la simulacion si es true.
 */
type OutboxProspectRow = Pick<
  ProspectRow,
  | 'id'
  | 'full_name'
  | 'phone'
  | 'opt_out'
>

// ============================================================
// Tipos de retorno publicos
// ============================================================

/**
 * Item del outbox local. Combina datos de quote y prospect.
 *
 * INVARIANTE: approvedMessage NO es null.
 * La query filtra por approved_message IS NOT NULL antes de construir este tipo.
 * El tipo usa string (no string | null) para reflejar esa garantia.
 */
export type OutboxItem = {
  quoteId: string
  quoteStatus: QuoteStatus
  insuranceType: InsuranceType
  approvedMessage: string
  riskDescription: string | null
  quotedAmount: number | null
  currency: string
  quoteDate: string
  insurerName: string | null
  prospectId: string
  prospectName: string
  prospectPhone: string
  prospectOptOut: boolean
}

export type OutboxResult = {
  items: OutboxItem[]
  error: string | null
}

// ============================================================
// Status elegibles para el outbox
// ============================================================

/*
 * El outbox solo muestra quotes en 'pending_approval'.
 *
 * RAZON: 'pending_approval' es el estado que resulta despues de que el producer
 * aprueba el mensaje M1 en la cola de aprobacion (/dashboard/approvals).
 * Es el unico estado donde approved_message != null Y el mensaje aun no fue
 * "enviado" (simulado o real).
 *
 * Despues del envio simulado, el status cambia a 'contacted' y el item
 * desaparece del outbox — el producer lo ve en el timeline de la quote.
 *
 * ESTADOS EXCLUIDOS DEL OUTBOX:
 *   - 'pending_follow_up', 'scheduled': mensaje aun no aprobado (van a /approvals).
 *   - 'contacted', 'contacted_2': ya enviado (simulado o real).
 *   - 'responded', 'interested', etc.: etapas posteriores al primer contacto.
 *   - 'closed_won', 'closed_lost', 'cancelled': terminales.
 *
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */
const OUTBOX_ELIGIBLE_STATUS: QuoteStatus = 'pending_approval'

// ============================================================
// Implementacion
// ============================================================

/**
 * INTENCION: Obtener los items del outbox local para un producer.
 * Retorna quotes en 'pending_approval' con approved_message no nulo.
 *
 * @param producerId UUID del producer del usuario autenticado.
 *   El llamador (la pagina) ya lo obtuvo de getCurrentProducerContext().
 */
export async function getLocalOutbox(producerId: string): Promise<OutboxResult> {
  const supabase = await createClient()

  // ── Query 1: quotes elegibles para el outbox ─────────────────────────────
  /*
   * FILTROS:
   *   1. producer_id = producerId — solo quotes del producer autenticado.
   *   2. status = 'pending_approval' — unico estado elegible (ver arriba).
   *   3. approved_message IS NOT NULL — el mensaje debe estar aprobado.
   *      Usamos .not('approved_message', 'is', null) que PostgREST traduce
   *      a WHERE approved_message IS NOT NULL.
   *
   * ORDEN: updated_at ASC — los mas antiguos primero (mas urgentes de enviar).
   *
   * TYPE ASSERTION:
   *   Supabase TS infiere 'never' para .data con select strings en schemas de
   *   833+ lineas. Casteamos a OutboxQuoteRow[] | null de forma segura —
   *   las columnas en el select string coinciden exactamente con el tipo.
   *   Ver: lib/quotes/get-approval-queue.ts (patron identico).
   */
  const quotesResult = await supabase
    .from('quotes')
    .select('id, status, insurance_type, risk_description, quoted_amount, currency, quote_date, approved_message, insurer_name, prospect_id')
    .eq('producer_id', producerId)
    .eq('status', OUTBOX_ELIGIBLE_STATUS)
    .not('approved_message', 'is', null)
    .order('updated_at', { ascending: true })

  const quotesData = quotesResult.data as OutboxQuoteRow[] | null

  if (quotesResult.error) {
    console.error('[outbox] Error querying eligible quotes — code:', quotesResult.error.code)
    return { items: [], error: 'Error al obtener las cotizaciones del outbox.' }
  }

  // Sin quotes elegibles — retornar vacio sin error
  if (!quotesData || quotesData.length === 0) {
    return { items: [], error: null }
  }

  // ── Query 2: prospects de esas quotes ────────────────────────────────────
  /*
   * Extraemos los prospect_ids unicos de las quotes para hacer un solo SELECT.
   * Esto evita N queries adicionales (patron N+1).
   *
   * FILTRO: producer_id = producerId ademas de id IN [...] — doble barrera.
   * Aunque RLS garantiza que solo vemos prospects del producer, el filtro
   * explicito mejora la claridad y previene confusion si se cambia el RLS.
   */
  const prospectIds = [...new Set(quotesData.map(q => q.prospect_id))]

  const prospectsResult = await supabase
    .from('prospects')
    .select('id, full_name, phone, opt_out')
    .eq('producer_id', producerId)
    .in('id', prospectIds)

  const prospectsData = prospectsResult.data as OutboxProspectRow[] | null

  if (prospectsResult.error) {
    // Error no critico — continuamos sin datos de prospect.
    // La UI mostrara "Prospect desconocido" en lugar de crashear.
    console.error('[outbox] Error querying prospects — code:', prospectsResult.error.code)
  }

  // Indice de prospects por id para O(1) lookup al joinear
  const prospectMap = new Map<string, OutboxProspectRow>()
  for (const p of (prospectsData ?? [])) {
    prospectMap.set(p.id, p)
  }

  // ── Construir items del outbox ────────────────────────────────────────────
  /*
   * INVARIANTE: approvedMessage es string (no null) porque filtramos
   * approved_message IS NOT NULL en la query. El cast es seguro.
   *
   * DECISION SOBRE OPT-OUT:
   *   No excluimos prospects con opt_out = true. Los incluimos con
   *   prospectOptOut: true para que la UI los marque y deshabilite el boton.
   *   Esto es consistente con la cola de aprobacion (/dashboard/approvals).
   *   El Server Action hace su propia validacion de opt_out — doble barrera.
   *
   * ALTERNATIVA CONSIDERADA: excluir completamente prospects con opt_out.
   *   Rechazada porque el producer necesita saber que hay una quote "varada"
   *   en el outbox por el opt-out, para poder cerrarla manualmente.
   */
  const items: OutboxItem[] = quotesData.map((quote) => {
    const prospect = prospectMap.get(quote.prospect_id)
    return {
      quoteId: quote.id,
      quoteStatus: quote.status,
      insuranceType: quote.insurance_type,
      approvedMessage: quote.approved_message as string, // safe: filtramos IS NOT NULL
      riskDescription: quote.risk_description,
      quotedAmount: quote.quoted_amount,
      currency: quote.currency,
      quoteDate: quote.quote_date,
      insurerName: quote.insurer_name,
      prospectId: quote.prospect_id,
      prospectName: prospect?.full_name ?? 'Prospect desconocido',
      prospectPhone: prospect?.phone ?? '—',
      prospectOptOut: prospect?.opt_out ?? false,
    }
  })

  return { items, error: null }
}
