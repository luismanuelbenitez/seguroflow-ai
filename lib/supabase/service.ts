import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/*
 * Cliente Supabase con service role key.
 * Bypasea RLS — usar SOLO en Server Actions de administración del sistema.
 * NUNCA exponer al cliente ni usar en rutas de usuarios normales.
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md, Seccion 6.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado')
  return createSupabaseClient(url, key, {
    auth: { persistSession: false },
  })
}
