import { signOut } from '@/app/actions/auth'

/*
 * INTENCION: Contenedor visual del dashboard del producer.
 * Provee el layout base: header con nombre de usuario y boton de logout,
 * y el area de contenido principal donde se renderizan los children.
 *
 * POR QUE SERVER COMPONENT (sin 'use client'):
 *   - Recibe solo props serializables (strings y ReactNode).
 *   - Puede importar el Server Action signOut() directamente para el form de logout.
 *   - No necesita estado reactivo: el layout es estatico.
 *
 * USO:
 *   import DashboardShell from '@/components/dashboard/dashboard-shell'
 *   <DashboardShell userEmail={user.email}>
 *     <ProducerSummaryCard context={ctx} />
 *   </DashboardShell>
 *
 * Ver: app/dashboard/page.tsx (unico caller actual)
 */

type DashboardShellProps = {
  /** Email del usuario autenticado. Mostrado en el header. Es PII — no loguear. */
  userEmail: string
  /** Contenido del dashboard. Renderizado dentro del area principal. */
  children: React.ReactNode
}

export default function DashboardShell({ userEmail, children }: DashboardShellProps) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        background: '#f8fafc',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 2rem',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
          SeguroFlow AI
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/*
           * Email del usuario. Es PII pero es su propio dato.
           * No loguear ni enviar a servicios de monitoreo externos.
           */}
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {userEmail}
          </span>

          {/*
           * Logout via Server Action. form action={signOut} conecta el boton
           * directamente al Server Action sin 'use client' ni fetch manual.
           * signOut() invalida la sesion en Supabase y redirige a /login.
           */}
          <form action={signOut}>
            <button
              type="submit"
              style={{
                padding: '0.35rem 0.8rem',
                background: 'transparent',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: '#475569',
              }}
            >
              Cerrar sesion
            </button>
          </form>
        </div>
      </header>

      {/* ── Contenido principal ─────────────────────────────────────────────── */}
      <main
        style={{
          padding: '2rem',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {children}
      </main>
    </div>
  )
}
