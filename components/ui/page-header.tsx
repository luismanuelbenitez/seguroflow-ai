import Link from 'next/link'

/*
 * INTENCION: Encabezado de pagina consistente para todas las rutas del dashboard.
 * Muestra breadcrumb (opcional), titulo, subtitulo (opcional) y acciones (opcional).
 *
 * SERVER COMPONENT: no necesita 'use client'. Solo renderiza HTML estatico.
 *
 * USO:
 *   <PageHeader
 *     breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }]}
 *     title="Cotizaciones"
 *     subtitle="Lista de cotizaciones del producer"
 *     actions={<Link href="/quotes/new">+ Nueva</Link>}
 *   />
 */

type BreadcrumbItem = {
  label: string
  href?: string
}

type PageHeaderProps = {
  /** Migas de pan. El ultimo item se muestra como pagina actual (sin link). */
  breadcrumb?: BreadcrumbItem[]
  /** Titulo principal de la pagina. */
  title: string
  /** Subtitulo o descripcion corta debajo del titulo. */
  subtitle?: string
  /** Acciones a la derecha del titulo (botones, links, badges). */
  actions?: React.ReactNode
}

export default function PageHeader({ breadcrumb, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '0.6rem',
            fontSize: '0.78rem',
          }}
        >
          {breadcrumb.map((item, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {idx > 0 && <span style={{ color: '#cbd5e1' }} aria-hidden>›</span>}
              {item.href ? (
                <Link
                  href={item.href}
                  style={{ color: '#64748b', textDecoration: 'none' }}
                >
                  {item.label}
                </Link>
              ) : (
                <span style={{ color: '#374151', fontWeight: 500 }}>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Titulo + acciones */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: '0.3rem 0 0',
                fontSize: '0.88rem',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
