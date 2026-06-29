import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getBasicDashboardMetrics } from '@/lib/metrics/get-basic-dashboard-metrics'
import { formatQuoteStatus } from '@/lib/quotes/get-quotes-for-current-producer'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import type { RecentEvent, StatusCount } from '@/lib/metrics/get-basic-dashboard-metrics'
import type { Database } from '@/types/database'

/*
 * INTENCION: Pantalla de métricas locales del MVP — /dashboard/metrics
 *
 * Muestra al producer un resumen del estado del flujo simulado:
 *   - Volumen de cotizaciones por estado
 *   - Embudo: creadas → contactadas → respondidas → interesadas → cerradas
 *   - Mensajes outbound e inbound simulados
 *   - Tasas calculadas: respuesta e interés
 *   - Últimos 5 eventos del timeline global
 *
 * RUTA: /dashboard/metrics
 *
 * FLUJO:
 *   1. getCurrentProducerContext() para validar sesion y obtener auth + producerId.
 *   2. Si no hay sesion → redirect a /login.
 *   3. Si no hay producer → mensaje de estado vacío.
 *   4. getBasicDashboardMetrics(producerId) — 5 queries en paralelo.
 *   5. Renderizar: cards, tabla de distribución, eventos recientes.
 *
 * DATOS:
 *   - Todos los datos son locales simulados (MVP fase 1).
 *   - NO hay WhatsApp real ni IA integrada.
 *   - Los mensajes outbound/inbound cuentan TODOS (en MVP todo es simulado).
 *   - Ver GAP en lib/metrics/get-basic-dashboard-metrics.ts
 *
 * DISEÑO:
 *   - Sin gráficos ni librerías adicionales.
 *   - Solo HTML + inline styles.
 *   - Cards en grid flexible (flex-wrap).
 *   - Tabla de distribución con barras proporcionales visuales simples.
 *
 * SEGURIDAD:
 *   - getUser() server-side — JWT validado.
 *   - getBasicDashboardMetrics filtra por producer_id + RLS.
 *   - No se usa service role en ningún momento.
 *
 * PRIVACIDAD:
 *   - La pantalla de métricas no muestra PII directa (nombres/teléfonos).
 *   - Solo conteos y tasas agregadas. Los links de eventos exponen quote_id (UUID, no PII).
 *
 * Ver: lib/metrics/get-basic-dashboard-metrics.ts (queries + cómputo)
 * Ver: docs/00-ai-context/CODING_RULES.md (reglas de comentarios y seguridad)
 */

type QuoteStatus = Database['public']['Enums']['quote_status']
type QuoteEventActor = Database['public']['Enums']['quote_event_actor']

// ─────────────────────────────────────────────
// Helpers de formato (inline — no exportados)
// ─────────────────────────────────────────────

/**
 * Traduce event_type (string libre) al español para el timeline de métricas.
 * Inlineado aquí porque la función en quotes/[quoteId]/page.tsx no es exportada.
 * Mantener en sync con app/dashboard/quotes/[quoteId]/page.tsx — formatEventType().
 */
function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    quote_created: 'Cotizacion creada',
    message_approved: 'Mensaje M1 aprobado',
    message_prepared: 'Mensaje preparado',
    message_sent: 'Mensaje enviado',
    message_delivered: 'Mensaje entregado',
    message_read: 'Mensaje leido',
    message_received: 'Mensaje recibido',
    response_received: 'Respuesta recibida',
    response_classified: 'Respuesta clasificada',
    follow_up_scheduled: 'Seguimiento programado',
    status_changed: 'Estado cambiado',
    human_handoff_created: 'Handoff a humano',
    opt_out_received: 'Opt-out recibido',
    opt_out_blocked_send: 'Envio bloqueado por opt-out',
  }
  return labels[eventType] ?? eventType
}

/**
 * Traduce el actor del evento al español.
 */
function formatActor(actor: QuoteEventActor): string {
  const labels: Record<QuoteEventActor, string> = {
    system: 'Sistema',
    producer: 'Producer',
    webhook: 'Webhook',
  }
  return labels[actor] ?? actor
}

/**
 * Formatea una fecha ISO a dd/mm/yyyy HH:MM para la UI.
 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

// ─────────────────────────────────────────────
// Sub-componentes de UI (sin 'use client' — Server Components)
// ─────────────────────────────────────────────

/**
 * Card de una métrica numérica.
 * Muestra: valor grande, etiqueta, nota opcional.
 * Color del borde izquierdo según tipo de métrica.
 */
function MetricCard({
  label,
  value,
  note,
  borderColor = '#e2e8f0',
  valueColor = '#0f172a',
}: {
  label: string
  value: string | number
  note?: string
  borderColor?: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        minWidth: '140px',
        flex: '1 1 140px',
      }}
    >
      <p
        style={{
          margin: '0 0 0.25rem',
          fontSize: '0.78rem',
          color: '#6b7280',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: '2rem',
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      {note && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
          {note}
        </p>
      )}
    </div>
  )
}

/**
 * Fila de la tabla de distribución por status.
 * Muestra barra proporcional visual usando un div con width calculado.
 */
function StatusRow({
  statusCount,
  maxCount,
}: {
  statusCount: StatusCount
  maxCount: number
}) {
  const widthPct = maxCount > 0 ? Math.round((statusCount.count / maxCount) * 100) : 0

  return (
    <tr>
      <td
        style={{
          padding: '0.5rem 0.75rem',
          fontSize: '0.85rem',
          color: '#374151',
          borderBottom: '1px solid #f1f5f9',
          whiteSpace: 'nowrap',
        }}
      >
        {formatQuoteStatus(statusCount.status)}
      </td>
      <td
        style={{
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid #f1f5f9',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              height: '8px',
              width: `${widthPct}%`,
              minWidth: widthPct > 0 ? '4px' : '0',
              background: '#3b82f6',
              borderRadius: '4px',
              transition: 'width 0.2s',
            }}
          />
          <span style={{ fontSize: '0.82rem', color: '#6b7280', minWidth: '1.5rem' }}>
            {statusCount.count}
          </span>
        </div>
      </td>
    </tr>
  )
}

/**
 * Fila de un evento reciente del timeline global.
 */
function EventRow({ event }: { event: RecentEvent }) {
  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      {/* Dot indicador */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#3b82f6',
          marginTop: '0.35rem',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
          {formatEventType(event.event_type)}
        </p>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
          {formatActor(event.actor)}
          {event.previous_status && event.new_status && (
            <>
              {' · '}
              {formatQuoteStatus(event.previous_status)}
              {' → '}
              {formatQuoteStatus(event.new_status)}
            </>
          )}
        </p>
        {event.description && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            {event.description}
          </p>
        )}
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
          {formatDate(event.created_at)}
          {' · '}
          <Link
            href={`/dashboard/quotes/${event.quote_id}`}
            style={{ color: '#3b82f6', textDecoration: 'none' }}
          >
            Ver cotizacion →
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default async function MetricsPage() {
  // ── Paso 1: Validar sesion ───────────────────────────────────────────────
  /*
   * getCurrentProducerContext() hace getUser() server-side (JWT real, no solo cookie).
   * Retorna un discriminated union: unauthenticated | success (con o sin producer).
   */
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  // ── Paso 2: Guard sin producer ───────────────────────────────────────────
  if (!ctx.hasProducer || !ctx.producer) {
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
          <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
            Sin producer asociado
          </p>
          <p style={{ margin: '0.5rem 0 1rem', color: '#78350f', fontSize: '0.9rem' }}>
            Para ver métricas necesitas un producer activo.
          </p>
          <Link href="/dashboard" style={{ color: '#2563eb', fontSize: '0.9rem' }}>
            ← Volver al dashboard
          </Link>
        </div>
      </DashboardShell>
    )
  }

  const producerId = ctx.producer.id
  const producerName = ctx.producer.name ?? 'Producer'

  // ── Paso 3: Cargar métricas ──────────────────────────────────────────────
  /*
   * getBasicDashboardMetrics corre 5 queries en paralelo (Promise.all).
   * No lanza excepción — retorna error como string si algo falla.
   */
  const metrics = await getBasicDashboardMetrics(producerId)

  // Máximo count para escalar las barras en la tabla de distribución
  const maxStatusCount = metrics.quotesByStatus[0]?.count ?? 1

  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>

      {/* ── Encabezado ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.82rem', color: '#94a3b8' }}>
          <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Dashboard
          </Link>
          {' / '}
          <span style={{ color: '#475569' }}>Métricas locales</span>
        </p>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
          Métricas locales
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
          {producerName}
        </p>
      </div>

      {/* ── Links de navegación rápida ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {[
          { href: '/dashboard/quotes/new', label: 'Nueva cotizacion', color: '#2563eb' },
          { href: '/dashboard/scheduler', label: 'Scheduler local', color: '#7c3aed' },
          { href: '/dashboard/approvals', label: 'Cola de aprobacion', color: '#059669' },
          { href: '/dashboard/outbox', label: 'Outbox local', color: '#d97706' },
          { href: '/dashboard/quotes', label: 'Ver cotizaciones', color: '#0891b2' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'inline-block',
              padding: '0.35rem 0.75rem',
              background: link.color,
              color: '#fff',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Disclaimer ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: '#1e40af',
        }}
      >
        <strong>MVP local:</strong> Estas métricas usan datos locales simulados.
        No hay WhatsApp real ni IA integrada. Los mensajes outbound/inbound son simulaciones del flujo.
      </div>

      {/* ── Error de query ───────────────────────────────────────────────── */}
      {metrics.error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.82rem',
            color: '#991b1b',
          }}
        >
          <strong>Error en queries:</strong> {metrics.error}
          <br />
          Los conteos pueden ser parciales. Verificar Supabase local.
        </div>
      )}

      {/* ── Sección: Volumen ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <p
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Volumen total
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <MetricCard
            label="Cotizaciones"
            value={metrics.totalQuotes}
            borderColor="#0f172a"
            valueColor="#0f172a"
          />
          <MetricCard
            label="Pend. seguimiento"
            value={metrics.pendingFollowUpCount}
            borderColor="#f59e0b"
            note="pending_follow_up"
          />
          <MetricCard
            label="Programadas"
            value={metrics.scheduledCount}
            borderColor="#8b5cf6"
            note="scheduled"
          />
          <MetricCard
            label="En aprobacion"
            value={metrics.pendingApprovalCount}
            borderColor="#3b82f6"
            note="pending_approval"
          />
        </div>
      </section>

      {/* ── Sección: Embudo de contacto ──────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <p
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Embudo de contacto
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <MetricCard
            label="Contactadas"
            value={metrics.contactedCount}
            borderColor="#0284c7"
            note="contacted + contacted_2"
          />
          <MetricCard
            label="Sin respuesta"
            value={metrics.noResponseCount}
            borderColor="#94a3b8"
            note="no_response + no_response_1"
            valueColor="#64748b"
          />
          <MetricCard
            label="Respondieron"
            value={metrics.respondedCount}
            borderColor="#0891b2"
            note="responded"
          />
          <MetricCard
            label="Interesadas"
            value={metrics.interestedCount}
            borderColor="#16a34a"
            valueColor="#166534"
            note="interested"
          />
        </div>
      </section>

      {/* ── Sección: Resultados ──────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <p
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Resultados
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <MetricCard
            label="Cerradas ganadas"
            value={metrics.closedWonCount}
            borderColor="#16a34a"
            valueColor="#166534"
            note="closed_won"
          />
          <MetricCard
            label="Cerradas perdidas"
            value={metrics.closedLostCount}
            borderColor="#dc2626"
            valueColor="#991b1b"
            note="closed_lost"
          />
          <MetricCard
            label="Opt-out (quotes)"
            value={metrics.optOutQuotesCount}
            borderColor="#f97316"
            note="status opt_out"
          />
          <MetricCard
            label="Opt-out (prospectos)"
            value={metrics.optOutProspectsCount}
            borderColor="#dc2626"
            note="prospects.opt_out=true"
          />
        </div>
      </section>

      {/* ── Sección: Mensajes simulados y tasas ─────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <p
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Mensajes simulados y tasas
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <MetricCard
            label="Enviados (outbound)"
            value={metrics.outboundSimulatedCount}
            borderColor="#0891b2"
            note="whatsapp_messages direction=outbound"
          />
          <MetricCard
            label="Recibidos (inbound)"
            value={metrics.inboundSimulatedCount}
            borderColor="#7c3aed"
            note="whatsapp_messages direction=inbound"
          />
          <MetricCard
            label="Tasa de respuesta"
            value={metrics.responseRate !== null ? `${metrics.responseRate}%` : '—'}
            borderColor="#0284c7"
            valueColor={metrics.responseRate !== null ? '#0c4a6e' : '#94a3b8'}
            note={
              metrics.responseRate !== null
                ? 'inbound / outbound'
                : 'sin mensajes enviados aun'
            }
          />
          <MetricCard
            label="Tasa de interes"
            value={metrics.interestRate !== null ? `${metrics.interestRate}%` : '—'}
            borderColor="#16a34a"
            valueColor={metrics.interestRate !== null ? '#166534' : '#94a3b8'}
            note={
              metrics.interestRate !== null
                ? 'interesadas / alguna vez contactadas'
                : 'sin contactadas aun'
            }
          />
        </div>
        {/* Nota sobre el denominador de tasa de interés */}
        <p
          style={{
            margin: '0.75rem 0 0',
            fontSize: '0.75rem',
            color: '#94a3b8',
          }}
        >
          Tasa de interés = quotes en "interested" / todas las quotes que recibieron al menos 1 mensaje.
          <br />
          GAP (MVP): en producción se filtraría por metadata.simulated para excluir mensajes reales del conteo.
        </p>
      </section>

      {/* ── Sección: Distribución por status ────────────────────────────── */}
      {metrics.quotesByStatus.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <p
            style={{
              margin: '0 0 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Distribución por estado
          </p>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th
                    style={{
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#64748b',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#64748b',
                      borderBottom: '1px solid #e2e8f0',
                      width: '100%',
                    }}
                  >
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.quotesByStatus.map((sc) => (
                  <StatusRow key={sc.status} statusCount={sc} maxCount={maxStatusCount} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Sección: Actividad reciente ──────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <p
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Actividad reciente (últimos 5 eventos)
        </p>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {metrics.lastEvents.length === 0 ? (
            <p
              style={{
                padding: '1.5rem 1rem',
                margin: 0,
                color: '#94a3b8',
                fontSize: '0.88rem',
                textAlign: 'center',
              }}
            >
              Sin eventos registrados todavía.
              <br />
              Creá una cotización y ejecutá el flujo para ver actividad aquí.
            </p>
          ) : (
            metrics.lastEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))
          )}
        </div>
      </section>

      {/* ── Footer: nota técnica ─────────────────────────────────────────── */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.78rem',
          color: '#94a3b8',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#64748b' }}>Notas técnicas (MVP local):</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          <li>
            Todos los mensajes en whatsapp_messages son simulados — no hay filtro por
            <code> metadata.simulated</code>. En M2 (WhatsApp real), se filtrará.
          </li>
          <li>
            Tasa de interés denomina sobre &quot;alguna vez contactadas&quot; (todos los estados
            post-contacto), no solo status actual <code>contacted</code>.
          </li>
          <li>
            Handoffs, pausadas, canceladas y errores se muestran en la distribución pero
            no tienen card individual por ser casos minoritarios en MVP.
          </li>
          <li>
            <code>follow_up_start_at</code> existe en el schema pero no se usa en métricas
            (cotizaciones manuales no setean ese campo). Ver scheduler para contexto.
          </li>
        </ul>
        <p style={{ margin: '0.5rem 0 0' }}>
          Ver: <code>lib/metrics/get-basic-dashboard-metrics.ts</code> para detalle de queries.
        </p>
      </div>

    </DashboardShell>
  )
}
