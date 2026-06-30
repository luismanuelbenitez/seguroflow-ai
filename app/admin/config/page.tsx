'use client'

import { useActionState } from 'react'
import { updateSystemConfig, type AdminActionResult } from '@/app/actions/admin'
import { useEffect, useState } from 'react'

const INITIAL_STATE: AdminActionResult = { message: '', isError: false }

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini — rápido y económico (recomendado)' },
  { value: 'gpt-4o', label: 'GPT-4o — máxima calidad OpenAI' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
]

const ANTHROPIC_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — rápido' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — alta calidad' },
]

export default function AdminConfigPage() {
  const [state, action, isPending] = useActionState(updateSystemConfig, INITIAL_STATE)

  const [provider, setProvider] = useState('openai')
  const [genModel, setGenModel] = useState('gpt-4o-mini')
  const [classModel, setClassModel] = useState('gpt-4o-mini')
  const [debug, setDebug] = useState(false)

  const models = provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS

  useEffect(() => {
    const defaultModel = models[0]?.value ?? 'gpt-4o-mini'
    setGenModel(defaultModel)
    setClassModel(defaultModel)
  }, [provider])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración del sistema</h1>
        <p className="mt-1 text-sm text-gray-400">
          Ajustes globales de IA y comportamiento de la plataforma. Cambios aplicados
          inmediatamente en todos los producers.
        </p>
      </div>

      <form action={action} className="space-y-6">
        {/* Proveedor de IA */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Proveedor de IA
          </h2>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">Proveedor activo</label>
            <div className="flex gap-4">
              {['openai', 'anthropic'].map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ai_provider"
                    value={p}
                    checked={provider === p}
                    onChange={() => setProvider(p)}
                    className="accent-indigo-500"
                  />
                  <span className="text-sm text-gray-200 capitalize">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ai_generation_model" className="text-sm text-gray-300">
                Modelo — generación de mensajes
              </label>
              <select
                id="ai_generation_model"
                name="ai_generation_model"
                value={genModel}
                onChange={(e) => setGenModel(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="ai_classification_model" className="text-sm text-gray-300">
                Modelo — clasificación de respuestas
              </label>
              <select
                id="ai_classification_model"
                name="ai_classification_model"
                value={classModel}
                onChange={(e) => setClassModel(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Modo debug */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Diagnóstico
          </h2>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="hidden"
              name="mode_debug"
              value={debug ? 'true' : 'false'}
            />
            <button
              type="button"
              role="switch"
              aria-checked={debug}
              onClick={() => setDebug(!debug)}
              className={`mt-0.5 relative h-5 w-9 rounded-full transition-colors ${
                debug ? 'bg-indigo-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  debug ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-200">Modo debug</p>
              <p className="text-xs text-gray-500">
                Cuando está activo, todos los eventos se registran en app_logs con detalle completo.
                Desactivarlo en producción para reducir volumen de logs.
              </p>
            </div>
          </label>

          {debug && (
            <p className="rounded-lg border border-yellow-800 bg-yellow-900/20 px-4 py-2 text-xs text-yellow-400">
              Debug activo: cada acción del sistema queda registrada con payload completo en la tabla app_logs.
            </p>
          )}
        </section>

        {/* Feedback y submit */}
        {state.message && (
          <p className={`text-sm ${state.isError ? 'text-red-400' : 'text-green-400'}`}>
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  )
}
