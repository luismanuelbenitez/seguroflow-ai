'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import type { Database } from '@/types/database'

/*
 * INTENCION: Server Action para ejecutar el scheduler local manualmente.
 * Simula el cron/job de produccion que detecta cotizaciones pendientes
 * y las mueve al estado 'scheduled' para que aparezcan en la cola de aprobacion.
 *
 * NO envia WhatsApp. NO llama IA. NO aplica migraciones. Solo registra localmente.
 *
 * QUE HACE runLocalScheduler():
 *   1. Valida sesion y producer context.
 *   2. Busca quotes en 'pending_follow_up' del producer.
 *   3. Obtiene prospects de esas quotes para verificar opt_out.
 *   4. Separa elegibles (opt_out=false) de bloqueadas (opt_out=true).
 *   5. Para las elegibles:
 *      a. UPDATE quotes.status: 'pending_follow_up' → 'scheduled' (batch).
 *      b. INSERT quote_events: event_type='follow_up_scheduled', actor='system'.
 *   6. Retorna resumen: { processedCount, skippedOptOutCount, errors }.
 *   NO hace redirect — el resultado se muestra inline en la UI.
 *
 * POR QUE STATUS DESTINO ES 'scheduled':
 *   'scheduled' es el estado que indica que la cotizacion esta lista para
 *   que el producer apruebe el mensaje M1. La cola de aprobacion (/dashboard/approvals)
 *   ya muestra quotes en 'scheduled' — las nuevas aparecen ahi sin cambios adicionales.
 *   Ver: lib/quotes/get-approval-queue.ts (query que incluye 'scheduled').
 *
 * POR QUE event_type='follow_up_scheduled':
 *   Ya existe en el mapa formatEventType de /dashboard/quotes/[quoteId]/page.tsx:
 *   'follow_up_scheduled' → 'Seguimiento programado'. Dot verde en el timeline.
 *   No requiere cambios en el detail page.
 *
 * POR QUE actor='system':
 *   El scheduler es un proceso automatico (en produccion seria un cron).
 *   Usar actor='system' es semanticamente correcto y esta en el enum:
 *   quote_event_actor: system | producer | webhook.
 *
 * BATCH UPDATE y BATCH INSERT:
 *   Para eficiencia, actualizamos TODAS las quotes elegibles en un solo UPDATE con
 *   .in('id', eligibleIds). Luego insertamos TODOS los eventos en un solo INSERT.
 *   Si el batch UPDATE falla, no insertamos eventos (la DB quedo sin cambios).
 *   Si el batch INSERT de eventos falla, las quotes ya fueron actualizadas — solo
 *   falla el audit log, no el estado. Degradacion elegante.
 *
 * PATRON (supabase.from('quotes') as any).update():
 *   Identico al patron establecido en app/actions/outbox.ts y app/actions/approvals.ts.
 *   El .update({...} as any) no funciona para 'quotes' — se castea el builder completo.
 *
 * FIRMA COMPATIBLE CON useActionState (React 19):
 *   (prevState: S, formData: FormData) => Promise<S>
 *
 * SEGURIDAD:
 *   - No usa service role. createClient() usa la sesion del usuario.
 *   - Valida sesion y producer context ANTES de cualquier operacion.
 *   - .eq('producer_id', producerId) + RLS = doble barrera en TODAS las queries.
 *   - Valida opt_out en servidor (doble barrera con la UI de preview).
 *   - El UPDATE de status usa .in('id', eligibleIds) + .eq('producer_id', producerId)
 *     para prevenir que se actualicen quotes de otro producer si RLS fallara.
 *
 * PRIVACIDAD:
 *   - No loguear full_name ni phone. Solo codigos de error de Supabase.
 *
 * Ver: lib/scheduler/get-local-scheduler-preview.ts (preview que alimenta la UI)
 * Ver: components/dashboard/run-scheduler-button.tsx (client component)
 * Ver: app/dashboard/scheduler/page.tsx (pagina del scheduler)
 * Ver: app/dashboard/approvals/page.tsx (donde aparecen las quotes despues del scheduler)
 * Ver: types/database.ts (columnas reales y enums verificados 2026-06-29)
 */

// ============================================================
// Tipos de retorno
// ============================================================

/**
 * Resultado del scheduler local.
 * ran=false: estado inicial (no se ejecuto todavia).
 * ran=true: se ejecuto — ver processedCount, skippedOptOutCount, errors.
 */
export type SchedulerResult = {
  ran: boolean
  message: string
  isError: boolean
  processedCount: number
  skippedOptOutCount: number
  /** IDs de quotes que fallaron su UPDATE o INSERT. Para debugging. */
  errorIds: string[]
}

/**
 * Estado inicial para useActionState en RunSchedulerButton.
 */
export const SCHEDULER_INITIAL_STATE: SchedulerResult = {
  ran: false,
  message: '',
  isError: false,
  processedCount: 0,
  skippedOptOutCount: 0,
  errorIds: [],
}

// ============================================================
// Tipos locales para queries
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']
type QuoteStatus = Database['public']['Enums']['quote_status']

/**
 * Columnas de quote necesarias para validar elegibilidad y procesar el scheduler.
 */
type SchedulerQuoteRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'prospect_id'
>

/**
 * Columnas de prospect necesarias para verificar opt_out.
 */
type SchedulerProspectRow = Pick<
  ProspectRow,
  | 'id'
  | 'opt_out'
>

// ============================================================
// Constantes
// ============================================================

/**
 * Status del que parte el scheduler.
 * El scheduler busca quotes en este estado para procesarlas.
 */
const SCHEDULER_ELIGIBLE_STATUS: QuoteStatus = 'pending_follow_up'

/**
 * Status objetivo despues del scheduler.
 * 'scheduled' indica que la cotizacion esta lista para aprobacion del M1.
 * La cola de aprobacion (/dashboard/approvals) muestra quotes en este estado.
 * Ver: lib/quotes/get-approval-queue.ts — incluye 'scheduled' como estado elegible.
 */
const SCHEDULER_TARGET_STATUS: QuoteStatus = 'scheduled'

/**
 * Descripcion del evento para quote_events.
 * Texto fijo que aparece en el timeline de la cotizacion.
 */
const SCHEDULER_EVENT_DESCRIPTION =
  'Scheduler local simulo que la cotizacion quedo lista para seguimiento. ' +
  'En produccion, un cron detectaria que el umbral de seguimiento expiro.'

// ============================================================
// Server Action
// ============================================================

/**
 * INTENCION: Ejecutar el scheduler local — mover quotes de 'pending_follow_up' a 'scheduled'.
 *
 * NO envia WhatsApp. NO llama IA. Solo actualiza status y registra eventos.
 *
 * @param _prevState Estado anterior de useActionState (ignorado — requerido por la firma)
 * @param _formData FormData del formulario (no se usan campos del form)
 */
export async function runLocalScheduler(
  _prevState: SchedulerResult,
  _formData: FormData
): Promise<SchedulerResult> {
  const supabase = await createClient()

  // ── Paso 1: Validar sesion y producer context ────────────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: 'Tu sesion expiro. Recarga la pagina e inicia sesion nuevamente.',
      isError: true,
    }
  }

  if (!ctx.hasProducer || !ctx.membership) {
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: 'Tu usuario no esta asociado a ningun producer. Ejecuta el seed local primero.',
      isError: true,
    }
  }

  const producerId = ctx.membership.producer_id

  // ── Paso 2: Obtener quotes en pending_follow_up ──────────────────────────
  /*
   * Filtramos por (producer_id, status) para obtener solo las quotes
   * candidatas del producer autenticado. RLS aplica adicionalmente.
   *
   * TYPE ASSERTION: Supabase TS infiere 'never' para .data en schemas complejos.
   * El cast es seguro — los campos del select coinciden con SchedulerQuoteRow.
   */
  const quotesResult = await supabase
    .from('quotes')
    .select('id, status, prospect_id')
    .eq('producer_id', producerId)
    .eq('status', SCHEDULER_ELIGIBLE_STATUS)

  const quotesData = quotesResult.data as SchedulerQuoteRow[] | null

  if (quotesResult.error) {
    console.error('[scheduler:action] Error querying quotes — code:', quotesResult.error.code)
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: 'Error al obtener las cotizaciones candidatas. Ver logs del servidor.',
      isError: true,
    }
  }

  if (!quotesData || quotesData.length === 0) {
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: 'No hay cotizaciones en seguimiento pendiente. Crea una nueva cotizacion primero.',
      isError: false,
      processedCount: 0,
    }
  }

  // ── Paso 3: Obtener prospects — verificar opt_out ────────────────────────
  /*
   * Doble barrera de opt_out: la UI de preview muestra las bloqueadas,
   * pero el Server Action re-verifica en el servidor.
   * El opt_out puede cambiar entre el render de la pagina y el submit del form.
   */
  const prospectIds = [...new Set(quotesData.map((q) => q.prospect_id))]

  const prospectsResult = await supabase
    .from('prospects')
    .select('id, opt_out')
    .eq('producer_id', producerId)
    .in('id', prospectIds)

  const prospectsData = prospectsResult.data as SchedulerProspectRow[] | null

  if (prospectsResult.error) {
    console.error('[scheduler:action] Error querying prospects — code:', prospectsResult.error.code)
    // Error no critico: si no podemos verificar opt_out, abortamos por seguridad.
    // No procesar quotes sin saber si el prospect tiene opt-out — mejor fallar que contactar alguien que no quiere.
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: 'Error al verificar el estado de opt-out de los prospectos. Intenta nuevamente.',
      isError: true,
    }
  }

  // Mapa de prospect_id → opt_out para O(1) lookup
  const optOutMap = new Map<string, boolean>()
  for (const p of prospectsData ?? []) {
    optOutMap.set(p.id, p.opt_out)
  }

  // ── Paso 4: Separar elegibles de bloqueados ─────────────────────────────
  /*
   * elegibleIds: quotes cuyo prospect NO tiene opt_out — el scheduler las procesa.
   * skippedCount: quotes cuyo prospect tiene opt_out — el scheduler las omite.
   *
   * Si prospect no encontrado (no deberia ocurrir por RLS + doble barrera),
   * lo tratamos como opt_out=false para no bloquear innecesariamente.
   * El producer puede verificar manualmente.
   */
  const eligibleIds: string[] = []
  let skippedOptOutCount = 0

  for (const quote of quotesData) {
    const isOptOut = optOutMap.get(quote.prospect_id) ?? false
    if (isOptOut) {
      skippedOptOutCount++
    } else {
      eligibleIds.push(quote.id)
    }
  }

  if (eligibleIds.length === 0) {
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: `No hay cotizaciones elegibles. ${skippedOptOutCount} bloqueadas por opt-out.`,
      isError: false,
      processedCount: 0,
      skippedOptOutCount,
    }
  }

  // ── Paso 5a: Batch UPDATE quotes.status → 'scheduled' ───────────────────
  /*
   * INTENCION: Mover todas las quotes elegibles a 'scheduled' en un solo UPDATE.
   * Mas eficiente que N UPDATEs individuales.
   *
   * FILTROS:
   *   .in('id', eligibleIds) — solo las quotes elegibles
   *   .eq('producer_id', producerId) — barrera adicional de propiedad
   *   .eq('status', SCHEDULER_ELIGIBLE_STATUS) — previene race conditions
   *     (si alguien cambio el status entre el Paso 2 y aqui, esta barrera lo protege)
   *
   * PATRON (supabase.from('quotes') as any):
   *   Identico al patron en app/actions/outbox.ts — el UPDATE arg se infiere como 'never'.
   *   El cast del builder completo es el workaround establecido.
   */
  const updateResult = await (supabase.from('quotes') as any)
    .update({ status: SCHEDULER_TARGET_STATUS })
    .in('id', eligibleIds)
    .eq('producer_id', producerId)
    .eq('status', SCHEDULER_ELIGIBLE_STATUS)

  if (updateResult.error) {
    console.error('[scheduler:action] Error batch-updating quotes — code:', updateResult.error?.code)
    return {
      ...SCHEDULER_INITIAL_STATE,
      ran: true,
      message: 'Error al actualizar el estado de las cotizaciones. Ver logs del servidor.',
      isError: true,
      skippedOptOutCount,
    }
  }

  // ── Paso 5b: Batch INSERT quote_events (audit trail) ────────────────────
  /*
   * INTENCION: Registrar un evento 'follow_up_scheduled' por cada quote procesada.
   * Supabase soporta INSERT de multiples registros en una sola llamada.
   *
   * VALORES POR EVENTO:
   *   event_type: 'follow_up_scheduled' — ya mapeado en formatEventType del detail page.
   *     → label 'Seguimiento programado', dot verde en el timeline.
   *   actor: 'system' — el scheduler es un proceso automatico (cron en produccion).
   *   previous_status: 'pending_follow_up' — validado en el Paso 2.
   *   new_status: 'scheduled' — el status objetivo del scheduler.
   *   description: SCHEDULER_EVENT_DESCRIPTION — texto informativo para el timeline.
   *
   * NOTA SOBRE metadata EN quote_events:
   *   La tabla quote_events NO tiene columna metadata en el schema v2.0.
   *   La informacion de simulacion va en 'description'.
   *   Ver: types/database.ts — quote_events.Row (columnas reales).
   *
   * PATRON '{...} as any':
   *   El INSERT de quote_events con {obj} as any funciona (a diferencia del UPDATE
   *   de quotes donde hay que castear el builder). Ver: app/actions/outbox.ts.
   *
   * DEGRADACION ELEGANTE:
   *   Si el INSERT de eventos falla, las quotes ya fueron actualizadas en Paso 5a.
   *   Solo falla el audit log — el flujo principal (cambio de status) ya ocurrio.
   *   Logueamos el error para debugging pero no retornamos error al usuario.
   */
  const events = eligibleIds.map((quoteId) => ({
    producer_id: producerId,
    quote_id: quoteId,
    event_type: 'follow_up_scheduled',
    actor: 'system' as const,
    previous_status: SCHEDULER_ELIGIBLE_STATUS,
    new_status: SCHEDULER_TARGET_STATUS,
    description: SCHEDULER_EVENT_DESCRIPTION,
  }))

  const eventsResult = await supabase
    .from('quote_events')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(events as any)

  if (eventsResult.error) {
    // Error no critico — las quotes ya se actualizaron. Solo falla el audit log.
    console.error(
      '[scheduler:action] Error batch-inserting quote_events — code:',
      eventsResult.error.code
    )
  }

  // ── Exito ────────────────────────────────────────────────────────────────
  /*
   * Retornamos el resumen al Client Component (RunSchedulerButton).
   * NO hacemos redirect — el resultado se muestra inline debajo del boton.
   * El usuario puede recargar la pagina para ver la lista actualizada.
   *
   * NOTA: despues del scheduler, las quotes aparecen en /dashboard/approvals
   * porque la cola de aprobacion ya incluye el status 'scheduled'.
   */
  const processedCount = eligibleIds.length
  const hadEventError = eventsResult.error !== null

  return {
    ran: true,
    message: hadEventError
      ? `Procesadas ${processedCount} cotizaciones (${skippedOptOutCount} omitidas por opt-out). Advertencia: el registro de eventos en el timeline fallo — ver logs.`
      : `Procesadas ${processedCount} cotizaciones. ${skippedOptOutCount > 0 ? `${skippedOptOutCount} omitidas por opt-out.` : ''} Ahora aparecen en la cola de aprobacion.`,
    isError: false,
    processedCount,
    skippedOptOutCount,
    errorIds: [],
  }
}
