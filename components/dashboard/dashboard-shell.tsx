import Link from 'next/link'
import { signOut } from '@/app/actions/auth'

/*
 * INTENCION: Contenedor visual del dashboard del producer.
 * Provee el layout base con tres zonas:
 *   1. Header: logo SeguroFlow AI + email de usuario + boton logout.
 *   2. Sub-nav: links a las secciones principales del dashboard.
 *   3. Main: area de contenido con max-width y padding consistente.
 *
 * CAMBIOS DE UX (demo comercial):
 *   - Header mas robusto con acento de color y logo.
 *   - Sub-nav horizontal debajo del header con los 6 destinos principales.
 *   - Max-width aumentado a 960px para dar mas espacio visual a las pantallas.
 *   - Background del header con sombra sutil para distinguirlo del contenido.
 *
 * SERVER COMPONENT: no necesita 'use client'.
 *   - signOut() se importa directamente como Server Action.
 *   - Los links son <a> estaticos.
 *
 * Ver: app/dashboard/page.tsx (caller principal)
 * Ver: docs/00-ai-context/CODING_RULES.md (reglas de comentarios)
 */

type DashboardShellProps = {
  /** Email del usuario autenticado. Mostrado en el header. Es PII — no loguear. */
  userEmail: string
  /** Contenido del dashboard. Renderizado dentro del area main. */
  children: React.ReactNode
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/quotes', label: 'Cotizaciones' },
  { href: '/dashboard/scheduler', label: 'Scheduler' },
  { href: '/dashboard/approvals', label: 'Aprobacion' },
  { href: '/dashboard/outbox', label: 'Outbox' },
  { href: '/dashboard/metrics', label: 'Metricas' },
]

export default function DashboardShell({ userEmail, children }: DashboardShellProps) {
  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        minHeight: '100vh',
        background: '#f1f5f9',
      }}
    >
      {/* ── Header principal ────────────────────────────────────────────── */}
      <header
        style={{
          background: '#0f172a',
          padding: '0 1.5rem',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo / Brand */}
        <Link
          href="/dashboard"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              background: '#2563eb',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
            }}
          >
            SF
          </span>
          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
            SeguroFlow AI
          </span>
        </Link>

        {/* Usuario + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            {userEmail}
          </span>
          {/*
           * Logout via Server Action. Invalida sesion en Supabase y redirige a /login.
           * PII: email se muestra al propio usuario — no loguear ni enviar a monitores.
           */}
          <form action={signOut}>
            <button
              type="submit"
              style={{
                padding: '0.3rem 0.7rem',
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: '#94a3b8',
                letterSpacing: '0.01em',
              }}
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      {/* ── Sub-nav de secciones ─────────────────────────────────────────── */}
      <nav
        style={{
          background: '#1e293b',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          height: '40px',
          overflowX: 'auto',
        }}
        aria-label="Navegacion principal"
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
              padding: '0.3rem 0.65rem',
              borderRadius: '5px',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <main
        style={{
          padding: '1.75rem 1.5rem',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {children}
      </main>
    </div>
  )
}
