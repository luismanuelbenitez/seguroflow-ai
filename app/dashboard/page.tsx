import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import ProducerSummaryCard from '@/components/dashboard/producer-summary-card'

/*
 * INTENCION: Dashboard del producer — ruta protegida del MVP.
 * Verifica la sesion, obtiene el contexto del producer y renderiza el dashboard.
 *
 * POR QUE SERVER COMPONENT (sin 'use client'):
 *   - Toda la logica de auth y fetch ocurre en el servidor, antes de enviar HTML.
 *   - El redirect a /login ocurre en el servidor: el browser nunca ve datos protegidos.
 *   - Puede usar async/await directamente sin useEffect ni fetch del cliente.
 *
 * FLUJO DE ESTE COMPONENTE:
 *   1. getCurrentProducerContext() obtiene usuario + producer en una sola query.
 *   2. Si no hay sesion → redirect al login.
 *   3. Si hay sesion pero no hay producer → DashboardShell + ProducerSummaryCard (estado vacio).
 *   4. Si hay sesion y producer → DashboardShell + ProducerSummaryCard (con datos).
 *
 * ESTADO ACTUAL (MVP fase 2 — local):
 *   - Verifica sesion con getUser() (no getSession()) — seguro.
 *   - Verifica membresia en producer_members.
 *   - Muestra estado vacio con instrucciones si no hay producer.
 *   - NO consulta quotes, prospects ni otras tablas de negocio todavia.
 *
 * PROXIMAS ITERACIONES:
 *   - Mostrar resumen de quotes en seguimiento (quotes WHERE status NOT IN terminal).
 *   - Mostrar handoffs pendientes (human_handoffs WHERE status = 'pending').
 *   - Agregar navegacion: /dashboard/quotes, /dashboard/prospects.
 *
 * Ver: lib/producers/get-current-producer-context.ts (logica de auth + producer)
 * Ver: docs/02-mvp/MVP-01-recuperador-cotizaciones.md (spec del modulo)
 * Ver: docs/02-product/USER_FLOWS.md (Flujo 1: Producer accede al dashboard)
 */
export default async function DashboardPage() {
  /*
   * getCurrentProducerContext() hace dos cosas en una sola funcion:
   *   1. Valida la sesion con supabase.auth.getUser() (validacion server-side).
   *   2. Consulta producer_members + producers en una query con JOIN.
   *
   * Retorna un discriminated union: ProducerContextUnauthenticated | ProducerContextSuccess.
   */
  const ctx = await getCurrentProducerContext()

  /*
   * SEGURIDAD: Si no hay sesion, redirigir al login ANTES de renderizar cualquier cosa.
   * TypeScript estrecha el tipo: despues de este if, ctx.user es siempre non-null.
   */
  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  /*
   * A partir de aqui, TypeScript sabe que ctx es ProducerContextSuccess.
   * ctx.user es User (non-null). ctx.producer puede ser null (sin producer asociado).
   *
   * PRIVACIDAD: ctx.user.email es PII. Se pasa a DashboardShell para mostrarlo
   * al propio usuario. No loguear ni enviar a servicios de monitoreo.
   */
  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>
      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 1.5rem',
        }}
      >
        Dashboard
      </h1>

      {/*
       * ProducerSummaryCard muestra:
       *   - Datos del producer si hasProducer: true.
       *   - Mensaje de estado vacio si hasProducer: false.
       */}
      <ProducerSummaryCard context={ctx} />

      {/*
       * Acceso rapido a cotizaciones: link a /dashboard/quotes.
       * Solo se muestra si el usuario tiene un producer asociado.
       * Si no tiene producer, el usuario ya ve el estado vacio en ProducerSummaryCard.
       */}
      {ctx.hasProducer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Acceso rapido: Cotizaciones */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
                Cotizaciones
              </p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.82rem' }}>
                Lista de cotizaciones en seguimiento del producer
              </p>
            </div>
            <Link
              href="/dashboard/quotes"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Ver cotizaciones
            </Link>
          </section>

          {/*
           * Acceso rapido: Cola de aprobacion.
           * Muestra cotizaciones en pending_follow_up / scheduled / pending_approval
           * listas para que el producer apruebe el mensaje M1 antes de enviarlo.
           */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
                Cola de aprobacion
              </p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.82rem' }}>
                Revisa y aprueba los mensajes M1 de seguimiento antes de enviarlos
              </p>
            </div>
            <Link
              href="/dashboard/approvals"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#059669',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Cola de aprobacion
            </Link>
          </section>

          {/*
           * Acceso rapido: Outbox local simulado.
           * Muestra mensajes aprobados en 'pending_approval' listos para
           * simular el envio. NO envia WhatsApp real.
           * El producer hace clic en "Simular envio" para registrar localmente
           * que el mensaje habria sido enviado y ver el evento en el timeline.
           */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
                Outbox local
              </p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.82rem' }}>
                Simula el envio de mensajes aprobados — sin WhatsApp real
              </p>
            </div>
            <Link
              href="/dashboard/outbox"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#d97706',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Outbox local
            </Link>
          </section>
        </div>
      )}

      {/*
       * Seccion de proximos pasos del MVP.
       * Se muestra siempre, independientemente de si hay producer.
       * Sirve como roadmap visual para el equipo de desarrollo.
       */}
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
            margin: 0,
            fontWeight: 600,
            color: '#374151',
            fontSize: '0.9rem',
          }}
        >
          Proximas funcionalidades del MVP
        </p>
        <ul
          style={{
            marginTop: '0.75rem',
            paddingLeft: '1.25rem',
            color: '#6b7280',
            lineHeight: 1.7,
            fontSize: '0.88rem',
          }}
        >
          <li>✅ Listar cotizaciones demo en /dashboard/quotes</li>
          <li>✅ Carga manual de cotizaciones en /dashboard/quotes/new</li>
          <li>✅ Cola de aprobacion local en /dashboard/approvals</li>
          <li>✅ Outbox local simulado en /dashboard/outbox</li>
          <li>Ver prospectos del producer (tabla <code>prospects</code>)</li>
          <li>Panel de handoffs pendientes (tabla <code>human_handoffs</code>)</li>
          <li>Integracion WhatsApp sandbox (Twilio) para mensajes de seguimiento</li>
        </ul>
        <p
          style={{
            marginTop: '0.75rem',
            marginBottom: 0,
            fontSize: '0.78rem',
            color: '#9ca3af',
          }}
        >
          Ver: <code>docs/02-mvp/MVP-01-recuperador-cotizaciones.md</code>
        </p>
      </section>
    </DashboardShell>
  )
}
