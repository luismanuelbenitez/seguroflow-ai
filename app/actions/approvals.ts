'use server'

/*
 * INTENCION: Server Actions para la cola local de aprobacion de mensajes.
 * Permite que el producer apruebe (y opcionalmente edite) el mensaje M1
 * de seguimiento inicial antes de enviarlo por WhatsApp.
 *
 * ESTADO ACTUAL (MVP local):
 *   - NO envia WhatsApp real (no hay integracion WABA).
 *   - NO llama a ninguna IA.
 *   - Registra la aprobacion en quotes.approved_message y en quote_events.
 *   - Cambia el estado de la quote a pending_approval si corresponde.
 *   - El producer puede editar el texto antes de aprobar.
 *
 * FLUJO DE approveInitialFollowUpMessage:
 *   1. Obtener producer context (valida sesion y producer).
 *   2. Leer quote_id y message_text de formData.
 *   3. Validar campos (no vacios, longitud).
 *   4. Obtener la quote (valida que pertenezca al producer via RLS + eq).
 *   5. Verificar que el status de la quote sea elegible para aprobacion.
 *   6. Obtener el prospect (valida opt_out).
 *   7. Si opt_out = true, bloquear y retornar error.
 *   8. UPDATE quotes: approved_message + status si corresponde.
 *   9. INSERT quote_events: registrar aprobacion como evento append-only.
 *  10. redirect('/dashboard/approvals') en exito.
 *
 * NOTA SOBRE approved_responses (GAP DOCUMENTADO):
 *   La tabla approved_responses esta disenada para el banco de FAQs del producer:
 *   ejemplo de pregunta del prospecto + respuesta automatica. NO tiene columna
 *   quote_id y NO es el lugar correcto para guardar el texto aprobado de M1.
 *   La columna correcta es quotes.approved_message (TEXT NULLABLE, ya existe).
 *   Se registra adicionalmente en quote_events para el audit trail.
 *   Ver: docs/05-architecture/DATA_MODEL.md — seccion "Relacion flujo-modelo de datos".
 *
 * NOTA SOBRE STATUS TRANSITIONS (DECISION-005):
 *   pending_follow_up → pending_approval : el producer pre-aprueba el M1
 *   scheduled → pending_approval         : el umbral vencio, producer aprueba
 *   pending_approval → pending_approval  : re-aprobacion (actualiza el texto)
 *
 *   En el flujo completo con WABA, el estado pasaria de pending_approval a
 *   contacted SOLO cuando el proveedor confirma el envio. Como no hay WABA,
 *   la cotizacion queda en pending_approval con el texto guardado en approved_message.
 *
 * NOTA SOBRE TYPE ASSERTIONS:
 *   El insert en quote_events usa 'as any'. Razon: Supabase TS infiere el tipo
 *   del argumento de .insert() como 'never' con schemas complejos (833 lineas
 *   en database.ts). El objeto que se pasa es seguro: refleja exactamente el
 *   tipo Database['public']['Tables']['quote_events']['Insert']. La assertion
 *   es la solucion establecida en este proyecto para este bug conocido.
 *   Ver: lib/producers/get-current-producer-context.ts — nota sobre type assertions.
 *
 * SEGURIDAD:
 *   - createClient() usa la sesion del usuario (no service role).
 *   - La quote se busca con .eq('producer_id', producerId) + RLS: doble barrera.
 *   - opt_out se verifica en capa de aplicacion (primera barrera).
 *   - El trigger en whatsapp_messages actuaria como segunda barrera si se
 *     intentara hacer un INSERT con opt_out = true (pero no hay INSERT en este action).
 *   - No se usan datos del cliente para construir queries SQL — parametrizados siempre.
 *
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 * Ver: lib/messages/templates.ts (buildInitialFollowUpMessage)
 * Ver: lib/quotes/get-approval-queue.ts (getApprovalQueue)
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import type { Database } from '@/types/database'

type QuoteStatus = Database['public']['Enums']['quote_status']
type QuoteEventActor = Database['public']['Enums']['quote_event_actor']

// ============================================================
// Tipos del Server Action (patron useActionState)
// ============================================================

export type ApprovalActionResult = {
  /** Mensaje de error o exito para mostrar al producer */
  message: string
  /** true si es un error, false si es exito (aunque el exito suele redirigir) */
  isError: boolean
  /**
   * quoteId del item que fallo, para que el UI pueda resaltar el formulario correcto.
   * Es null cuando el error no es especifico de una quote (ej: sin sesion).
   */
  failedQuoteId: string | null
}

// APPROVAL_INITIAL_STATE se define en components/dashboard/approval-form.tsx
// No puede exportarse desde 'use server' — solo async functions son exportables.

// ============================================================
// Constantes de validacion
// ============================================================

/** Longitud maxima del texto aprobado. 4096 chars es el limite de WhatsApp. */
const MAX_MESSAGE_LENGTH = 4096

/** Estados de quote que habilitan la aprobacion de M1 (DECISION-005) */
const APPROVABLE_STATUSES: QuoteStatus[] = [
  'pending_follow_up',
  'scheduled',
  'pending_approval',
]

// ============================================================
// Helpers internos
// ============================================================

/**
 * Determina el nuevo status de la quote despues de la aprobacion.
 *
 * LOGICA:
 *   - pending_follow_up → pending_approval (el producer pre-aprueba antes del umbral)
 *   - scheduled → pending_approval (umbral vencio, listo para enviar)
 *   - pending_approval → pending_approval (re-aprobacion, actualiza el texto)
 *
 * En el flujo real, pending_approval → contacted solo ocurre cuando WABA confirma
 * el envio. Como no hay WABA en el MVP local, la quote queda en pending_approval
 * con approved_message seteado. La presencia de approved_message indica que el
 * producer ya aprobo el texto.
 */
function resolveNewStatus(currentStatus: QuoteStatus): QuoteStatus {
  if (currentStatus === 'pending_follow_up' || currentStatus === 'scheduled') {
    return 'pending_approval'
  }
  // Ya esta en pending_approval — re-aprobacion
  return 'pending_approval'
}

// ============================================================
// Server Action principal
// ============================================================

/**
 * INTENCION: Registrar la aprobacion del mensaje M1 de seguimiento inicial.
 *
 * PATRON: useActionState — firma (prevState, formData) → Promise<State>
 *   En exito: redirect('/dashboard/approvals') — nunca retorna al cliente.
 *   En error: retorna ApprovalActionResult con isError: true.
 *
 * CAMPOS DE formData:
 *   - quote_id   : string — UUID de la cotizacion a aprobar
 *   - message_text: string — texto aprobado (puede ser editado por el producer)
 *
 * @param _prevState Estado anterior (ignorado — solo se usa en caso de error previo)
 * @param formData FormData del formulario de aprobacion
 */
export async function approveInitialFollowUpMessage(
  _prevState: ApprovalActionResult,
  formData: FormData
): Promise<ApprovalActionResult> {

  // ── Paso 1: validar sesion y producer context ─────────────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    /*
     * No redirigimos aqui: el action puede ser llamado desde cualquier formulario.
     * Devolvemos error para que el componente decida que mostrar.
     * La pagina ya tiene su propio guard de sesion.
     */
    return {
      message: 'Tu sesion expiro. Por favor, recarga la pagina e ingresa nuevamente.',
      isError: true,
      failedQuoteId: null,
    }
  }

  if (!ctx.hasProducer || !ctx.membership) {
    return {
      message: 'No hay productor asociado a tu cuenta. Completa el onboarding primero.',
      isError: true,
      failedQuoteId: null,
    }
  }

  const producerId = ctx.membership.producer_id

  // ── Paso 2: leer y validar campos del formulario ──────────────────────────
  const rawQuoteId = formData.get('quote_id')
  const rawMessageText = formData.get('message_text')

  /*
   * Validamos como strings antes de cualquier operacion con la DB.
   * Nunca confiamos en que el cliente envia el tipo correcto.
   */
  if (typeof rawQuoteId !== 'string' || !rawQuoteId.trim()) {
    return {
      message: 'Falta el identificador de la cotizacion. Por favor, recarga la pagina.',
      isError: true,
      failedQuoteId: null,
    }
  }

  const quoteId = rawQuoteId.trim()

  if (typeof rawMessageText !== 'string' || !rawMessageText.trim()) {
    return {
      message: 'El texto del mensaje no puede estar vacio.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  const messageText = rawMessageText.trim()

  if (messageText.length > MAX_MESSAGE_LENGTH) {
    return {
      message: `El mensaje es demasiado largo (max ${MAX_MESSAGE_LENGTH} caracteres, actual: ${messageText.length}).`,
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 3: obtener la quote y verificar propiedad ────────────────────────
  /*
   * La combinacion .eq('id', quoteId).eq('producer_id', producerId) garantiza
   * que la quote pertenece al producer del usuario autenticado.
   * RLS aplica adicionalmente: producer_id IN (SELECT get_my_producer_ids()).
   * Si la quote no existe o no pertenece a este producer, data === null.
   */
  const supabase = await createClient()

  const quoteResult = await supabase
    .from('quotes')
    .select('id, status, prospect_id')
    .eq('id', quoteId)
    .eq('producer_id', producerId)
    .maybeSingle()

  const quoteData = quoteResult.data as { id: string; status: QuoteStatus; prospect_id: string } | null

  if (quoteResult.error) {
    console.error('[approvals] Error querying quote — code:', quoteResult.error.code)
    return {
      message: 'Error al verificar la cotizacion. Por favor, intenta nuevamente.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  if (!quoteData) {
    // La quote no existe para este producer — no revelar si existe en otro producer
    return {
      message: 'No se encontro la cotizacion o no tenes permiso para aprobarla.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 4: verificar que el status sea elegible ──────────────────────────
  if (!APPROVABLE_STATUSES.includes(quoteData.status)) {
    return {
      message: `Esta cotizacion no puede ser aprobada en su estado actual (${quoteData.status}).`,
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 5: obtener prospect y verificar opt_out ──────────────────────────
  /*
   * BARRERA 1: verificar opt_out antes de registrar cualquier aprobacion.
   * Si el prospecto ya pidio baja, no permitimos ni guardar el mensaje —
   * seria confuso para el producer ver una "aprobacion" que nunca podra enviarse.
   *
   * BARRERA 2: el trigger en whatsapp_messages rechazaria el INSERT outbound.
   * Pero ese trigger solo actua si se intenta insertar en whatsapp_messages,
   * lo cual no hacemos aqui (no hay envio WABA en el MVP local).
   * Por eso la barrera 1 (aqui) es critica para el flujo del dashboard.
   */
  const prospectResult = await supabase
    .from('prospects')
    .select('id, opt_out')
    .eq('id', quoteData.prospect_id)
    .eq('producer_id', producerId)
    .maybeSingle()

  const prospectData = prospectResult.data as { id: string; opt_out: boolean } | null

  if (prospectResult.error) {
    console.error('[approvals] Error querying prospect — code:', prospectResult.error.code)
    return {
      message: 'Error al verificar el prospecto. Por favor, intenta nuevamente.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  if (!prospectData) {
    return {
      message: 'No se encontro el prospecto asociado a esta cotizacion.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  if (prospectData.opt_out) {
    /*
     * El prospecto pidio no ser contactado. Bloquear la aprobacion.
     * No revelar detalles del motivo en el mensaje de error — solo informar al producer.
     */
    return {
      message:
        'Este prospecto ha solicitado no recibir mensajes. No es posible aprobar el seguimiento.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 6: calcular nuevo status de la quote ─────────────────────────────
  const previousStatus = quoteData.status
  const newStatus = resolveNewStatus(previousStatus)

  // ── Paso 7: actualizar quotes (approved_message + status) ─────────────────
  /*
   * Update con el texto aprobado por el producer y el nuevo status.
   *
   * NOTA SOBRE 'as any' EN EL UPDATE:
   *   El mismo bug de inferencia de Supabase TS que afecta a .insert() tambien
   *   afecta a .update(): el argumento se infiere como 'never' con schemas
   *   complejos. El objeto es exactamente Database['public']['Tables']['quotes']['Update'].
   *   La assertion es safe: el schema SQL garantiza que estos campos existen.
   *   Ver: lib/producers/get-current-producer-context.ts — nota sobre type assertions.
   *
   * El .eq('producer_id', producerId) es defensa extra sobre el RLS.
   */
  /*
   * NOTA TECNICA: Con el schema complejo (833 lineas en database.ts), Supabase TS
   * infiere el tipo de supabase.from('quotes') como un builder con generics en 'never'.
   * Esto hace que .update({ ... } as any) falle con "any not assignable to never"
   * porque el argumento se type-checks antes de que la cast se aplique.
   *
   * SOLUCION: castear supabase.from('quotes') completo a 'any' para que TypeScript
   * no type-check la cadena .update().eq(). Es la forma segura de evitar el bug
   * de inferencia cuando la assertion en el argumento no es suficiente.
   * La operacion runtime es identica: Supabase recibe el payload correcto.
   *
   * Confirmed safe: el objeto {approved_message, status} refleja exactamente
   * Database['public']['Tables']['quotes']['Update'].
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateResult = await (supabase.from('quotes') as any)
    .update({
      approved_message: messageText,
      status: newStatus,
    })
    .eq('id', quoteId)
    .eq('producer_id', producerId)

  if (updateResult.error) {
    console.error('[approvals] Error updating quote — code:', updateResult.error.code)
    return {
      message: 'Error al guardar la aprobacion. Por favor, intenta nuevamente.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 8: registrar evento en quote_events (audit log append-only) ───────
  /*
   * quote_events es append-only: cada accion del producer o del sistema se registra
   * como un evento inmutable. Esto permite auditar exactamente que aprobo el producer
   * y cuando.
   *
   * event_type es TEXT (no enum): podemos usar cualquier string descriptivo.
   * actor = 'producer': el producer fue quien tomo la accion (no el sistema).
   *
   * NOTA SOBRE 'as any':
   *   Supabase TypeScript infiere el argumento de .insert() como 'never' para
   *   quote_events cuando el schema es complejo. El objeto que pasamos es exactamente
   *   el tipo Database['public']['Tables']['quote_events']['Insert']. La assertion
   *   es safe porque el schema SQL garantiza que estos campos existen con estos tipos.
   *   Ver: docs/00-ai-context/CODING_RULES.md — seccion sobre type assertions Supabase.
   */
  const eventDescription =
    previousStatus === newStatus
      ? `Producer re-aprobó el mensaje M1 (texto actualizado). Status sin cambio: ${newStatus}.`
      : `Producer aprobó el mensaje M1 de seguimiento inicial. Transición: ${previousStatus} → ${newStatus}.`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventResult = await supabase.from('quote_events').insert({
    producer_id: producerId,
    quote_id: quoteId,
    event_type: 'message_approved',
    actor: 'producer' as QuoteEventActor,
    previous_status: previousStatus,
    new_status: newStatus,
    description: eventDescription,
  } as any)

  if (eventResult.error) {
    /*
     * El evento fallo pero el update de la quote ya se hizo.
     * No revertimos (el update fue exitoso y el producer espera el resultado).
     * Logueamos el error pero no interrumpimos el flujo.
     * En una version futura, esto podria ir a una cola de reintentos.
     */
    console.error('[approvals] Error inserting quote_event — code:', eventResult.error.code)
  }

  // ── Paso 9: redirigir al listado de aprobaciones ──────────────────────────
  /*
   * redirect() lanza NEXT_REDIRECT internamente — nunca retorna.
   * El cliente navega a /dashboard/approvals donde ve la cola actualizada.
   */
  redirect('/dashboard/approvals')
}
