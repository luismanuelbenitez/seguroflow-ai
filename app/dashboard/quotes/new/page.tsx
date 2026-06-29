import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import QuoteForm from '@/components/dashboard/quote-form'

/*
 * INTENCION: Pantalla de ingesta manual de cotizacion — ruta protegida.
 * Muestra el formulario de creacion de prospect + quote para el producer autenticado.
 *
 * ARQUITECTURA (dos componentes):
 *   Este componente (Server Component) hace el trabajo de seguridad:
 *   - Valida la sesion con getUser() (server-side, no getSession()).
 *   - Verifica que el usuario tiene un producer activo (producer_members).
 *   - Renderiza DashboardShell y pasa el contexto necesario.
 *
 *   QuoteForm (Client Component) maneja la interactividad:
 *   - useActionState para conectar con createManualQuote() Server Action.
 *   - Estado de carga, errores de campo, feedback al usuario.
 *
 * POR QUE SEPARAR:
 *   - El Server Component no puede usar useActionState (requiere 'use client').
 *   - El Client Component no puede acceder a cookies de sesion SSR directamente.
 *   - Esta separacion es el patron estandar de Next.js 15 App Router para
 *     formularios protegidos: Server Component como guard, Client Component para UI.
 *   Ver: app/dashboard/page.tsx (mismo patron para el dashboard principal)
 *
 * FLUJO COMPLETO:
 *   1. [Este componente] Valida sesion y producer → renderiza o redirige.
 *   2. [QuoteForm] Usuario llena el formulario y hace submit.
 *   3. [createManualQuote] Server Action valida datos y crea prospect + quote.
 *   4. [createManualQuote] En exito → redirect('/dashboard/quotes').
 *   4. [createManualQuote] En error → QuoteForm muestra mensajes inline.
 *
 * SEGURIDAD:
 *   - redirect('/login') ocurre en el servidor antes de enviar HTML.
 *   - createManualQuote() tambien valida sesion independientemente
 *     (no confia solo en el guard de esta pagina).
 *   - No se usa service role en ninguna parte de este flujo.
 *
 * Ver: components/dashboard/quote-form.tsx (UI interactiva del formulario)
 * Ver: app/actions/quotes.ts (createManualQuote — validacion y persistencia)
 * Ver: docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md (por que formulario manual)
 */
export default async function NewQuotePage() {
  // ── Paso 1: Validar sesion y producer context ────────────────────────────
  const ctx = await getCurrentProducerContext()

  /*
   * SEGURIDAD: Redirect al login antes de renderizar cualquier contenido.
   * El redirect ocurre en el servidor — el cliente nunca ve datos protegidos.
   */
  if (ctx.error === 'unauthenticated') {
    redirect('/login')
  }

  // ── Caso: usuario sin producer asociado ─────────────────────────────────
  /*
   * No puede crear cotizaciones sin producer_id.
   * Mostramos mensaje claro con pasos en lugar de una pantalla rota.
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
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
            No hay producer asociado a tu cuenta
          </p>
          <p style={{ margin: '0 0 1rem', color: '#78350f', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Para cargar cotizaciones primero debes asociar tu usuario a un producer.
            En desarrollo local, ejecuta el seed de la base de datos.
          </p>
          <p style={{ margin: '0 0 1rem', color: '#78350f', fontSize: '0.85rem' }}>
            Ver: <code>docs/05-architecture/LOCAL_SEEDING.md</code>
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

  // ── Paso 2: Renderizar formulario ─────────────────────────────────────────
  return (
    <DashboardShell userEmail={ctx.user.email ?? ''}>
      {/* Navegacion breadcrumb */}
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
        <Link href="/dashboard/quotes" style={{ color: '#6b7280', textDecoration: 'none' }}>
          Cotizaciones
        </Link>
        <span aria-hidden>›</span>
        <span style={{ color: '#374151', fontWeight: 600 }}>Nueva cotizacion</span>
      </nav>

      {/* Encabezado */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            margin: '0 0 0.25rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#0f172a',
          }}
        >
          Nueva cotizacion
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          {ctx.producer?.name ?? 'Producer'} — rol:{' '}
          <strong>{ctx.membership?.role ?? '—'}</strong>
        </p>
      </div>

      {/*
       * QuoteForm: Client Component que maneja useActionState y la interactividad.
       * No recibe props de datos — los obtiene desde el Server Action en cada submit.
       *
       * La separacion Server/Client Component es la razon por la que este archivo
       * no tiene 'use client' aunque QuoteForm si lo tiene.
       */}
      <QuoteForm />
    </DashboardShell>
  )
}
