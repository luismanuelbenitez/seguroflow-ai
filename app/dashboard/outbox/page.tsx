import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getLocalOutbox } from '@/lib/outbox/get-local-outbox'
import { formatInsuranceType, formatQuoteStatus } from '@/lib/quotes/get-quotes-for-current-producer'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import SimulateSendButton from '@/components/dashboard/simulate-send-button'
import PageHeader from '@/components/ui/page-header'
import DemoDisclaimer from '@/components/ui/demo-disclaimer'

/*
 * INTENCION: Outbox local simulado — ruta protegida.
 * Muestra mensajes aprobados pendientes de "envio" (simulado localmente).
 * El producer puede hacer clic en "Simular envio" para registrar que el
 * mensaje habria sido enviado por WhatsApp. SIN ENVIO REAL.
 *
 * QUE ES EL OUTBOX LOCAL:
 *   El outbox es una cola de mensajes que ESTARIAN listos para enviar si
 *   WABA (WhatsApp Business API) estuviera integrado. En el MVP local,
 *   "enviar" solo registra un evento en quote_events y un registro en
 *   whatsapp_messages con delivery_status='sent' y waba_message_id=null.
 *
 *   Esta pantalla permite al equipo de desarrollo validar el flujo completo:
 *   cotizacion creada → aprobada → "enviada" → visible en el timeline.
 *
 * REQUISITO PREVIO PARA VER ITEMS:
 *   1. Login con magic link (ver README.md).
 *   2. Seed local ejecutado (producer + membership).
 *   3. Cotizacion manual creada en /dashboard/quotes/new.
 *   4. Mensaje aprobado en /dashboard/approvals.
 *   Las quotes pasan a 'pending_approval' despues de aprobar en /approvals.
 *   Esas quotes son las que aparecen aqui.
 *
 * ARQUITECTURA (Server / Client split):
 *   Esta pagina (Server Component):
 *   - Valida sesion y producer (redirect si no hay).
 *   - Llama getLocalOutbox() para obtener los items.
 *   - Renderiza la lista con los datos pre-fetched.
 *
 *   SimulateSendButton (Client Component):
 *   - useActionState para estado de carga y errores por item.
 *   - Boton de submit — conectado a simulateSendApprovedMessage().
 *   - Aislamiento de errores por quoteId (multiples forms en la misma pagina).
 *
 * ITEMS ELEGIBLES PARA EL OUTBOX:
 *   - quotes.status = 'pending_approval'
 *   - quotes.approved_message IS NOT NULL
 *   Los prospects con opt_out = true aparecen con aviso y boton bloqueado.
 *
 * DESPUES DE "SIMULAR ENVIO":
 *   - quotes.status cambia a 'contacted'
 *   - El item desaparece del outbox (ya no esta en 'pending_approval')
 *   - Evento 'message_sent' visible en /dashboard/quotes/[quoteId]
 *   - Registro en whatsapp_messages con delivery_status='sent'
 *
 * LO QUE NO HACE ESTA PANTALLA:
 *   - NO envia ningun mensaje por WhatsApp
 *   - NO llama a ninguna API externa (Twilio, 360dialog, Meta)
 *   - NO usa service role
 *   - NO integra IA
 *   - NO usa datos reales
 *   - NO aplica migraciones remotas
 *
 * SEGURIDAD:
 *   - getUser() server-side (no getSession()).
 *   - getLocalOutbox() usa RLS — solo ve quotes del producer autenticado.
 *   - simulateSendApprovedMessage() re-valida sesion, propiedad y opt_out.
 *
 * Ver: lib/outbox/get-local-outbox.ts (helper con las queries)
 * Ver: app/actions/outbox.ts (Server Action de simulacion)
 * Ver: components/dashboard/simulate-send-button.tsx (Client Component del boton)
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */

export default async function OutboxPage() {
  // ── Paso 1: Validar sesion y obtener producer context ────────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  // ── Caso: usuario sin producer asociado ─────────────────────────────────
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
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
            No hay productor asociado a tu cuenta
          </p>
          <p style={{ margin: '0 0 1rem', color: '#78350f', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Para usar el outbox, primero asocia tu usuario a un producer.
            Ver: <code>supabase/seed.local.example.sql</code>
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

  // ── Paso 2: Obtener items del outbox ─────────────────────────────────────
  const producerId = ctx.membership!.producer_id
  const outboxResult = await getLocalOutbox(producerId)

  // ── Renderizar pagina ─────────────────────────────────────────────────────
  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>

      <DemoDisclaimer
        message="Outbox local: 'Simular envío' registra el evento pero NO envía mensajes reales por WhatsApp."
        variant="warning"
      />

      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Outbox local' }]}
        title="Outbox local"
        subtitle={`${ctx.producer?.name ?? 'Producer'} · Mensajes aprobados listos para simular envío.`}
        actions={
          <>
            <Link href="/dashboard/approvals" style={{ fontSize: '0.82rem', color: '#059669', textDecoration: 'none', fontWeight: 600 }}>← Aprobacion</Link>
            <Link href="/dashboard/quotes" style={{ fontSize: '0.82rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Cotizaciones →</Link>
          </>
        }
      />

      {/* Error de query */}
      {outboxResult.error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '1rem',
            fontSize: '0.88rem',
            color: '#991b1b',
            marginBottom: '1rem',
          }}
        >
          <strong>Error al cargar el outbox:</strong> {outboxResult.error}
        </div>
      )}

      {/* Estado vacio */}
      {!outboxResult.error && outboxResult.items.length === 0 && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#166534',
            }}
          >
            Outbox vacio
          </p>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: '#15803d', lineHeight: 1.6 }}>
            No hay mensajes aprobados pendientes de envio simulado.
            Los mensajes aparecen aqui despues de ser aprobados en la cola de aprobacion
            (estado <em>Pendiente aprobacion</em>).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard/approvals"
              style={{
                padding: '0.5rem 1rem',
                background: '#059669',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Ir a la cola de aprobacion
            </Link>
            <Link
              href="/dashboard/quotes/new"
              style={{
                padding: '0.5rem 1rem',
                background: '#fff',
                color: '#2563eb',
                border: '1px solid #2563eb',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              + Nueva cotizacion manual
            </Link>
          </div>
        </div>
      )}

      {/* Lista de items del outbox */}
      {outboxResult.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            {outboxResult.items.length} mensaje{outboxResult.items.length !== 1 ? 's' : ''}{' '}
            {outboxResult.items.length !== 1 ? 'listos' : 'listo'} para simulacion.
          </p>

          {outboxResult.items.map((item) => (
            <div
              key={item.quoteId}
              style={{
                background: '#fff',
                border: `1px solid ${item.prospectOptOut ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: '10px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {/* Encabezado de la tarjeta */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <h2 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    {item.prospectName}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    {item.prospectPhone}
                    {item.prospectOptOut && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          padding: '0.15rem 0.4rem',
                          background: '#fef2f2',
                          border: '1px solid #fca5a5',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          color: '#991b1b',
                          fontWeight: 600,
                        }}
                      >
                        OPT-OUT
                      </span>
                    )}
                  </p>
                </div>

                {/* Badges de estado y links de navegacion */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      background: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    {formatInsuranceType(item.insuranceType)}
                  </span>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      background: '#ede9fe',
                      color: '#6d28d9',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      border: '1px solid #c4b5fd',
                    }}
                  >
                    {formatQuoteStatus(item.quoteStatus)}
                  </span>
                  {/*
                   * Link al timeline de eventos de la quote.
                   * Despues de simular, el timeline mostrara el evento 'message_sent'.
                   */}
                  <Link
                    href={`/dashboard/quotes/${item.quoteId}`}
                    style={{
                      padding: '0.2rem 0.5rem',
                      background: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Ver timeline →
                  </Link>
                </div>
              </div>

              {/* Detalles de la cotizacion */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.4rem',
                  marginBottom: '1rem',
                  padding: '0.65rem 0.85rem',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#475569',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Fecha:</span>{' '}
                  {item.quoteDate}
                </div>
                {item.quotedAmount != null && (
                  <div>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Monto:</span>{' '}
                    {item.currency} {item.quotedAmount.toLocaleString('es-UY')}
                  </div>
                )}
                {item.insurerName && (
                  <div>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Aseguradora:</span>{' '}
                    {item.insurerName}
                  </div>
                )}
                {item.riskDescription && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Descripcion:</span>{' '}
                    {item.riskDescription}
                  </div>
                )}
              </div>

              {/*
               * Mensaje aprobado que sera "enviado".
               * Mostrado en un panel verde para reflejar que fue aprobado.
               * El producer ve exactamente el texto que el sistema simulara enviar.
               */}
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.85rem 1rem',
                  background: '#f0fdf4',
                  border: '1px solid #6ee7b7',
                  borderRadius: '6px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#065f46',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Mensaje aprobado — pendiente de envio simulado
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.83rem',
                    color: '#047857',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    fontFamily: 'monospace',
                  }}
                >
                  {item.approvedMessage}
                </p>
              </div>

              {/*
               * Boton de simulacion (Client Component).
               * Si opt_out = true, muestra aviso en lugar del boton.
               * Si opt_out = false, muestra el formulario con el boton.
               */}
              <SimulateSendButton
                quoteId={item.quoteId}
                isOptOut={item.prospectOptOut}
              />
            </div>
          ))}
        </div>
      )}

      {/* Nota tecnica de contexto MVP */}
      <div
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '0.78rem',
          color: '#64748b',
          lineHeight: 1.6,
        }}
      >
        <strong>Como funciona la simulacion:</strong>{' '}
        Al hacer clic en "Simular envio", el sistema:
        <ol style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem' }}>
          <li>Inserta un registro en <code>whatsapp_messages</code> con <code>delivery_status='sent'</code> y <code>waba_message_id=null</code></li>
          <li>Actualiza <code>quotes.status</code> de <code>pending_approval</code> a <code>contacted</code></li>
          <li>Inserta un evento en <code>quote_events</code> con <code>event_type='message_sent'</code></li>
        </ol>
        El evento es visible en el timeline de la cotizacion (link "Ver timeline →").
        Nada de esto interactua con WhatsApp real.
      </div>
    </DashboardShell>
  )
}
