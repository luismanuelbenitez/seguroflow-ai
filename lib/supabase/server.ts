/*
 * INTENCION: Placeholder para el cliente Supabase de lado servidor.
 *
 * PENDIENTE DE IMPLEMENTAR en iteraciones futuras, cuando se construyan:
 * - Server Components que lean datos protegidos del producer.
 * - Route Handlers para el webhook de WhatsApp (POST /api/webhooks/whatsapp).
 * - Server Actions para el formulario de carga de cotizaciones.
 * - Cron job de deteccion de cotizaciones elegibles.
 *
 * REFERENCIA DE IMPLEMENTACION:
 * Usar createServerClient de @supabase/ssr con cookies de next/headers.
 * Ver documentacion oficial: https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * SEGURIDAD CRITICA:
 * - El cliente de servidor puede autenticarse con dos keys distintas segun el caso:
 *
 *   1. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (con sesion de usuario):
 *      Para server components que muestran datos del producer autenticado.
 *      RLS aplica normalmente. El usuario ve solo sus datos.
 *
 *   2. SUPABASE_SERVICE_ROLE_KEY (sin sesion de usuario, bypasea RLS):
 *      Para procesos del sistema: webhook de WhatsApp, cron de deteccion,
 *      jobs de envio de mensajes. NUNCA exponer al cliente.
 *      Todo proceso con service role DEBE registrar actor='system' en quote_events.
 *
 * - NUNCA usar SUPABASE_SERVICE_ROLE_KEY en rutas o componentes accesibles
 *   desde el cliente sin autenticacion y verificacion de firma HMAC.
 *
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md, Secciones 6 y 7.
 * Ver: docs/00-ai-context/CODING_RULES.md
 */

// TODO: Implementar cuando se necesiten los primeros Server Components o Route Handlers.
// Ejemplo de estructura:
//
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'
//
// export async function createClient() {
//   const cookieStore = await cookies()
//   return createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
//     { cookies: { getAll: () => cookieStore.getAll(), setAll: ... } }
//   )
// }

export {}
