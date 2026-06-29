'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import {
  findInboundScenario,
  VALID_INBOUND_SCENARIO_KEYS,
  INBOUND_ELIGIBLE_STATUSES,
} from '@/lib/messages/inbound-scenarios'
import type { Database } from '@/types/database'

/*
 * INTENCION: Server Action para simular una respuesta inbound del prospecto.
 * NO recibe WhatsApp real. NO llama APIs externas. NO integra IA.
 * Solo registra localmente un mensaje inbound ficticio, actualiza el estado
 * de la quote y lo hace visible en el timeline.
 *
 * QUE HACE simulateInboundResponse():
 *   1. Valida sesion y producer context.
 *   2. Lee quote_id y scenario del FormData.
 *   3. Valida el scenario contra INBOUND_SCENARIOS.
 *   4. Obtiene la quote — verifica propiedad.
 *   5. Valida que el status de la quote es elegible para recibir inbound.
 *   6. Obtiene el prospect.
 *   7. INSERT en whatsapp_messages: registro inbound simulado.
 *      - direction: 'inbound'
 *      - delivery_status: 'delivered' (lo "recibimos")
 *      - body: scenario.sampleMessage
 *      - metadata: { simulated: true, scenario: key }
 *   8. Si scenario.shouldSetOptOut = true:
 *      UPDATE prospects: opt_out = true, opt_out_at = now()
 *   9. UPDATE quotes.status → scenario.targetStatus.
 *   10. INSERT en quote_events: event_type del scenario, actor='webhook' (simula llegada externa).
 *   11. redirect('/dashboard/quotes/[quoteId]') — muestra el timeline actualizado.
 *
 * POR QUE actor='webhook' EN quote_events:
 *   En produccion, una respuesta inbound llega via webhook de WhatsApp (Twilio/360dialog).
 *   El actor='webhook' refleja esta realidad aunque en la simulacion no hay webhook real.
 *   Alternativa seria 'producer' (el producer activo el boton) pero 'webhook' es mas
 *   semanticamente correcto para el tipo de evento que estamos simulando.
 *   Ver: types/database.ts — Enums.quote_event_actor: system | producer | webhook
 *
 * POR QUE delivery_status='delivered' PARA INBOUND:
 *   El enum delivery_status (pending|sent|delivered|read|failed) es semanticamente
 *   para mensajes OUTBOUND (rastrear si llego al destinatario).
 *   Para mensajes INBOUND, lo usamos como 'delivered' para indicar que lo recibimos.
 *   En produccion, los mensajes inbound podrian tener delivery_status=null o 'delivered'.
 *   GAP aceptable para MVP local.
 *
 * DEGRADACION ELEGANTE:
 *   Si whatsapp_messages INSERT falla → logueamos, CONTINUAMOS.
 *   Si prospects UPDATE falla (solo en opt_out) → retornamos error (es critico).
 *   Si quotes UPDATE falla → retornamos error (es critico).
 *   Si quote_events INSERT falla → logueamos, CONTINUAMOS (el status ya cambio).
 *
 * PATRON (supabase.from as any):
 *   - Para quotes.update(): castear supabase.from('quotes') as any (no el arg).
 *   - Para prospects.update(): mismo patron por precaucion.
 *   - Para whatsapp_messages.insert() y quote_events.insert(): {... } as any en el arg.
 *   Ver: app/actions/outbox.ts (patron identico documentado).
 *
 * FIRMA COMPATIBLE CON useActionState (React 19):
 *   (prevState: InboundResult, formData: FormData) => Promise<InboundResult>
 *
 * SEGURIDAD:
 *   - No usa service role. Usa createClient() (cliente del usuario).
 *   - Valida sesion y producer context antes de cualquier operacion.
 *   - Valida propiedad de la quote con .eq('producer_id', producerId) + RLS.
 *   - Valida scenario contra lista blanca (VALID_INBOUND_SCENARIO_KEYS).
 *   - Valida que el status de la quote es elegible para inbound.
 *
 * PRIVACIDAD:
 *   - full_name, phone son PII (Ley 18.331, Uruguay). No loguear.
 *   - Solo loguear codigos de error de Supabase.
 *
 * Ver: lib/messages/inbound-scenarios.ts (definicion de escenarios)
 * Ver: components/dashboard/simulate-inbound-form.tsx (client component)
 * Ver: app/dashboard/quotes/[quoteId]/page.tsx (panel de simulacion + timeline)
 * Ver: types/database.ts (columnas reales verificadas 2026-06-29)
 */

// ============================================================
// Tipos de retorno
// ============================================================

/**
 * Resultado de simulateInboundResponse.
 * Un solo formulario por pagina (detalle de quote) → no necesitamos failedQuoteId.
 */
export type InboundResult = {
  message: string
  isError: boolean
}

/**
 * Estado inicial para useActionState en SimulateInboundForm.
 */
export const INBOUND_INITIAL_STATE: InboundResult = {
  message: '',
  isError: false,
}

// ============================================================
// Tipos locales para queries
// ============================================================

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type ProspectRow = Database['public']['Tables']['prospects']['Row']

/**
 * Columnas de quote necesarias para la validacion y el procesamiento inbound.
 */
type InboundQuoteRow = Pick<
  QuoteRow,
  | 'id'
  | 'status'
  | 'prospect_id'
  | 'producer_id'
>

/**
 * Columnas de prospect necesarias para opt_out check y registro en whatsapp_messages.
 */
type InboundProspectRow = Pick<
  ProspectRow,
  | 'id'
  | 'opt_out'
  | 'opt_out_at'
>

// ============================================================
// Server Action
// ============================================================

/**
 * INTENCION: Simular la llegada de una respuesta inbound del prospecto.
 *
 * NO recibe WhatsApp real. Solo registra localmente y actualiza el timeline.
 *
 * @param _prevState Estado anterior de useActionState (ignorado — requerido por la firma)
 * @param formData FormData con campos 'quote_id' (UUID) y 'scenario' (key del escenario)
 */
export async function simulateInboundResponse(
  _prevState: InboundResult,
  formData: FormData
): Promise<InboundResult> {
  const supabase = await createClient()

  // ── Paso 1: Validar sesion y producer context ────────────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    return {
      message: 'Tu sesion expiro. Recarga la pagina e inicia sesion nuevamente.',
      isError: true,
    }
  }

  if (!ctx.hasProducer || !ctx.membership) {
    return {
      message: 'Tu usuario no esta asociado a ningun producer. Ejecuta el seed local primero.',
      isError: true,
    }
  }

  const producerId = ctx.membership.producer_id

  // ── Paso 2: Leer y validar quote_id ─────────────────────────────────────
  const quoteId = (formData.get('quote_id') as string | null)?.trim() ?? ''

  if (!quoteId) {
    return {
      message: 'No se recibio el ID de la cotizacion. Recarga la pagina e intenta nuevamente.',
      isError: true,
    }
  }

  // ── Paso 3: Leer y validar scenario ─────────────────────────────────────
  /*
   * El scenario viene del boton submit con name="scenario" value="key".
   * Validamos contra VALID_INBOUND_SCENARIO_KEYS para rechazar keys arbitrarios
   * que alguien podria enviar manualmente en el FormData.
   */
  const scenarioKey = (formData.get('scenario') as string | null)?.trim() ?? ''

  if (!scenarioKey || !VALID_INBOUND_SCENARIO_KEYS.has(scenarioKey)) {
    return {
      message: `Escenario invalido: '${scenarioKey}'. Los escenarios validos son: interested, has_question, not_interested, opt_out.`,
      isError: true,
    }
  }

  const scenario = findInboundScenario(scenarioKey)

  if (!scenario) {
    /*
     * Este caso no deberia ocurrir si VALID_INBOUND_SCENARIO_KEYS y findInboundScenario
     * estan sincronizados con INBOUND_SCENARIOS. Guardado defensivo.
     */
    return {
      message: 'Error interno: escenario no encontrado. Reportar al equipo tecnico.',
      isError: true,
    }
  }

  // ── Paso 4: Obtener la quote — verificar propiedad ───────────────────────
  /*
   * Filtramos por (id, producer_id) para verificar que la quote pertenece
   * al producer del usuario autenticado. RLS aplica adicionalmente (doble barrera).
   *
   * TYPE ASSERTION: Supabase TS infiere 'never' para .data con select strings.
   * Ver: lib/quotes/get-quote-detail.ts (misma razon, mismo workaround).
   */
  const quoteResult = await supabase
    .from('quotes')
    .select('id, status, prospect_id, producer_id')
    .eq('id', quoteId)
    .eq('producer_id', producerId)
    .single()

  const quoteData = quoteResult.data as InboundQuoteRow | null

  if (quoteResult.error || !quoteData) {
    console.error('[inbound:action] Error obteniendo quote — code:', quoteResult.error?.code)
    return {
      message: 'No se encontro la cotizacion o no tienes permiso para acceder a ella.',
      isError: true,
    }
  }

  // ── Paso 5: Validar que el status es elegible para inbound ───────────────
  /*
   * Solo tiene sentido simular una respuesta inbound cuando la quote esta
   * en un estado donde el prospecto podria estar respondiendo.
   * Ver: lib/messages/inbound-scenarios.ts (INBOUND_ELIGIBLE_STATUSES).
   *
   * Si ya fue cerrada, opt_out, o en aprobacion, no tiene sentido simular inbound.
   */
  const isEligible = (INBOUND_ELIGIBLE_STATUSES as string[]).includes(quoteData.status)

  if (!isEligible) {
    return {
      message: `La cotizacion esta en estado '${quoteData.status}' y no es elegible para simular una respuesta. Solo se puede simular inbound desde: ${INBOUND_ELIGIBLE_STATUSES.join(', ')}.`,
      isError: true,
    }
  }

  // ── Paso 6: Obtener prospect ─────────────────────────────────────────────
  /*
   * Necesitamos el prospect para:
   *   - Registrar el mensaje inbound en whatsapp_messages (prospect_id).
   *   - Verificar opt_out antes de procesar (aunque la UI ya lo muestra en el detalle).
   *   - Si scenario.shouldSetOptOut: actualizar opt_out en prospects.
   *
   * PRIVACIDAD: No loguear full_name ni phone.
   */
  const prospectResult = await supabase
    .from('prospects')
    .select('id, opt_out, opt_out_at')
    .eq('id', quoteData.prospect_id)
    .eq('producer_id', producerId)
    .single()

  const prospectData = prospectResult.data as InboundProspectRow | null

  if (prospectResult.error || !prospectData) {
    console.error('[inbound:action] Error obteniendo prospect — code:', prospectResult.error?.code)
    return {
      message: 'No se pudo verificar los datos del prospecto. Intenta nuevamente.',
      isError: true,
    }
  }

  /*
   * Si el escenario NO es opt_out, verificamos que el prospect no tenga ya opt_out.
   * Si es opt_out, es logico que el prospect aun no lo tenga (lo vamos a marcar).
   * Pero si ya tiene opt_out y alguien intenta simular otra respuesta, bloqueamos.
   */
  if (!scenario.shouldSetOptOut && prospectData.opt_out) {
    return {
      message: 'El prospecto ya tiene opt-out activo. No se puede simular una respuesta que no sea opt_out.',
      isError: true,
    }
  }

  const now = new Date().toISOString()
  const prospectId = prospectData.id

  // ── Paso 7: INSERT en whatsapp_messages (registro inbound simulado) ───────
  /*
   * INTENCION: Registrar el mensaje ficticio que "envio" el prospecto.
   *
   * COLUMNAS VERIFICADAS (types/database.ts — whatsapp_messages.Insert):
   *   body: scenario.sampleMessage — el texto del mensaje ficticio
   *   direction: 'inbound' — el prospecto nos envio un mensaje (nos llego)
   *   delivery_status: 'delivered' — lo recibimos (ver nota en header del archivo)
   *   sent_at: now — timestamp simulado de cuando el prospect lo "envio"
   *   waba_message_id: null — sin WABA real, no hay ID externo del mensaje
   *   template_name: null — inbound no usa templates (templates son para outbound HSM)
   *   metadata: Json con flag de simulacion para distinguirlo de mensajes reales futuros
   *
   * GAP: waba_message_id = null en simulacion.
   *   En produccion, el webhook de WhatsApp incluye el ID del mensaje del prospecto.
   *   En simulacion local, no hay webhook — se deja null.
   *
   * DEGRADACION ELEGANTE: si falla, logueamos pero continuamos.
   * El UPDATE de status y el INSERT de quote_events son los pasos criticos.
   */
  const wabaInboundResult = await supabase
    .from('whatsapp_messages')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      prospect_id: prospectId,
      quote_id: quoteId,
      body: scenario.sampleMessage,
      direction: 'inbound' as const,
      delivery_status: 'delivered' as const,
      sent_at: now,
      waba_message_id: null,
      template_name: null,
      metadata: {
        simulated: true,
        scenario: scenarioKey,
        note: `Respuesta inbound simulada localmente — escenario '${scenarioKey}'. No llego por WhatsApp real.`,
        simulated_at: now,
      },
    } as any)

  if (wabaInboundResult.error) {
    // Error no critico — continuamos con el UPDATE de status y el evento.
    console.error(
      '[inbound:action] Error insertando whatsapp_message inbound simulado — code:',
      wabaInboundResult.error.code
    )
  }

  // ── Paso 8: Opt-out — actualizar prospects si corresponde ────────────────
  /*
   * Solo se ejecuta si scenario.shouldSetOptOut = true (escenario 'opt_out').
   *
   * INTENCION: Marcar al prospect como "no contactar" en la base de datos.
   * Esto bloquea futuros seguimientos en:
   *   - /dashboard/approvals: muestra aviso de opt-out en el formulario.
   *   - /dashboard/outbox: bloquea el boton "Simular envio".
   *   - Server Actions (approvals.ts, outbox.ts): validan opt_out en servidor.
   *
   * COLUMNAS ACTUALIZADAS:
   *   prospects.opt_out: true
   *   prospects.opt_out_at: timestamp actual (para saber cuando ocurrio)
   *
   * POR QUE updated_at NO SE ACTUALIZA MANUALMENTE:
   *   updated_at se maneja con un trigger en la DB (ver migrations).
   *   No se necesita incluirlo en el UPDATE.
   *
   * PATRON (supabase.from('prospects') as any).update():
   *   Por precaucion, usamos el mismo patron que para quotes.
   *   El error de Supabase TS puede afectar cualquier tabla del schema complejo.
   */
  if (scenario.shouldSetOptOut) {
    const optOutResult = await (supabase.from('prospects') as any)
      .update({
        opt_out: true,
        opt_out_at: now,
      })
      .eq('id', prospectId)
      .eq('producer_id', producerId)

    if (optOutResult.error) {
      // Opt-out es critico — si falla, retornamos error (no continuamos).
      console.error(
        '[inbound:action] Error actualizando opt_out del prospect — code:',
        optOutResult.error?.code
      )
      return {
        message: 'Error al marcar el opt-out del prospecto. Ver logs del servidor.',
        isError: true,
      }
    }
  }

  // ── Paso 9: UPDATE quotes.status → scenario.targetStatus ─────────────────
  /*
   * INTENCION: Cambiar el status de la quote al estado que corresponde
   * segun la respuesta del prospecto.
   *
   * PATRONES DE TRANSICION (ver INBOUND_SCENARIOS en inbound-scenarios.ts):
   *   interested   → contacted/no_response → interested   (prospecto quiere saber mas)
   *   has_question → contacted/no_response → responded     (prospecto tiene dudas)
   *   not_interested → contacted/no_response → closed_lost (prospecto no quiere)
   *   opt_out      → contacted/no_response → opt_out      (prospecto pide no contactar)
   *
   * PATRON (supabase.from('quotes') as any).update():
   *   El .update({...} as any) NO funciona para 'quotes' — el argumento se infiere
   *   como 'never' y 'any' no es asignable a 'never' en TypeScript estricto.
   *   La solucion es castear TODA la instancia del query builder a 'any'.
   *   Ver: app/actions/approvals.ts y app/actions/outbox.ts (patron identico).
   */
  const updateQuoteResult = await (supabase.from('quotes') as any)
    .update({
      status: scenario.targetStatus,
    })
    .eq('id', quoteId)
    .eq('producer_id', producerId)

  if (updateQuoteResult.error) {
    console.error(
      '[inbound:action] Error actualizando status de quote — code:',
      updateQuoteResult.error?.code
    )
    return {
      message: 'Error al actualizar el estado de la cotizacion. Ver logs del servidor.',
      isError: true,
    }
  }

  // ── Paso 10: INSERT en quote_events (audit trail) ────────────────────────
  /*
   * INTENCION: Registrar la respuesta inbound en el timeline de la quote.
   * Visible en /dashboard/quotes/[quoteId] en la seccion de timeline.
   *
   * VALORES:
   *   event_type: scenario.eventType
   *     'response_received' para los 3 escenarios no-opt_out (dot amber en timeline)
   *     'opt_out_received' para el escenario opt_out (dot rojo en timeline)
   *     Ambos ya mapeados en formatEventType() en [quoteId]/page.tsx.
   *   actor: 'webhook'
   *     Semanticamente correcto: en produccion, una respuesta inbound llega via webhook.
   *     Usamos 'webhook' aunque no hay webhook real, para reflejar la arquitectura futura.
   *   previous_status: el status actual de la quote (antes del cambio).
   *   new_status: scenario.targetStatus (el nuevo status).
   *   description: scenario.eventDescription (texto informativo para el timeline).
   *
   * NOTA SOBRE metadata EN quote_events:
   *   La tabla quote_events NO tiene columna metadata en el schema v2.0.
   *   Ver: types/database.ts — quote_events.Row (columnas reales).
   *   El contexto de la simulacion va en 'description'.
   */
  const eventResult = await supabase
    .from('quote_events')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      producer_id: producerId,
      quote_id: quoteId,
      event_type: scenario.eventType,
      actor: 'webhook' as const,
      previous_status: quoteData.status,
      new_status: scenario.targetStatus,
      description: `[Simulacion local] ${scenario.eventDescription}`,
    } as any)

  if (eventResult.error) {
    // Error no critico — el status ya se actualizo. Logueamos para debugging.
    console.error(
      '[inbound:action] Error insertando quote_event para inbound — code:',
      eventResult.error.code
    )
  }

  /*
   * EXITO: redirect al timeline de la quote.
   *
   * El producer ve el timeline actualizado con el nuevo evento inbound.
   * El status de la quote ya cambio (badge actualizado en el encabezado).
   *
   * IMPORTANTE: redirect() lanza NEXT_REDIRECT — la funcion nunca retorna aqui.
   */
  redirect(`/dashboard/quotes/${quoteId}`)
}
