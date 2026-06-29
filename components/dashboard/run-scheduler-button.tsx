'use client'

/*
 * INTENCION: Boton para ejecutar el scheduler local manualmente.
 * Client Component porque necesita useActionState para mostrar el resultado
 * de la ejecucion sin recargar toda la pagina.
 *
 * COMPORTAMIENTO:
 *   - Estado inicial (ran=false): muestra boton "Ejecutar scheduler local".
 *   - Durante la ejecucion (isPending=true): boton deshabilitado "Ejecutando...".
 *   - Exito (ran=true, isError=false): muestra resumen con processedCount y skippedCount.
 *   - Error (ran=true, isError=true): muestra mensaje de error.
 *   - En todos los casos: aviso "Recarga la pagina para ver la lista actualizada."
 *
 * POR QUE NO REDIRECT:
 *   El scheduler puede ser idempotente (ejecutar dos veces es seguro — la segunda
 *   vez no hay quotes en pending_follow_up porque ya fueron movidas). El producer
 *   puede ver el resultado inline y luego navegar manualmente a /dashboard/approvals.
 *   Un redirect perderia el contexto del resultado (processedCount).
 *
 * VER: app/actions/scheduler.ts (Server Action runLocalScheduler)
 * VER: app/dashboard/scheduler/page.tsx (pagina del scheduler)
 * VER: docs/00-ai-context/CODING_RULES.md (reglas de comentarios)
 */

import { useActionState } from 'react'
import { runLocalScheduler, type SchedulerResult } from '@/app/actions/scheduler'

const SCHEDULER_INITIAL_STATE: SchedulerResult = {
  ran: false,
  message: '',
  isError: false,
  processedCount: 0,
  skippedOptOutCount: 0,
  errorIds: [],
}

// ============================================================
// Componente
// ============================================================

export default function RunSchedulerButton() {
  /*
   * useActionState conecta este componente con runLocalScheduler().
   *
   * FIRMA: (prevState: SchedulerResult, formData: FormData) => Promise<SchedulerResult>
   * INICIAL: SCHEDULER_INITIAL_STATE = { ran: false, isError: false, processedCount: 0, ... }
   *
   * 'state': resultado de la ultima ejecucion (o estado inicial).
   * 'formAction': funcion conectada al atributo action del <form>.
   * 'isPending': true mientras runLocalScheduler() esta procesando.
   */
  const [state, formAction, isPending] = useActionState(
    runLocalScheduler,
    SCHEDULER_INITIAL_STATE
  )

  return (
    <div>
      {/*
       * Aviso de simulacion — siempre visible.
       * Refuerza que no se envian mensajes reales.
       */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '6px',
          fontSize: '0.82rem',
          color: '#92400e',
          marginBottom: '1rem',
          lineHeight: 1.5,
        }}
        role="note"
      >
        <strong>Simulacion local.</strong>{' '}
        Esta pantalla simula un cron/job de produccion. No envia WhatsApp real y no usa IA.
        Las cotizaciones procesadas apareceran en la{' '}
        <strong>cola de aprobacion</strong> (/dashboard/approvals).
      </div>

      {/* Formulario del scheduler — sin campos visibles (el form_data no se usa) */}
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '0.6rem 1.5rem',
            background: isPending ? '#d1d5db' : '#7c3aed',
            color: isPending ? '#6b7280' : '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s ease',
          }}
          aria-busy={isPending}
        >
          {isPending ? 'Ejecutando...' : 'Ejecutar scheduler local'}
        </button>

        {/*
         * Recordatorio de que la lista no se actualiza automaticamente.
         * El usuario debe recargar para ver los cambios en la lista de candidatas.
         */}
        {!isPending && !state.ran && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
            Mueve cotizaciones de <code>pending_follow_up</code> a <code>scheduled</code>.
            Recarga la pagina despues para ver la lista actualizada.
          </p>
        )}
      </form>

      {/* ── Resultado de la ejecucion ─────────────────────────────────────── */}
      {/*
       * Solo se muestra cuando state.ran = true (despues de ejecutar el scheduler).
       * state.isError: rojo (algo salio mal).
       * !state.isError: verde (exito) o amarillo (exito con advertencia).
       */}
      {state.ran && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: state.isError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${state.isError ? '#fca5a5' : '#6ee7b7'}`,
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: state.isError ? '#991b1b' : '#065f46',
            lineHeight: 1.5,
          }}
          role={state.isError ? 'alert' : 'status'}
        >
          {/*
           * Mensaje principal del resultado.
           * Incluye processedCount y skippedOptOutCount si es exito.
           */}
          <p style={{ margin: 0, fontWeight: 600 }}>
            {state.isError ? 'Error en el scheduler' : 'Scheduler ejecutado'}
          </p>
          <p style={{ margin: '0.3rem 0 0', fontWeight: 400 }}>
            {state.message}
          </p>

          {/* Detalle de contadores si fue exito */}
          {!state.isError && state.processedCount > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.7, fontSize: '0.82rem' }}>
              <li>
                <strong>{state.processedCount}</strong> cotizacion{state.processedCount !== 1 ? 'es' : ''} movida{state.processedCount !== 1 ? 's' : ''} a <code>scheduled</code>
              </li>
              {state.skippedOptOutCount > 0 && (
                <li>
                  <strong>{state.skippedOptOutCount}</strong> omitida{state.skippedOptOutCount !== 1 ? 's' : ''} por opt-out (prospect solicito no contactar)
                </li>
              )}
            </ul>
          )}

          {/* Links de navegacion post-ejecucion */}
          {!state.isError && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href="/dashboard/approvals"
                style={{
                  display: 'inline-block',
                  padding: '0.35rem 0.75rem',
                  background: '#059669',
                  color: '#fff',
                  borderRadius: '5px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Ver cola de aprobacion →
              </a>
              <a
                href="/dashboard/scheduler"
                style={{
                  display: 'inline-block',
                  padding: '0.35rem 0.75rem',
                  background: '#ede9fe',
                  color: '#6d28d9',
                  border: '1px solid #c4b5fd',
                  borderRadius: '5px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Recargar scheduler →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
