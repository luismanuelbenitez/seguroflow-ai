import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/*
 * INTENCION: Route Handler que completa el flujo de autenticacion con magic link.
 * Supabase redirige aqui despues de que el usuario hace click en el email.
 *
 * FLUJO:
 *   1. El usuario hace click en el magic link del email.
 *   2. Supabase redirige a: /auth/callback?code=XXXX
 *   3. Este handler extrae el `code` de los query params.
 *   4. Intercambia el `code` por una sesion activa via exchangeCodeForSession().
 *      Supabase verifica el code, crea la sesion y escribe las cookies de JWT.
 *   5. Si el intercambio es exitoso, redirige al dashboard (o a `next` si se paso).
 *   6. Si falla, redirige al login con un parametro de error.
 *
 * ENTRADAS (query params):
 *   @param code {string} — Codigo temporal de Supabase Auth. Un solo uso. Expira en 1 hora.
 *   @param next {string} [opcional] — URL de destino post-login. Default: /dashboard.
 *
 * SALIDAS:
 *   @returns {NextResponse} — Redirect a /dashboard (exito) o /login?error=... (fallo)
 *
 * ERRORES POSIBLES:
 *   - code ausente → redirect a /login?error=auth_callback_failed (codigo no llego)
 *   - exchangeCodeForSession falla → codigo expirado, ya usado, o Supabase no disponible
 *   - error → redirect a /login?error=auth_callback_failed
 *
 * SEGURIDAD:
 *   - El `code` es de un solo uso. Supabase lo invalida tras el intercambio.
 *   - No logueamos el `code` (es equivalente a un token temporal).
 *   - Si el intercambio falla, no exponemos el motivo real al browser (solo codigo generico).
 *   - Las cookies de sesion son HttpOnly y se escriben en este paso via SSR.
 *
 * DECISION TECNICA — Por que Route Handler y no Server Component:
 *   Los Route Handlers pueden escribir cookies en la respuesta HTTP directamente.
 *   Un Server Component no puede hacer un redirect con headers de cookies adjuntos.
 *   Esta es la razon por la que el callback de Supabase Auth siempre usa un Route Handler.
 *
 * Ver: app/actions/auth.ts (sendMagicLink — donde se origina el flujo)
 * Ver: lib/supabase/server.ts (createClient — cookie management)
 * Ver: supabase/config.toml [auth] additional_redirect_urls (URLs permitidas)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // El `code` es el token temporal que Supabase incluye en la URL del magic link
  const code = searchParams.get('code')

  /*
   * SEGURIDAD — Validacion del parametro `next` para prevenir open redirects.
   *
   * Un open redirect ocurre cuando un atacante construye una URL como:
   *   /auth/callback?code=X&next=https://sitio-malicioso.com
   * y el handler redirige al usuario a ese dominio externo sin validar.
   *
   * Reglas de validacion:
   *   1. `next` debe existir y ser un string no vacio.
   *   2. Debe comenzar con "/" — garantiza que es una ruta relativa del sitio.
   *   3. NO debe comenzar con "//" — "//" es un protocolo-relativo que el browser
   *      interpreta como URL externa (ej: "//evil.com" → "https://evil.com").
   *
   * Si no cumple alguna regla → se usa /dashboard como destino seguro por defecto.
   */
  const rawNext = searchParams.get('next')
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/dashboard'

  if (!code) {
    // Sin code, no se puede completar el auth. Redirect al login con error.
    console.error('[auth/callback] No code in query params — possible direct navigation or expired link')
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  const supabase = await createClient()

  /*
   * exchangeCodeForSession: intercambia el code temporal por tokens de sesion (JWT + refresh).
   * Supabase valida el code, crea la sesion y escribe las cookies via el handler de setAll
   * que configuramos en lib/supabase/server.ts.
   *
   * Despues de esta llamada, el usuario esta autenticado y las cookies estan escritas.
   */
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // No logueamos el code (token sensible). Solo el mensaje de error de Supabase.
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Sesion creada exitosamente. Redirigir al destino post-login.
  return NextResponse.redirect(`${origin}${next}`)
}
