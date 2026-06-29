import { redirect } from 'next/navigation'

/*
 * INTENCION: Punto de entrada de la aplicacion.
 * Redirige a /login para que el flujo de autenticacion comience.
 *
 * FLUJO:
 *   / → /login → (magic link email) → /auth/callback → /dashboard
 *
 * DECISION TECNICA: Se redirige a /login en vez de verificar sesion aqui
 * para mantener la logica de auth concentrada en /dashboard y /auth/callback.
 * Si el usuario ya tiene sesion, /dashboard lo detectara y mostrara el dashboard.
 * (En el futuro se puede optimizar redirigiendo a /dashboard si hay sesion activa.)
 *
 * Ver: app/login/page.tsx, app/auth/callback/route.ts, app/dashboard/page.tsx
 */
export default function HomePage() {
  redirect('/login')
}
