import { createBrowserClient } from '@supabase/ssr'

/*
 * INTENCION: Crear un cliente Supabase para uso exclusivo en el browser.
 * Usar en archivos con 'use client' o componentes de cliente.
 *
 * FLUJO:
 * 1. Lee las variables de entorno publicas (NEXT_PUBLIC_*).
 * 2. Crea y devuelve el cliente browser de Supabase.
 * 3. El cliente respeta las politicas RLS de la base de datos.
 *
 * ENTRADAS: ninguna (lee variables de entorno del proceso)
 * SALIDAS: instancia de SupabaseBrowserClient lista para usar
 *
 * SEGURIDAD CRITICA:
 * - Usa NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: esta key es segura para el cliente.
 *   Supabase limita su acceso completamente via Row Level Security (RLS).
 * - NUNCA usar SUPABASE_SERVICE_ROLE_KEY en esta funcion ni en ningun archivo
 *   con 'use client'. El service role bypasea RLS y debe usarse solo en el servidor.
 * - Todo acceso a datos esta filtrado por las politicas RLS definidas en
 *   supabase/migrations/001_base_multitenant_schema.sql, Seccion 16.
 * - El usuario solo ve los datos de los producers donde tiene membresia activa,
 *   controlado por la funcion get_my_producer_ids() en la base de datos.
 *
 * USO:
 *   'use client'
 *   import { createClient } from '@/lib/supabase/client'
 *   const supabase = createClient()
 *   const { data } = await supabase.from('quotes').select('*')
 *
 * Para server components y route handlers usar: lib/supabase/server.ts
 *
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
