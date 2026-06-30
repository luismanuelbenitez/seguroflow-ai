import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL
  if (!adminEmail || user.email !== adminEmail) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">
              SeguroFlow Admin
            </span>
            <span className="h-4 w-px bg-gray-700" />
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="/admin/config" className="text-gray-300 hover:text-white transition-colors">
              Configuración
            </a>
            <a href="/admin/logs" className="text-gray-300 hover:text-white transition-colors">
              Logs
            </a>
            <a href="/dashboard" className="text-gray-500 hover:text-gray-300 transition-colors">
              Volver al dashboard
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
