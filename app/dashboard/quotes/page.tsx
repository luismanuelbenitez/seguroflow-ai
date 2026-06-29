import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getQuotesForCurrentProducer } from '@/lib/quotes/get-quotes-for-current-producer'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import QuotesList from '@/components/dashboard/quotes-list'
import CreateDemoQuoteButton from '@/components/dashboard/create-demo-quote-button'
import PageHeader from '@/components/ui/page-header'
import DemoDisclaimer from '@/components/ui/demo-disclaimer'

/*
 * INTENCION: Pantalla de cotizaciones del producer — ruta protegida.
 * Muestra las quotes del producer autenticado y permite crear una quote demo
 * para validar el flujo local de extremo a extremo.
 *
 * FLUJO DE ESTE COMPONENTE:
 *   1. getCurrentProducerContext() valida sesion y obtiene producer_id.
 *   2. Si no hay sesion → redirect al login.
 *   3. Si no hay producer → mostrar estado de error con link a /dashboard.
 *   4. Si hay producer → getQuotesForCurrentProducer() trae las quotes.
 *   5. Renderizar QuotesList + CreateDemoQuoteButton.
 *
 * ESTADO ACTUAL (MVP local — fase de desarrollo):
 *   - La pagina muestra cotizaciones reales de la DB local.
 *   - El boton "Crear cotizacion demo" llama a createDemoQuote() (Server Action).
 *   - No hay formulario de carga de cotizaciones reales todavia (pendiente en CURRENT_STATE.md).
 *   - No hay paginacion (OK para demo local con pocos registros).
 *
 * PROXIMAS ITERACIONES:
 *   - Formulario de carga de cotizaciones reales (CSV o formulario manual).
 *   - Filtrado por estado (pending_follow_up, interested, etc.).
 *   - Detalle de cotizacion individual con historial de mensajes.
 *   - Paginacion cuando haya >20 quotes.
 *
 * SEGURIDAD:
 *   - getUser() (no getSession()) — validacion server-side real.
 *   - getQuotesForCurrentProducer() usa RLS — el usuario solo ve sus propias quotes.
 *   - No se usa service role en ninguna operacion de esta pagina.
 *
 * Ver: lib/producers/get-current-producer-context.ts (auth + producer context)
 * Ver: lib/quotes/get-quotes-for-current-producer.ts (query de quotes con prospect names)
 * Ver: components/dashboard/quotes-list.tsx (componente de lista)
 * Ver: components/dashboard/create-demo-quote-button.tsx (boton de accion — 'use client')
 * Ver: app/actions/quotes.ts (Server Action createDemoQuote)
 * Ver: docs/05-architecture/LOCAL_SEEDING.md (guia del flujo demo)
 */
export default async function QuotesPage() {
  // ── Paso 1: Validar sesion y obtener producer context ────────────────────
  const ctx = await getCurrentProducerContext()

  /*
   * SEGURIDAD: Si no hay sesion, redirect al login antes de renderizar.
   * El redirect ocurre en el servidor — el cliente nunca ve datos protegidos.
   */
  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  // ── Caso: usuario sin producer asociado ─────────────────────────────────
  /*
   * Esto ocurre cuando:
   *   a) El seed local no se ejecuto todavia.
   *   b) El usuario es nuevo y no fue asignado a ningun producer.
   *
   * Mostramos un mensaje claro con pasos a seguir en lugar de una pantalla rota.
   * No redirigimos automaticamente a /dashboard para no crear loops inesperados.
   */
  if (!ctx.hasProducer) {
    return (
      <DashboardShell userEmail={ctx.user.email ?? ''}>
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem',
              fontWeight: 700,
              color: '#92400e',
              fontSize: '0.95rem',
            }}
          >
            No hay producer asociado a tu cuenta
          </p>
          <p style={{ margin: '0 0 1rem', color: '#78350f', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Para ver las cotizaciones, primero debes asociar tu usuario a un producer.
            En desarrollo local, esto se hace ejecutando el seed de la base de datos.
          </p>
          <p style={{ margin: '0 0 1rem', color: '#78350f', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Ver: <code>docs/05-architecture/LOCAL_SEEDING.md</code> y{' '}
            <code>supabase/seed.local.example.sql</code>
          </p>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '0.45rem 1rem',
              background: '#92400e',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Volver al dashboard
          </Link>
        </div>
      </DashboardShell>
    )
  }

  // ── Paso 2: Obtener cotizaciones del producer ────────────────────────────
  /*
   * Pasamos el producer_id que ya obtuvimos del context para evitar una segunda
   * llamada a auth.getUser() + producer_members dentro de getQuotesForCurrentProducer.
   * La funcion acepta producerId directamente para este caso de uso.
   */
  const quotesResult = await getQuotesForCurrentProducer(ctx.membership!.producer_id)

  // ── Renderizar dashboard de cotizaciones ─────────────────────────────────
  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>

      <DemoDisclaimer />

      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cotizaciones' }]}
        title="Cotizaciones"
        subtitle={`${ctx.producer?.name ?? 'Producer'} · Rol: ${ctx.membership?.role ?? '—'}`}
        actions={
          <>
            {/* CTA principal: nueva cotizacion */}
            <Link
              href="/dashboard/quotes/new"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1.1rem',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '7px',
                fontSize: '0.85rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              + Nueva cotizacion
            </Link>
            {/* Links secundarios */}
            <Link href="/dashboard/scheduler" style={{ fontSize: '0.82rem', color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>
              Scheduler →
            </Link>
            <Link href="/dashboard/approvals" style={{ fontSize: '0.82rem', color: '#059669', textDecoration: 'none', fontWeight: 600 }}>
              Aprobacion →
            </Link>
            <Link href="/dashboard/metrics" style={{ fontSize: '0.82rem', color: '#0891b2', textDecoration: 'none', fontWeight: 600 }}>
              Metricas →
            </Link>
          </>
        }
      />

      {/* Lista de cotizaciones */}
      <QuotesList quotesResult={quotesResult} />

      {/* Herramienta de seed local (solo para desarrollo) */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.6rem 0.9rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <span>Seed local:</span>
        <CreateDemoQuoteButton />
      </div>
    </DashboardShell>
  )
}
