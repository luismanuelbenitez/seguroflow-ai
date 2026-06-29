'use client'

/*
 * INTENCION: Pagina de login con email + password como flujo principal.
 *
 * POR QUE 'use client':
 *   - useActionState de React 19 requiere ejecucion en el cliente.
 *   - La accion del formulario (signInWithPassword) corre en el servidor.
 *   - El 'use client' solo aplica al componente de presentacion.
 *
 * ESTRATEGIA DE AUTH (DECISION-007):
 *   Email + password es el metodo principal. Magic link queda como fallback
 *   tecnico secundario — no es el camino recomendado para la demo ni el piloto.
 *
 * FLUJO DE AUTENTICACION:
 *   1. [Esta pagina] Usuario ingresa email + password y envia el formulario.
 *   2. [app/actions/auth.ts] signInWithPassword() valida con Supabase Auth.
 *   3. Si es exitoso, Supabase escribe las cookies de sesion y redirige a /dashboard.
 *   4. Si falla, se muestra el mensaje de error en el formulario.
 *
 * ACCESO DEMO LOCAL:
 *   Email:    demo@seguroflow.local
 *   Password: Demo123456!
 *
 * Ver: docs/04-decisiones/DECISION-007-auth-strategy-pilot.md
 * Ver: app/actions/auth.ts (la logica real del login)
 */

import { useActionState } from 'react'
import { signInWithPassword, type AuthActionResult } from '@/app/actions/auth'

const INITIAL_STATE: AuthActionResult = {
  message: '',
  isError: false,
}

export default function LoginPage() {
  /*
   * useActionState (React 19): conecta el Server Action con el estado del formulario.
   *   - state: el ultimo resultado de signInWithPassword (message + isError)
   *   - formAction: la accion que conectar al prop action del <form>
   *   - isPending: true mientras el Server Action procesa (bloquea el boton)
   */
  const [state, formAction, isPending] = useActionState(signInWithPassword, INITIAL_STATE)

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        maxWidth: '400px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>SeguroFlow AI</h1>
      <p style={{ color: '#6b7280', marginTop: 0, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Ingresa con tu email y password.
      </p>

      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label htmlFor="email" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="productor@email.com"
          required
          autoComplete="email"
          disabled={isPending}
          style={{
            padding: '0.6rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '1rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <label htmlFor="password" style={{ fontWeight: 500, fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          disabled={isPending}
          style={{
            padding: '0.6rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '1rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="submit"
          disabled={isPending}
          style={{
            marginTop: '0.25rem',
            padding: '0.65rem 1rem',
            background: isPending ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {isPending ? 'Verificando...' : 'Entrar'}
        </button>
      </form>

      {state.message && (
        <p
          role="status"
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            borderRadius: '6px',
            background: state.isError ? '#fee2e2' : '#dcfce7',
            color: state.isError ? '#b91c1c' : '#166534',
            fontSize: '0.9rem',
          }}
        >
          {state.message}
        </p>
      )}

      {/* Credenciales de demo local — visible solo en entorno local */}
      <div
        style={{
          marginTop: '2rem',
          padding: '0.875rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          fontSize: '0.82rem',
          color: '#0369a1',
        }}
      >
        <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>Acceso demo local</p>
        <p style={{ margin: '0 0 0.25rem' }}>
          Email: <code style={{ background: '#e0f2fe', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>demo@seguroflow.local</code>
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          Password: <code style={{ background: '#e0f2fe', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>Demo123456!</code>
        </p>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>
          No usar datos reales. Solo entorno local.
        </p>
      </div>
    </main>
  )
}
