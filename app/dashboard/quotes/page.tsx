import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import { getQuotesForCurrentProducer } from '@/lib/quotes/get-quotes-for-current-producer'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import QuotesList from '@/components/dashboard/quotes-list'
import CreateDemoQuoteButton from '@/components/dashboard/create-demo-quote-button'

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
      {/* Navegacion breadcrumb simple */}
      <nav
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.82rem',
          color: '#9ca3af',
        }}
        aria-label="Breadcrumb"
      >
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none' }}>
          Dashboard
        </Link>
        <span aria-hidden>›</span>
        <span style={{ color: '#374151', fontWeight: 600 }}>Cotizaciones</span>
      </nav>

      {/* Encabezado de la pagina */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 0.25rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            Cotizaciones
          </h1>
          {/*
           * Mostrar nombre del producer como contexto.
           * El usuario siempre ve datos de su propio producer (garantia de RLS).
           */}
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            {ctx.producer?.name ?? 'Producer'} — rol:{' '}
            <strong>{ctx.membership?.role ?? '—'}</strong>
          </p>
        </div>

        {/* Acciones del encabezado */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          {/*
           * Boton principal: navega al formulario de ingesta manual.
           * No requiere Client Component — es un link de navegacion simple.
           */}
          <Link
            href="/dashboard/quotes/new"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + Nueva cotizacion manual
          </Link>

          {/*
           * Herramientas de desarrollo — separadas del flujo real.
           * CreateDemoQuoteButton sigue disponible para seed rapido en local.
           */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>
              Solo desarrollo local:
            </p>
            <CreateDemoQuoteButton />
          </div>
        </div>
      </div>

      {/* Lista de cotizaciones — recibe el resultado ya fetched */}
      <QuotesList quotesResult={quotesResult} />

      {/* Nota de contexto para el equipo de desarrollo */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '0.75rem 1rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          fontSize: '0.78rem',
          color: '#0369a1',
        }}
      >
        <strong>Nota de desarrollo:</strong> Las cotizaciones demo no envian mensajes
        WhatsApp ni activan ninguna automatizacion. Son exclusivamente para validar el
        modelo de datos y el flujo del dashboard localmente.
        Ver: <code>docs/05-architecture/LOCAL_SEEDING.md</code>
      </div>
    </DashboardShell>
  )
}
