import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/*
 * INTENCION: Obtener el contexto completo del producer asociado al usuario autenticado.
 * Es el helper central de servidor para todas las rutas que necesitan saber a que
 * producer pertenece el usuario que esta haciendo la peticion.
 *
 * FLUJO:
 *   1. Obtiene el usuario autenticado con getUser() (valida contra el servidor).
 *   2. Consulta producer_members filtrando por user_id = user.id e is_active = true.
 *   3. Si hay membresia, consulta producers por producer_id.
 *   4. Retorna un objeto tipado con user, producer, membership y flags de estado.
 *
 * NOTA SOBRE TYPE ASSERTIONS:
 *   Las queries a Supabase usan type assertions explicitas ('as') en lugar de depender
 *   de la inferencia automatica del cliente. El motivo: @supabase/supabase-js v2 infiere
 *   el tipo de las queries via generics complejos sobre el database.ts generado. Con el
 *   schema actual (833 lineas, tipos enum anidados), TypeScript resuelve el tipo de
 *   data como 'never' cuando la string de select tiene columnas individuales.
 *   Las assertions no afectan el runtime — solo le dicen a TypeScript que confie
 *   en que el dato tiene la forma que sabemos que tiene por el schema SQL.
 *
 * POR QUE DOS QUERIES (y no un JOIN anidado):
 *   El join anidado via select('producers (...)') tambien resuelve como 'never'
 *   por el mismo problema de inferencia. Dos queries son mas explicitas y mas faciles
 *   de tipear con assertions. El costo (un round-trip extra) es aceptable para el MVP.
 *
 * SALIDAS (discriminated union):
 *   - Sin sesion → ProducerContextUnauthenticated (error: 'unauthenticated')
 *   - Con sesion, sin producer → ProducerContextSuccess con hasProducer: false
 *   - Con sesion, con producer → ProducerContextSuccess con hasProducer: true
 *   - Query falla → ProducerContextSuccess con hasProducer: false, error: 'query_failed'
 *
 * POR QUE NO LANZA ERRORES DUROS:
 *   El caso "usuario sin producer" es esperado en desarrollo local sin datos de prueba.
 *   La pagina que llama este helper decide que mostrar en cada caso.
 *
 * POR QUE NO USA SERVICE ROLE:
 *   Esta funcion maneja sesiones de usuario — RLS debe aplicar.
 *   Service role es solo para procesos del sistema (webhooks, cron jobs).
 *   Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md, Seccion 6.
 *
 * RLS APLICADO:
 *   - producer_members: filtra por user_id = auth.uid() (RLS) + eq('user_id', user.id).
 *   - producers: filtrado por id = memberData.producer_id, RLS via get_my_producer_ids().
 *
 * Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
 * Ver: supabase/migrations/001_base_multitenant_schema.sql
 */

// ============================================================
// Tipos locales para las queries (necesarios por limitacion de inferencia de Supabase TS)
// ============================================================

type MemberRow = Database['public']['Tables']['producer_members']['Row']
type ProducerRow = Database['public']['Tables']['producers']['Row']

/** Campos de producer_members que necesitamos para el contexto del dashboard. */
type MemberSelect = Pick<MemberRow, 'id' | 'role' | 'is_active' | 'accepted_at' | 'producer_id'>

/** Campos de producers que necesitamos para el contexto del dashboard. */
type ProducerSelect = Pick<
  ProducerRow,
  'id' | 'name' | 'contact_name' | 'status' | 'plan' | 'send_mode' | 'follow_up_hours' | 'waba_number'
>

// ============================================================
// Tipos de retorno publicos
// ============================================================

/**
 * Subconjunto de campos de producer_members para el contexto del dashboard.
 * No incluye user_id (es el usuario actual, ya disponible en ctx.user).
 */
export type ProducerMembership = MemberSelect

/**
 * Contexto cuando el usuario esta autenticado.
 * user es siempre non-null. producer y membership pueden ser null
 * si el usuario no tiene producer asociado (estado normal en local sin seed).
 */
export type ProducerContextSuccess = {
  user: User
  producer: ProducerSelect | null
  membership: ProducerMembership | null
  hasProducer: boolean
  error: null | 'query_failed'
}

/**
 * Contexto cuando no hay sesion activa.
 * Discriminated union: permite que TypeScript estreche el tipo despues de
 * if (ctx.error === 'unauthenticated') redirect('/login')
 */
export type ProducerContextUnauthenticated = {
  user: null
  producer: null
  membership: null
  hasProducer: false
  error: 'unauthenticated'
}

export type ProducerContextResult = ProducerContextSuccess | ProducerContextUnauthenticated

// ============================================================
// Implementacion
// ============================================================

export async function getCurrentProducerContext(): Promise<ProducerContextResult> {
  const supabase = await createClient()

  /*
   * SEGURIDAD: getUser() valida el JWT contra el servidor de Supabase Auth.
   * No usar getSession() — puede devolver tokens expirados sin validar.
   * Ver: https://supabase.com/docs/guides/auth/server-side/nextjs#protecting-routes
   */
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      user: null,
      producer: null,
      membership: null,
      hasProducer: false,
      error: 'unauthenticated',
    }
  }

  // ── Query 1: membresia activa del usuario ────────────────────────────────
  /*
   * Filtramos por user_id = user.id (codigo) + is_active = true.
   * RLS de producer_members tambien filtra por user_id = auth.uid().
   * maybeSingle(): sin filas → null sin error. Mas de una → error de Supabase.
   *
   * Type assertion en .data porque Supabase TypeScript infiere 'never'
   * cuando se usan select strings con columnas especificas sobre el schema
   * generado (limitacion conocida con schemas complejos y TS strict).
   * La assertion es segura: el schema SQL garantiza que los campos existen.
   */
  const memberResult = await supabase
    .from('producer_members')
    .select('id, role, is_active, accepted_at, producer_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Assertion explicita: el dato en runtime tiene exactamente estos campos
  const memberData = memberResult.data as MemberSelect | null
  const memberError = memberResult.error

  if (memberError) {
    // No logueamos datos del usuario (PII). Solo el codigo de error.
    console.error('[producers] producer_members query error — code:', memberError.code)
    return {
      user,
      producer: null,
      membership: null,
      hasProducer: false,
      error: 'query_failed',
    }
  }

  if (!memberData) {
    /*
     * Usuario autenticado sin membresia activa.
     * Estado esperado en entorno local sin datos de prueba.
     * No es un error tecnico — el dashboard mostrara estado vacio informativo.
     */
    return {
      user,
      producer: null,
      membership: null,
      hasProducer: false,
      error: null,
    }
  }

  // ── Query 2: datos del producer por su id ───────────────────────────────
  /*
   * RLS de producers usa get_my_producer_ids() que filtra por membresías activas.
   * Al filtrar por .eq('id', memberData.producer_id), el usuario solo puede ver
   * el producer al que pertenece: doble garantia (codigo + RLS).
   *
   * single(): espera exactamente una fila. Si no existe el producer (data corruption),
   * Supabase retorna error. Lo manejamos retornando hasProducer: false.
   */
  const producerResult = await supabase
    .from('producers')
    .select('id, name, contact_name, status, plan, send_mode, follow_up_hours, waba_number')
    .eq('id', memberData.producer_id)
    .single()

  // Assertion explicita (misma razon que arriba: inferencia Supabase TS)
  const producerData = producerResult.data as ProducerSelect | null
  const producerError = producerResult.error

  if (producerError || !producerData) {
    console.error('[producers] producers query error — code:', producerError?.code)
    return {
      user,
      producer: null,
      membership: memberData,
      hasProducer: false,
      error: 'query_failed',
    }
  }

  // ── Exito: retornar contexto completo ────────────────────────────────────
  return {
    user,
    producer: producerData,
    membership: memberData,
    hasProducer: true,
    error: null,
  }
}
