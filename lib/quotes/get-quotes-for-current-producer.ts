import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/*
 * INTENCION: Obtener todas las cotizaciones activas del producer al que pertenece
 * el usuario autenticado. Devuelve las quotes junto con el nombre del prospect
 * correspondiente para que la UI pueda mostrar la lista sin hacer queries adicionales.
 *
 * FLUJO:
 *   1. Query a quotes filtrando por producer_id (RLS tambien filtra — doble barrera).
 *   2. Si hay quotes, obtiene los nombres de los prospects en una segunda query.
 *   3. Combina quotes + prospect_name en un objeto enriquecido.
 *   4. Retorna resultado tipado con error y hasQuotes flag.
 *
 * ENTRADAS:
 *   @param producerId {string} — UUID del producer. Obtenido del producer context
 *     por el llamador (app/dashboard/quotes/page.tsx). No se valida el formato
 *     aqui — el llamador ya lo obtuvo de una fuente confiable (producer_members).
 *
 * SALIDAS:
 *   @returns {QuotesResult} — Discriminated union:
 *     - { quotes: QuoteWithProspect[]; error: null; hasQuotes: boolean } si exitoso
 *     - { quotes: null; error: 'query_failed'; hasQuotes: false } si Supabase falla
 *
 * ERRORES POSIBLES:
 *   - Error de Supabase en quotes query → retorna error: 'query_failed'
 *   - Error de Supabase en prospects query → los nombres aparecen como 'Prospecto desconocido'
 *     (degradacion elegante — la lista de quotes igual se muestra)
 *
 * NOTA SOBRE TYPE ASSERTIONS:
 *   Mismo problema que en get-current-producer-context.ts: Supabase TypeScript infiere
 *   el tipo de data como 'never' con select strings especificos sobre el schema generado.
 *   Usamos type assertions explicitas ('as') para evitar errores de build.
 *   Las assertions son seguras porque los campos reflejan exactamente la estructura SQL.
 *   Ver: lib/producers/get-current-producer-context.ts (mismo patron, misma razon)
 *
 * SEGURIDAD:
 *   - No usa service role (createClient() usa el cliente del usuario).
 *   - RLS de quotes: `USING (producer_id IN (SELECT get_my_producer_ids()))`.
 *   - La query .eq('producer_id', producerId) es redundante con RLS pero mejora performance.
 *   - Los full_name de prospects son PII. No loguear en texto plano.
 *
 * PRIVACIDAD:
 *   - full_name y phone de prospects son datos PII (Ley 18.331, Uruguay).
 *   - Este helper solo trae full_name (para mostrar en la UI del propio producer).
 *   - No loguear nombres en errores ni en consola de produccion.
 *
 * Ver: supabase/migrations/001_base_multitenant_schema.sql (tablas quotes, prospects)
 * Ver: supabase/migrations/002_grants.sql (GRANTs que habilitan las queries autenticadas)
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 */

// ============================================================
// Tipos locales para las queries (necesarios por limitacion de Supabase TS)
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type QuoteStatus = Database['public']['Enums']['quote_status']
type InsuranceType = Database['public']['Enums']['insurance_type']

/**
 * Subconjunto de columnas de quotes que se muestran en la lista del dashboard.
 * No incluye campos sensibles como approved_message ni internal_notes
 * (aunque el RLS ya limita el acceso, la defensa en profundidad no trae datos innecesarios).
 */
type QuoteSelectRow = Pick<
  QuoteRow,
  | 'id'
  | 'insurance_type'
  | 'quote_date'
  | 'quoted_amount'
  | 'currency'
  | 'status'
  | 'prospect_id'
  | 'risk_description'
  | 'insurer_name'
  | 'origin_channel'
  | 'created_at'
>

/**
 * Prospect name row — solo full_name para mostrar en la lista.
 * No incluimos phone (PII critico) porque no se necesita en la lista.
 */
type ProspectNameRow = {
  id: string
  full_name: string
}

// ============================================================
// Tipos de retorno publicos
// ============================================================

/**
 * Quote enriquecida con el nombre del prospect.
 * Es el tipo que recibe el componente QuotesList para renderizar la tabla.
 */
export type QuoteWithProspect = QuoteSelectRow & {
  /**
   * Nombre del prospect. Es PII (full_name de la tabla prospects).
   * Mostrarlo al producer es legitimo — es su propio cliente.
   * No loguear ni enviar a servicios de terceros.
   */
  prospectName: string
}

export type QuotesResult = {
  quotes: QuoteWithProspect[] | null
  error: null | 'query_failed'
  hasQuotes: boolean
}

// ============================================================
// Implementacion
// ============================================================

/**
 * INTENCION: Obtener las quotes del producer y enriquecerlas con el nombre del prospect.
 *
 * FLUJO:
 *   1. Query quotes filtradas por producer_id.
 *   2. Si hay quotes, obtener nombres de prospects en una segunda query.
 *   3. Combinar y retornar.
 *
 * @param producerId UUID del producer (obtenido del producer context por el llamador)
 */
export async function getQuotesForCurrentProducer(
  producerId: string
): Promise<QuotesResult> {
  const supabase = await createClient()

  // ── Query 1: quotes del producer ─────────────────────────────────────────
  /*
   * Ordenamos por created_at DESC para mostrar las mas recientes primero.
   * Filtramos por producer_id para aprovechar el indice idx_quotes_producer_status.
   * RLS aplica adicionalmente — doble barrera.
   *
   * Type assertion necesaria: Supabase TS infiere 'never' con select strings
   * complejos sobre el schema generado. Ver nota en el header del archivo.
   */
  const quotesResult = await supabase
    .from('quotes')
    .select(
      'id, insurance_type, quote_date, quoted_amount, currency, status, prospect_id, risk_description, insurer_name, origin_channel, created_at'
    )
    .eq('producer_id', producerId)
    .order('created_at', { ascending: false })

  const quotes = quotesResult.data as QuoteSelectRow[] | null

  if (quotesResult.error) {
    // No logueamos datos del producer. Solo el codigo de error de Supabase.
    console.error('[quotes] Error querying quotes — code:', quotesResult.error.code)
    return { quotes: null, error: 'query_failed', hasQuotes: false }
  }

  if (!quotes || quotes.length === 0) {
    /*
     * Estado normal en desarrollo local antes de crear quotes.
     * No es un error — el dashboard mostrara estado vacio informativo.
     */
    return { quotes: [], error: null, hasQuotes: false }
  }

  // ── Query 2: nombres de prospects para las quotes ─────────────────────────
  /*
   * Extraemos los prospect_id unicos de las quotes para hacer una sola query
   * en lugar de N queries (una por quote). Evita el problema N+1.
   *
   * PRIVACIDAD: solo traemos id + full_name.
   * phone (PII critico) y email (PII) no se necesitan en la lista de quotes.
   *
   * Si esta query falla, degradamos elegantemente: las quotes se muestran igual
   * pero con 'Prospecto desconocido' como nombre. Mejor que no mostrar nada.
   */
  const uniqueProspectIds = [...new Set(quotes.map((q) => q.prospect_id))]

  const prospectsResult = await supabase
    .from('prospects')
    .select('id, full_name')
    .in('id', uniqueProspectIds)

  const prospects = prospectsResult.data as ProspectNameRow[] | null

  if (prospectsResult.error) {
    // Degradacion elegante: no falla la pagina completa si solo fallan los nombres.
    console.error(
      '[quotes] Error querying prospect names — code:',
      prospectsResult.error.code
    )
  }

  /*
   * Mapa de prospect_id → full_name para O(1) lookup al combinar.
   * Si prospects es null (query fallo), el map queda vacio y los nombres
   * aparecen como 'Prospecto desconocido'.
   */
  const prospectNameMap = new Map(
    (prospects ?? []).map((p) => [p.id, p.full_name])
  )

  // ── Combinar quotes + prospect_name ──────────────────────────────────────
  const quotesWithProspect: QuoteWithProspect[] = quotes.map((quote) => ({
    ...quote,
    prospectName: prospectNameMap.get(quote.prospect_id) ?? 'Prospecto desconocido',
  }))

  return { quotes: quotesWithProspect, error: null, hasQuotes: quotesWithProspect.length > 0 }
}

// ============================================================
// Helpers utilitarios para la UI
// ============================================================

/**
 * INTENCION: Traducir el enum quote_status al español para la UI del producer.
 *
 * DECISION TECNICA: Se mantiene como una funcion de presentacion, no como un
 * campo en la base de datos. Los enums en DB son en ingles para consistencia
 * con DATA_MODEL.md v2.0. La traduccion ocurre solo en la capa de presentacion.
 */
export function formatQuoteStatus(status: QuoteStatus): string {
  const labels: Record<QuoteStatus, string> = {
    pending_follow_up: 'Esperando seguimiento',
    scheduled: 'Programada',
    pending_approval: 'Pendiente aprobacion',
    contacted: 'Contactado',
    no_response_1: 'Sin respuesta (1er intento)',
    contacted_2: 'Contactado (2do intento)',
    responded: 'Respondio',
    interested: 'Interesado',
    human_handoff: 'Derivado al producer',
    closed_won: 'Cerrada — Ganada',
    closed_lost: 'Cerrada — Perdida',
    no_response: 'Sin respuesta',
    paused: 'Pausada',
    cancelled: 'Cancelada',
    opt_out: 'Opt-out (no contactar)',
    error: 'Error tecnico',
  }
  return labels[status] ?? status
}

/**
 * INTENCION: Traducir el enum insurance_type al español para la UI.
 */
export function formatInsuranceType(type: InsuranceType): string {
  const labels: Record<InsuranceType, string> = {
    auto: 'Automotor',
    home: 'Hogar',
    life: 'Vida',
    commercial: 'Comercial',
    other: 'Otro',
  }
  return labels[type] ?? type
}
