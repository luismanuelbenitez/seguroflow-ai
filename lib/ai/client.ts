import { getSystemConfig } from './get-system-config'
import { createOpenAiAdapter } from './adapters/openai'
import type { AiAdapter } from './adapters/base'

/*
 * Devuelve el adaptador de IA correcto según la config activa en system_config.
 * Usar en Server Actions y Route Handlers — nunca en el cliente.
 */
export async function getAiClient(): Promise<AiAdapter> {
  const config = await getSystemConfig()

  if (config.ai_provider === 'openai') {
    const apiKey = process.env.AI_API_KEY
    if (!apiKey) throw new Error('[ai-client] AI_API_KEY no configurado para proveedor openai')
    return createOpenAiAdapter(apiKey, config.ai_generation_model, config.ai_classification_model)
  }

  // Extensión futura: 'anthropic', 'ollama'
  throw new Error(`[ai-client] Proveedor '${config.ai_provider}' no implementado`)
}
