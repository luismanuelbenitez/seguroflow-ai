import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getApprovalQueue } from '@/lib/quotes/get-approval-queue'
import {
  buildInitialFollowUpMessage,
  getInsuranceTypeLabel,
} from '@/lib/messages/templates'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import ApprovalForm from '@/components/dashboard/approval-form'
import { formatQuoteStatus, formatInsuranceType } from '@/lib/quotes/get-quotes-for-current-producer'

/*
 * INTENCION: Cola de aprobacion de mensajes de seguimiento — ruta protegida.
 * Muestra las cotizaciones elegibles para que el producer revise el mensaje
 * M1 sugerido, lo edite si quiere, y lo apruebe localmente.
 *
 * ESTADO ACTUAL (MVP local — sin WhatsApp, sin IA):
 *   - Los mensajes se generan con plantillas estaticas (lib/messages/templates.ts).
 *   - La aprobacion guarda el texto en quotes.approved_message.
 *   - La aprobacion registra un evento en quote_events (audit log).
 *   - NO se envia ningun mensaje por WhatsApp.
 *   - NO se llama a ninguna IA.
 *   - NO se usa service role en ningun momento.
 *
 * ARQUITECTURA (Server / Client split):
 *   Este componente (Server Component) hace:
 *   - Autenticacion y producer check (redirect si no hay sesion/producer).
 *   - Carga de datos (getApprovalQueue) con el cliente de sesion del usuario.
 *   - Construccion del template M1 para cada cotizacion (lib/messages/templates.ts).
 *   - Render de la lista de tarjetas de aprobacion.
 *
 *   ApprovalForm (Client Component) hace:
 *   - useActionState para conectar con approveInitialFollowUpMessage().
 *   - Estado de carga por formulario (isPending).
 *   - Muestra errores inline si el action falla.
 *
 * ESTADOS ELEGIBLES PARA LA COLA (DECISION-005):
 *   - pending_follow_up: cotizacion nueva, producer puede pre-aprobar
 *   - scheduled: umbral vencido, listo para enviar (requiere cron que aun no existe)
 *   - pending_approval: mensaje ya preparado o previamente aprobado
 *
 * POR QUE EL TEMPLATE SE CONSTRUYE AQUI (NO EN EL CLIENT COMPONENT):
 *   buildInitialFollowUpMessage() es una funcion pura sincrona que no necesita
 *   datos del browser. Construirlo en el Server Component permite:
 *   1. No enviar la funcion de template al bundle del cliente.
 *   2. Asegurarse de que el texto inicial sea el mismo que vera el producer
 *      al abrir la pagina (sin flickering de carga).
 *
 * SEGURIDAD:
 *   - getUser() server-side (no getSession) — valida JWT contra Supabase Auth.
 *   - getApprovalQueue() usa RLS — solo ve quotes de su producer.
 *   - approveInitialFollowUpMessage() re-valida sesion y propiedad de la quote.
 *   - No se usa service role en ningun punto del flujo del producer.
 *
 * Ver: lib/quotes/get-approval-queue.ts (query de cotizaciones elegibles)
 * Ver: app/actions/approvals.ts (Server Action de aprobacion)
 * Ver: components/dashboard/approval-form.tsx (formulario interactivo por cotizacion)
 * Ver: lib/messages/templates.ts (buildInitialFollowUpMessage — sin IA)
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */

export default async function ApprovalsPage() {
  // ── Paso 1: Validar sesion y obtener producer context ────────────────────
  const ctx = await getCurrentProducerContext()

  /*
   * SEGURIDAD: redirect en el servidor antes de cualquier render.
   * El cliente nunca ve datos si no hay sesion activa.
   */
  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  // ── Caso: usuario sin producer asociado ─────────────────────────────────
  /*
   * Sin producer_id no se puede mostrar la cola de aprobacion.
   * Mostramos mensaje claro con link a /dashboard en lugar de pantalla rota.
   */
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
            Para ver la cola de aprobacion, primero debes asociar tu usuario a un producer.
            En desarrollo local, ejecuta el seed de la base de datos.
          </p>
          <p style={{ margin: '0 0 1rem', color: '#78350f', fontSize: '0.85rem' }}>
            Ver: <code>docs/05-architecture/LOCAL_SEEDING.md</code>
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

  // ── Paso 2: Obtener la cola de aprobacion ────────────────────────────────
  const producerId = ctx.membership!.producer_id
  const queueResult = await getApprovalQueue(producerId)

  /*
   * Nombre del producer para el template del mensaje.
   * Usamos contact_name (nombre de la persona) en lugar de name (nombre comercial)
   * para que el mensaje suene mas personal: "de parte de Gonzalo" vs "de parte de Seguros XYZ".
   * Fallback a name si contact_name no existe.
   */
  const producerDisplayName =
    ctx.producer?.contact_name || ctx.producer?.name || 'tu productor'

  // ── Renderizar pagina ─────────────────────────────────────────────────────
  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>
      {/* Navegacion breadcrumb */}
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
        <span style={{ color: '#374151', fontWeight: 600 }}>Cola de aprobacion</span>
        <span aria-hidden style={{ marginLeft: 'auto' }}>
          {/*
           * Link rapido al outbox desde la cola de aprobacion.
           * Flujo esperado: aprobar mensaje aqui → ir al outbox a simular envio.
           */}
        </span>
      </nav>

      {/* Link rapido al outbox — siguiente paso despues de aprobar */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href="/dashboard/outbox"
          style={{
            padding: '0.4rem 0.9rem',
            background: '#fff7ed',
            color: '#c2410c',
            border: '1px solid #fed7aa',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Outbox local →
        </Link>
      </div>

      {/* Encabezado */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            margin: '0 0 0.25rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#0f172a',
          }}
        >
          Cola de aprobacion
        </h1>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
          {ctx.producer?.name ?? 'Producer'} — rol:{' '}
          <strong>{ctx.membership?.role ?? '—'}</strong>
        </p>
        {/*
         * Recordatorio de estado para el equipo de desarrollo.
         * No apareceria en produccion — es un badge informativo del MVP.
         */}
        <div
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.6rem',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '12px',
            fontSize: '0.72rem',
            color: '#92400e',
            fontWeight: 600,
          }}
        >
          MVP LOCAL — Sin WhatsApp real · Sin IA · Solo aprobacion local
        </div>
      </div>

      {/* Error de query */}
      {queueResult.error && (
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
          <strong>Error al cargar la cola:</strong> {queueResult.error}
        </div>
      )}

      {/* Estado vacio: no hay cotizaciones elegibles */}
      {!queueResult.error && queueResult.items.length === 0 && (
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
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
              color: '#0369a1',
            }}
          >
            No hay cotizaciones para aprobar
          </p>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: '#0284c7', lineHeight: 1.6 }}>
            Las cotizaciones aparecen aqui cuando estan en estado{' '}
            <em>Esperando seguimiento</em>, <em>Programada</em> o{' '}
            <em>Pendiente aprobacion</em>.{' '}
            Carga cotizaciones manuales para probar el flujo.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard/quotes/new"
              style={{
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              + Nueva cotizacion manual
            </Link>
            <Link
              href="/dashboard/quotes"
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
              Ver todas las cotizaciones
            </Link>
          </div>
        </div>
      )}

      {/* Lista de items de la cola */}
      {queueResult.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            {queueResult.items.length} cotizacion{queueResult.items.length !== 1 ? 'es' : ''}{' '}
            {queueResult.items.length !== 1 ? 'requieren' : 'requiere'} revision.
            Las mas antiguas aparecen primero.
          </p>

          {queueResult.items.map((item) => {
            /*
             * INTENCION: Construir el texto del template M1 para cada cotizacion.
             * Se hace aqui (Server Component) para que el Client Component no
             * necesite importar ni ejecutar buildInitialFollowUpMessage.
             *
             * Si la cotizacion ya tiene approved_message, se pre-llena el textarea
             * con ese texto (para que el producer vea lo que aprobo antes y pueda
             * actualizarlo). Si no tiene, se usa el template generado.
             */
            const templateMessage = buildInitialFollowUpMessage({
              prospectName: item.prospectName,
              producerName: producerDisplayName,
              insuranceTypeLabel: getInsuranceTypeLabel(item.insuranceType),
              riskDescription: item.riskDescription,
              quotedAmount: item.quotedAmount,
              currency: item.currency,
            })

            // El textarea se pre-llena con el mensaje aprobado previo (si existe)
            // o con el template fresco (si es la primera aprobacion).
            const initialMessageForForm = item.approvedMessage ?? templateMessage

            const alreadyApproved = item.approvedMessage !== null

            return (
              <div
                key={item.quoteId}
                style={{
                  background: '#fff',
                  border: `1px solid ${item.prospectOptOut ? '#fca5a5' : (alreadyApproved ? '#6ee7b7' : '#e2e8f0')}`,
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
                    {/* Nombre e info del prospecto (PII del propio producer) */}
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

                  {/* Badges de estado + link al detalle */}
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
                        background: '#f0fdf4',
                        color: '#166534',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      {formatQuoteStatus(item.quoteStatus)}
                    </span>

                    {/*
                     * Link al timeline de eventos de esta cotizacion.
                     * Lleva a /dashboard/quotes/[quoteId] donde se muestra el
                     * historial completo de quote_events y los datos del prospect.
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
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#475569',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Fecha cotizacion:</span>{' '}
                    {item.quoteDate}
                  </div>
                  {item.quotedAmount && (
                    <div>
                      <span style={{ fontWeight: 600, color: '#374151' }}>Monto:</span>{' '}
                      {item.currency} {item.quotedAmount.toLocaleString('es-UY')}
                    </div>
                  )}
                  {item.riskDescription && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>Descripcion:</span>{' '}
                      {item.riskDescription}
                    </div>
                  )}
                  {item.internalNotes && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>Notas internas:</span>{' '}
                      {item.internalNotes}
                    </div>
                  )}
                </div>

                {/*
                 * Formulario de aprobacion (Client Component).
                 * Recibe el texto inicial (aprobado previo o template) y el quoteId.
                 * Si opt_out = true, muestra el aviso y no el formulario.
                 */}
                <ApprovalForm
                  quoteId={item.quoteId}
                  initialMessage={initialMessageForForm}
                  isOptOut={item.prospectOptOut}
                  alreadyApproved={alreadyApproved}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Nota de contexto MVP */}
      <div
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          fontSize: '0.78rem',
          color: '#0369a1',
        }}
      >
        <strong>Cola local MVP:</strong> Los mensajes aprobados aquí quedan guardados en{' '}
        <code>quotes.approved_message</code> y se registran en{' '}
        <code>quote_events</code> (event_type: <code>message_approved</code>).
        La integración con WhatsApp Business API (WABA) es la siguiente etapa.
        No se envia ningun mensaje real hasta que WABA este configurado.
      </div>
    </DashboardShell>
  )
}
