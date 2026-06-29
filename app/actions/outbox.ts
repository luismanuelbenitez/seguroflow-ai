'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import type { Database } from '@/types/database'

/*
 * INTENCION: Server Action para simular el envio de un mensaje aprobado.
 * NO envia WhatsApp real. NO llama APIs externas. NO usa service role.
 * Solo registra localmente que el mensaje "habria sido enviado" y actualiza
 * el estado de la quote + eventos para que sean visibles en el timeline.
 *
 * QUE HACE simulateSendApprovedMessage():
 *   1. Valida sesion y producer context.
 *   2. Lee quote_id del FormData.
 *   3. Obtiene la quote — verifica propiedad (producer_id match + RLS).
 *   4. Obtiene el prospect — verifica opt_out.
 *   5. Verifica que approved_message existe (no puede simular sin mensaje).
 *   6. Verifica que el status es 'pending_approval' (estado elegible).
 *   7. INSERT en whatsapp_messages: registro outbound simulado.
 *      - delivery_status: 'sent' (simulado — en produccion seria 'pending' hasta ACK)
 *      - waba_message_id: null (sin WABA real)
 *      - metadata: { simulated: true, note: "..." }
 *      - sent_at: timestamp actual
 *   8. UPDATE quotes.status: 'pending_approval' → 'contacted'.
 *   9. INSERT en quote_events: event_type='message_sent', actor='producer'.
 *   10. redirect('/dashboard/outbox') en exito.
 *
 * POR QUE whatsapp_messages ES COMPATIBLE CON LA SIMULACION:
 *   La tabla tiene todas las columnas necesarias para registrar un outbound simulado:
 *     body: el approved_message (texto real del mensaje)
 *     direction: 'outbound' (enum message_direction)
 *     delivery_status: 'sent' (enum delivery_status — simulado)
 *     sent_at: timestamp actual
 *     waba_message_id: null (sin WABA — gap documentado)
 *     template_name: 'seguimiento_inicial_v1' (template usado en M1)
 *     metadata: Json — usado para marcar la simulacion
 *     producer_id, prospect_id, quote_id: disponibles
 *   Ver: types/database.ts — whatsapp_messages.Insert
 *
 * GAP DOCUMENTADO: waba_message_id = null en simulacion.
 *   En produccion, Twilio/360dialog retornan un ID de mensaje al enviar.
 *   Ese ID se guarda en waba_message_id para rastrear delivery.
 *   En simulacion local, no hay ID real. Se deja null intencionalmente.
 *   La columna waba_message_id es nullable en el schema v2.0.
 *
 * STATUS TRANSITION ELEGIDA: pending_approval → contacted.
 *   'contacted' es el estado que indica que el producer contacto al prospect.
 *   Es semanticamente correcto incluso en simulacion.
 *   La alternativa 'no_response_1' seria para cuando no hay respuesta despues
 *   del primer contacto — lo cual requeriria esperar N dias. No aplica aqui.
 *
 * DEGRADACION ELEGANTE:
 *   Si whatsapp_messages INSERT falla → logueamos, pero CONTINUAMOS.
 *   El UPDATE de status y el INSERT de quote_events son los pasos criticos.
 *   El registro en whatsapp_messages es "best effort" para la simulacion.
 *   Un sistema de reconciliacion futuro podria detectar gaps entre quote_events
 *   y whatsapp_messages.
 *
 * FIRMA COMPATIBLE CON useActionState (React 19):
 *   (prevState: S, formData: FormData) => Promise<S>
 *
 * SEGURIDAD:
 *   - No usa service role. Usa createClient() (cliente del usuario).
 *   - Valida sesion con getUser() → getCurrentProducerContext().
 *   - Valida propiedad de la quote con .eq('producer_id', producerId) + RLS.
 *   - Bloquea si opt_out = true (doble barrera con la UI).
 *   - Bloquea si approved_message es null.
 *   - Bloquea si status != 'pending_approval'.
 *
 * PRIVACIDAD:
 *   - full_name y phone son PII. No loguear en errores.
 *   - Solo loguear codigos de error de Supabase.
 *
 * Ver: lib/outbox/get-local-outbox.ts (helper que alimenta la UI)
 * Ver: app/dashboard/outbox/page.tsx (pagina del outbox)
 * Ver: components/dashboard/simulate-send-button.tsx (client component)
 * Ver: types/database.ts (columnas reales verificadas 2026-06-29)
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */

// ============================================================
// Tipos de retorno de la accion
// ============================================================

/**
 * Resultado de simulateSendApprovedMessage.
 * failedQuoteId permite que cada SimulateSendButton muestre solo
 * el error de SU quote, no el de otra (multiples forms en una pagina).
 */
export type SimulateResult = {
  message: string
  isError: boolean
  failedQuoteId: string | null
}

/**
 * Estado inicial para useActionState en SimulateSendButton.
 * message vacio = sin feedback todavia.
 */
export const SIMULATE_INITIAL_STATE: SimulateResult = {
  message: '',
  isError: false,
  failedQuoteId: null,
}

// ============================================================
// Tipos locales para queries
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']

/*
 * Columnas de quote que necesitamos para validar el envio simulado.
 * approved_message: el texto del mensaje a "enviar".
 * status: debe ser 'pending_approval'.
 * prospect_id: para obtener el prospect (opt_out check).
 */
type SimulateQuoteRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'approved_message'
  | 'prospect_id'
  | 'producer_id'
>

/*
 * Columnas de prospect para la validacion de opt_out.
 * phone: para el registro en whatsapp_messages.
 * full_name: para el description del evento (sin loguear).
 */
type SimulateProspectRow = Pick<
  ProspectRow,
  | 'id'
  | 'full_name'
  | 'phone'
  | 'opt_out'
>

// ============================================================
// Constantes
// ============================================================

/*
 * Status que debe tener la quote para que sea elegible para el outbox.
 * Solo 'pending_approval' puede ser "enviado" en el outbox local.
 * Ver: lib/outbox/get-local-outbox.ts (misma constante logica, duplicada intencionalmente
 * para que el Server Action sea independiente del helper — validacion defensiva).
 */
const ELIGIBLE_STATUS_FOR_SEND = 'pending_approval' as const

/*
 * Status objetivo despues del envio simulado.
 * 'contacted' indica que el primer contacto fue realizado.
 * Es el status semanticamente correcto en el enum quote_status.
 * Ver: types/database.ts — Enums.quote_status
 */
const STATUS_AFTER_SIMULATE = 'contacted' as const

/*
 * Nombre del template del mensaje M1.
 * Documentado en DECISION-005. No es un enum — es un string libre.
 * Se guarda en whatsapp_messages.template_name para referencia futura.
 */
const M1_TEMPLATE_NAME = 'seguimiento_inicial_v1'

// ============================================================
// Server Action
// ============================================================

/**
 * INTENCION: Simular el envio del mensaje aprobado para una quote.
 *
 * NO envia WhatsApp real. NO llama APIs externas. Solo registra localmente.
 *
 * @param _prevState Estado anterior de useActionState (ignorado — requerido por la firma)
 * @param formData FormData con campo 'quote_id' (UUID de la quote a simular)
 */
export async function simulateSendApprovedMessage(
  _prevState: SimulateResult,
  formData: FormData
): Promise<SimulateResult> {
  const supabase = await createClient()

  // ── Paso 1: Validar sesion y obtener producer context ───────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    return {
      message: 'Tu sesion expiro. Recarga la pagina e inicia sesion nuevamente.',
      isError: true,
      failedQuoteId: null,
    }
  }

  if (!ctx.hasProducer || !ctx.membership) {
    return {
      message: 'Tu usuario no esta asociado a ningun producer. Ejecuta el seed local primero.',
      isError: true,
      failedQuoteId: null,
    }
  }

  const producerId = ctx.membership.producer_id

  // ── Paso 2: Leer y validar quote_id ─────────────────────────────────────
  /*
   * quote_id viene del input hidden del formulario en SimulateSendButton.
   * Validamos que es un string no vacio antes de usarlo en queries.
   */
  const quoteId = (formData.get('quote_id') as string | null)?.trim() ?? ''

  if (!quoteId) {
    return {
      message: 'No se recibio el ID de la cotizacion. Recarga la pagina e intenta nuevamente.',
      isError: true,
      failedQuoteId: null,
    }
  }

  // ── Paso 3: Obtener la quote — verificar propiedad ───────────────────────
  /*
   * Filtramos por (id, producer_id) para verificar que la quote pertenece
   * al producer del usuario autenticado. RLS aplica adicionalmente.
   *
   * TYPE ASSERTION: Supabase TS infiere 'never' para .data con select strings.
   * Ver: lib/quotes/get-quote-detail.ts (misma razon, mismo workaround).
   */
  type QuoteIdRow = { id: string }

  const quoteResult = await supabase
    .from('quotes')
    .select('id, status, approved_message, prospect_id, producer_id')
    .eq('id', quoteId)
    .eq('producer_id', producerId)
    .single()

  const quoteData = quoteResult.data as SimulateQuoteRow | null

  if (quoteResult.error || !quoteData) {
    console.error('[outbox:action] Error obteniendo quote — code:', quoteResult.error?.code)
    return {
      message: 'No se encontro la cotizacion o no tienes permiso para acceder a ella.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 4: Validar status elegible ──────────────────────────────────────
  /*
   * Solo podemos simular desde 'pending_approval'.
   * Si el status cambio (por ejemplo, ya se simulo antes), bloqueamos.
   * Esto hace la accion idempotent-safe: segunda llamada retorna error claro.
   */
  if (quoteData.status !== ELIGIBLE_STATUS_FOR_SEND) {
    return {
      message: `La cotizacion ya no esta en estado '${ELIGIBLE_STATUS_FOR_SEND}' (estado actual: '${quoteData.status}'). Puede que el envio ya fue simulado.`,
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 5: Validar que existe approved_message ──────────────────────────
  /*
   * Si approved_message es null, no hay mensaje para simular el envio.
   * Esto no deberia ocurrir en el flujo normal (el outbox filtra IS NOT NULL),
   * pero puede ocurrir si alguien manipula el FormData directamente.
   */
  if (!quoteData.approved_message) {
    return {
      message: 'La cotizacion no tiene un mensaje aprobado. Ve a la cola de aprobacion primero.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 6: Obtener prospect — verificar opt_out ──────────────────────────
  /*
   * Doble barrera de opt_out: la UI muestra el aviso y deshabilita el boton,
   * pero el Server Action verifica nuevamente en el servidor.
   * El opt_out puede cambiar entre el render de la pagina y el submit del form.
   *
   * PRIVACIDAD: No loguear full_name ni phone en errores de consola.
   */
  const prospectResult = await supabase
    .from('prospects')
    .select('id, full_name, phone, opt_out')
    .eq('id', quoteData.prospect_id)
    .eq('producer_id', producerId)
    .single()

  const prospectData = prospectResult.data as SimulateProspectRow | null

  if (prospectResult.error || !prospectData) {
    console.error('[outbox:action] Error obteniendo prospect — code:', prospectResult.error?.code)
    return {
      message: 'No se pudo verificar los datos del prospecto. Intenta nuevamente.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  /*
   * Bloquear si opt_out = true — no "enviar" a prospectos que pidieron no ser contactados.
   * El opt_out es la barrera mas importante del sistema de seguimiento.
   * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
   */
  if (prospectData.opt_out) {
    return {
      message: 'El prospecto tiene opt-out activo. No se puede simular el envio.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 7: INSERT en whatsapp_messages (registro simulado) ──────────────
  /*
   * INTENCION: Insertar un registro outbound que representa el mensaje que
   * SE HABRIA enviado por WhatsApp si WABA estuviera integrado.
   *
   * COLUMNAS VERIFICADAS (types/database.ts — whatsapp_messages.Insert):
   *   body: string — el texto del mensaje aprobado
   *   direction: 'outbound' — enviamos al prospect (no recibiamos)
   *   delivery_status: 'sent' — simulamos que fue enviado (en prod seria 'pending' hasta ACK)
   *   sent_at: timestamp actual — cuando se "envio" en la simulacion
   *   waba_message_id: null — sin WABA real, no hay ID de mensaje externo
   *   template_name: M1_TEMPLATE_NAME — para referencia futura
   *   metadata: Json con flag de simulacion para distinguirlo de mensajes reales futuros
   *   producer_id, prospect_id, quote_id: requeridos por el schema
   *
   * GAP: waba_message_id = null en simulacion.
   *   En produccion con WABA real, este campo recibe el ID del proveedor
   *   (Twilio: 'SMxxxxx', 360dialog: 'wamid.xxxxx').
   *   Para la simulacion, se deja null. La columna es nullable en el schema.
   *
   * DEGRADACION ELEGANTE:
   *   Si este INSERT falla, logueamos pero CONTINUAMOS con el UPDATE de status
   *   y el INSERT de quote_events. La simulacion "funciona" aunque sin registro
   *   en whatsapp_messages. El timeline del quote mostrara el evento de todas formas.
   *
   * PATRON 'as any':
   *   Supabase TS infiere 'never' para .insert() en schemas complejos.
   *   Ver: app/actions/quotes.ts (patron identico, misma razon).
   */
  const now = new Date().toISOString()

  const wabaResult = await supabase
    .from('whatsapp_messages')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      prospect_id: quoteData.prospect_id,
      quote_id: quoteId,
      body: quoteData.approved_message,
      direction: 'outbound' as const,
      delivery_status: 'sent' as const,
      sent_at: now,
      waba_message_id: null,   // sin WABA real — gap documentado arriba
      template_name: M1_TEMPLATE_NAME,
      metadata: {
        simulated: true,
        note: 'Envio simulado local. No se envio WhatsApp real. Sin integracion WABA.',
        simulated_at: now,
      },
    } as any)

  if (wabaResult.error) {
    // Error no critico — continuamos. El evento en quote_events es suficiente para el MVP.
    console.error('[outbox:action] Error insertando whatsapp_message simulado — code:', wabaResult.error.code)
  }

  // ── Paso 8: UPDATE quotes.status: pending_approval → contacted ───────────
  /*
   * INTENCION: Cambiar el status de la quote para reflejar que el primer
   * contacto fue "realizado" (simulado en el MVP local).
   *
   * PATRON (supabase.from('quotes') as any).update():
   *   El .update({...} as any) no funciona para la tabla 'quotes' con el
   *   generador de tipos de Supabase 2.x — el argumento se infiere como 'never'
   *   y 'any' no es asignable a 'never' en este contexto.
   *   La solucion es castear TODA la instancia de from('quotes') a 'any'.
   *   Ver: app/actions/approvals.ts (patron identico, descubierto en sesion anterior).
   *
   * NUEVO STATUS: 'contacted' — primer contacto realizado.
   * ANTERIOR STATUS: 'pending_approval' — validado en Paso 4.
   */
  const updateResult = await (supabase.from('quotes') as any)
    .update({
      status: STATUS_AFTER_SIMULATE,
    })
    .eq('id', quoteId)
    .eq('producer_id', producerId)

  if (updateResult.error) {
    console.error('[outbox:action] Error actualizando status de quote — code:', updateResult.error?.code)
    return {
      message: 'Error al actualizar el estado de la cotizacion. Ver logs del servidor.',
      isError: true,
      failedQuoteId: quoteId,
    }
  }

  // ── Paso 9: INSERT en quote_events (audit trail) ─────────────────────────
  /*
   * INTENCION: Registrar el envio simulado en el timeline de la quote.
   * Este evento sera visible en /dashboard/quotes/[quoteId] en la seccion
   * de timeline.
   *
   * VALORES:
   *   event_type: 'message_sent' — string libre (TEXT), no enum.
   *     Ya mapeado en app/dashboard/quotes/[quoteId]/page.tsx (formatEventType).
   *   actor: 'producer' — el producer activo el envio simulado desde el outbox.
   *   previous_status: 'pending_approval' — validado en Paso 4.
   *   new_status: 'contacted' — el status que asignamos en Paso 8.
   *   description: explica la simulacion para que sea claro en el timeline.
   *
   * NOTA SOBRE metadata EN quote_events:
   *   La tabla quote_events NO tiene columna metadata en el schema v2.0.
   *   Por eso NO incluimos metadata aqui — la descripcion cubre el contexto.
   *   Ver: types/database.ts — quote_events.Row (columnas reales).
   *
   * PATRON 'as any':
   *   Supabase TS infiere 'never' para .insert() en quote_events con este schema.
   *   Ver: app/actions/approvals.ts (patron identico — funciona para INSERT).
   */
  const eventResult = await supabase
    .from('quote_events')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      quote_id: quoteId,
      event_type: 'message_sent',
      actor: 'producer' as const,
      previous_status: ELIGIBLE_STATUS_FOR_SEND,
      new_status: STATUS_AFTER_SIMULATE,
      description: 'Envio simulado local del mensaje aprobado. No se envio WhatsApp real. Registro en whatsapp_messages con waba_message_id=null.',
    } as any)

  if (eventResult.error) {
    // Error no critico para el flujo — el status ya se actualizo en Paso 8.
    // Pero es importante para el timeline, entonces lo logueamos.
    console.error('[outbox:action] Error insertando quote_event message_sent — code:', eventResult.error.code)
  }

  /*
   * EXITO: redirect al outbox.
   *
   * El usuario ve el outbox actualizado — la quote ya no aparece porque
   * su status cambio de 'pending_approval' a 'contacted'.
   * Para ver el evento de envio simulado: /dashboard/quotes/[quoteId].
   *
   * IMPORTANTE: redirect() lanza NEXT_REDIRECT — la funcion nunca retorna aqui.
   */
  redirect('/dashboard/outbox')
}
