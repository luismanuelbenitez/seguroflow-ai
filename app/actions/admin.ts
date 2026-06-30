'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { invalidateSystemConfigCache } from '@/lib/ai/get-system-config'
import { logEvent } from '@/lib/logging/log'
import { redirect } from 'next/navigation'

export type AdminActionResult = {
  message: string
  isError: boolean
}

async function assertSystemAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL
  if (!adminEmail || user.email !== adminEmail) {
    throw new Error('Acceso denegado: no sos administrador del sistema')
  }

  return user
}

export async function updateSystemConfig(
  prevState: AdminActionResult,
  formData: FormData
): Promise<AdminActionResult> {
  let user
  try {
    user = await assertSystemAdmin()
  } catch {
    return { message: 'Acceso denegado', isError: true }
  }

  const ai_provider = formData.get('ai_provider')?.toString() ?? 'openai'
  const ai_generation_model = formData.get('ai_generation_model')?.toString() ?? 'gpt-4o-mini'
  const ai_classification_model = formData.get('ai_classification_model')?.toString() ?? 'gpt-4o-mini'
  const mode_debug = formData.get('mode_debug') === 'true'

  const service = createServiceClient()
  const { error } = await service
    .from('system_config')
    .update({
      ai_provider,
      ai_generation_model,
      ai_classification_model,
      mode_debug,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .not('id', 'is', null)

  if (error) {
    return { message: `Error al guardar: ${error.message}`, isError: true }
  }

  invalidateSystemConfigCache()

  await logEvent({
    level: 'info',
    event_category: 'config',
    event_type: 'system_config_updated',
    actor_id: user.id,
    details: { ai_provider, ai_generation_model, ai_classification_model, mode_debug },
  })

  return { message: 'Configuración guardada correctamente', isError: false }
}
