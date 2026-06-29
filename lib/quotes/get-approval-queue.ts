import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/*
 * INTENCION: Obtener la cola de aprobacion de mensajes para el producer autenticado.
 * Devuelve cotizaciones en estados elegibles para que el producer apruebe el mensaje
 * M1 (seguimiento inicial) antes de enviarlo por WhatsApp.
 *
 * ESTADOS ELEGIBLES (definidos en DECISION-005):
 *   - pending_follow_up: cotizacion recien ingresada, dentro del umbral de espera
 *   - scheduled: umbral vencido, lista para preparar mensaje
 *   - pending_approval: mensaje ya preparado/aprobado, esperando envio WABA
 *
 * ESTADOS EXCLUIDOS (terminales o en curso):
 *   contacted, no_response_1, contacted_2, responded, interested, human_handoff,
 *   closed_won, closed_lost, no_response, paused, cancelled, opt_out, error
 *
 * FLUJO:
 *   1. Query quotes con los estados elegibles para el producer_id dado.
 *   2. Obtener datos de prospects (nombre, telefono, opt_out) para esas quotes.
 *   3. Combinar y retornar como lista de ApprovalQueueItem.
 *
 * ENTRADAS:
 *   @param producerId {string} — UUID del producer. El llamador (la pagina) ya
 *     lo obtuvo de getCurrentProducerContext(). No se re-valida aqui.
 *
 * SALIDAS:
 *   @returns {ApprovalQueueResult} — items: lista de cotizaciones elegibles.
 *     Si la query falla, retorna items vacio con error descriptivo.
 *
 * NOTA SOBRE approved_responses (GAP DOCUMENTADO):
 *   La tabla approved_responses esta disenada para el banco de FAQs del producer
 *   (respuestas predefinidas a preguntas frecuentes de prospectos). NO tiene columna
 *   quote_id y NO es el lugar correcto para guardar el texto aprobado del M1.
 *   La columna correcta para el texto aprobado es quotes.approved_message (TEXT NULLABLE).
 *   Ver: docs/05-architecture/DATA_MODEL.md — Relacion entre flujo y modelo de datos.
 *
 * NOTA SOBRE TYPE ASSERTIONS:
 *   Mismo patron que get-current-producer-context.ts y get-quotes-for-current-producer.ts.
 *   Supabase TS infiere 'never' para .data con select strings sobre schema complejo.
 *   Las assertions ('as QuoteQueueRow[] | null') son seguras: reflejan el schema SQL.
 *
 * PRIVACIDAD:
 *   full_name y phone de prospects son PII (Ley 18.331, Uruguay).
 *   Se exponen al producer porque son sus propios clientes.
 *   No loguear en consola de produccion.
 *
 * SEGURIDAD:
 *   - createClient() usa la sesion del usuario (no service role).
 *   - RLS de quotes: producer_id IN (SELECT get_my_producer_ids()).
 *   - .eq('producer_id', producerId) es redundante con RLS pero mejora performance.
 *
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 * Ver: docs/05-architecture/DATA_MODEL.md
 */

// ============================================================
// Tipos locales para las queries (necesarios por limitacion de Supabase TS)
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']
type QuoteStatus = Database['public']['Enums']['quote_status']
type InsuranceType = Database['public']['Enums']['insurance_type']

/**
 * Subconjunto de columnas de quotes necesarias para la cola de aprobacion.
 * Incluye approved_message para saber si ya fue aprobada anteriormente.
 */
type QuoteQueueRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'insurance_type'
  | 'risk_description'
  | 'quoted_amount'
  | 'currency'
  | 'quote_date'
  | 'approved_message'
  | 'internal_notes'
  | 'prospect_id'
>

/**
 * Subconjunto de columnas de prospects necesarias para la cola de aprobacion.
 * Incluye opt_out para bloquear la aprobacion si el prospecto pidio baja.
 * Incluye phone para mostrar al producer con quién esta hablando.
 */
type ProspectQueueRow = Pick<ProspectRow, 'id' | 'full_name' | 'phone' | 'opt_out'>

// ============================================================
// Tipos de retorno publicos
// ============================================================

/**
 * Un item de la cola de aprobacion: la cotizacion enriquecida con datos del prospecto.
 * Es el tipo que recibe el componente ApprovalForm para renderizar cada tarjeta.
 */
export type ApprovalQueueItem = {
  /** UUID de la cotizacion (se pasa como hidden input al Server Action) */
  quoteId: string
  /** Estado actual del enum quote_status */
  quoteStatus: QuoteStatus
  /** Tipo de seguro del enum insurance_type */
  insuranceType: InsuranceType
  /** Descripcion del riesgo para personalizar el mensaje (puede ser null) */
  riskDescription: string | null
  /** Monto cotizado (puede ser null si no se ingreso) */
  quotedAmount: number | null
  /** Moneda ISO 4217 (UYU o USD) */
  currency: string
  /** Fecha de la cotizacion en formato YYYY-MM-DD */
  quoteDate: string
  /**
   * Texto del mensaje previamente aprobado (null si aun no se aprobo).
   * Si no es null, el producer ya aprobo el M1 y este es el texto que guardaron.
   */
  approvedMessage: string | null
  /** Notas internas del producer sobre la cotizacion (puede ser null) */
  internalNotes: string | null
  /** UUID del prospecto */
  prospectId: string
  /** Nombre completo del prospecto (PII) */
  prospectName: string
  /** Telefono en E.164 (PII) */
  prospectPhone: string
  /**
   * Si el prospecto pidio baja, la aprobacion esta bloqueada.
   * El trigger en whatsapp_messages rechazaria el INSERT de todas formas,
   * pero bloqueamos antes en la UI (primera barrera).
   */
  prospectOptOut: boolean
}

export type ApprovalQueueResult = {
  items: ApprovalQueueItem[]
  error: string | null
}

// ============================================================
// Estados elegibles para la cola de aprobacion
// ============================================================

/**
 * INTENCION: Lista de estados donde el producer puede aprobar el mensaje M1.
 *
 * POR QUE ESTOS TRES:
 *   - pending_follow_up: la cotizacion esta nueva, el producer puede pre-aprobar el M1
 *     antes de que venza el umbral. Ahorra tiempo cuando llega el momento de enviar.
 *   - scheduled: el umbral de follow_up_hours vencio. El cron deberia haber activado
 *     el seguimiento. En el demo local (sin cron), aparece si se cambia el status manualmente.
 *   - pending_approval: el mensaje fue preparado y esta esperando aprobacion del producer.
 *
 * ESTADO QUE INTENCIONALMENTE NO SE INCLUYE:
 *   - no_response_1, no_response: podrian incluirse en el futuro para M2/M3,
 *     pero para el MVP-01 solo implementamos M1.
 */
const APPROVAL_QUEUE_STATUSES: QuoteStatus[] = [
  'pending_follow_up',
  'scheduled',
  'pending_approval',
]

// ============================================================
// Implementacion
// ============================================================

/**
 * INTENCION: Obtener cotizaciones elegibles para aprobacion de M1 del producer.
 *
 * @param producerId UUID del producer (obtenido del producer context por el llamador)
 */
export async function getApprovalQueue(
  producerId: string
): Promise<ApprovalQueueResult> {
  const supabase = await createClient()

  // ── Query 1: quotes elegibles para este producer ──────────────────────────
  /*
   * Filtramos por producer_id + status IN eligibles.
   * RLS aplica adicionalmente — doble barrera de seguridad.
   * Ordenamos por created_at ASC: las mas antiguas primero (mas urgentes).
   *
   * Incluimos approved_message para saber si el producer ya aprobo esta cotizacion.
   *
   * Type assertion en .data: misma limitacion de Supabase TS que en los otros helpers.
   * Ver header de este archivo para la explicacion completa.
   */
  const quotesResult = await supabase
    .from('quotes')
    .select(
      'id, status, insurance_type, risk_description, quoted_amount, currency, quote_date, approved_message, internal_notes, prospect_id'
    )
    .eq('producer_id', producerId)
    .in('status', APPROVAL_QUEUE_STATUSES)
    .order('created_at', { ascending: true }) // las mas antiguas primero = mas urgentes

  const quotes = quotesResult.data as QuoteQueueRow[] | null

  if (quotesResult.error) {
    // No logueamos producer_id ni datos de negocio — solo el codigo de error.
    console.error('[approval-queue] Error querying quotes — code:', quotesResult.error.code)
    return { items: [], error: 'Error al obtener la cola de aprobacion.' }
  }

  if (!quotes || quotes.length === 0) {
    // Sin cotizaciones elegibles — estado normal si todas estan en seguimiento o cerradas.
    return { items: [], error: null }
  }

  // ── Query 2: datos de prospects para las quotes ───────────────────────────
  /*
   * Una sola query para todos los prospect_ids unicos.
   * Evita el problema N+1: no hacemos una query por quote.
   *
   * Traemos opt_out para poder bloquear la aprobacion en la UI y en el action.
   * Traemos phone para que el producer vea a quien contactaria.
   *
   * PRIVACIDAD: full_name y phone son PII. No loguear en texto plano.
   */
  const uniqueProspectIds = [...new Set(quotes.map((q) => q.prospect_id))]

  const prospectsResult = await supabase
    .from('prospects')
    .select('id, full_name, phone, opt_out')
    .in('id', uniqueProspectIds)

  const prospects = prospectsResult.data as ProspectQueueRow[] | null

  if (prospectsResult.error) {
    // Degradacion elegante: no falla la cola completa si solo fallan los datos del prospect.
    console.error('[approval-queue] Error querying prospects — code:', prospectsResult.error.code)
  }

  // ── Combinar quotes + prospects ──────────────────────────────────────────
  /*
   * Mapa prospect_id → datos del prospect para O(1) lookup.
   * Si prospects es null (query fallo), el map queda vacio y los campos
   * del prospect aparecen con valores fallback ('Nombre desconocido', etc.).
   */
  const prospectMap = new Map(
    (prospects ?? []).map((p) => [p.id, p])
  )

  const items: ApprovalQueueItem[] = quotes.map((quote) => {
    const prospect = prospectMap.get(quote.prospect_id)
    return {
      quoteId: quote.id,
      quoteStatus: quote.status,
      insuranceType: quote.insurance_type,
      riskDescription: quote.risk_description,
      quotedAmount: quote.quoted_amount,
      currency: quote.currency,
      quoteDate: quote.quote_date,
      approvedMessage: quote.approved_message,
      internalNotes: quote.internal_notes,
      prospectId: quote.prospect_id,
      prospectName: prospect?.full_name ?? 'Nombre desconocido',
      prospectPhone: prospect?.phone ?? 'Telefono desconocido',
      prospectOptOut: prospect?.opt_out ?? false,
    }
  })

  return { items, error: null }
}
