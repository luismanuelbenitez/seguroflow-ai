import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/*
 * INTENCION: Crear un cliente Supabase para uso exclusivo en el servidor.
 * Usar en Server Components, Route Handlers y Server Actions de Next.js.
 *
 * FLUJO:
 *   1. Obtiene el cookieStore de next/headers (async en Next.js 15+).
 *   2. Crea el cliente via createServerClient de @supabase/ssr.
 *   3. Configura los handlers de cookies para que Supabase pueda leer y
 *      escribir la sesion del usuario entre requests.
 *   4. El cliente resultante aplica RLS normalmente con la sesion del usuario.
 *
 * ENTRADAS: ninguna (lee el contexto de cookies del request actual)
 * SALIDAS: {SupabaseClient<Database>} cliente con sesion del usuario activa
 *
 * ERRORES POSIBLES:
 *   - Si NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *     no estan definidas, el cliente lanzara error en tiempo de ejecucion.
 *     Ver validacion en: (pendiente — agregar startup validation).
 *
 * POR QUE ES SERVER-SIDE (y no browser):
 *   - Lee cookies HttpOnly que el browser no puede ver directamente.
 *   - Puede tanto leer COMO escribir cookies (en Route Handlers y Server Actions).
 *   - Necesario para verificar sesion en rutas protegidas sin exponer el token al JS del cliente.
 *   - Evita el "flash" de contenido no autenticado que ocurre con validacion solo en cliente.
 *
 * POR QUE NO USA SERVICE ROLE KEY:
 *   - Esta funcion maneja sesiones de usuarios autenticados. RLS DEBE aplicar.
 *   - El service role bypasea RLS y es para procesos del sistema (webhooks, cron).
 *   - El service role key vive EXCLUSIVAMENTE en server/*, nunca en rutas de usuario.
 *   - Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md, Seccion 6.
 *
 * VARIABLES DE ENTORNO REQUERIDAS:
 *   - NEXT_PUBLIC_SUPABASE_URL: URL del proyecto Supabase (api/kong endpoint).
 *     Local: http://localhost:54321  |  Produccion: https://xxx.supabase.co
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon key del proyecto.
 *     Segura para exponer al cliente. RLS la protege.
 *     Local: obtener de `npx supabase@2.108.0 status` (campo "anon key").
 *
 * DIFERENCIA CON lib/supabase/client.ts:
 *   - client.ts: solo browser ('use client'). No accede a cookies HttpOnly.
 *   - server.ts (este): servidor. Lee cookies HttpOnly. Unico modo seguro
 *     de verificar sesiones en rutas protegidas.
 *
 * USO CORRECTO:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 * Ver: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function createClient() {
  // En Next.js 15, cookies() es async. Siempre await para evitar el warning
  // "cookies() should be awaited before using its value" en produccion.
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Sin esto, signInWithOtp usa implicit flow (tokens en #hash).
        // Con pkce, Supabase redirige a /auth/callback?code= y exchangeCodeForSession funciona.
        flowType: 'pkce',
      },
      cookies: {
        /*
         * getAll: Supabase lee las cookies actuales para reconstruir la sesion del usuario.
         * Necesario para que auth.getUser() funcione en Server Components protegidos.
         * Devuelve todas las cookies del request — Supabase filtra las suyas internamente.
         */
        getAll() {
          return cookieStore.getAll()
        },

        /*
         * setAll: Supabase escribe cookies actualizadas tras login, logout o refresh de token.
         *
         * El try/catch maneja el caso de Server Components puros: Next.js no permite
         * escribir cookies desde un Server Component (solo leer). Si se llama setAll
         * desde un Server Component, el error se ignora silenciosamente.
         *
         * En Route Handlers y Server Actions, setAll funciona correctamente.
         * En Server Components, la sesion se refresca en el proximo Route Handler
         * (o via middleware si se agrega en el futuro).
         *
         * DECISION TECNICA: Se eligio este enfoque (try/catch en setAll) sobre
         * agregar middleware de refresh porque es mas simple para el MVP.
         * Ver discusion en: https://supabase.com/docs/guides/auth/server-side/nextjs
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar error en Server Components puros. Esperado y seguro.
          }
        },
      },
    }
  )
}
