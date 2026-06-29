import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getQuoteDetail } from '@/lib/quotes/get-quote-detail'
import { formatQuoteStatus, formatInsuranceType } from '@/lib/quotes/get-quotes-for-current-producer'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import type { QuoteEventDetailRow, QuoteDetailRow, ProspectDetailRow, QuoteStatus } from '@/lib/quotes/get-quote-detail'

/*
 * INTENCION: Vista de detalle de una cotizacion individual con timeline de eventos.
 * Muestra todos los datos de la quote (incluyendo approved_message e internal_notes,
 * que NO se muestran en la lista), los datos del prospect, y el historial de eventos
 * en orden cronologico.
 *
 * RUTA: /dashboard/quotes/[quoteId] (ruta dinamica Next.js 15)
 *
 * FLUJO:
 *   1. Await params (Next.js 15 — params es un Promise en App Router).
 *   2. Validar sesion con getCurrentProducerContext().
 *   3. Llamar a getQuoteDetail(quoteId, producerId) — 3 queries separadas.
 *   4. Si notFound → mostrar 404 local (no revelar si existe en otro producer).
 *   5. Renderizar: datos de quote, datos de prospect, timeline de eventos.
 *
 * NEXT.JS 15 — PARAMS ES PROMISE:
 *   En App Router v15, el objeto `params` de los Server Components dinamicos
 *   es un Promise que debe ser awaited. No desestructurar directamente.
 *   Ver: https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
 *
 * SEGURIDAD:
 *   - getUser() server-side — valida JWT real.
 *   - getQuoteDetail() filtra por producer_id + RLS.
 *   - Si la quote no existe o es de otro producer → notFound: true.
 *     NO se revela si existe en otro producer (information disclosure).
 *   - No se usa service role en ningun momento.
 *
 * PRIVACIDAD:
 *   - full_name, phone, email son PII (Ley 18.331, Uruguay).
 *     Mostrados al producer porque son sus propios clientes.
 *   - approved_message y internal_notes son datos internos del producer.
 *     Visibles en esta vista de detalle (a diferencia de la lista general).
 *
 * NOTA SOBRE metadata EN quote_events:
 *   La tabla quote_events NO tiene columna metadata en el schema v2.0.
 *   Por eso el timeline no muestra metadata — la columna no existe.
 *   Ver: lib/quotes/get-quote-detail.ts (documentacion del gap).
 *
 * Ver: lib/quotes/get-quote-detail.ts (helper de 3 queries)
 * Ver: app/dashboard/quotes/page.tsx (lista de quotes — tiene el link "Ver detalle")
 * Ver: app/dashboard/approvals/page.tsx (tiene el link "Ver timeline")
 * Ver: types/database.ts (columnas reales de quote_events)
 */

// ============================================================
// Tipos de pagina
// ============================================================

/*
 * Next.js 15: params es una Promise, no un objeto plano.
 * Esta es la firma correcta para Server Components de rutas dinamicas.
 */
type PageProps = {
  params: Promise<{ quoteId: string }>
}

// ============================================================
// Componente principal
// ============================================================

export default async function QuoteDetailPage({ params }: PageProps) {
  // ── Paso 1: Resolver params (Next.js 15 — Promise) ──────────────────────
  const { quoteId } = await params

  // ── Paso 2: Validar sesion y obtener producer context ───────────────────
  const ctx = await getCurrentProducerContext()

  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  if (!ctx.hasProducer) {
    return (
      <DashboardShell userEmail={ctx.user.email ?? ''}>
        <NoProducerMessage />
      </DashboardShell>
    )
  }

  const producerId = ctx.membership!.producer_id

  // ── Paso 3: Obtener detalle de la quote ─────────────────────────────────
  /*
   * getQuoteDetail hace 3 queries separadas:
   *   1. quote por (id, producer_id) — sin joins para evitar inferencia 'never' de Supabase TS.
   *   2. prospect del quote
   *   3. quote_events del quote ordenados cronologicamente
   *
   * Si la quote no existe o pertenece a otro producer → notFound: true.
   * Tratamos ambos casos igual (sin revelar si existe en otro producer).
   */
  const detail = await getQuoteDetail(quoteId, producerId)

  // ── Caso: no encontrada ──────────────────────────────────────────────────
  if (detail.notFound) {
    return (
      <DashboardShell userEmail={ctx.user.email ?? ''}>
        <QuoteNotFoundView />
      </DashboardShell>
    )
  }

  // ── Caso: error de query ─────────────────────────────────────────────────
  if (detail.error) {
    return (
      <DashboardShell userEmail={ctx.user.email ?? ''}>
        <QueryErrorView error={detail.error} />
      </DashboardShell>
    )
  }

  // ── Narrowing explícito para TypeScript ──────────────────────────────────
  /*
   * QuoteDetailResult es una union discriminada con dos ramas para notFound=false:
   *   - { quote: QuoteDetailRow, error: null }  (exito)
   *   - { quote: null,           error: string } (fallo)
   *
   * Despues de los guards anteriores, TypeScript no siempre puede narrowear
   * quote a QuoteDetailRow porque 'error: string' podria ser '' (falsy).
   * Este check adicional garantiza que quote no es null antes de desestructurar.
   * En runtime, si llegamos aqui con quote=null seria un estado inconsistente
   * que nunca deberia ocurrir (el error guard de arriba lo atrapa siempre).
   */
  if (!detail.quote) {
    return (
      <DashboardShell userEmail={ctx.user.email ?? ''}>
        <QueryErrorView error="Error inesperado al cargar la cotizacion." />
      </DashboardShell>
    )
  }

  // ── Paso 4: Renderizar detalle ───────────────────────────────────────────
  const { quote, prospect, events } = detail
  const isDemo = quote.origin_channel === 'demo_local'

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
        <Link href="/dashboard/quotes" style={{ color: '#6b7280', textDecoration: 'none' }}>
          Cotizaciones
        </Link>
        <span aria-hidden>›</span>
        <span style={{ color: '#374151', fontWeight: 600 }}>
          {prospect?.full_name ?? 'Detalle'}
        </span>
      </nav>

      {/* Encabezado de la quote */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {prospect?.full_name ?? 'Prospect desconocido'}
            </h1>
            {isDemo && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  letterSpacing: '0.03em',
                }}
              >
                DEMO
              </span>
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {formatInsuranceType(quote.insurance_type)} · ID: <code style={{ fontSize: '0.78rem' }}>{quote.id.slice(0, 8)}…</code>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Badge de estado */}
          <QuoteStatusBadge status={quote.status} />

          {/* Link a la cola de aprobacion si es elegible */}
          {['pending_follow_up', 'scheduled', 'pending_approval'].includes(quote.status) && (
            <Link
              href="/dashboard/approvals"
              style={{
                padding: '0.3rem 0.75rem',
                background: '#059669',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Aprobar mensaje M1
            </Link>
          )}
        </div>
      </div>

      {/* Grid de datos: quote a la izquierda, prospect a la derecha */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Tarjeta de datos de la quote */}
        <QuoteDataCard quote={quote} />

        {/* Tarjeta del prospect */}
        <ProspectDataCard prospect={prospect} />
      </div>

      {/* Mensaje aprobado (si existe) */}
      {quote.approved_message && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #6ee7b7',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#065f46' }}>
            Mensaje M1 aprobado localmente
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: '#047857',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              fontFamily: 'monospace',
            }}
          >
            {quote.approved_message}
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#10b981' }}>
            Pendiente envio WABA — Sin integracion WhatsApp aun (MVP local)
          </p>
        </div>
      )}

      {/* Notas internas (si existen) */}
      {quote.internal_notes && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.4rem', fontWeight: 600, fontSize: '0.82rem', color: '#92400e' }}>
            Notas internas
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', lineHeight: 1.6 }}>
            {quote.internal_notes}
          </p>
        </div>
      )}

      {/* Timeline de eventos */}
      <EventTimeline events={events} quoteCreatedAt={quote.created_at} />
    </DashboardShell>
  )
}

// ============================================================
// Subcomponentes de datos
// ============================================================

/**
 * INTENCION: Mostrar los campos clave de la cotizacion en un panel.
 */
function QuoteDataCard({ quote }: { quote: QuoteDetailRow }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
      }}
    >
      <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Cotizacion
      </p>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <DataRow label="Tipo de seguro" value={formatInsuranceType(quote.insurance_type)} />
        <DataRow label="Estado" value={formatQuoteStatus(quote.status)} />
        <DataRow label="Fecha" value={formatDate(quote.quote_date)} />
        {quote.expiry_date && (
          <DataRow label="Vencimiento" value={formatDate(quote.expiry_date)} />
        )}
        {quote.quoted_amount != null && (
          <DataRow
            label="Monto"
            value={`${quote.currency} ${quote.quoted_amount.toLocaleString('es-UY')}`}
          />
        )}
        {quote.insurer_name && (
          <DataRow label="Aseguradora" value={quote.insurer_name} />
        )}
        {quote.risk_description && (
          <DataRow label="Descripcion / Ref" value={quote.risk_description} />
        )}
        {quote.follow_up_start_at && (
          <DataRow label="Inicio seguimiento" value={formatDateTime(quote.follow_up_start_at)} />
        )}
        <DataRow label="Origen" value={quote.origin_channel ?? '—'} />
        <DataRow label="Creada" value={formatDateTime(quote.created_at)} />
        <DataRow label="Actualizada" value={formatDateTime(quote.updated_at)} />
      </dl>
    </div>
  )
}

/**
 * INTENCION: Mostrar los datos del prospect asociado a la cotizacion.
 * Muestra PII al producer porque son sus propios clientes.
 */
function ProspectDataCard({ prospect }: { prospect: ProspectDetailRow | null }) {
  if (!prospect) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
          Datos del prospect no disponibles
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${prospect.opt_out ? '#fca5a5' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
      }}
    >
      <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Prospecto
      </p>

      {prospect.opt_out && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.75rem',
            fontSize: '0.78rem',
            color: '#991b1b',
            fontWeight: 600,
          }}
        >
          OPT-OUT activo — No contactar por WhatsApp
          {prospect.opt_out_at && (
            <span style={{ fontWeight: 400 }}> · {formatDateTime(prospect.opt_out_at)}</span>
          )}
        </div>
      )}

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <DataRow label="Nombre" value={prospect.full_name} />
        <DataRow label="Telefono" value={prospect.phone} />
        {prospect.email && (
          <DataRow label="Email" value={prospect.email} />
        )}
        <DataRow label="Consentimiento" value={formatConsentStatus(prospect.consent_status)} />
        <DataRow label="Opt-out" value={prospect.opt_out ? 'Si' : 'No'} />
      </dl>
    </div>
  )
}

/**
 * INTENCION: Mostrar el timeline cronologico de quote_events.
 *
 * NOTA: quote_events es append-only — lo que se ve aqui es el historial real.
 * No hay forma de editar o borrar eventos una vez insertados.
 *
 * NOTA SOBRE metadata: La tabla quote_events NO tiene columna metadata.
 * El timeline muestra: timestamp, event_type, actor, transicion de estado, description.
 * Ver: lib/quotes/get-quote-detail.ts (documentacion completa del gap).
 */
function EventTimeline({ events, quoteCreatedAt }: { events: QuoteEventDetailRow[]; quoteCreatedAt: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
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
        Timeline de eventos
        <span
          style={{
            marginLeft: '0.5rem',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.72rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          {events.length}
        </span>
      </p>

      {events.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
            Sin eventos registrados todavia.
          </p>
          <p style={{ margin: '0.4rem 0 0', color: '#cbd5e1', fontSize: '0.78rem' }}>
            Los eventos se generan al aprobar mensajes, cambiar estados, etc.
            Las cotizaciones demo creadas antes del paso 20 no tienen evento de creacion.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/*
           * Linea vertical del timeline.
           * Posicionada absolutamente a la izquierda de los eventos.
           */}
          <div
            style={{
              position: 'absolute',
              left: '11px',
              top: '12px',
              bottom: '12px',
              width: '2px',
              background: '#e2e8f0',
            }}
            aria-hidden
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {events.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                isLast={index === events.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/*
       * Nota educativa para el equipo de desarrollo.
       * Explica por que quote_events no tiene metadata.
       */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.6rem 0.75rem',
          background: '#f8fafc',
          borderRadius: '4px',
          fontSize: '0.72rem',
          color: '#94a3b8',
        }}
      >
        <strong>Nota tecnica:</strong> <code>quote_events</code> es append-only — no hay UPDATE ni DELETE.
        El schema v2.0 no tiene columna <code>metadata</code> en esta tabla.
        Columnas disponibles: <code>event_type</code>, <code>actor</code>,{' '}
        <code>previous_status</code>, <code>new_status</code>, <code>description</code>.
      </div>
    </div>
  )
}

/**
 * INTENCION: Fila individual de evento en el timeline.
 */
function EventRow({ event, isLast }: { event: QuoteEventDetailRow; isLast: boolean }) {
  const dotColor = getEventDotColor(event.event_type)

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        paddingBottom: isLast ? '0' : '1rem',
        position: 'relative',
      }}
    >
      {/* Punto del timeline con color segun categoria del evento */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: dotColor.bg,
          border: `2px solid ${dotColor.border}`,
          flexShrink: 0,
          marginTop: '1px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={event.event_type}
      >
        <span style={{ fontSize: '0.6rem', color: dotColor.icon }}>
          {getEventIcon(event.event_type)}
        </span>
      </div>

      {/* Contenido del evento */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Encabezado: tipo y timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
            {formatEventType(event.event_type)}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
            {formatDateTime(event.created_at)}
          </span>
        </div>

        {/* Transicion de estado + actor */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: event.description ? '0.3rem' : 0 }}>
          {/* Actor */}
          <span
            style={{
              display: 'inline-block',
              padding: '0.1rem 0.4rem',
              background: getActorColor(event.actor).bg,
              color: getActorColor(event.actor).text,
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          >
            {formatActorLabel(event.actor)}
          </span>

          {/* Transicion de estado (solo si hay cambio) */}
          {(event.previous_status || event.new_status) && (
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              {event.previous_status ? (
                <span
                  style={{
                    padding: '0.1rem 0.35rem',
                    background: '#f3f4f6',
                    borderRadius: '3px',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                  }}
                >
                  {formatQuoteStatus(event.previous_status)}
                </span>
              ) : (
                <span style={{ color: '#d1d5db' }}>nuevo</span>
              )}
              {' → '}
              {event.new_status ? (
                <span
                  style={{
                    padding: '0.1rem 0.35rem',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    borderRadius: '3px',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                  }}
                >
                  {formatQuoteStatus(event.new_status)}
                </span>
              ) : (
                <span style={{ color: '#d1d5db' }}>—</span>
              )}
            </span>
          )}
        </div>

        {/* Descripcion del evento (si existe) */}
        {event.description && (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.5 }}>
            {event.description}
          </p>
        )}

        {/* event_type raw para debugging — solo en dev */}
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.68rem', color: '#d1d5db', fontFamily: 'monospace' }}>
          {event.event_type}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Vistas de error y estados especiales
// ============================================================

function QuoteNotFoundView() {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '1rem', color: '#374151' }}>
        Cotizacion no encontrada
      </p>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
        La cotizacion no existe o no pertenece a tu cuenta.
      </p>
      <Link
        href="/dashboard/quotes"
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
        Volver a cotizaciones
      </Link>
    </div>
  )
}

function QueryErrorView({ error }: { error: string }) {
  return (
    <div
      style={{
        background: '#fef2f2',
        border: '1px solid #fca5a5',
        borderRadius: '8px',
        padding: '1.25rem',
      }}
    >
      <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.9rem', color: '#dc2626' }}>
        Error al cargar la cotizacion
      </p>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#b91c1c' }}>
        {error}
      </p>
      <Link href="/dashboard/quotes" style={{ fontSize: '0.85rem', color: '#dc2626' }}>
        ← Volver a cotizaciones
      </Link>
    </div>
  )
}

function NoProducerMessage() {
  return (
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
  )
}

// ============================================================
// Helpers de presentacion
// ============================================================

/**
 * INTENCION: Fila de definicion (label + valor) para los paneles de datos.
 */
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
      <dt style={{ color: '#6b7280', fontWeight: 500, minWidth: '120px', flexShrink: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: 0, color: '#111827', wordBreak: 'break-word' }}>
        {value}
      </dd>
    </div>
  )
}

/**
 * INTENCION: Badge de color para el estado de la quote.
 * Mismo diseño que en quotes-list.tsx para consistencia visual.
 */
function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending_follow_up: { bg: '#fef9c3', text: '#854d0e' },
    scheduled: { bg: '#e0f2fe', text: '#0369a1' },
    pending_approval: { bg: '#ede9fe', text: '#6d28d9' },
    contacted: { bg: '#dbeafe', text: '#1d4ed8' },
    interested: { bg: '#dcfce7', text: '#166534' },
    human_handoff: { bg: '#ede9fe', text: '#6d28d9' },
    closed_won: { bg: '#bbf7d0', text: '#14532d' },
    closed_lost: { bg: '#fee2e2', text: '#991b1b' },
    no_response: { bg: '#f3f4f6', text: '#6b7280' },
    cancelled: { bg: '#f3f4f6', text: '#9ca3af' },
    opt_out: { bg: '#fce7f3', text: '#9d174d' },
    error: { bg: '#fee2e2', text: '#dc2626' },
  }

  const c = colors[status] ?? { bg: '#f3f4f6', text: '#6b7280' }

  return (
    <span
      style={{
        padding: '0.3rem 0.75rem',
        borderRadius: '6px',
        fontSize: '0.82rem',
        fontWeight: 600,
        background: c.bg,
        color: c.text,
      }}
    >
      {formatQuoteStatus(status)}
    </span>
  )
}

// ============================================================
// Helpers de formato
// ============================================================

/**
 * INTENCION: Convertir event_type (string libre) a etiqueta legible en español.
 *
 * DECISION: Mapa de etiquetas en lugar de enum porque event_type es TEXT en la DB.
 * Si llega un event_type desconocido, se muestra el raw string (mas util que silenciarlo).
 * Los event_types conocidos vienen de DECISION-005 y de app/actions/approvals.ts.
 */
function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    // Eventos de creacion
    quote_created: 'Cotizacion creada',
    // Eventos de aprobacion (DECISION-005 — app/actions/approvals.ts)
    message_approved: 'Mensaje M1 aprobado',
    message_prepared: 'Mensaje preparado',
    // Eventos de envio (futuros — cuando WABA este integrado)
    message_sent: 'Mensaje enviado',
    message_delivered: 'Mensaje entregado',
    message_read: 'Mensaje leido',
    // Eventos de respuesta (futuros)
    response_received: 'Respuesta recibida',
    response_classified: 'Respuesta clasificada',
    // Eventos de seguimiento
    follow_up_scheduled: 'Seguimiento programado',
    status_changed: 'Estado cambiado',
    // Eventos de handoff y cierre
    human_handoff_created: 'Handoff a humano',
    // Eventos de opt-out
    opt_out_received: 'Opt-out recibido',
    opt_out_blocked_send: 'Envio bloqueado por opt-out',
  }
  return labels[eventType] ?? eventType
}

/**
 * INTENCION: Etiqueta del actor del evento en español.
 * Los valores del enum son: 'system', 'producer', 'webhook'.
 */
function formatActorLabel(actor: string): string {
  const labels: Record<string, string> = {
    producer: 'Producer',
    system: 'Sistema',
    webhook: 'Webhook',
  }
  return labels[actor] ?? actor
}

/**
 * INTENCION: Color del badge del actor para distincion visual rapida.
 */
function getActorColor(actor: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    producer: { bg: '#eff6ff', text: '#1d4ed8' },
    system: { bg: '#f3f4f6', text: '#374151' },
    webhook: { bg: '#fef3c7', text: '#92400e' },
  }
  return colors[actor] ?? { bg: '#f3f4f6', text: '#374151' }
}

/**
 * INTENCION: Color del punto del timeline segun categoria del evento.
 * Agrupa eventos por tipo para dar contexto visual rapido al producer.
 */
function getEventDotColor(eventType: string): { bg: string; border: string; icon: string } {
  if (eventType === 'quote_created') {
    return { bg: '#dbeafe', border: '#93c5fd', icon: '#1d4ed8' }
  }
  if (eventType.startsWith('message_') || eventType === 'follow_up_scheduled') {
    return { bg: '#dcfce7', border: '#6ee7b7', icon: '#059669' }
  }
  if (eventType.startsWith('response_')) {
    return { bg: '#fef3c7', border: '#fcd34d', icon: '#d97706' }
  }
  if (eventType.startsWith('opt_out')) {
    return { bg: '#fee2e2', border: '#fca5a5', icon: '#dc2626' }
  }
  if (eventType === 'human_handoff_created') {
    return { bg: '#ede9fe', border: '#c4b5fd', icon: '#7c3aed' }
  }
  // Fallback para eventos desconocidos o genericos
  return { bg: '#f3f4f6', border: '#d1d5db', icon: '#6b7280' }
}

/**
 * INTENCION: Icono textual (emoji minimo) para el punto del timeline.
 * Evita dependencias de icon libraries. Solo ASCII/Unicode basico.
 */
function getEventIcon(eventType: string): string {
  if (eventType === 'quote_created') return '+'
  if (eventType === 'message_approved') return '✓'
  if (eventType === 'message_sent') return '→'
  if (eventType === 'message_delivered') return '✓'
  if (eventType === 'message_read') return '✓'
  if (eventType.startsWith('response_')) return '←'
  if (eventType.startsWith('opt_out')) return '✕'
  if (eventType === 'human_handoff_created') return 'H'
  return '•'
}

/**
 * INTENCION: Formatear fecha ISO (YYYY-MM-DD o DATE) a DD/MM/YYYY.
 * Consistente con el formato usado en quotes-list.tsx.
 */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-')
  if (!year || !month || !day) return dateStr
  return `${day}/${month}/${year}`
}

/**
 * INTENCION: Formatear timestamp ISO (TIMESTAMPTZ) a fecha + hora legible.
 * Formato: DD/MM/YYYY HH:MM (sin segundos para brevedad).
 *
 * DECISION: Parse manual del ISO string en lugar de toLocaleString()
 * para evitar diferencias entre servidores (SSR) y evitar hydration mismatches.
 * La hora se muestra en UTC — suficiente para el MVP local.
 */
function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return '—'

  // "2026-06-29T15:30:00.000Z" → partes
  const [datePart, timePart] = isoStr.split('T')
  if (!datePart) return isoStr

  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return isoStr

  if (!timePart) return `${day}/${month}/${year}`

  const [hours, minutes] = timePart.split(':')
  if (!hours || !minutes) return `${day}/${month}/${year}`

  return `${day}/${month}/${year} ${hours}:${minutes} UTC`
}

/**
 * INTENCION: Etiqueta legible para el estado de consentimiento del prospect.
 */
function formatConsentStatus(status: string): string {
  const labels: Record<string, string> = {
    unknown: 'Desconocido',
    granted: 'Otorgado',
    revoked: 'Revocado',
  }
  return labels[status] ?? status
}
