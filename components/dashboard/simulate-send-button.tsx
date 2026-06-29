'use client'

/*
 * INTENCION: Boton de envio simulado para el outbox local.
 * Client Component porque necesita useActionState para manejar el estado
 * de carga y los errores inline sin recargar la pagina.
 *
 * COMPORTAMIENTO:
 *   - Si isOptOut = true: muestra aviso de bloqueo, no el boton.
 *   - Si no: muestra formulario con boton "Simular envio".
 *   - Durante el envio: boton deshabilitado con texto "Simulando...".
 *   - En error: mensaje de error visible solo para ESTA quote (failedQuoteId === quoteId).
 *   - En exito: redirect a /dashboard/outbox (redirect ocurre en el Server Action).
 *
 * POR QUE MULTIPLES FORMULARIOS EN UNA PAGINA (mismo patron que ApprovalForm):
 *   La pagina del outbox muestra N items, cada uno con su propio SimulateSendButton.
 *   Cada instancia tiene su propio useActionState — estado completamente aislado.
 *   El resultado incluye failedQuoteId para que cada boton solo muestre
 *   el error de su propia quote, no el de otra.
 *
 * VER: app/actions/outbox.ts (Server Action simulateSendApprovedMessage)
 * VER: components/dashboard/approval-form.tsx (patron identico con failedQuoteId)
 * VER: docs/00-ai-context/CODING_RULES.md (reglas de comentarios)
 */

import { useActionState } from 'react'
import {
  simulateSendApprovedMessage,
  SIMULATE_INITIAL_STATE,
} from '@/app/actions/outbox'

// ============================================================
// Tipos de props
// ============================================================

interface SimulateSendButtonProps {
  /**
   * UUID de la quote a simular. Se pasa como hidden input en el form.
   * El Server Action lee este valor para identificar la quote.
   */
  quoteId: string
  /**
   * Si true, el prospect tiene opt-out activo.
   * El boton se reemplaza por un aviso de bloqueo.
   * Doble barrera: la UI bloquea + el Server Action valida nuevamente.
   */
  isOptOut: boolean
}

// ============================================================
// Componente
// ============================================================

export default function SimulateSendButton({ quoteId, isOptOut }: SimulateSendButtonProps) {
  /*
   * useActionState: conecta este componente con simulateSendApprovedMessage().
   *
   * FIRMA DEL ACTION: (prevState: SimulateResult, formData: FormData) => Promise<SimulateResult>
   * ESTADO INICIAL: SIMULATE_INITIAL_STATE = { message: '', isError: false, failedQuoteId: null }
   *
   * 'state': resultado del ultimo envio del form (o estado inicial).
   * 'formAction': funcion que conecta el <form action={formAction}>.
   * 'isPending': true mientras el Server Action esta procesando.
   *
   * NOTA: isPending se resetea a false cuando el action termina.
   * Si el action hace redirect(), el componente se desmonta y isPending
   * nunca vuelve a false — la pagina navega antes.
   */
  const [state, formAction, isPending] = useActionState(
    simulateSendApprovedMessage,
    SIMULATE_INITIAL_STATE
  )

  // ── Caso: opt-out activo — no mostrar boton ──────────────────────────────
  /*
   * Si el prospect tiene opt-out, mostramos un aviso claro y NO el formulario.
   * Esto previene que el producer haga clic "por accidente" en un prospect
   * que explicitamente pidio no ser contactado.
   *
   * El Server Action tiene su propia validacion de opt_out (doble barrera).
   */
  if (isOptOut) {
    return (
      <div
        style={{
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          fontSize: '0.82rem',
          color: '#991b1b',
          fontWeight: 500,
        }}
        role="alert"
      >
        Simulacion bloqueada — prospecto con opt-out activo.
        <span style={{ display: 'block', fontWeight: 400, marginTop: '0.2rem', color: '#b91c1c' }}>
          El prospect solicito no ser contactado. Para continuar, el prospect debe revocar el opt-out.
        </span>
      </div>
    )
  }

  // ── Caso normal: mostrar formulario con boton ────────────────────────────
  /*
   * INTENCION DEL FORMULARIO:
   *   - Un input hidden con el quoteId para que el Server Action sepa que quote procesar.
   *   - El boton de submit dispara simulateSendApprovedMessage().
   *   - El texto del boton cambia a "Simulando..." mientras isPending = true.
   *   - Solo se muestra el error si failedQuoteId === quoteId (aislamiento por form).
   *
   * POR QUE NO NECESITAMOS onSubmit MANUAL:
   *   formAction se pasa directamente al atributo action del form.
   *   React 19 + Next.js 15 manejan el envio y el estado automaticamente.
   */
  return (
    <form action={formAction}>
      {/* Hidden: identificador de la quote — el Server Action lo usa en Paso 2 */}
      <input type="hidden" name="quote_id" value={quoteId} />

      {/*
       * Mensaje de error — aislado por quoteId.
       * Solo se muestra si failedQuoteId coincide con esta instancia.
       * Esto evita que un error de otra quote aparezca en este formulario.
       */}
      {state.isError && state.failedQuoteId === quoteId && state.message && (
        <p
          style={{
            margin: '0 0 0.5rem',
            padding: '0.4rem 0.75rem',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            fontSize: '0.8rem',
            color: '#dc2626',
          }}
          role="alert"
        >
          {state.message}
        </p>
      )}

      {/*
       * Boton de simulacion.
       * DESHABILITADO si isPending para prevenir doble submit.
       *
       * DISENO INTENCIONAL: el boton usa colores naranja/amber para
       * distinguirlo visualmente del verde de "Aprobar" (/approvals).
       * Naranja = "simulacion" = accion que no es definitiva/real.
       */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: '0.5rem 1.25rem',
          background: isPending ? '#d1d5db' : '#d97706',
          color: isPending ? '#6b7280' : '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
        }}
        aria-busy={isPending}
      >
        {isPending ? 'Simulando...' : 'Simular envio'}
      </button>

      {/*
       * Recordatorio visual de que esto NO es un envio real.
       * Refuerza la expectativa del producer: nada sale hacia WhatsApp.
       */}
      {!isPending && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
          Solo registra localmente — no envia WhatsApp real
        </p>
      )}
    </form>
  )
}
