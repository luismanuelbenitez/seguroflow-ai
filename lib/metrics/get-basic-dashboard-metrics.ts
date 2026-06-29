/**
 * MÓDULO: lib/metrics/get-basic-dashboard-metrics.ts
 *
 * INTENCIÓN: Obtener todas las métricas básicas del dashboard local MVP para un producer.
 * Usado por /dashboard/metrics para dar al producer una vista del estado del flujo simulado.
 *
 * PATRÓN DE USO (consistente con los demás helpers del proyecto):
 *   - El caller (page.tsx) hace getCurrentProducerContext() para validar sesion y auth.
 *   - El page extrae producerId y lo pasa a getBasicDashboardMetrics(producerId).
 *   - Este helper NO llama getCurrentProducerContext() — solo recibe el producerId.
 *   - El caller hace redirect('/login') si no hay sesion.
 *   - RLS de Supabase garantiza que el producerId solo devuelve datos del producer.
 *
 * Ver: app/dashboard/scheduler/page.tsx + lib/scheduler/get-local-scheduler-preview.ts
 *      para ver el mismo patron aplicado al scheduler.
 *
 * NO usa WhatsApp real. NO usa IA. NO usa service role. Todo es local simulado.
 *
 * QUERIES (5 en paralelo vía Promise.all):
 *   1. quotes — todos los del producer (id, status) para contar por estado
 *   2. prospects — solo los con opt_out=true para contar opt-outs a nivel prospecto
 *   3. whatsapp_messages direction='outbound' — mensajes enviados simulados
 *   4. whatsapp_messages direction='inbound' — respuestas simuladas recibidas
 *   5. quote_events — últimos 5 eventos del producer para actividad reciente
 *
 * GAP DOCUMENTADO — metadata.simulated:
 *   En MVP local, todos los mensajes en whatsapp_messages son simulados
 *   (no hay integración WhatsApp real). Por eso contamos TODOS los outbound/inbound
 *   del producer sin filtrar por metadata.simulated=true.
 *   Cuando se integre WhatsApp real (M2/M3), habrá que filtrar por metadata para
 *   separar mensajes reales de los simulados en métricas históricas.
 *
 * GAP DOCUMENTADO — interestRate denominator:
 *   Usamos "everContactedCount" (todos los estados que implican al menos 1 mensaje enviado)
 *   como denominador de interest rate, no solo el count de status='contacted'.
 *   Esto da una tasa más representativa: las quotes que avanzaron a responded/interested
 *   ya no están en status 'contacted', así que usar solo 'contacted' subvalúa el denominador.
 *
 * SEGURIDAD / PRIVACIDAD:
 *   - Recibe producerId del caller que ya validó auth con getCurrentProducerContext().
 *   - Filtra todas las queries por producer_id explícitamente (además del RLS).
 *   - No usa service role key. No loguea nombres ni teléfonos de prospectos (PII).
 *   - PII solo llega al caller (page.tsx) que la renderiza para el propio producer.
 *
 * Ver: types/database.ts — enums quote_status, message_direction, quote_event_actor
 * Ver: docs/00-ai-context/CODING_RULES.md — reglas de comentarios y manejo de datos
 */

import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────
// Tipos exportados
// ─────────────────────────────────────────────

type QuoteStatus = Database['public']['Enums']['quote_status']
type QuoteEventActor = Database['public']['Enums']['quote_event_actor']

/**
 * Un evento reciente del timeline global del producer.
 * Usado para mostrar "Últimos eventos" en la pantalla de métricas.
 */
export type RecentEvent = {
  id: string
  event_type: string
  actor: QuoteEventActor
  previous_status: QuoteStatus | null
  new_status: QuoteStatus | null
  description: string | null
  quote_id: string
  created_at: string
}

/**
 * Conteo de quotes para un status específico del enum.
 * Usado para renderizar la distribución de states en tabla.
 */
export type StatusCount = {
  status: QuoteStatus
  count: number
}

/**
 * Resultado completo de la consulta de métricas.
 * Todos los conteos son 0 (nunca undefined) para facilitar el renderizado.
 */
export type BasicDashboardMetrics = {
  // ── Volumen ───────────────────────────────────────────────────────────────
  totalQuotes: number
  pendingFollowUpCount: number
  scheduledCount: number
  pendingApprovalCount: number

  // ── Embudo de contacto ───────────────────────────────────────────────────
  /** Quotes actualmente en status contacted + contacted_2 (esperando respuesta) */
  contactedCount: number
  /** no_response + no_response_1 combinados */
  noResponseCount: number
  respondedCount: number
  interestedCount: number
  humanHandoffCount: number

  // ── Resultados finales ───────────────────────────────────────────────────
  closedWonCount: number
  closedLostCount: number
  /** Quotes en status opt_out (distinto de prospects con opt_out=true) */
  optOutQuotesCount: number
  /** paused + cancelled + error */
  otherCount: number

  // ── Distribución completa por status ─────────────────────────────────────
  /** Solo statuses con count > 0, ordenados por count descendente */
  quotesByStatus: StatusCount[]

  // ── Prospectos ────────────────────────────────────────────────────────────
  /** Prospectos marcados opt_out=true en la tabla prospects */
  optOutProspectsCount: number

  // ── Mensajes simulados ────────────────────────────────────────────────────
  /** whatsapp_messages direction='outbound' del producer (todos simulados en MVP) */
  outboundSimulatedCount: number
  /** whatsapp_messages direction='inbound' del producer (todos simulados en MVP) */
  inboundSimulatedCount: number

  // ── Tasas calculadas ──────────────────────────────────────────────────────
  /** inbound / outbound * 100 — null si outbound = 0 */
  responseRate: number | null
  /**
   * interested / everContactedCount * 100 — null si everContactedCount = 0.
   * Ver GAP DOCUMENTADO arriba sobre la elección del denominador.
   */
  interestRate: number | null

  // ── Actividad reciente ────────────────────────────────────────────────────
  /** Últimos 5 quote_events del producer, ordenados por created_at DESC */
  lastEvents: RecentEvent[]

  // ── Error de query (distinto de error de auth) ────────────────────────────
  error: string | null
}

// ─────────────────────────────────────────────
// Estado vacío helper interno
// ─────────────────────────────────────────────

/**
 * Genera un BasicDashboardMetrics vacío con todos los conteos en 0.
 * Usado cuando hay error de queries para no retornar undefined.
 */
function emptyMetrics(error: string | null = null): BasicDashboardMetrics {
  return {
    totalQuotes: 0,
    pendingFollowUpCount: 0,
    scheduledCount: 0,
    pendingApprovalCount: 0,
    contactedCount: 0,
    noResponseCount: 0,
    respondedCount: 0,
    interestedCount: 0,
    humanHandoffCount: 0,
    closedWonCount: 0,
    closedLostCount: 0,
    optOutQuotesCount: 0,
    otherCount: 0,
    quotesByStatus: [],
    optOutProspectsCount: 0,
    outboundSimulatedCount: 0,
    inboundSimulatedCount: 0,
    responseRate: null,
    interestRate: null,
    lastEvents: [],
    error,
  }
}

// ─────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────

/**
 * INTENCIÓN: Obtener métricas básicas del MVP para un producer dado.
 * El caller (page.tsx) ya validó auth con getCurrentProducerContext().
 * Este helper solo necesita el producerId para correr sus queries.
 *
 * FLUJO:
 *   1. createClient() — cliente Supabase server-side (usa cookies del request).
 *   2. Promise.all con 5 queries independientes en paralelo.
 *   3. Castear .data de cada query (workaround bug TypeScript 'never' de Supabase).
 *   4. Computar conteos por status usando Map<QuoteStatus, number> (una pasada).
 *   5. Computar tasas: responseRate y interestRate.
 *   6. Retornar BasicDashboardMetrics completo.
 *
 * ENTRADAS:
 *   @param producerId {string} — ID del producer activo. Viene de ctx.producer.id.
 *
 * SALIDAS:
 *   @returns {BasicDashboardMetrics} — siempre retorna objeto completo, nunca lanza.
 *   Si hay error de query, retorna emptyMetrics(errorMessage).
 *
 * DECISIONES TÉCNICAS:
 *   - Promise.all: Las 5 queries son independientes. Ejecutarlas en paralelo
 *     reduce latencia al tiempo del query más lento (en lugar de suma de todos).
 *   - Conteo en memoria: Para el MVP local (decenas de quotes), es más simple que
 *     intentar GROUP BY en PostgREST (que tiene limitaciones de tipos TypeScript).
 *   - Cast explícito de .data: Bug conocido del cliente TypeScript de Supabase —
 *     en schemas complejos (833+ líneas) los tipos se infieren como 'never'.
 *   - metadata.simulated no filtrado: En MVP todo es simulado. Ver GAP arriba.
 *
 * SEGURIDAD / PRIVACIDAD:
 *   - RLS protege los datos — producerId solo devuelve sus propias quotes/prospectos.
 *   - No usa service role. No loguea PII.
 */
export async function getBasicDashboardMetrics(
  producerId: string,
): Promise<BasicDashboardMetrics> {
  // ── Paso 1: Cliente Supabase server-side ────────────────────────────────
  const supabase = await createClient()

  // ── Paso 2: 5 queries en paralelo ───────────────────────────────────────
  /*
   * Todas las queries filtran por producer_id explícitamente aunque RLS
   * también lo haría vía get_my_producer_ids(). El filtro explícito evita
   * cargar datos de otros producers en casos de membresía múltiple futura.
   */
  const [
    quotesResult,
    optOutProspectsResult,
    outboundResult,
    inboundResult,
    lastEventsResult,
  ] = await Promise.all([
    // 1. Todos los status de quotes del producer
    supabase
      .from('quotes')
      .select('id, status')
      .eq('producer_id', producerId),

    // 2. Prospectos con opt_out=true (nivel prospecto, no nivel quote status)
    supabase
      .from('prospects')
      .select('id')
      .eq('producer_id', producerId)
      .eq('opt_out', true),

    // 3. Mensajes outbound enviados (todos simulados en MVP — ver GAP arriba)
    supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('producer_id', producerId)
      .eq('direction', 'outbound'),

    // 4. Mensajes inbound recibidos (respuestas simuladas — ver GAP arriba)
    supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('producer_id', producerId)
      .eq('direction', 'inbound'),

    // 5. Últimos 5 eventos del producer para "Actividad reciente"
    supabase
      .from('quote_events')
      .select('id, event_type, actor, previous_status, new_status, description, quote_id, created_at')
      .eq('producer_id', producerId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // ── Paso 3: Castear resultados (workaround bug TypeScript 'never') ───────
  /*
   * El cliente TypeScript de Supabase infiere los tipos de .data como 'never'
   * en schemas complejos (833+ líneas en types/database.ts). Casteamos
   * explícitamente a los tipos correctos según la definición en database.ts.
   * Esta es la convención establecida en todo el proyecto — ver otros helpers.
   */
  const quotes =
    (quotesResult.data as Array<{ id: string; status: QuoteStatus }> | null) ?? []

  const optOutProspects =
    (optOutProspectsResult.data as Array<{ id: string }> | null) ?? []

  const outboundMessages =
    (outboundResult.data as Array<{ id: string }> | null) ?? []

  const inboundMessages =
    (inboundResult.data as Array<{ id: string }> | null) ?? []

  const rawEvents =
    (lastEventsResult.data as RecentEvent[] | null) ?? []

  // Recopilar errores de query sin lanzar excepción
  // (mejor mostrar métricas parciales con aviso que una pantalla en blanco)
  const queryErrors: string[] = []
  if (quotesResult.error) queryErrors.push(`quotes: ${quotesResult.error.message}`)
  if (optOutProspectsResult.error) queryErrors.push(`prospects: ${optOutProspectsResult.error.message}`)
  if (outboundResult.error) queryErrors.push(`outbound: ${outboundResult.error.message}`)
  if (inboundResult.error) queryErrors.push(`inbound: ${inboundResult.error.message}`)
  if (lastEventsResult.error) queryErrors.push(`events: ${lastEventsResult.error.message}`)

  const queryError = queryErrors.length > 0 ? queryErrors.join(' | ') : null

  // ── Paso 4: Computar conteos por status ─────────────────────────────────
  /*
   * Una sola pasada por el array de quotes — O(n) donde n = quotes del producer.
   * Map<QuoteStatus, number> es más eficiente que múltiples .filter().length.
   */
  const statusCounts = new Map<QuoteStatus, number>()
  for (const quote of quotes) {
    statusCounts.set(quote.status, (statusCounts.get(quote.status) ?? 0) + 1)
  }

  // Helper inline: obtener count de un status sin repetir ?? 0
  const count = (s: QuoteStatus): number => statusCounts.get(s) ?? 0

  const pendingFollowUpCount = count('pending_follow_up')
  const scheduledCount = count('scheduled')
  const pendingApprovalCount = count('pending_approval')
  const contactedCount = count('contacted') + count('contacted_2')
  const noResponseCount = count('no_response') + count('no_response_1')
  const respondedCount = count('responded')
  const interestedCount = count('interested')
  const humanHandoffCount = count('human_handoff')
  const closedWonCount = count('closed_won')
  const closedLostCount = count('closed_lost')
  const optOutQuotesCount = count('opt_out')
  const otherCount = count('paused') + count('cancelled') + count('error')

  // Distribución completa — solo statuses con data, ordenados por count DESC
  const quotesByStatus: StatusCount[] = []
  for (const [status, cnt] of statusCounts.entries()) {
    quotesByStatus.push({ status, count: cnt })
  }
  quotesByStatus.sort((a, b) => b.count - a.count)

  const outboundSimulatedCount = outboundMessages.length
  const inboundSimulatedCount = inboundMessages.length
  const optOutProspectsCount = optOutProspects.length

  // ── Paso 5: Computar tasas ───────────────────────────────────────────────

  // Tasa de respuesta: qué % de mensajes enviados recibieron respuesta
  const responseRate =
    outboundSimulatedCount > 0
      ? Math.round((inboundSimulatedCount / outboundSimulatedCount) * 100)
      : null

  /*
   * Tasa de interés: qué % de prospectos contactados mostraron interés.
   *
   * Denominador: "everContactedCount" — sum de todos los statuses que implican
   * que el prospecto recibió al menos 1 mensaje simulado. No solo los que están
   * actualmente en status='contacted', porque los que avanzaron a respondió/
   * interesado/perdido ya salieron de ese status.
   *
   * Ver GAP DOCUMENTADO al inicio del archivo.
   */
  const everContactedCount =
    count('contacted') +
    count('contacted_2') +
    count('no_response_1') +
    count('no_response') +
    count('responded') +
    count('interested') +
    count('closed_won') +
    count('closed_lost') +
    count('human_handoff') +
    count('opt_out') +
    count('error')

  const interestRate =
    everContactedCount > 0
      ? Math.round((interestedCount / everContactedCount) * 100)
      : null

  // ── Paso 6: Retornar resultado completo ─────────────────────────────────
  return {
    totalQuotes: quotes.length,
    pendingFollowUpCount,
    scheduledCount,
    pendingApprovalCount,
    contactedCount,
    noResponseCount,
    respondedCount,
    interestedCount,
    humanHandoffCount,
    closedWonCount,
    closedLostCount,
    optOutQuotesCount,
    otherCount,
    quotesByStatus,
    optOutProspectsCount,
    outboundSimulatedCount,
    inboundSimulatedCount,
    responseRate,
    interestRate,
    lastEvents: rawEvents,
    error: queryError,
  }
}
