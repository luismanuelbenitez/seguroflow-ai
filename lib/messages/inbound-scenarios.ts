import type { Database } from '@/types/database'

/*
 * INTENCION: Definir los escenarios estaticos de respuesta inbound simulada.
 * NO usa IA. NO llama APIs externas. Solo texto fijo predefinido para
 * representar los 4 casos mas comunes de respuesta de un prospecto.
 *
 * POR QUE ESTATICO (sin IA):
 *   - Regla critica del MVP local: NO integrar IA.
 *   - El objetivo es validar el flujo tecnico, no el contenido del mensaje.
 *   - El producer puede ver como se registra cada tipo de respuesta en el timeline.
 *   - En produccion, el webhook real recibira el mensaje real del prospecto.
 *
 * USO:
 *   - app/actions/inbound.ts: lee el scenario elegido del FormData y lo aplica.
 *   - components/dashboard/simulate-inbound-form.tsx: muestra los 4 botones.
 *
 * COLUMNAS VERIFICADAS (types/database.ts):
 *   - quote_status enum: interested, responded, closed_lost, opt_out (todos existen)
 *   - quote_events.event_type: TEXT libre — usamos 'response_received' y 'opt_out_received'
 *     (ya mapeados en formatEventType en /dashboard/quotes/[quoteId]/page.tsx)
 *
 * Ver: app/actions/inbound.ts (Server Action que consume estos escenarios)
 * Ver: components/dashboard/simulate-inbound-form.tsx (UI que muestra estos escenarios)
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */

// ============================================================
// Tipo de escenario
// ============================================================

type QuoteStatus = Database['public']['Enums']['quote_status']

/**
 * Escenario de respuesta inbound simulada.
 * Cada escenario define una situacion tipica que puede responder un prospecto.
 */
export type InboundScenario = {
  /**
   * Identificador unico del escenario.
   * Se pasa como campo 'scenario' en el FormData del formulario.
   */
  key: string

  /**
   * Etiqueta visible para el producer en el boton de simulacion.
   */
  label: string

  /**
   * Texto del mensaje ficticio que "envio" el prospecto.
   * En produccion, este texto viene del webhook de WhatsApp (el mensaje real).
   * En la simulacion, usamos este texto estatico.
   * Se guarda en whatsapp_messages.body.
   */
  sampleMessage: string

  /**
   * Status objetivo de la quote despues de procesar este escenario.
   * Debe ser un valor valido del enum quote_status (verificado en types/database.ts).
   *
   * Mapa de escenarios a status:
   *   interested      → 'interested'  (prospecto quiere comprar — exito parcial)
   *   has_question    → 'responded'   (prospecto respondio con duda — requiere seguimiento)
   *   not_interested  → 'closed_lost' (prospecto no quiere — cerrar sin exito)
   *   opt_out         → 'opt_out'     (prospecto pide no ser contactado — bloqueo total)
   */
  targetStatus: QuoteStatus

  /**
   * Si true, ademas de cambiar el status de la quote, se debe marcar
   * prospects.opt_out = true y prospects.opt_out_at = now.
   * Solo aplica al escenario 'opt_out'.
   */
  shouldSetOptOut: boolean

  /**
   * Texto para el campo description del evento en quote_events.
   * Explica que ocurrio para que el timeline sea informativo.
   * NO incluir datos PII — el timeline es visible al producer, no al prospect.
   */
  eventDescription: string

  /**
   * Valor para quote_events.event_type (TEXT libre, no enum).
   * Opciones elegidas:
   *   'response_received': para interested, has_question, not_interested.
   *     → dot amber en el timeline (getEventDotColor: startsWith('response_'))
   *     → label 'Respuesta recibida' (formatEventType en [quoteId]/page.tsx)
   *   'opt_out_received': para opt_out.
   *     → dot rojo en el timeline (getEventDotColor: startsWith('opt_out'))
   *     → label 'Opt-out recibido' (formatEventType en [quoteId]/page.tsx)
   * Ambos ya estan mapeados en formatEventType — no requieren cambios al timeline.
   */
  eventType: string
}

// ============================================================
// Escenarios definidos
// ============================================================

/**
 * Lista de los 4 escenarios de respuesta inbound simulada.
 * Orden: de mas positivo a mas negativo (para UX intuitiva).
 */
export const INBOUND_SCENARIOS: InboundScenario[] = [
  {
    key: 'interested',
    label: 'Simular interesado',
    sampleMessage: 'Hola, si, me interesa. Me podes pasar mas detalles?',
    targetStatus: 'interested',
    shouldSetOptOut: false,
    eventDescription:
      'Prospecto respondio con interes. Seguimiento manual del producer requerido para continuar con el cierre.',
    eventType: 'response_received',
  },
  {
    key: 'has_question',
    label: 'Simular duda',
    sampleMessage: 'Hola, tengo una duda sobre la cobertura y el precio.',
    targetStatus: 'responded',
    shouldSetOptOut: false,
    eventDescription:
      'Prospecto respondio con una duda. Requiere respuesta del producer antes de continuar.',
    eventType: 'response_received',
  },
  {
    key: 'not_interested',
    label: 'Simular no interesado',
    sampleMessage: 'Gracias, por ahora no me interesa.',
    targetStatus: 'closed_lost',
    shouldSetOptOut: false,
    eventDescription:
      'Prospecto indico no estar interesado en la cotizacion. Cotizacion cerrada sin exito.',
    eventType: 'response_received',
  },
  {
    key: 'opt_out',
    label: 'Simular opt-out',
    sampleMessage: 'Por favor no me escriban mas.',
    targetStatus: 'opt_out',
    shouldSetOptOut: true,
    eventDescription:
      'Prospecto solicito no recibir mas mensajes. prospects.opt_out marcado como true. Futuros seguimientos bloqueados.',
    eventType: 'opt_out_received',
  },
]

// ============================================================
// Helpers
// ============================================================

/**
 * Conjunto de keys validos para validacion en el Server Action.
 * Evita strings arbitrarios del FormData.
 */
export const VALID_INBOUND_SCENARIO_KEYS = new Set(
  INBOUND_SCENARIOS.map((s) => s.key)
)

/**
 * INTENCION: Buscar un escenario por key.
 *
 * @param key Key del escenario recibido desde el FormData
 * @returns El escenario si existe, undefined si no
 */
export function findInboundScenario(key: string): InboundScenario | undefined {
  return INBOUND_SCENARIOS.find((s) => s.key === key)
}

/**
 * Status de quote que son elegibles para recibir una respuesta inbound simulada.
 * La UI muestra el panel de simulacion solo cuando la quote esta en uno de estos estados.
 * El Server Action valida que el status sea uno de estos antes de procesar.
 *
 * LOGICA: Estos son los estados en los que un prospecto PODRIA responder naturalmente:
 *   contacted:     primer mensaje enviado, esperando respuesta
 *   contacted_2:   segundo mensaje enviado, esperando respuesta
 *   no_response_1: no respondio al primer mensaje — aun puede responder
 *   no_response:   no respondio — aun puede responder espontaneamente
 */
export const INBOUND_ELIGIBLE_STATUSES: QuoteStatus[] = [
  'contacted',
  'contacted_2',
  'no_response_1',
  'no_response',
]
