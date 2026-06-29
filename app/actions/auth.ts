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
 * ESTRATEGIA DE AUTH (DECISION-007):
 *   - Email + password es el metodo principal de acceso.
 *   - Magic link se conserva como fallback tecnico secundario — no es el flujo central.
 *   - MFA y Google login quedan como evolucion futura.
 *   - Ver: docs/04-decisiones/DECISION-007-auth-strategy-pilot.md
 *
 * SEGURIDAD GLOBAL DE ESTE MODULO:
 *   - Ningun dato PII (email del usuario) se loguea en consola ni en servicios externos.
 *   - Los tokens de sesion son manejados exclusivamente por Supabase SSR via cookies HttpOnly.
 *   - NUNCA retornar tokens, keys o datos de sesion al cliente. Solo mensajes de estado.
 *   - NUNCA usar service role key aqui. Solo la publishable/anon key via el cliente SSR.
 *
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 * Ver: docs/04-decisiones/DECISION-007-auth-strategy-pilot.md
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
 * INTENCION: Autenticar al usuario con email + password.
 * Este es el flujo principal de login (DECISION-007).
 *
 * FLUJO:
 *   1. Extrae y valida email y password del FormData.
 *   2. Crea el cliente Supabase server-side (con contexto de cookies).
 *   3. Llama a supabase.auth.signInWithPassword() — Supabase valida credenciales.
 *   4. Si es exitoso, redirige a /dashboard con sesion activa.
 *   5. Si falla, retorna mensaje de error al componente.
 *
 * ENTRADAS:
 *   @param _prevState {AuthActionResult} — Estado anterior (requerido por useActionState)
 *   @param formData {FormData} — Formulario con campos 'email' y 'password'
 *
 * SALIDAS:
 *   @returns {Promise<AuthActionResult>} — { message, isError }
 *   NOTA: En exito no retorna — ejecuta redirect('/dashboard').
 *
 * ERRORES POSIBLES:
 *   - Email o password vacios → isError: true con mensaje amigable
 *   - Credenciales incorrectas → isError: true (sin revelar cual campo fallo)
 *   - Usuario no existe → misma respuesta que credenciales incorrectas (anti-enumeracion)
 *   - Supabase no disponible → isError: true con mensaje generico
 *
 * SEGURIDAD:
 *   - El email y password NO se loguan (son PII y credencial).
 *   - Solo se loguea el codigo de error de Supabase si falla (sin las credenciales).
 *   - No diferenciamos "email no existe" de "password incorrecto" — anti user enumeration.
 *   - Supabase limita intentos de login fallidos por IP (rate limiting automatico).
 *
 * NO HACER:
 *   - No manejar el hash de la password manualmente.
 *   - No comparar passwords directamente.
 *   - No usar service role key.
 */
export async function signInWithPassword(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (!email || typeof email !== 'string' || !email.trim().includes('@')) {
    return { message: 'Ingresa un email valido para continuar.', isError: true }
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return { message: 'Ingresa tu password para continuar.', isError: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password,
  })

  if (error) {
    console.error('[auth] signInWithPassword error — code:', error.code, '| status:', error.status)
    return {
      message: 'Email o password incorrecto. Verifica tus credenciales e intentá de nuevo.',
      isError: true,
    }
  }

  // Sesion creada exitosamente. redirect() lanza internamente — no retorna.
  redirect('/dashboard')
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
 * que el framework captura para ejecutar la redireccion. No es un error real.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/*
 * FALLBACK SECUNDARIO — Magic link (OTP por email).
 *
 * NO es el flujo principal desde DECISION-007. Se conserva como opcion tecnica
 * de reserva. No debe aparecer como camino recomendado en la UI principal.
 *
 * Requiere que Supabase local este corriendo (Mailpit en localhost:54324).
 * En produccion requiere un proveedor SMTP configurado.
 *
 * Ver: docs/04-decisiones/DECISION-007-auth-strategy-pilot.md
 */
export async function sendMagicLink(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email')

  if (!email || typeof email !== 'string' || !email.trim().includes('@')) {
    return { message: 'Ingresa un email valido para continuar.', isError: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
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
