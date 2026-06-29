import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import ProducerSummaryCard from '@/components/dashboard/producer-summary-card'
import DemoDisclaimer from '@/components/ui/demo-disclaimer'

/*
 * INTENCION: Dashboard principal — home del producto para el producer.
 * Muestra la propuesta de valor, acceso rápido a todas las secciones del flujo
 * y el estado del producer activo.
 *
 * CAMBIOS DE UX (demo comercial):
 *   - Hero con nombre del producto + tagline comercial.
 *   - 6 cards de acceso rapido organizados en grid.
 *   - Bloque visual del flujo MVP: Cotizacion → Scheduler → Aprobacion → Outbox → Respuesta → Metricas.
 *   - Disclaimer claro de demo local.
 *   - Checklist de funcionalidades activas (sin las pendientes que confunden en la demo).
 *
 * FLUJO:
 *   1. getCurrentProducerContext() valida sesion + obtiene producer.
 *   2. Si no hay sesion → redirect a /login.
 *   3. Si no hay producer → mostrar ProducerSummaryCard en estado vacio.
 *   4. Si hay producer → hero + quick access cards + flow diagram.
 *
 * SEGURIDAD:
 *   - getUser() server-side — valida JWT real.
 *   - No consulta quotes ni prospects aqui (se hace en cada sub-pagina).
 *   - No usa service role.
 *
 * Ver: lib/producers/get-current-producer-context.ts
 * Ver: components/dashboard/producer-summary-card.tsx
 */

// ─────────────────────────────────────────────
// Quick action cards: config de las 6 secciones
// ─────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    href: '/dashboard/quotes/new',
    label: '+ Nueva cotizacion',
    description: 'Cargar un prospecto y cotizacion manualmente',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    href: '/dashboard/scheduler',
    label: 'Scheduler local',
    description: 'Mover cotizaciones pendientes a seguimiento',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  {
    href: '/dashboard/approvals',
    label: 'Cola de aprobacion',
    description: 'Revisar y aprobar mensajes M1 antes de enviar',
    color: '#059669',
    bg: '#f0fdf4',
    border: '#a7f3d0',
  },
  {
    href: '/dashboard/outbox',
    label: 'Outbox local',
    description: 'Simular el envio de mensajes aprobados',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  {
    href: '/dashboard/quotes',
    label: 'Cotizaciones',
    description: 'Ver todas las cotizaciones y sus estados',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
  },
  {
    href: '/dashboard/metrics',
    label: 'Metricas locales',
    description: 'Estado del flujo: volumen, embudo y tasas',
    color: '#0891b2',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
]

// Etapas del flujo MVP para el diagrama visual
const FLOW_STEPS = [
  { label: 'Cotizacion', href: '/dashboard/quotes/new', color: '#2563eb' },
  { label: 'Scheduler', href: '/dashboard/scheduler', color: '#7c3aed' },
  { label: 'Aprobacion', href: '/dashboard/approvals', color: '#059669' },
  { label: 'Outbox', href: '/dashboard/outbox', color: '#d97706' },
  { label: 'Respuesta', href: '/dashboard/quotes', color: '#0891b2' },
  { label: 'Metricas', href: '/dashboard/metrics', color: '#475569' },
]

export default async function DashboardPage() {
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  const producerName = ctx.producer?.name ?? null

  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>

      {/* ── Disclaimer demo ──────────────────────────────────────────────── */}
      <DemoDisclaimer />

      {/* ── Hero section ────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
          borderRadius: '12px',
          padding: '2rem 2.25rem',
          marginBottom: '1.5rem',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  background: '#2563eb',
                  borderRadius: '6px',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                MVP Local
              </span>
              <span
                style={{
                  background: '#065f46',
                  borderRadius: '6px',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#6ee7b7',
                  letterSpacing: '0.05em',
                }}
              >
                Flujo completo activo
              </span>
            </div>
            <h1
              style={{
                margin: '0 0 0.4rem',
                fontSize: '1.6rem',
                fontWeight: 800,
                color: '#f8fafc',
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
              }}
            >
              SeguroFlow AI
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.95rem',
                color: '#94a3b8',
                lineHeight: 1.5,
                maxWidth: '480px',
              }}
            >
              Recuperá cotizaciones no cerradas con seguimiento asistido por WhatsApp.
              Automatizá el primer contacto y medí la respuesta de tus prospectos.
            </p>
          </div>

          {/* Estado del producer */}
          {ctx.hasProducer && producerName && (
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                minWidth: '160px',
              }}
            >
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Producer activo
              </p>
              <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9' }}>
                {producerName}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Flujo del MVP (diagrama visual) ─────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Flujo del MVP
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            flexWrap: 'wrap',
          }}
        >
          {FLOW_STEPS.map((step, idx) => (
            <div key={step.href} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Link
                href={step.href}
                style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.7rem',
                  background: `${step.color}18`,
                  color: step.color,
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: `1px solid ${step.color}30`,
                }}
              >
                {step.label}
              </Link>
              {idx < FLOW_STEPS.length - 1 && (
                <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Estado del producer (si no hay producer) ─────────────────────── */}
      {!ctx.hasProducer && (
        <div style={{ marginBottom: '1.5rem' }}>
          <ProducerSummaryCard context={ctx} />
        </div>
      )}

      {/* ── Quick access cards ───────────────────────────────────────────── */}
      {ctx.hasProducer && (
        <div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Acceso rápido
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    background: '#fff',
                    border: `1px solid ${action.border}`,
                    borderLeft: `4px solid ${action.color}`,
                    borderRadius: '10px',
                    padding: '1rem 1.1rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 0.25rem',
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      color: action.color,
                    }}
                  >
                    {action.label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.82rem',
                      color: '#64748b',
                      lineHeight: 1.4,
                    }}
                  >
                    {action.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Proximas funcionalidades (minimalista, solo para el equipo) ─── */}
      <div
        style={{
          marginTop: '1.75rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
        }}
      >
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Estado del MVP local
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.8, fontSize: '0.82rem', color: '#64748b' }}>
          <li>✅ Auth con magic link (Supabase)</li>
          <li>✅ Ingesta manual de cotizaciones (/quotes/new)</li>
          <li>✅ Scheduler local (/scheduler)</li>
          <li>✅ Cola de aprobacion de mensajes M1 (/approvals)</li>
          <li>✅ Outbox simulado (/outbox)</li>
          <li>✅ Timeline de eventos por cotizacion (/quotes/[id])</li>
          <li>✅ Simulacion de respuesta inbound (4 escenarios)</li>
          <li>✅ Metricas locales del flujo (/metrics)</li>
          <li style={{ color: '#94a3b8' }}>⬜ Integracion WhatsApp real (Twilio sandbox — M2)</li>
          <li style={{ color: '#94a3b8' }}>⬜ IA para clasificacion de respuestas (M3)</li>
        </ul>
      </div>

    </DashboardShell>
  )
}
