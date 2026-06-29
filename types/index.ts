/*
 * INTENCION: Tipos TypeScript centrales para SeguroFlow AI.
 * Alineados con docs/05-architecture/DATA_MODEL.md v2.0.
 *
 * ESTOS SON PLACEHOLDERS MINIMOS. A medida que se implemente la logica de
 * negocio, estos tipos se expandiran. Cada modulo puede definir sus propios
 * tipos mas especificos; este archivo contiene solo los compartidos globalmente.
 *
 * PRIVACIDAD (Ley 18.331, Uruguay):
 * Los tipos marcados con [PII] contienen datos personales de prospectos.
 * Ver tratamiento requerido en: docs/00-ai-context/CODING_RULES.md, Seccion 5.
 * Regla critica: nunca loguear campos PII en texto plano.
 * Mascara para telefono en logs: +598 9XX XXX X89
 *
 * DECISION DE DISENO:
 * Los tipos de DB (como los generados por Supabase TypeScript Generator) viviran
 * en types/database.ts cuando se generen. Este archivo es para tipos de dominio
 * de la aplicacion, no tipos de base de datos crudos.
 * Comando para generar: supabase gen types typescript --local > types/database.ts
 */

// ============================================================
// ENUMS alineados con supabase/migrations/001_base_multitenant_schema.sql
// ============================================================

/**
 * Estado de una cotizacion a lo largo de su ciclo de vida.
 * Ver descripcion completa en DATA_MODEL.md #quotes.status
 */
export type QuoteStatus =
  | 'pending_follow_up'  // Ingresada, dentro del periodo de espera
  | 'scheduled'          // Umbral vencido, en cola para envio
  | 'pending_approval'   // Mensaje generado, esperando aprobacion (modo manual)
  | 'contacted'          // Primer mensaje enviado
  | 'no_response_1'      // 24h sin respuesta al primer mensaje
  | 'contacted_2'        // Segundo mensaje enviado
  | 'responded'          // El prospecto respondio algo
  | 'interested'         // El prospecto confirmo interes activo
  | 'human_handoff'      // Derivado al producer humano
  | 'closed_won'         // Poliza emitida - ESTADO TERMINAL
  | 'closed_lost'        // Prospecto declino - ESTADO TERMINAL
  | 'no_response'        // Sin respuesta tras todos los intentos
  | 'paused'             // Producer pauso el seguimiento
  | 'cancelled'          // Producer descarto - ESTADO TERMINAL
  | 'opt_out'            // Prospecto pidio baja - ESTADO TERMINAL
  | 'error'              // Error tecnico, requiere revision

/** Estados terminales: no se puede salir de ellos sin accion explicita. */
export const TERMINAL_QUOTE_STATUSES = [
  'closed_won',
  'closed_lost',
  'cancelled',
  'opt_out',
] as const satisfies ReadonlyArray<QuoteStatus>

export type TerminalQuoteStatus = typeof TERMINAL_QUOTE_STATUSES[number]

export type SendMode = 'manual' | 'automatic'
export type ProducerPlan = 'pilot' | 'starter' | 'pro' | 'enterprise'
export type MemberRole = 'owner' | 'admin' | 'agent' | 'viewer'
export type MessageDirection = 'outbound' | 'inbound'
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type HandoffStatus = 'pending' | 'accepted' | 'resolved'

/** Actor que genera eventos en el audit log (quote_events). */
export type QuoteEventActor = 'system' | 'producer' | 'webhook'

/**
 * Clasificacion de la respuesta del prospecto por el LLM.
 * Si confidence < 0.80, el sistema escala al producer independientemente del valor.
 */
export type AiClassification =
  | 'interested'
  | 'needs_more_info'
  | 'price_objection'
  | 'coverage_objection'
  | 'wants_human_contact'
  | 'not_interested'
  | 'opt_out_requested'
  | 'unclear_response'
  | 'angry_or_sensitive'

export type AiSuggestedAction = 'respond' | 'escalate' | 'close'

// ============================================================
// INTERFACES de entidades principales (shapes basicos)
// ============================================================

/**
 * La organizacion comercial. Su id es el producer_id del sistema.
 * ATENCION: producer_id != auth.uid()
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 */
export interface Producer {
  id: string
  name: string
  contact_name: string
  waba_number: string | null
  send_mode: SendMode
  follow_up_hours: number
  plan: ProducerPlan
  status: string
  created_at: string
  updated_at: string
}

/**
 * [PII] Persona o empresa que recibio una cotizacion.
 * Campos full_name, phone y email son datos personales (Ley 18.331 Uruguay).
 * No loguear en texto plano. Mascara para telefono en logs: +598 9XX XXX X89
 */
export interface Prospect {
  id: string
  producer_id: string
  full_name: string      // [PII]
  phone: string          // [PII] Formato E.164 (+598...)
  email: string | null   // [PII]
  opt_out: boolean
  opt_out_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Cotizacion de seguro en seguimiento. Objeto central del sistema.
 * El campo status controla el flujo automatico del MVP-01.
 */
export interface Quote {
  id: string
  producer_id: string
  prospect_id: string
  insurance_type: string
  quoted_amount: number | null
  currency: string
  quote_date: string
  expiry_date: string | null
  follow_up_start_at: string | null
  status: QuoteStatus
  approved_message: string | null
  created_at: string
  updated_at: string
}

/**
 * [PII indirecto] Mensaje de WhatsApp enviado o recibido.
 * El campo body puede contener texto del prospecto. No loguear.
 */
export interface WhatsappMessage {
  id: string
  producer_id: string
  quote_id: string
  prospect_id: string
  direction: MessageDirection
  body: string           // [PII indirecto]
  template_name: string | null
  waba_message_id: string | null
  delivery_status: DeliveryStatus | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  created_at: string
}

/**
 * Evento inmutable en el audit log de una cotizacion.
 * Una vez insertado, no se modifica ni elimina (append-only por RLS).
 */
export interface QuoteEvent {
  id: string
  producer_id: string
  quote_id: string
  event_type: string
  previous_status: QuoteStatus | null
  new_status: QuoteStatus | null
  actor: QuoteEventActor
  description: string | null
  created_at: string
}

/**
 * Derivacion al producer humano.
 * El producer la ve y resuelve desde el dashboard.
 */
export interface HumanHandoff {
  id: string
  producer_id: string
  quote_id: string
  prospect_id: string
  reason: string
  summary: string
  status: HandoffStatus
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
}
