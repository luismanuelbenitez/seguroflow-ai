import Link from 'next/link'

/*
 * INTENCION: Estado vacío reutilizable para listas y colas sin datos.
 * Reemplaza los mensajes de "no hay datos" con un estado vacío más comercial
 * que guía al usuario hacia la acción correcta.
 *
 * SERVER COMPONENT: no necesita 'use client'. Solo HTML estatico.
 *
 * USO:
 *   <EmptyState
 *     title="Sin cotizaciones"
 *     description="Todavia no hay cotizaciones en esta etapa del flujo."
 *     cta={{ label: 'Crear cotizacion', href: '/dashboard/quotes/new' }}
 *   />
 */

type EmptyStateProps = {
  /** Titulo del estado vacio. */
  title: string
  /** Descripcion adicional. */
  description?: string
  /** Call to action principal (link). */
  cta?: {
    label: string
    href: string
    color?: string
  }
  /** Links secundarios. */
  links?: Array<{ label: string; href: string }>
}

export default function EmptyState({ title, description, cta, links }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
      }}
    >
      {/* Icono visual simple */}
      <div
        style={{
          width: '48px',
          height: '48px',
          background: '#f1f5f9',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          fontSize: '1.25rem',
        }}
      >
        📋
      </div>

      <p
        style={{
          margin: '0 0 0.4rem',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: '#374151',
        }}
      >
        {title}
      </p>

      {description && (
        <p
          style={{
            fontSize: '0.85rem',
            color: '#64748b',
            lineHeight: 1.5,
            maxWidth: '360px',
            margin: '0 auto 1.25rem',
          }}
        >
          {description}
        </p>
      )}

      {cta && (
        <Link
          href={cta.href}
          style={{
            display: 'inline-block',
            padding: '0.55rem 1.25rem',
            background: cta.color ?? '#2563eb',
            color: '#fff',
            borderRadius: '7px',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {cta.label}
        </Link>
      )}

      {links && links.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: '0.82rem',
                color: '#2563eb',
                textDecoration: 'none',
              }}
            >
              {link.label} →
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
