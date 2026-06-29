import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/*
 * INTENCION: Helper server-side para previsualizar que quotes procesaria el scheduler local.
 * Devuelve las cotizaciones en estado 'pending_follow_up' del producer autenticado,
 * separadas en candidatas (opt_out=false) y bloqueadas por opt-out (opt_out=true).
 *
 * QUE ES EL SCHEDULER LOCAL:
 *   En produccion, un cron/job detectaria cotizaciones cuyo umbral de seguimiento
 *   expiro y las moveria a 'scheduled' para que aparezcan en la cola de aprobacion.
 *   En el MVP local no hay cron real. Esta funcion alimenta la pantalla de preview
 *   que permite ejecutar ese paso manualmente desde /dashboard/scheduler.
 *
 * LOGICA DE ELEGIBILIDAD (simplificada para MVP local):
 *   Elegible = status 'pending_follow_up' + prospect opt_out=false.
 *   En produccion se agregaria: follow_up_start_at <= NOW() (si la columna tiene valor)
 *   o created_at + N dias < NOW(). Por ahora: toda quote en 'pending_follow_up' es elegible.
 *
 *   GAP DOCUMENTADO:
 *   La tabla quotes tiene columna 'follow_up_start_at' (TIMESTAMPTZ nullable).
 *   En produccion, el scheduler verificaria si ya paso esa fecha.
 *   En el MVP local, la columna puede ser null (no se setea en createManualQuote).
 *   Para no bloquear el flujo de desarrollo, no filtramos por follow_up_start_at.
 *   Mostramos la fecha en la UI si existe, pero no la usamos como condicion.
 *
 * POR QUE DOS QUERIES SEPARADAS (en lugar de JOIN):
 *   Supabase TypeScript infiere 'never' para .data con select strings que contienen
 *   relaciones anidadas en schemas de 833+ lineas. El patron de dos queries con
 *   type assertions es el estandar de este proyecto.
 *   Ver: lib/outbox/get-local-outbox.ts (patron identico).
 *
 * COLUMNAS VERIFICADAS EN types/database.ts (2026-06-29):
 *   quotes: id, status, insurance_type, risk_description, quoted_amount, currency,
 *           quote_date, follow_up_start_at, insurer_name, prospect_id, producer_id,
 *           created_at, updated_at
 *   prospects: id, full_name, phone, opt_out, opt_out_at, producer_id
 *   Enums confirmados:
 *     quote_status incluye 'pending_follow_up' y 'scheduled'
 *     quote_event_actor incluye 'system', 'producer', 'webhook'
 *
 * SEGURIDAD:
 *   - createClient() usa la sesion del usuario (no service role).
 *   - .eq('producer_id', producerId) + RLS = doble barrera.
 *   - producerId viene de getCurrentProducerContext() (llamador validado).
 *
 * PRIVACIDAD:
 *   - full_name, phone son PII (Ley 18.331, Uruguay).
 *   - Se exponen al producer porque son sus propios clientes.
 *   - No loguear en errores — solo codigos de error de Supabase.
 *
 * Ver: app/dashboard/scheduler/page.tsx (unico llamador)
 * Ver: app/actions/scheduler.ts (Server Action que ejecuta el scheduler)
 * Ver: lib/outbox/get-local-outbox.ts (patron de dos queries — referencia)
 * Ver: types/database.ts (columnas y enums verificados)
 */

// ============================================================
// Tipos locales para las queries
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']
type QuoteStatus = Database['public']['Enums']['quote_status']
type InsuranceType = Database['public']['Enums']['insurance_type']

/**
 * Columnas de quote que necesitamos para la preview del scheduler.
 * Incluimos follow_up_start_at para mostrarlo en la UI (informativo).
 */
type SchedulerQuoteRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'insurance_type'
  | 'risk_description'
  | 'quoted_amount'
  | 'currency'
  | 'quote_date'
  | 'follow_up_start_at'
  | 'insurer_name'
  | 'prospect_id'
  | 'created_at'
>

/**
 * Columnas de prospect para determinar opt_out y mostrar datos en la UI.
 */
type SchedulerProspectRow = Pick<
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
 * Candidata para el scheduler: quote en 'pending_follow_up' con prospect sin opt-out.
 * El scheduler puede moverla a 'scheduled'.
 */
export type SchedulerCandidate = {
  quoteId: string
  quoteStatus: QuoteStatus
  insuranceType: InsuranceType
  riskDescription: string | null
  quotedAmount: number | null
  currency: string
  quoteDate: string
  followUpStartAt: string | null
  insurerName: string | null
  createdAt: string
  prospectId: string
  prospectName: string
  prospectPhone: string
  prospectOptOut: boolean
}

export type SchedulerPreviewResult = {
  /**
   * Quotes elegibles para el scheduler: pending_follow_up + opt_out=false.
   * El scheduler puede moverlas a 'scheduled'.
   */
  candidates: SchedulerCandidate[]

  /**
   * Quotes en pending_follow_up cuyo prospect tiene opt_out=true.
   * El scheduler NO las procesa — se muestran al producer para que las
   * cierre manualmente (closed_lost o cancelled).
   */
  blockedByOptOut: SchedulerCandidate[]

  /** Error de query, si ocurrio. null si todo fue bien. */
  error: string | null
}

// ============================================================
// Status elegibles para el scheduler
// ============================================================

/**
 * El scheduler busca quotes en 'pending_follow_up'.
 * Este es el estado inicial de toda quote recien creada.
 *
 * En produccion, el cron tambien procesaria 'no_response_1' para M2,
 * pero en el MVP local manejamos solo M1 (primer seguimiento).
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */
const SCHEDULER_ELIGIBLE_STATUS: QuoteStatus = 'pending_follow_up'

// ============================================================
// Implementacion
// ============================================================

/**
 * INTENCION: Obtener la preview del scheduler — que quotes procesaria si se ejecuta.
 *
 * @param producerId UUID del producer del usuario autenticado.
 */
export async function getLocalSchedulerPreview(
  producerId: string
): Promise<SchedulerPreviewResult> {
  const supabase = await createClient()

  // ── Query 1: quotes en pending_follow_up del producer ───────────────────
  /*
   * FILTROS:
   *   1. producer_id = producerId — solo quotes del producer autenticado.
   *   2. status = 'pending_follow_up' — unico estado que procesa el scheduler M1.
   *
   * ORDEN: created_at ASC — las mas antiguas primero (mas urgentes de procesar).
   *
   * TYPE ASSERTION: Supabase TS infiere 'never' para .data en schemas complejos.
   * El cast a SchedulerQuoteRow[] | null es seguro porque los campos del select
   * coinciden exactamente con el tipo definido arriba.
   */
  const quotesResult = await supabase
    .from('quotes')
    .select(
      'id, status, insurance_type, risk_description, quoted_amount, currency, quote_date, follow_up_start_at, insurer_name, prospect_id, created_at'
    )
    .eq('producer_id', producerId)
    .eq('status', SCHEDULER_ELIGIBLE_STATUS)
    .order('created_at', { ascending: true })

  const quotesData = quotesResult.data as SchedulerQuoteRow[] | null

  if (quotesResult.error) {
    console.error('[scheduler:preview] Error querying quotes — code:', quotesResult.error.code)
    return { candidates: [], blockedByOptOut: [], error: 'Error al obtener las cotizaciones candidatas.' }
  }

  if (!quotesData || quotesData.length === 0) {
    return { candidates: [], blockedByOptOut: [], error: null }
  }

  // ── Query 2: prospects de esas quotes ────────────────────────────────────
  /*
   * Un solo SELECT con IN para evitar el patron N+1.
   * Necesitamos opt_out para separar candidatas de bloqueadas.
   */
  const prospectIds = [...new Set(quotesData.map((q) => q.prospect_id))]

  const prospectsResult = await supabase
    .from('prospects')
    .select('id, full_name, phone, opt_out')
    .eq('producer_id', producerId)
    .in('id', prospectIds)

  const prospectsData = prospectsResult.data as SchedulerProspectRow[] | null

  if (prospectsResult.error) {
    // Error no critico: continuamos. Sin datos de prospect, asumimos opt_out=false.
    // El Server Action del scheduler re-verifica opt_out en el servidor.
    console.error('[scheduler:preview] Error querying prospects — code:', prospectsResult.error.code)
  }

  // Mapa de prospects por id para O(1) lookup
  const prospectMap = new Map<string, SchedulerProspectRow>()
  for (const p of prospectsData ?? []) {
    prospectMap.set(p.id, p)
  }

  // ── Combinar y separar candidatas vs bloqueadas ──────────────────────────
  const candidates: SchedulerCandidate[] = []
  const blockedByOptOut: SchedulerCandidate[] = []

  for (const quote of quotesData) {
    const prospect = prospectMap.get(quote.prospect_id)

    const candidate: SchedulerCandidate = {
      quoteId: quote.id,
      quoteStatus: quote.status,
      insuranceType: quote.insurance_type,
      riskDescription: quote.risk_description,
      quotedAmount: quote.quoted_amount,
      currency: quote.currency,
      quoteDate: quote.quote_date,
      followUpStartAt: quote.follow_up_start_at,
      insurerName: quote.insurer_name,
      createdAt: quote.created_at,
      prospectId: quote.prospect_id,
      prospectName: prospect?.full_name ?? 'Prospect desconocido',
      prospectPhone: prospect?.phone ?? '—',
      prospectOptOut: prospect?.opt_out ?? false,
    }

    /*
     * Separacion por opt_out:
     *   opt_out=false → candidata (el scheduler la puede procesar)
     *   opt_out=true  → bloqueada (el scheduler NO la toca — no contactar)
     *
     * Si prospect no encontrado (error de query), asumimos opt_out=false
     * para no bloquear innecesariamente. El Server Action re-verifica.
     */
    if (candidate.prospectOptOut) {
      blockedByOptOut.push(candidate)
    } else {
      candidates.push(candidate)
    }
  }

  return { candidates, blockedByOptOut, error: null }
}
