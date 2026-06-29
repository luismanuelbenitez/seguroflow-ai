/*
 * INTENCION: Contenedor de seccion con estilo de card consistente.
 * Usado para agrupar contenido relacionado en las pantallas del dashboard.
 * Reemplaza los divs con estilo repetido en cada pagina.
 *
 * SERVER COMPONENT: no necesita 'use client'. Solo layout visual.
 *
 * USO:
 *   <SectionCard title="Candidatas" count={5} accentColor="#7c3aed">
 *     <p>contenido...</p>
 *   </SectionCard>
 */

type SectionCardProps = {
  /** Titulo del bloque de seccion (opcional). */
  title?: string
  /** Numero a mostrar junto al titulo como badge (opcional). */
  count?: number
  /** Color del borde izquierdo de acento (opcional). */
  accentColor?: string
  /** Acciones a la derecha del titulo (botones, links) (opcional). */
  actions?: React.ReactNode
  /** Contenido de la seccion. */
  children: React.ReactNode
  /** Padding interno. Default: '1.25rem'. */
  padding?: string
}

export default function SectionCard({
  title,
  count,
  accentColor,
  actions,
  children,
  padding = '1.25rem',
}: SectionCardProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderLeft: accentColor ? `4px solid ${accentColor}` : '1px solid #e2e8f0',
        borderRadius: '10px',
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header de la seccion (si tiene titulo) */}
      {title && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {title}
            </span>
            {count !== undefined && (
              <span
                style={{
                  background: accentColor ?? '#e2e8f0',
                  color: accentColor ? '#fff' : '#374151',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  minWidth: '1.5rem',
                  textAlign: 'center',
                }}
              >
                {count}
              </span>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Contenido */}
      <div style={{ padding }}>{children}</div>
    </div>
  )
}
