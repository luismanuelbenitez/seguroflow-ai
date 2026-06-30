import { createClient } from '@/lib/supabase/server'

const LEVEL_STYLES: Record<string, string> = {
  info: 'bg-blue-900/40 text-blue-300 border-blue-800',
  warn: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  error: 'bg-red-900/40 text-red-300 border-red-800',
  debug: 'bg-gray-800 text-gray-400 border-gray-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  auth: 'Auth',
  quote: 'Cotización',
  message: 'Mensaje',
  ai: 'IA',
  whatsapp: 'WhatsApp',
  config: 'Config',
  system: 'Sistema',
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; category?: string; page?: string }>
}) {
  const params = await searchParams
  const level = params.level ?? 'all'
  const category = params.category ?? 'all'
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 50
  const offset = (page - 1) * pageSize

  const supabase = await createClient()

  let query = supabase
    .from('app_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (level !== 'all') query = query.eq('level', level)
  if (category !== 'all') query = query.eq('event_category', category)

  const { data: logs, count, error } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ level, category, page: String(page), ...overrides })
    return `/admin/logs?${p}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Logs del sistema</h1>
        <p className="mt-1 text-sm text-gray-400">
          Eventos de negocio registrados. En modo debug se incluyen eventos técnicos detallados.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Nivel</label>
          <div className="flex gap-2">
            {['all', 'info', 'warn', 'error', 'debug'].map((l) => (
              <a
                key={l}
                href={buildUrl({ level: l, page: '1' })}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  level === l
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {l === 'all' ? 'Todos' : l.toUpperCase()}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Categoría</label>
          <div className="flex flex-wrap gap-2">
            {['all', 'auth', 'quote', 'message', 'ai', 'whatsapp', 'config', 'system'].map((c) => (
              <a
                key={c}
                href={buildUrl({ category: c, page: '1' })}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  category === c
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {c === 'all' ? 'Todas' : (CATEGORY_LABELS[c] ?? c)}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-500">
        {count ?? 0} eventos total — página {page} de {totalPages || 1}
      </p>

      {/* Tabla */}
      {error ? (
        <p className="text-sm text-red-400">Error al cargar logs: {error.message}</p>
      ) : !logs || logs.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 text-center text-sm text-gray-500">
          No hay logs con los filtros seleccionados
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Evento</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {logs.map((log: Record<string, unknown>) => (
                <tr key={log.id as string} className="hover:bg-gray-900/50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-400">
                    {new Date(log.created_at as string).toLocaleString('es-UY', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[log.level as string] ?? ''}`}>
                      {(log.level as string).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {CATEGORY_LABELS[log.event_category as string] ?? log.event_category as string}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    {log.event_type as string}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {log.details ? (
                      <pre className="truncate text-xs text-gray-500">
                        {JSON.stringify(log.details, null, 0)}
                      </pre>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex gap-2">
          {page > 1 && (
            <a href={buildUrl({ page: String(page - 1) })} className="rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:text-white">
              ← Anterior
            </a>
          )}
          {page < totalPages && (
            <a href={buildUrl({ page: String(page + 1) })} className="rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:text-white">
              Siguiente →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
