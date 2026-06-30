import { createClient } from '@/lib/supabase/server'
import { getSystemConfig } from '@/lib/ai/get-system-config'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export type LogEventCategory =
  | 'auth'
  | 'quote'
  | 'message'
  | 'ai'
  | 'whatsapp'
  | 'config'
  | 'system'

export type LogEventParams = {
  level: LogLevel
  event_category: LogEventCategory
  event_type: string
  actor_id?: string | null
  producer_id?: string | null
  quote_id?: string | null
  details?: Record<string, unknown> | null
}

/*
 * Escribe un evento en app_logs.
 *
 * Reglas de verbosidad:
 *   - mode_debug=false: registra info/warn/error con details mínimos (solo 'summary' o 'error').
 *     Los eventos 'debug' se descartan.
 *   - mode_debug=true: registra todos los niveles con details completos.
 *
 * Esta función NUNCA lanza excepción — un fallo de logging no debe cortar el flujo principal.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    const config = await getSystemConfig()

    if (params.level === 'debug' && !config.mode_debug) return

    const details = buildDetails(params.details, config.mode_debug)

    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_logs') as any).insert({
      level: params.level,
      event_category: params.event_category,
      event_type: params.event_type,
      actor_id: params.actor_id ?? null,
      producer_id: params.producer_id ?? null,
      quote_id: params.quote_id ?? null,
      details,
    })
  } catch {
    // Intencional: logging nunca debe cortar el flujo principal.
    console.error('[log] Error al escribir en app_logs — se ignora para no afectar el flujo')
  }
}

function buildDetails(
  details: Record<string, unknown> | null | undefined,
  debugMode: boolean
): Record<string, unknown> | null {
  if (!details) return null
  if (debugMode) return details
  // En modo normal: solo campos superficiales no sensibles
  const safe: Record<string, unknown> = {}
  for (const key of ['summary', 'error', 'model', 'status', 'count']) {
    if (key in details) safe[key] = details[key]
  }
  return Object.keys(safe).length > 0 ? safe : null
}
