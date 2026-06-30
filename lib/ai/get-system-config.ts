import { createClient } from '@/lib/supabase/server'

export type SystemConfig = {
  id: string
  ai_provider: string
  ai_generation_model: string
  ai_classification_model: string
  mode_debug: boolean
  updated_at: string
  updated_by: string | null
}

const FALLBACK_CONFIG: SystemConfig = {
  id: 'fallback',
  ai_provider: process.env.AI_PROVIDER ?? 'openai',
  ai_generation_model: process.env.AI_GENERATION_MODEL ?? 'gpt-4o-mini',
  ai_classification_model: process.env.AI_CLASSIFICATION_MODEL ?? 'gpt-4o-mini',
  mode_debug: false,
  updated_at: new Date().toISOString(),
  updated_by: null,
}

// Cache en memoria — se invalida al actualizar config desde el panel admin.
// En Next.js cada instancia serverless tiene su propia memoria, por lo que
// el TTL actúa como respaldo para nuevas instancias tras un deploy.
let _cache: { config: SystemConfig; fetchedAt: number } | null = null
const CACHE_TTL_MS = 60_000

export async function getSystemConfig(): Promise<SystemConfig> {
  const now = Date.now()
  if (_cache && now - _cache.fetchedAt < CACHE_TTL_MS) return _cache.config

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('[system-config] No se pudo leer desde DB, usando fallback:', error?.message)
      return FALLBACK_CONFIG
    }

    _cache = { config: data as SystemConfig, fetchedAt: now }
    return _cache.config
  } catch {
    return FALLBACK_CONFIG
  }
}

export function invalidateSystemConfigCache() {
  _cache = null
}
