'use client'

/*
 * INTENCION: Formulario interactivo para que el producer revise, edite (opcionalmente)
 * y apruebe el mensaje M1 de seguimiento de una cotizacion.
 *
 * ARQUITECTURA:
 *   - Es un Client Component por tres razones:
 *     1. useActionState requiere 'use client' (React 19).
 *     2. Cada instancia de ApprovalForm tiene su propio estado de error aislado.
 *     3. Hay multiples formularios en la misma pagina (uno por cotizacion elegible).
 *
 *   - El texto inicial del textarea viene del Server Component padre:
 *     si la cotizacion ya tiene approved_message, se pre-llena con ese texto.
 *     si no, se pre-llena con el template M1 construido en la pagina.
 *
 * FLUJO DEL FORMULARIO:
 *   1. Producer ve el textarea con el texto sugerido (o el texto previamente aprobado).
 *   2. Puede editar el texto directamente en el textarea.
 *   3. Hace click en "Aprobar mensaje".
 *   4. approveInitialFollowUpMessage() recibe quote_id + message_text.
 *   5. Si exito: redirect('/dashboard/approvals') — la pagina se refresca.
 *   6. Si error: se muestra el mensaje de error debajo del formulario.
 *
 * PROPS:
 *   - quoteId: string — UUID de la cotizacion (va como hidden input)
 *   - initialMessage: string — texto pre-relleno del textarea
 *   - isOptOut: boolean — si true, deshabilita el formulario (opt_out del prospect)
 *   - alreadyApproved: boolean — si true, el boton dice "Re-aprobar"
 *
 * PATRON useActionState:
 *   Mismo patron que components/dashboard/quote-form.tsx (createManualQuote).
 *   El action signature es: (prevState, formData) => Promise<ApprovalActionResult>.
 *   APPROVAL_INITIAL_STATE se exporta desde app/actions/approvals.ts.
 *
 * POR QUE noValidate EN EL FORM:
 *   La validacion del servidor es la fuente de verdad.
 *   La validacion del navegador (required, maxlength) puede ser inconsistente
 *   entre browsers y no muestra errores con el mismo estilo que el rest de la UI.
 *   Preferimos mostrar errores inline debajo de cada campo (fieldErrors pattern).
 *
 * Ver: app/actions/approvals.ts (approveInitialFollowUpMessage)
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */

import { useActionState } from 'react'
import {
  approveInitialFollowUpMessage,
  APPROVAL_INITIAL_STATE,
} from '@/app/actions/approvals'

// ============================================================
// Props
// ============================================================

interface ApprovalFormProps {
  /** UUID de la cotizacion. Se pasa como campo hidden para el Server Action. */
  quoteId: string
  /**
   * Texto inicial del textarea. Puede ser:
   *   - El template M1 construido desde lib/messages/templates.ts (primer uso)
   *   - El texto previamente aprobado (si approved_message no es null)
   */
  initialMessage: string
  /**
   * Si el prospecto tiene opt_out = true, el formulario esta deshabilitado.
   * El producer ve el aviso pero no puede aprobar.
   */
  isOptOut: boolean
  /**
   * Si la cotizacion ya tiene un approved_message previo.
   * Cambia el label del boton de "Aprobar mensaje" a "Actualizar aprobacion".
   */
  alreadyApproved: boolean
}

// ============================================================
// Componente
// ============================================================

export default function ApprovalForm({
  quoteId,
  initialMessage,
  isOptOut,
  alreadyApproved,
}: ApprovalFormProps) {
  /*
   * useActionState: vincula el Server Action al formulario y mantiene el estado
   * entre envios. isPending es true mientras el action esta ejecutandose.
   *
   * state.failedQuoteId permite que el componente sepa si el error de la ultima
   * accion fue para ESTA cotizacion o para otra (hay multiples formularios en la pagina).
   * Si el error no es para este quoteId, no lo mostramos.
   */
  const [state, formAction, isPending] = useActionState(
    approveInitialFollowUpMessage,
    APPROVAL_INITIAL_STATE
  )

  // El error solo se muestra si corresponde a este formulario especifico
  const showError = state.isError && state.failedQuoteId === quoteId

  // El error general (sin quoteId) se muestra en todos los formularios
  const showGlobalError = state.isError && state.failedQuoteId === null

  if (isOptOut) {
    /*
     * Caso: prospecto con opt_out = true.
     * Mostramos el aviso pero NO el formulario — no tiene sentido aprobar un
     * mensaje que no puede enviarse.
     */
    return (
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          padding: '0.75rem 1rem',
          fontSize: '0.82rem',
          color: '#991b1b',
        }}
      >
        <strong>Opt-out activo:</strong> Este prospecto solicitó no recibir mensajes.
        No es posible aprobar ni enviar seguimiento.
      </div>
    )
  }

  return (
    <form action={formAction} noValidate>
      {/*
       * Campo oculto: pasa el quote_id al Server Action.
       * El producer nunca lo ve ni lo edita — es solo para identificar la cotizacion.
       */}
      <input type="hidden" name="quote_id" value={quoteId} />

      {/* Textarea: el producer puede editar el texto antes de aprobar */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label
          htmlFor={`message_text_${quoteId}`}
          style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '0.35rem',
          }}
        >
          Texto del mensaje (editable)
        </label>
        <textarea
          id={`message_text_${quoteId}`}
          name="message_text"
          defaultValue={initialMessage}
          rows={6}
          disabled={isPending}
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            resize: 'vertical',
            color: '#111827',
            background: isPending ? '#f9fafb' : '#fff',
            boxSizing: 'border-box',
          }}
        />
        {/*
         * Aviso de contexto: el producer sabe que este texto NO se envio todavia.
         * Es critico que quede claro que esto es solo una aprobacion local.
         */}
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.73rem', color: '#6b7280' }}>
          Este texto queda guardado localmente. No se envia por WhatsApp hasta que
          se configure la integración WABA.
        </p>
      </div>

      {/* Mensajes de error */}
      {(showError || showGlobalError) && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            padding: '0.6rem 0.75rem',
            fontSize: '0.82rem',
            color: '#991b1b',
            marginBottom: '0.75rem',
          }}
          role="alert"
        >
          {state.message}
        </div>
      )}

      {/* Boton de submit */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          display: 'inline-block',
          padding: '0.5rem 1.25rem',
          background: isPending ? '#9ca3af' : (alreadyApproved ? '#059669' : '#2563eb'),
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {isPending
          ? 'Guardando...'
          : alreadyApproved
            ? 'Actualizar aprobacion'
            : 'Aprobar mensaje'}
      </button>

      {/*
       * Badge de estado: si ya fue aprobado anteriormente, mostrar indicador visual.
       * Aparece a la derecha del boton para no ocupar espacio.
       */}
      {alreadyApproved && !isPending && (
        <span
          style={{
            display: 'inline-block',
            marginLeft: '0.75rem',
            padding: '0.3rem 0.6rem',
            background: '#d1fae5',
            border: '1px solid #6ee7b7',
            borderRadius: '12px',
            fontSize: '0.73rem',
            color: '#065f46',
            fontWeight: 600,
          }}
        >
          Aprobado localmente — pendiente envío WABA
        </span>
      )}
    </form>
  )
}
