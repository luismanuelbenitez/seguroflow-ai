import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProducerContext } from '@/lib/producers/get-current-producer-context'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import QuoteForm from '@/components/dashboard/quote-form'
import PageHeader from '@/components/ui/page-header'
import DemoDisclaimer from '@/components/ui/demo-disclaimer'

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
      <DemoDisclaimer message="Demo local: los datos ingresados son ficticios. No se envía WhatsApp real ni se contacta ningún prospecto." />

      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Cotizaciones', href: '/dashboard/quotes' },
          { label: 'Nueva cotizacion' },
        ]}
        title="Nueva cotizacion"
        subtitle={`${ctx.producer?.name ?? 'Producer'} · Carga un prospecto nuevo para iniciar el flujo de seguimiento.`}
        actions={
          <Link href="/dashboard/quotes" style={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', fontWeight: 600 }}>← Todas las cotizaciones</Link>
        }
      />

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
