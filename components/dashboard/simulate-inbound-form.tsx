'use client'

/*
 * INTENCION: Formulario para simular una respuesta inbound del prospecto.
 * Client Component porque necesita useActionState para manejar el estado
 * de la accion sin recargar toda la pagina.
 *
 * MUESTRA: 4 tarjetas, una por escenario. Cada tarjeta tiene:
 *   - El texto del mensaje que el prospect "enviaria" (sampleMessage).
 *   - El status objetivo de la quote si se elige este escenario.
 *   - Un boton submit que envia el formulario con name="scenario" value="key".
 *
 * POR QUE UN SOLO FORM CON 4 BOTONES (en lugar de 4 forms separados):
 *   La pagina de detalle muestra solo UNA quote. No hay problema de aislamiento
 *   de errores entre multiples instancias del mismo form (a diferencia de
 *   /dashboard/approvals y /dashboard/outbox donde hay N forms en la pagina).
 *   Un solo form simplifica el codigo y el estado.
 *
 * MECANISMO DE SUBMIT DE MULTIPLES BOTONES:
 *   HTML estandar: cuando un boton submit tiene name="scenario" value="key",
 *   al hacer clic en ese boton especifico, el FormData incluye scenario=key.
 *   El Server Action lee formData.get('scenario') para saber que escenario se eligio.
 *   No requiere JavaScript adicional — es comportamiento nativo del browser.
 *
 * COMPORTAMIENTO:
 *   - Durante el envio: todos los botones deshabilitados con "Simulando...".
 *   - En exito: redirect a /dashboard/quotes/[quoteId] (desde el Server Action).
 *   - En error: mensaje de error visible en el panel.
 *
 * Ver: app/actions/inbound.ts (Server Action simulateInboundResponse)
 * Ver: lib/messages/inbound-scenarios.ts (definicion de los 4 escenarios)
 * Ver: app/dashboard/quotes/[quoteId]/page.tsx (donde se renderiza este componente)
 * Ver: docs/00-ai-context/CODING_RULES.md (reglas de comentarios)
 */

import { useActionState } from 'react'
import { simulateInboundResponse, type InboundResult } from '@/app/actions/inbound'

const INBOUND_INITIAL_STATE: InboundResult = {
  message: '',
  isError: false,
}
import { INBOUND_SCENARIOS } from '@/lib/messages/inbound-scenarios'

/*
 * POR QUE NO IMPORTAMOS formatQuoteStatus AQUI:
 *   formatQuoteStatus vive en lib/quotes/get-quotes-for-current-producer.ts.
 *   Ese modulo importa lib/supabase/server.ts que usa 'next/headers'.
 *   'next/headers' solo funciona en Server Components.
 *   Un Client Component ('use client') no puede importar modulos que lo usen.
 *   Solucion: inline de los 4 labels de status que usan los escenarios inbound.
 *   No es duplicacion problematica — son 4 strings de presentacion fijos.
 */

// ============================================================
// Tipos locales
// ============================================================

interface SimulateInboundFormProps {
  /**
   * UUID de la quote. Se pasa como hidden input para que el Server Action
   * sepa a que quote aplicar la simulacion.
   */
  quoteId: string
}

// ============================================================
// Helper de presentacion (inline — no puede importarse de servidor)
// ============================================================

/**
 * INTENCION: Traducir los 4 status destino de los escenarios inbound al español.
 * Solo cubre los 4 status que pueden resultar de la simulacion inbound.
 * Para el mapa completo, ver lib/quotes/get-quotes-for-current-producer.ts (server-only).
 */
function formatScenarioStatus(status: string): string {
  const labels: Record<string, string> = {
    interested: 'Interesado',
    responded: 'Respondio',
    closed_lost: 'Cerrada — Perdida',
    opt_out: 'Opt-out (no contactar)',
  }
  return labels[status] ?? status
}

// ============================================================
// Componente principal
// ============================================================

export default function SimulateInboundForm({ quoteId }: SimulateInboundFormProps) {
  /*
   * useActionState conecta este componente con simulateInboundResponse().
   *
   * FIRMA DEL ACTION: (prevState: InboundResult, formData: FormData) => Promise<InboundResult>
   * ESTADO INICIAL: INBOUND_INITIAL_STATE = { message: '', isError: false }
   *
   * 'state': resultado del ultimo envio (o estado inicial con message vacio).
   * 'formAction': funcion que se pasa al atributo action del <form>.
   * 'isPending': true mientras el Server Action esta procesando.
   */
  const [state, formAction, isPending] = useActionState(
    simulateInboundResponse,
    INBOUND_INITIAL_STATE
  )

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginTop: '1rem',
      }}
    >
      {/* Encabezado de la seccion */}
      <div style={{ marginBottom: '0.75rem' }}>
        <p
          style={{
            margin: '0 0 0.25rem',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Simular respuesta del prospecto
        </p>

        {/*
         * Aviso de simulacion — siempre visible, nunca omitible.
         * El producer debe tener claro en todo momento que esto es local.
         */}
        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            color: '#d97706',
            fontWeight: 500,
          }}
        >
          Esto no recibe WhatsApp real. Solo registra una respuesta ficticia local para validar el flujo.
        </p>
      </div>

      {/*
       * Formulario unico con 4 botones submit (uno por escenario).
       * Cada boton tiene name="scenario" value={scenario.key} — HTML estandar.
       * El boton que se hace clic envia su value en el FormData.
       */}
      <form action={formAction}>
        {/* Hidden: identificador de la quote para el Server Action */}
        <input type="hidden" name="quote_id" value={quoteId} />

        {/*
         * Grid de 4 tarjetas — una por escenario.
         * En pantallas pequenas colapsa a 1 columna.
         */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          {INBOUND_SCENARIOS.map((scenario) => (
            <ScenarioCard
              key={scenario.key}
              scenarioKey={scenario.key}
              label={scenario.label}
              sampleMessage={scenario.sampleMessage}
              targetStatus={scenario.targetStatus}
              isOptOut={scenario.shouldSetOptOut}
              isPending={isPending}
            />
          ))}
        </div>

        {/*
         * Mensaje de error (si lo hay).
         * Solo se muestra cuando state.isError = true y hay mensaje.
         */}
        {state.isError && state.message && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
              fontSize: '0.8rem',
              color: '#dc2626',
              marginTop: '0.5rem',
            }}
            role="alert"
          >
            {state.message}
          </div>
        )}
      </form>

      {/* Nota tecnica al pie */}
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.5 }}>
        <strong>Que ocurre al simular:</strong>{' '}
        (1) INSERT en <code>whatsapp_messages</code> con <code>direction=&apos;inbound&apos;</code> y{' '}
        <code>metadata.simulated=true</code> ·{' '}
        (2) UPDATE de <code>quotes.status</code> segun el escenario ·{' '}
        (3) INSERT en <code>quote_events</code> visible en el timeline.
        {' '}Opt-out ademas actualiza <code>prospects.opt_out=true</code>.
      </p>
    </div>
  )
}

// ============================================================
// Subcomponente: tarjeta de escenario
// ============================================================

/**
 * INTENCION: Tarjeta individual para un escenario de respuesta inbound.
 * Muestra el mensaje que el prospect "enviaria", el status resultante
 * y el boton submit que dispara ese escenario.
 */
function ScenarioCard({
  scenarioKey,
  label,
  sampleMessage,
  targetStatus,
  isOptOut,
  isPending,
}: {
  scenarioKey: string
  label: string
  sampleMessage: string
  targetStatus: string
  isOptOut: boolean
  isPending: boolean
}) {
  /*
   * Colores de la tarjeta segun el tipo de escenario.
   * Opt-out: rojo (peligro — bloqueo definitivo).
   * No interesado: naranja suave (negativo pero reversible).
   * Duda: azul suave (neutral — requiere seguimiento).
   * Interesado: verde (positivo).
   */
  const cardColors = getScenarioCardColors(scenarioKey)

  return (
    <div
      style={{
        border: `1px solid ${cardColors.border}`,
        borderRadius: '6px',
        padding: '0.75rem',
        background: cardColors.bg,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Mensaje ficticio del prospect */}
      <p
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: '#374151',
          fontStyle: 'italic',
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        &ldquo;{sampleMessage}&rdquo;
      </p>

      {/* Status resultante */}
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280' }}>
        Status:{' '}
        <span
          style={{
            background: '#f3f4f6',
            color: '#374151',
            padding: '0.1rem 0.35rem',
            borderRadius: '3px',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
          }}
        >
          {formatScenarioStatus(targetStatus)}
        </span>
      </p>

      {/*
       * Boton submit con name="scenario" value={scenarioKey}.
       * Al hacer clic, el browser incluye scenario=scenarioKey en el FormData
       * ademas del quote_id del input hidden. HTML estandar, sin JS extra.
       *
       * Colores diferenciados segun impacto del escenario:
       *   interesado:     verde  (positivo)
       *   has_question:   azul   (neutral)
       *   not_interested: naranja (negativo)
       *   opt_out:        rojo   (critico — irreversible en MVP local)
       */}
      <button
        type="submit"
        name="scenario"
        value={scenarioKey}
        disabled={isPending}
        style={{
          padding: '0.4rem 0.75rem',
          background: isPending ? '#d1d5db' : cardColors.btnBg,
          color: isPending ? '#6b7280' : '#fff',
          border: 'none',
          borderRadius: '5px',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
          marginTop: 'auto',
        }}
        aria-busy={isPending}
      >
        {isPending ? 'Simulando...' : label}
      </button>

      {/* Advertencia adicional para opt-out — es la accion mas irreversible */}
      {isOptOut && !isPending && (
        <p style={{ margin: 0, fontSize: '0.68rem', color: '#ef4444', lineHeight: 1.4 }}>
          Marca prospects.opt_out=true — bloquea futuros seguimientos.
        </p>
      )}
    </div>
  )
}

// ============================================================
// Helpers de presentacion
// ============================================================

/**
 * INTENCION: Colores de la tarjeta segun el escenario.
 * Distingue visualmente el impacto de cada accion.
 */
function getScenarioCardColors(scenarioKey: string): {
  bg: string
  border: string
  btnBg: string
} {
  switch (scenarioKey) {
    case 'interested':
      return { bg: '#f0fdf4', border: '#6ee7b7', btnBg: '#059669' }
    case 'has_question':
      return { bg: '#eff6ff', border: '#93c5fd', btnBg: '#2563eb' }
    case 'not_interested':
      return { bg: '#fff7ed', border: '#fcd34d', btnBg: '#d97706' }
    case 'opt_out':
      return { bg: '#fef2f2', border: '#fca5a5', btnBg: '#dc2626' }
    default:
      return { bg: '#f9fafb', border: '#e5e7eb', btnBg: '#6b7280' }
  }
}
