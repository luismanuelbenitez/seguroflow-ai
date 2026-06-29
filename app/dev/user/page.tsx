import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/*
 * INTENCION: Pagina de desarrollo local para mostrar el user.id del usuario
 * autenticado. Sirve para obtener el UUID necesario para ejecutar el seed local.
 *
 * SEGURIDAD:
 *   - NO accesible en produccion: retorna 404 si NODE_ENV != 'development'.
 *   - NO usa service role. Solo getUser() contra el servidor de auth.
 *   - NO muestra tokens, secrets ni datos de otros usuarios.
 *   - El user_id es un UUID que ya viaja en el JWT del usuario — no es secreto.
 *   - El email solo se muestra para confirmar que es el usuario correcto.
 *
 * POR QUE EXISTE:
 *   El seed local (supabase/seed.local.example.sql) requiere el UUID del usuario
 *   autenticado para insertar en producer_members. Esta pagina lo muestra con
 *   un boton de copia para facilitar el flujo sin tener que abrir Supabase Studio.
 *
 * USO:
 *   1. Iniciar Supabase local + app (npm run dev).
 *   2. Loguearse con magic link en /login.
 *   3. Navegar a http://localhost:3000/dev/user.
 *   4. Copiar el user.id.
 *   5. Reemplazar LOCAL_AUTH_USER_ID en seed.local.example.sql.
 *   6. Ejecutar el SQL en Supabase Studio local (http://localhost:54323).
 *
 * ATENCION: No usar esta pagina como feature productiva. Es un helper de desarrollo.
 * Si alguna vez se necesita mostrar el user_id en produccion, crear un endpoint
 * dedicado con autenticacion explicita y rate limiting.
 *
 * Ver: supabase/seed.local.example.sql
 * Ver: docs/05-architecture/LOCAL_SEEDING.md
 */

export default async function DevUserPage() {
  /*
   * BLOQUEO EN PRODUCCION:
   * NODE_ENV es 'development' en `npm run dev`.
   * Es 'production' en `npm run build && npm start` y en Vercel.
   * notFound() retorna HTTP 404 — la pagina no existe para el usuario final.
   */
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  const supabase = await createClient()

  /*
   * getUser() valida el JWT contra el servidor de Supabase Auth.
   * Si no hay sesion activa, redirigir a /login.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '2px solid #f59e0b',
          borderRadius: '10px',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
        }}
      >
        {/* Banner de advertencia de entorno */}
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            padding: '0.6rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.82rem',
            color: '#92400e',
            fontWeight: 600,
          }}
        >
          Pagina solo para desarrollo local — No usar en produccion
        </div>

        <h1
          style={{
            margin: '0 0 0.25rem',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: '#0f172a',
          }}
        >
          Datos del usuario autenticado
        </h1>

        <p
          style={{
            margin: '0 0 1.5rem',
            fontSize: '0.85rem',
            color: '#64748b',
            lineHeight: 1.5,
          }}
        >
          Usa el <strong>user.id</strong> de abajo para reemplazar{' '}
          <code
            style={{
              background: '#f1f5f9',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.8rem',
            }}
          >
            LOCAL_AUTH_USER_ID
          </code>{' '}
          en{' '}
          <code
            style={{
              background: '#f1f5f9',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.8rem',
            }}
          >
            supabase/seed.local.example.sql
          </code>
        </p>

        {/* Email del usuario */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p
            style={{
              margin: '0 0 0.35rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            Email
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '1rem',
              color: '#1e293b',
              fontWeight: 500,
            }}
          >
            {user.email}
          </p>
        </div>

        {/* User ID — el dato importante */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p
            style={{
              margin: '0 0 0.35rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            user.id (UUID para el seed)
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              color: '#0f172a',
              wordBreak: 'break-all',
              letterSpacing: '0.02em',
            }}
          >
            {user.id}
          </div>
        </div>

        {/* Instrucciones rapidas */}
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '1rem',
            fontSize: '0.82rem',
            color: '#0c4a6e',
            lineHeight: 1.7,
          }}
        >
          <strong>Proximos pasos:</strong>
          <ol
            style={{
              margin: '0.5rem 0 0',
              paddingLeft: '1.25rem',
            }}
          >
            <li>
              Copiar el user.id de arriba
            </li>
            <li>
              Abrir{' '}
              <code
                style={{
                  background: '#e0f2fe',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                supabase/seed.local.example.sql
              </code>{' '}
              y reemplazar{' '}
              <code
                style={{
                  background: '#e0f2fe',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                LOCAL_AUTH_USER_ID
              </code>
            </li>
            <li>
              Ejecutar el SQL en{' '}
              <a
                href="http://localhost:54323"
                style={{ color: '#0369a1' }}
                target="_blank"
                rel="noreferrer"
              >
                Supabase Studio local
              </a>
              {' '}→ SQL Editor
            </li>
            <li>
              Volver a{' '}
              <a href="/dashboard" style={{ color: '#0369a1' }}>
                /dashboard
              </a>{' '}
              para ver el producer demo
            </li>
          </ol>
        </div>

        {/* Link a documentacion */}
        <p
          style={{
            marginTop: '1.25rem',
            marginBottom: 0,
            fontSize: '0.78rem',
            color: '#94a3b8',
          }}
        >
          Ver:{' '}
          <code
            style={{
              background: '#f1f5f9',
              padding: '0.1rem 0.3rem',
              borderRadius: '3px',
              fontSize: '0.75rem',
            }}
          >
            docs/05-architecture/LOCAL_SEEDING.md
          </code>
        </p>
      </div>
    </main>
  )
}
