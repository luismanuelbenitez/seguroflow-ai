'use server'

/*
 * INTENCION: Server Actions para el flujo de autenticacion.
 * Solo contiene acciones de Auth — nada de logica de negocio del MVP.
 *
 * POR QUE SERVER ACTIONS (y no route handlers):
 *   - Las Server Actions de Next.js 15 se integran nativamente con formularios HTML.
 *   - Permiten usar useActionState en componentes cliente sin crear un endpoint API.
 *   - Next.js serializa y valida automaticamente el FormData.
 *   - La directiva 'use server' garantiza que este codigo NUNCA se envia al browser.
 *
 * SEGURIDAD GLOBAL DE ESTE MODULO:
 *   - Ningun dato PII (email del usuario) se loguea en consola ni en servicios externos.
 *   - Los tokens de sesion son manejados exclusivamente por Supabase SSR via cookies HttpOnly.
 *   - NUNCA retornar tokens, keys o datos de sesion al cliente. Solo mensajes de estado.
 *
 * Ver: docs/00-ai-context/CODING_RULES.md (Seccion 5 — Datos sensibles)
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/*
 * Tipo de retorno compartido por las acciones que no redirigen.
 * El componente cliente usa este objeto para mostrar feedback al usuario.
 *
 * CAMPO message: texto mostrado al usuario (no exponer detalles tecnicos internos).
 * CAMPO isError: true si hubo un problema, false si la operacion fue exitosa.
 */
export type AuthActionResult = {
  message: string
  isError: boolean
}

/*
 * INTENCION: Enviar un magic link al email del usuario para iniciar sesion.
 * Esta es la unica forma de autenticacion del MVP (magic link / OTP por email).
 *
 * FLUJO:
 *   1. Extrae y valida el email del FormData.
 *   2. Crea el cliente Supabase server-side (con contexto de cookies).
 *   3. Llama a supabase.auth.signInWithOtp() — Supabase envia el email.
 *   4. Retorna un mensaje de resultado al componente que llamo la accion.
 *   NOTA: Esta funcion NO redirige. La redireccion ocurre en /auth/callback
 *   cuando el usuario hace click en el link del email.
 *
 * ENTRADAS:
 *   @param _prevState {AuthActionResult} — Estado anterior (requerido por useActionState de React 19)
 *   @param formData {FormData} — Formulario con campo 'email'
 *
 * SALIDAS:
 *   @returns {Promise<AuthActionResult>} — { message, isError }
 *
 * ERRORES POSIBLES:
 *   - Email invalido o vacio → retorna isError: true con mensaje amigable
 *   - Rate limit de Supabase (2 emails/hora en local) → isError: true
 *   - Supabase no disponible → isError: true con mensaje generico
 *
 * SEGURIDAD:
 *   - El email NO se loguea (es PII segun Ley 18.331 Uruguay).
 *   - Solo se loguea el codigo de error de Supabase si falla (sin el email).
 *   - El magic link expira segun configuracion de Supabase (default: 1 hora).
 *   - Si el email no existe en Supabase, la API responde igual que si existiera
 *     (para no revelar que emails estan registrados — proteccion de enumeracion).
 *
 * DECISION TECNICA — Magic link sobre password:
 *   - El piloto tiene pocos usuarios (productores de seguros conocidos).
 *   - Elimina riesgo de contrasenas debiles o reutilizadas.
 *   - Reduce friccion de onboarding: no hay registro separado ni verificacion.
 *   - Menos superficie de ataque: no hay hashes de password que proteger.
 */
export async function sendMagicLink(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email')

  // Validacion basica del email antes de llamar a Supabase
  if (!email || typeof email !== 'string' || !email.trim().includes('@')) {
    return {
      message: 'Ingresa un email valido para continuar.',
      isError: true,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      /*
       * emailRedirectTo: URL donde Supabase redirige despues de que el usuario
       * hace click en el link del email. Debe estar en la lista de URLs permitidas
       * del proyecto Supabase (additional_redirect_urls en supabase/config.toml
       * para local, o en el dashboard de Supabase para produccion).
       *
       * NEXT_PUBLIC_SITE_URL:
       *   Local:      http://localhost:3000
       *   Produccion: https://tu-dominio.vercel.app
       */
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    // No logueamos el email (PII). Solo el codigo y status del error de Supabase.
    console.error('[auth] sendMagicLink error — status:', error.status, '| code:', error.code)
    return {
      message: 'No pudimos enviar el email. Espera unos minutos e intenta de nuevo.',
      isError: true,
    }
  }

  return {
    message: 'Revisa tu email. Te enviamos un link para ingresar.',
    isError: false,
  }
}

/*
 * INTENCION: Cerrar la sesion del usuario y redirigir al login.
 *
 * FLUJO:
 *   1. Crea el cliente Supabase con el contexto de cookies del usuario actual.
 *   2. Llama a supabase.auth.signOut() — invalida el token en Supabase y limpia cookies.
 *   3. Redirige a /login via redirect() de Next.js.
 *
 * SALIDAS: Esta funcion nunca retorna — siempre termina en un redirect.
 *
 * SEGURIDAD:
 *   - signOut() invalida el JWT de sesion en el servidor de Supabase.
 *   - Las cookies de sesion se limpian automaticamente por el cliente SSR.
 *   - Despues del redirect, el usuario no puede acceder a rutas protegidas.
 *
 * NOTA TECNICA: redirect() de Next.js lanza internamente un error especial
 * que el framework captura para ejecutar la redireccion. No es un error real
 * del codigo — es el mecanismo de Next.js para redirecciones desde Server Actions.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient()

  // Invalidar sesion en Supabase (limpia cookies de sesion via SSR)
  await supabase.auth.signOut()

  // Redirigir al login. redirect() nunca retorna — lanza internamente.
  redirect('/login')
}
