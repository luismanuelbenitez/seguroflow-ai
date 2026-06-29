import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getLocalSchedulerPreview } from '@/lib/scheduler/get-local-scheduler-preview'
import { formatQuoteStatus, formatInsuranceType } from '@/lib/quotes/get-quotes-for-current-producer'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import RunSchedulerButton from '@/components/dashboard/run-scheduler-button'
import type { SchedulerCandidate } from '@/lib/scheduler/get-local-scheduler-preview'

/*
 * INTENCION: Pantalla del scheduler local — simula un cron/job de produccion.
 * Muestra las cotizaciones candidatas para seguimiento y permite ejecutar
 * el scheduler manualmente para moverlas al estado 'scheduled'.
 *
 * RUTA: /dashboard/scheduler
 *
 * FLUJO:
 *   1. Validar sesion con getCurrentProducerContext().
 *   2. Si no hay sesion → redirect a /login.
 *   3. Si no hay producer → mensaje y link a /dashboard.
 *   4. Cargar preview con getLocalSchedulerPreview(producerId).
 *   5. Renderizar: candidatas, bloqueadas por opt-out, boton RunSchedulerButton.
 *
 * SIMULACION (NO PRODUCCION):
 *   Este scheduler NO es un cron real. En produccion se usaria un servicio
 *   externo (pg_cron, Supabase Edge Functions con schedules, Vercel Cron, etc.)
 *   que detectaria cotizaciones cuyo umbral de seguimiento expiro.
 *   En el MVP local, el producer ejecuta el paso manualmente desde esta pantalla.
 *
 * QUE HACE EL SCHEDULER LOCAL:
 *   Mueve quotes de 'pending_follow_up' a 'scheduled'.
 *   Las quotes en 'scheduled' aparecen en /dashboard/approvals.
 *   El producer puede entonces aprobar el mensaje M1 desde ahi.
 *
 * SEGURIDAD:
 *   - getUser() server-side — valida JWT real.
 *   - getLocalSchedulerPreview() filtra por producer_id + RLS.
 *   - RunSchedulerButton → runLocalScheduler() re-valida todo en el servidor.
 *   - No se usa service role en ningun momento.
 *
 * PRIVACIDAD:
 *   - full_name, phone son PII. Se muestran al producer (sus propios clientes).
 *   - No loguear PII en errores.
 *
 * Ver: lib/scheduler/get-local-scheduler-preview.ts (helper de datos)
 * Ver: app/actions/scheduler.ts (Server Action runLocalScheduler)
 * Ver: components/dashboard/run-scheduler-button.tsx (Client Component interactivo)
 * Ver: app/dashboard/approvals/page.tsx (donde van las quotes despues del scheduler)
 */

export default async function SchedulerPage() {
  // ── Paso 1: Validar sesion ───────────────────────────────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  // ── Paso 2: Guard: sin producer ──────────────────────────────────────────
  if (!ctx.hasProducer) {
    return (
      <DashboardShell userEmail={ctx.user.email ?? ''}>
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <p style={{ margin: '0 0 1rem', fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
            No hay productor asociado a tu cuenta
          </p>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '0.45rem 1rem',
              background: '#92400e',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Volver al dashboard
          </Link>
        </div>
      </DashboardShell>
    )
  }

  const producerId = ctx.membership!.producer_id

  // ── Paso 3: Cargar preview del scheduler ─────────────────────────────────
  const preview = await getLocalSchedulerPreview(producerId)

  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>
      {/* Breadcrumb */}
      <nav
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.82rem',
          color: '#9ca3af',
        }}
        aria-label="Breadcrumb"
      >
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <span aria-hidden>›</span>
        <span style={{ color: '#374151', fontWeight: 600 }}>Scheduler local</span>
      </nav>

      {/* Encabezado */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
          Scheduler local
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
          Simula el cron/job de produccion que detecta cotizaciones pendientes de seguimiento
          y las mueve al estado <code>scheduled</code> para que aparezcan en la cola de aprobacion.
        </p>
      </div>

      {/* Links de navegacion */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Link
          href="/dashboard/approvals"
          style={{
            display: 'inline-block',
            padding: '0.3rem 0.75rem',
            background: '#f0fdf4',
            color: '#059669',
            border: '1px solid #6ee7b7',
            borderRadius: '5px',
            fontSize: '0.8rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Cola de aprobacion →
        </Link>
        <Link
          href="/dashboard/quotes"
          style={{
            display: 'inline-block',
            padding: '0.3rem 0.75rem',
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #93c5fd',
            borderRadius: '5px',
            fontSize: '0.8rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Lista de cotizaciones →
        </Link>
        <Link
          href="/dashboard/quotes/new"
          style={{
            display: 'inline-block',
            padding: '0.3rem 0.75rem',
            background: '#f8fafc',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            borderRadius: '5px',
            fontSize: '0.8rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          + Nueva cotizacion
        </Link>
      </div>

      {/* Error de carga del preview */}
      {preview.error && (
        <div
          style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: '#dc2626',
          }}
          role="alert"
        >
          {preview.error}
        </div>
      )}

      {/* Seccion: Candidatas para el scheduler */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Header de la seccion */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#374151' }}>
              Candidatas para seguimiento
            </p>
            <span
              style={{
                background: '#ede9fe',
                color: '#6d28d9',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
              }}
            >
              {preview.candidates.length}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af' }}>
              Estado: <code>pending_follow_up</code> → <code>scheduled</code>
            </span>
          </div>

          {/* Lista de candidatas */}
          {preview.candidates.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            >
              <p style={{ margin: '0 0 0.5rem' }}>
                No hay cotizaciones candidatas en este momento.
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1' }}>
                Crea una cotizacion desde <Link href="/dashboard/quotes/new" style={{ color: '#2563eb' }}>/quotes/new</Link> para ver como aparece aqui.
              </p>
            </div>
          ) : (
            <div style={{ padding: '0.5rem 0' }}>
              {preview.candidates.map((candidate, index) => (
                <CandidateRow
                  key={candidate.quoteId}
                  candidate={candidate}
                  isLast={index === preview.candidates.length - 1}
                  isBlocked={false}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/*
       * Seccion: Bloqueadas por opt-out.
       * Solo se muestra si hay al menos una quote bloqueada.
       * El scheduler NO las procesa — el producer debe cerrarlas manualmente.
       */}
      {preview.blockedByOptOut.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#fef2f2',
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#991b1b' }}>
                Bloqueadas por opt-out
              </p>
              <span
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                }}
              >
                {preview.blockedByOptOut.length}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#b91c1c' }}>
                El scheduler NO las procesa — cerrar manualmente
              </span>
            </div>

            <div style={{ padding: '0.5rem 0' }}>
              {preview.blockedByOptOut.map((candidate, index) => (
                <CandidateRow
                  key={candidate.quoteId}
                  candidate={candidate}
                  isLast={index === preview.blockedByOptOut.length - 1}
                  isBlocked={true}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Seccion: Boton de ejecucion */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.25rem',
        }}
      >
        <p
          style={{
            margin: '0 0 1rem',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Ejecutar scheduler
        </p>

        {/*
         * RunSchedulerButton es un Client Component.
         * Maneja el estado de carga y el resultado inline con useActionState.
         * Ver: components/dashboard/run-scheduler-button.tsx
         */}
        <RunSchedulerButton />
      </section>

      {/* Nota tecnica al pie */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '0.75rem 1rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '0.72rem',
          color: '#94a3b8',
          lineHeight: 1.6,
        }}
      >
        <strong>Nota tecnica MVP:</strong> El scheduler busca quotes con{' '}
        <code>status=&apos;pending_follow_up&apos;</code> y las mueve a{' '}
        <code>status=&apos;scheduled&apos;</code>. En produccion, se agregaria la condicion:{' '}
        <code>follow_up_start_at &lt;= NOW()</code> (la columna existe en el schema pero puede
        ser null en el MVP local). Tambien se procesaria <code>no_response_1</code> para M2.
        Actor del evento: <code>system</code> (en produccion seria el cron).
      </div>
    </DashboardShell>
  )
}

// ============================================================
// Subcomponente: fila de candidata
// ============================================================

/**
 * INTENCION: Mostrar una quote candidata o bloqueada del scheduler.
 * Incluye datos clave del prospect y de la cotizacion, mas link al timeline.
 */
function CandidateRow({
  candidate,
  isLast,
  isBlocked,
}: {
  candidate: SchedulerCandidate
  isLast: boolean
  isBlocked: boolean
}) {
  return (
    <div
      style={{
        padding: '0.75rem 1.25rem',
        borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        flexWrap: 'wrap',
        background: isBlocked ? '#fef9f9' : '#fff',
      }}
    >
      {/* Datos del prospect */}
      <div style={{ flex: '1', minWidth: '160px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
            {candidate.prospectName}
          </span>
          {isBlocked && (
            <span
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.1rem 0.35rem',
                borderRadius: '3px',
              }}
            >
              OPT-OUT
            </span>
          )}
        </div>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
          {candidate.prospectPhone}
        </p>
      </div>

      {/* Datos de la quote */}
      <div style={{ flex: '2', minWidth: '200px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Badge de tipo de seguro */}
        <span
          style={{
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
          }}
        >
          {formatInsuranceType(candidate.insuranceType)}
        </span>

        {/* Badge de status actual */}
        <span
          style={{
            background: '#fef9c3',
            color: '#854d0e',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
          }}
        >
          {formatQuoteStatus(candidate.quoteStatus)}
        </span>

        {/* Fecha de creacion */}
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          Creada: {formatShortDate(candidate.createdAt)}
        </span>

        {/*
         * follow_up_start_at: fecha objetivo de seguimiento.
         * En el MVP local puede ser null (no se setea en createManualQuote).
         * Se muestra si existe, como informacion adicional.
         */}
        {candidate.followUpStartAt && (
          <span style={{ fontSize: '0.75rem', color: '#7c3aed' }}>
            Seguimiento: {formatShortDate(candidate.followUpStartAt)}
          </span>
        )}

        {/* Descripcion del riesgo si existe */}
        {candidate.riskDescription && (
          <span
            style={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {candidate.riskDescription}
          </span>
        )}
      </div>

      {/* Link al timeline de la quote */}
      <div style={{ flexShrink: 0 }}>
        <Link
          href={`/dashboard/quotes/${candidate.quoteId}`}
          style={{
            display: 'inline-block',
            padding: '0.2rem 0.6rem',
            background: '#f0f9ff',
            color: '#0369a1',
            border: '1px solid #bae6fd',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Timeline →
        </Link>
      </div>
    </div>
  )
}

// ============================================================
// Helpers de formato
// ============================================================

/**
 * INTENCION: Formatear un timestamp ISO a fecha corta DD/MM/YYYY.
 * Usado para fechas de creacion y follow_up_start_at.
 */
function formatShortDate(isoStr: string | null): string {
  if (!isoStr) return '—'
  const [datePart] = isoStr.split('T')
  if (!datePart) return isoStr
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return isoStr
  return `${day}/${month}/${year}`
}
