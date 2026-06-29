import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/*
 * INTENCION: Obtener el detalle completo de una cotizacion con su prospect y timeline
 * de eventos. Usada por la vista de detalle /dashboard/quotes/[quoteId].
 *
 * FLUJO:
 *   1. Query la quote por id + producer_id (verifica propiedad via RLS + eq).
 *   2. Query el prospect asociado para mostrar datos de contacto.
 *   3. Query quote_events ordenados ascendente (cronologico para el timeline).
 *   4. Retorna un objeto tipado con los tres resultados.
 *
 * ENTRADAS:
 *   @param quoteId {string} — UUID de la cotizacion a buscar.
 *   @param producerId {string} — UUID del producer del usuario autenticado.
 *     El llamador (la pagina) ya lo obtuvo de getCurrentProducerContext().
 *     Se pasa como parametro para no re-llamar getCurrentProducerContext() aqui.
 *
 * SALIDAS:
 *   @returns {QuoteDetailResult} — discriminated union:
 *     - notFound: true → la quote no existe o no pertenece al producer.
 *       NO revelar si existe en otro producer (seguridad — information disclosure).
 *     - quote/prospect/events con datos si se encontro.
 *     - error con mensaje descriptivo si Supabase falla.
 *
 * NOTA SOBRE metadata EN quote_events:
 *   La tabla quote_events NO tiene columna metadata en el schema v2.0.
 *   Ver: types/database.ts — quote_events.Row (columnas reales).
 *   El spec menciona "metadata si existe" — en este caso no existe.
 *   Columnas reales de quote_events: id, producer_id, quote_id, event_type,
 *   actor, previous_status, new_status, description, created_at.
 *
 * NOTA SOBRE TYPE ASSERTIONS:
 *   Mismo patron que get-approval-queue.ts y get-quotes-for-current-producer.ts.
 *   Supabase TS infiere 'never' para .data con select strings sobre schema complejo.
 *   Las assertions son seguras: reflejan exactamente las columnas del schema SQL.
 *
 * SEGURIDAD:
 *   - createClient() usa la sesion del usuario (no service role).
 *   - .eq('producer_id', producerId) + RLS = doble barrera de propiedad.
 *   - Si la quote no existe o pertenece a otro producer, maybeSingle() devuelve null.
 *   - No revelamos informacion sobre quotes de otros producers.
 *
 * PRIVACIDAD:
 *   - full_name, phone, email de prospects son PII (Ley 18.331, Uruguay).
 *   - Se exponen al producer porque son sus propios clientes.
 *   - No loguear en texto plano en errores.
 *
 * Ver: app/dashboard/quotes/[quoteId]/page.tsx (unico llamador)
 * Ver: types/database.ts (columnas reales de cada tabla)
 * Ver: docs/05-architecture/DATA_MODEL.md
 */

// ============================================================
// Tipos locales para las queries
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']
type QuoteEventRow = Database['public']['Tables']['quote_events']['Row']
type QuoteStatus = Database['public']['Enums']['quote_status']
type InsuranceType = Database['public']['Enums']['insurance_type']
type QuoteEventActor = Database['public']['Enums']['quote_event_actor']

/**
 * Todas las columnas de la quote para la vista de detalle.
 * En contraste con la lista (que omite approved_message y internal_notes),
 * aqui si las mostramos porque el producer esta viendo una quote especifica.
 */
type QuoteDetailRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'insurance_type'
  | 'risk_description'
  | 'quoted_amount'
  | 'currency'
  | 'quote_date'
  | 'expiry_date'
  | 'follow_up_start_at'
  | 'approved_message'
  | 'internal_notes'
  | 'origin_channel'
  | 'insurer_name'
  | 'prospect_id'
  | 'producer_id'
  | 'created_at'
  | 'updated_at'
>

/**
 * Datos del prospect para la vista de detalle.
 * Incluye email y consent_status ademas del nombre y telefono.
 */
type ProspectDetailRow = Pick<
  ProspectRow,
  | 'id'
  | 'full_name'
  | 'phone'
  | 'email'
  | 'opt_out'
  | 'opt_out_at'
  | 'consent_status'
>

/**
 * Columnas reales de quote_events.
 * NOTA: NO existe columna 'metadata' en este schema.
 * Ver: types/database.ts — quote_events.Row.
 */
type QuoteEventDetailRow = Pick<
  QuoteEventRow,
  | 'id'
  | 'event_type'
  | 'actor'
  | 'previous_status'
  | 'new_status'
  | 'description'
  | 'created_at'
>

// ============================================================
// Tipos de retorno publicos
// ============================================================

export type { QuoteDetailRow, ProspectDetailRow, QuoteEventDetailRow }
export type { QuoteStatus, InsuranceType, QuoteEventActor }

export type QuoteDetailResult =
  | {
      notFound: true
      quote: null
      prospect: null
      events: []
      error: null
    }
  | {
      notFound: false
      quote: QuoteDetailRow
      prospect: ProspectDetailRow | null
      events: QuoteEventDetailRow[]
      error: null
    }
  | {
      notFound: false
      quote: null
      prospect: null
      events: []
      error: string
    }

// ============================================================
// Implementacion
// ============================================================

/**
 * INTENCION: Obtener la quote, su prospect y su timeline de eventos.
 *
 * @param quoteId UUID de la cotizacion
 * @param producerId UUID del producer del usuario autenticado
 */
export async function getQuoteDetail(
  quoteId: string,
  producerId: string
): Promise<QuoteDetailResult> {
  const supabase = await createClient()

  // ── Query 1: la quote ─────────────────────────────────────────────────────
  /*
   * Filtramos por id + producer_id para garantizar que la quote pertenezca
   * al producer del usuario. Si no existe o es de otro producer, data es null.
   *
   * SEGURIDAD: Nunca revelar al cliente si la quote existe en otro producer.
   * Si data es null, retornamos notFound: true sin distinguir "no existe" de
   * "existe pero es de otro producer". Esto previene information disclosure.
   *
   * Type assertion: Supabase TS infiere 'never' para .data con select strings.
   * Ver: get-approval-queue.ts (misma razon, mismo workaround).
   */
  const quoteResult = await supabase
    .from('quotes')
    .select(
      'id, status, insurance_type, risk_description, quoted_amount, currency, quote_date, expiry_date, follow_up_start_at, approved_message, internal_notes, origin_channel, insurer_name, prospect_id, producer_id, created_at, updated_at'
    )
    .eq('id', quoteId)
    .eq('producer_id', producerId)
    .maybeSingle()

  const quoteData = quoteResult.data as QuoteDetailRow | null

  if (quoteResult.error) {
    console.error('[quote-detail] Error querying quote — code:', quoteResult.error.code)
    return { notFound: false, quote: null, prospect: null, events: [], error: 'Error al obtener la cotizacion.' }
  }

  if (!quoteData) {
    // No existe para este producer — respuesta identica si es otra del producer o si no existe.
    return { notFound: true, quote: null, prospect: null, events: [] , error: null }
  }

  // ── Query 2: prospect de la quote ─────────────────────────────────────────
  /*
   * Buscamos el prospect por id + producer_id para mantenernos dentro del scope
   * del producer autenticado. RLS aplica adicionalmente.
   *
   * Si esta query falla, continuamos sin datos del prospect (degradacion elegante).
   * La vista de detalle muestra la quote igual, solo con "Prospecto desconocido".
   */
  const prospectResult = await supabase
    .from('prospects')
    .select('id, full_name, phone, email, opt_out, opt_out_at, consent_status')
    .eq('id', quoteData.prospect_id)
    .eq('producer_id', producerId)
    .maybeSingle()

  const prospectData = prospectResult.data as ProspectDetailRow | null

  if (prospectResult.error) {
    // Error no critico — continuamos sin datos del prospect.
    console.error('[quote-detail] Error querying prospect — code:', prospectResult.error.code)
  }

  // ── Query 3: eventos de la quote (timeline) ───────────────────────────────
  /*
   * Ordenamos ascendente por created_at para mostrar en orden cronologico.
   * Los eventos mas antiguos van primero (el timeline avanza hacia abajo).
   *
   * quote_events es append-only: no hay UPDATE ni DELETE en esta tabla.
   * Lo que se inserta es permanente. El timeline es el historial real.
   *
   * COLUMNAS REALES (de types/database.ts, quote_events.Row):
   *   id, producer_id, quote_id, event_type, actor, previous_status,
   *   new_status, description, created_at
   *
   * SIN COLUMNA metadata: el schema v2.0 no tiene metadata en quote_events.
   * El spec menciona "metadata si existe" — en este caso no existe.
   */
  const eventsResult = await supabase
    .from('quote_events')
    .select('id, event_type, actor, previous_status, new_status, description, created_at')
    .eq('quote_id', quoteId)
    .eq('producer_id', producerId)
    .order('created_at', { ascending: true })

  const eventsData = eventsResult.data as QuoteEventDetailRow[] | null

  if (eventsResult.error) {
    // Error no critico — mostramos la quote sin timeline.
    console.error('[quote-detail] Error querying events — code:', eventsResult.error.code)
  }

  return {
    notFound: false,
    quote: quoteData,
    prospect: prospectData,
    events: eventsData ?? [],
    error: null,
  }
}
