'use client'

/*
 * INTENCION: Pagina de login con magic link (OTP por email).
 * El usuario ingresa su email y recibe un link para acceder sin password.
 *
 * POR QUE 'use client':
 *   - useActionState de React 19 requiere ejecucion en el cliente.
 *   - Necesitamos estado reactivo para mostrar el mensaje de resultado
 *     y deshabilitar el boton mientras se procesa el request.
 *   - La accion del formulario (sendMagicLink) corre en el servidor —
 *     el 'use client' solo aplica al componente de presentacion.
 *
 * FLUJO DE AUTENTICACION COMPLETO:
 *   1. [Esta pagina] Usuario ingresa email y envia el formulario.
 *   2. [app/actions/auth.ts] sendMagicLink() llama a Supabase OTP.
 *   3. [Supabase / Inbucket local] Email con magic link es enviado.
 *   4. [Usuario] Hace click en el link del email.
 *   5. [app/auth/callback/route.ts] Supabase intercambia el code por sesion.
 *   6. [Browser] Redireccion a /dashboard con sesion activa.
 *
 * Para testear localmente:
 *   - Los emails se capturan en Inbucket: http://localhost:54324
 *   - Ver README.md seccion "Probar Auth localmente" para detalles.
 *
 * Ver: docs/02-mvp/MVP-01-recuperador-cotizaciones.md
 * Ver: app/actions/auth.ts (la logica real del login)
 */

import { useActionState } from 'react'
import { sendMagicLink, type AuthActionResult } from '@/app/actions/auth'

/*
 * Estado inicial del formulario. message vacio = sin feedback todavia.
 * isError false = no hay error pendiente de mostrar.
 */
const INITIAL_STATE: AuthActionResult = {
  message: '',
  isError: false,
}

export default function LoginPage() {
  /*
   * useActionState (React 19): conecta el Server Action con el estado del formulario.
   *   - state: el ultimo resultado de sendMagicLink (message + isError)
   *   - formAction: la accion que conectar al prop action del <form>
   *   - isPending: true mientras el Server Action esta procesando (bloquea el boton)
   *
   * DECISION TECNICA: Se usa useActionState sobre useState + fetch porque:
   *   - Integra nativamente con el modelo de Server Actions de Next.js 15.
   *   - Maneja automaticamente el pending state y el FormData.
   *   - No requiere un endpoint API separado.
   */
  const [state, formAction, isPending] = useActionState(sendMagicLink, INITIAL_STATE)

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>SeguroFlow AI</h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '2rem' }}>
        Ingresa tu email para recibir un magic link de acceso.
      </p>

      {/*
       * El form apunta al Server Action via formAction.
       * React serializa el FormData automaticamente al hacer submit.
       * No hay onSubmit manual ni fetch() — Next.js maneja todo.
       */}
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
            border: '1px solid #ccc',
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
            padding: '0.65rem 1rem',
            background: isPending ? '#999' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          {isPending ? 'Enviando...' : 'Enviar magic link'}
        </button>
      </form>

      {/*
       * Feedback al usuario tras el submit.
       * Verde para exito, rojo para error.
       * Solo se muestra si hay un message (string no vacio).
       */}
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
    </main>
  )
}
