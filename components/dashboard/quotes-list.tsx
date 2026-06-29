/*
 * INTENCION: Componente de presentacion (pure UI) para la lista de cotizaciones.
 * Recibe el resultado tipado de getQuotesForCurrentProducer() y lo renderiza.
 *
 * POR QUE SERVER COMPONENT (sin 'use client'):
 *   - No tiene interactividad propia. Solo renderiza datos.
 *   - El boton de accion esta en CreateDemoQuoteButton (client component separado).
 *   - Mantenerlo como Server Component reduce el JS enviado al cliente.
 *
 * RESPONSABILIDADES:
 *   - Mostrar estado de error si hubo un fallo en la query.
 *   - Mostrar estado vacio con instrucciones si no hay quotes.
 *   - Mostrar tabla de quotes si las hay.
 *
 * LO QUE NO HACE:
 *   - No consulta datos (eso lo hace el Server Component padre via getQuotesForCurrentProducer).
 *   - No maneja estado local (es un componente de presentacion puro).
 *   - No integra WhatsApp, IA ni ninguna funcionalidad de negocio.
 *
 * PRIVACIDAD:
 *   - prospectName es PII (full_name del prospect). Se muestra porque es el producer
 *     viendo sus propios datos. No exponer en logs ni analiticamente.
 *   - No se muestran campos sensibles: approved_message, internal_notes, phone.
 *
 * Ver: lib/quotes/get-quotes-for-current-producer.ts (tipos QuoteWithProspect, QuotesResult)
 * Ver: app/dashboard/quotes/page.tsx (Server Component que usa este componente)
 */

import Link from 'next/link'
import type { QuotesResult, QuoteWithProspect } from '@/lib/quotes/get-quotes-for-current-producer'
import { formatQuoteStatus, formatInsuranceType } from '@/lib/quotes/get-quotes-for-current-producer'

// ============================================================
// Tipos de props
// ============================================================

type QuotesListProps = {
  /**
   * Resultado de getQuotesForCurrentProducer().
   * Puede contener quotes, null (error), o [] (vacio).
   */
  quotesResult: QuotesResult
}

// ============================================================
// Componente principal
// ============================================================

export default function QuotesList({ quotesResult }: QuotesListProps) {
  const { quotes, error, hasQuotes } = quotesResult

  // ── Estado de error ───────────────────────────────────────────────────────
  if (error === 'query_failed') {
    return (
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '1.25rem',
          color: '#dc2626',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
          Error al cargar las cotizaciones
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>
          Supabase retorno un error al consultar la tabla <code>quotes</code>.
          Verificar que Supabase local este corriendo y que las migraciones 001 y 002
          esten aplicadas.
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
          Ver: <code>supabase/migrations/002_grants.sql</code> — GRANTs para el rol
          authenticated
        </p>
      </div>
    )
  }

  // ── Estado vacio ─────────────────────────────────────────────────────────
  if (!hasQuotes || !quotes || quotes.length === 0) {
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
        <p
          style={{
            margin: '0 0 0.5rem',
            fontWeight: 600,
            color: '#475569',
            fontSize: '0.95rem',
          }}
        >
          Sin cotizaciones todavia
        </p>
        <p
          style={{
            margin: 0,
            color: '#94a3b8',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}
        >
          Crea una cotizacion demo con el boton de arriba para ver como se visualiza
          la lista.
          <br />
          En produccion, las cotizaciones se cargaran via formulario o CSV.
        </p>
      </div>
    )
  }

  // ── Lista de cotizaciones ─────────────────────────────────────────────────
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/*
       * Encabezado de la seccion con contador de quotes.
       * El contador ayuda al producer a saber cuantas quotes tiene en seguimiento.
       */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
          Cotizaciones en seguimiento
        </p>
        <span
          style={{
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
          }}
        >
          {quotes.length}
        </span>
      </div>

      {/*
       * Tabla responsiva de cotizaciones.
       * Columnas: Prospecto, Tipo, Fecha, Monto, Estado.
       * No incluimos internal_notes ni approved_message (datos sensibles de negocio).
       */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
          }}
        >
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <Th>Prospecto</Th>
              <Th>Tipo</Th>
              <Th>Fecha</Th>
              <Th>Monto</Th>
              <Th>Estado</Th>
              <Th>Aseguradora</Th>
              <Th>Detalle</Th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote, index) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                /*
                 * Fila alternada para mejorar legibilidad en listas largas.
                 * Sin dependencias de clases CSS externas.
                 */
                isEven={index % 2 === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// Subcomponentes internos
// ============================================================

/**
 * INTENCION: Celda de encabezado de tabla con estilos consistentes.
 */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '0.65rem 1rem',
        textAlign: 'left',
        fontWeight: 600,
        color: '#6b7280',
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: '1px solid #e2e8f0',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

/**
 * INTENCION: Fila de cotizacion con todos sus datos clave.
 *
 * PRIVACIDAD: prospectName (full_name) es PII. Se muestra al producer
 * porque es su propio cliente. No exponer en logs.
 */
function QuoteRow({ quote, isEven }: { quote: QuoteWithProspect; isEven: boolean }) {
  const isDemo = quote.origin_channel === 'demo_local'

  return (
    <tr
      style={{
        background: isEven ? '#fff' : '#f9fafb',
        borderBottom: '1px solid #f1f5f9',
      }}
    >
      {/*
       * Columna de prospecto: full_name + badge DEMO si es cotizacion demo.
       * El badge ayuda a distinguir datos reales de datos de prueba localmente.
       */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: '#111827', fontWeight: 500 }}>
            {quote.prospectName}
          </span>
          {isDemo && (
            <span
              style={{
                background: '#fef3c7',
                color: '#92400e',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                letterSpacing: '0.03em',
              }}
            >
              DEMO
            </span>
          )}
        </div>
        {/* Descripcion del riesgo como subtexto — puede ser null */}
        {quote.risk_description && (
          <div
            style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              marginTop: '0.15rem',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {quote.risk_description}
          </div>
        )}
      </td>

      {/* Tipo de seguro — traducido al español via formatInsuranceType() */}
      <td style={tdStyle}>
        <span
          style={{
            background: '#eff6ff',
            color: '#1d4ed8',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          {formatInsuranceType(quote.insurance_type)}
        </span>
      </td>

      {/* Fecha de la cotizacion — formato legible (sin hora, es DATE) */}
      <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {formatDate(quote.quote_date)}
      </td>

      {/* Monto cotizado — puede ser null si el producer no lo cargó aún */}
      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {quote.quoted_amount != null
          ? `${quote.currency} ${quote.quoted_amount.toLocaleString('es-UY')}`
          : <span style={{ color: '#9ca3af' }}>—</span>
        }
      </td>

      {/* Estado de la cotizacion — traducido y con color de estado */}
      <td style={tdStyle}>
        <QuoteStatusBadge status={quote.status} />
      </td>

      {/* Aseguradora — puede ser null */}
      <td style={{ ...tdStyle, color: '#6b7280' }}>
        {quote.insurer_name ?? <span style={{ color: '#d1d5db' }}>—</span>}
      </td>

      {/*
       * Link al detalle de la cotizacion.
       * La ruta dinamica /dashboard/quotes/[quoteId] muestra datos completos
       * (approved_message, internal_notes) y el timeline de quote_events.
       */}
      <td style={tdStyle}>
        <Link
          href={`/dashboard/quotes/${quote.id}`}
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
          Ver →
        </Link>
      </td>
    </tr>
  )
}

/**
 * INTENCION: Badge de color para el estado de la cotizacion.
 *
 * DECISION TECNICA: Colores definidos inline para no depender de Tailwind.
 * Si se agrega Tailwind al proyecto, migrar a clases.
 */
function QuoteStatusBadge({ status }: { status: QuoteWithProspect['status'] }) {
  /*
   * Mapa completo de colores para todos los valores del enum quote_status.
   * Ver: types/database.ts — Enums.quote_status (lista completa de valores).
   *
   * Statuses agregados en MVP paso 22 (simulacion inbound):
   *   pending_approval: violeta — esperando que el producer apruebe el mensaje
   *   responded:        teal   — prospect respondio, requiere seguimiento
   *   no_response_1:   azul claro — sin respuesta despues del 1er intento
   *   contacted_2:     azul medio — segundo contacto realizado
   *   paused:          gris medio — seguimiento pausado manualmente
   */
  const statusColors: Record<string, { bg: string; text: string }> = {
    pending_follow_up: { bg: '#fef9c3', text: '#854d0e' },
    scheduled: { bg: '#e0f2fe', text: '#0369a1' },
    pending_approval: { bg: '#ede9fe', text: '#6d28d9' },
    contacted: { bg: '#dbeafe', text: '#1d4ed8' },
    no_response_1: { bg: '#e0f2fe', text: '#075985' },
    contacted_2: { bg: '#bfdbfe', text: '#1e40af' },
    responded: { bg: '#ccfbf1', text: '#0f766e' },
    interested: { bg: '#dcfce7', text: '#166534' },
    human_handoff: { bg: '#ede9fe', text: '#6d28d9' },
    closed_won: { bg: '#bbf7d0', text: '#14532d' },
    closed_lost: { bg: '#fee2e2', text: '#991b1b' },
    no_response: { bg: '#f3f4f6', text: '#6b7280' },
    paused: { bg: '#e5e7eb', text: '#4b5563' },
    cancelled: { bg: '#f3f4f6', text: '#9ca3af' },
    opt_out: { bg: '#fce7f3', text: '#9d174d' },
    error: { bg: '#fee2e2', text: '#dc2626' },
  }

  const colors = statusColors[status] ?? { bg: '#f3f4f6', text: '#6b7280' }

  return (
    <span
      style={{
        background: colors.bg,
        color: colors.text,
        padding: '0.2rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {formatQuoteStatus(status)}
    </span>
  )
}

// ============================================================
// Utilidades de formato
// ============================================================

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  verticalAlign: 'middle',
  color: '#374151',
}

/**
 * INTENCION: Convertir fecha ISO (YYYY-MM-DD) a formato legible en español (DD/MM/YYYY).
 * No usamos toLocaleDateString() con locale porque el formato puede variar por plataforma.
 */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-')
  if (!year || !month || !day) return dateStr
  return `${day}/${month}/${year}`
}
