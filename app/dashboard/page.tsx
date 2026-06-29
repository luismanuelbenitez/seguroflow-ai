import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

/*
 * INTENCION: Dashboard inicial del producer — ruta protegida del MVP.
 * Solo accesible con sesion activa. Sin sesion, redirige a /login.
 *
 * POR QUE SERVER COMPONENT (sin 'use client'):
 *   - La verificacion de sesion ocurre en el servidor via getUser().
 *   - Evita exponer datos del usuario antes de verificar autenticacion.
 *   - Mas seguro: el redirect a /login ocurre antes de enviar HTML al browser.
 *   - El server component puede llamar directamente al Server Action signOut()
 *     en el prop action del formulario — sin necesidad de 'use client'.
 *
 * ESTADO ACTUAL (MVP fase inicial):
 *   - Solo muestra email del usuario autenticado y un boton de logout.
 *   - NO consulta tablas de negocio todavia (producers, quotes, prospects).
 *   - NO tiene dashboard funcional. Es el punto de entrada post-login.
 *   - El dashboard real del producer se implementa en iteraciones siguientes.
 *
 * PROXIMAS ITERACIONES:
 *   - Verificar que el usuario pertenece a un producer (tabla producer_members).
 *   - Si no pertenece a ningun producer, mostrar pantalla de "sin organizacion asignada".
 *   - Mostrar resumen de cotizaciones del producer (quotes) via server component.
 *   - Agregar navegacion: cotizaciones, prospectos, configuracion.
 *
 * Ver: docs/02-mvp/MVP-01-recuperador-cotizaciones.md
 * Ver: docs/02-product/USER_FLOWS.md (Flujo 1: Producer accede al dashboard)
 * Ver: supabase/migrations/001_base_multitenant_schema.sql (tablas de negocio)
 */
export default async function DashboardPage() {
  const supabase = await createClient()

  /*
   * SEGURIDAD CRITICA: Usar getUser() y NO getSession() para proteger esta ruta.
   *
   * getSession() lee el JWT desde la cookie local SIN validarlo contra el servidor.
   * Un token expirado, modificado o revocado podria pasar la verificacion de getSession().
   *
   * getUser() valida el JWT contra el servidor de Supabase Auth en cada llamada.
   * Es mas lento (un round-trip extra) pero es la unica verificacion confiable.
   * Para rutas protegidas, siempre usar getUser().
   *
   * Ver: https://supabase.com/docs/guides/auth/server-side/nextjs#protecting-routes
   */
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    /*
     * Sin sesion valida, redirigir al login.
     * redirect() de Next.js lanza internamente para interrumpir el render.
     * No es un error real — es el mecanismo de redireccion del framework.
     */
    redirect('/login')
  }

  /*
   * A partir de aqui, TypeScript sabe que user != null.
   * La sesion fue verificada contra el servidor de Supabase.
   *
   * NOTA DE PRIVACIDAD: user.email es PII. No loguear en produccion.
   * Mostrarlo en la UI del propio usuario esta bien (es su propio dato).
   */

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      {/* Cabecera del dashboard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Dashboard inicial — SeguroFlow AI</h1>

        {/*
         * Logout via Server Action en un formulario.
         * El form con action={signOut} conecta el boton directamente al Server Action.
         * No requiere 'use client' ni handlers manuales.
         * Al hacer submit, signOut() cierra la sesion y redirige a /login.
         */}
        <form action={signOut}>
          <button
            type="submit"
            style={{
              padding: '0.4rem 0.85rem',
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: '#555',
            }}
          >
            Cerrar sesion
          </button>
        </form>
      </div>

      {/* Datos del usuario autenticado */}
      <section
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Usuario autenticado
        </p>
        {/*
         * Mostramos el email del usuario. Es PII pero es el dato del propio usuario.
         * No loguear en consola ni en servicios de monitoreo externos.
         */}
        <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: '#1e293b' }}>
          {user.email}
        </p>
      </section>

      {/* Estado del MVP */}
      <section
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '1.25rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>Proximos pasos del MVP</p>
        <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', color: '#78350f', lineHeight: 1.6 }}>
          <li>Verificar membresia del producer (tabla producer_members)</li>
          <li>Mostrar cotizaciones en seguimiento (tabla quotes)</li>
          <li>Ver prospectos del producer (tabla prospects)</li>
          <li>Dashboard funcional del recuperador de cotizaciones</li>
        </ul>
        <p style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem', color: '#92400e' }}>
          Ver: <code>docs/02-mvp/MVP-01-recuperador-cotizaciones.md</code>
        </p>
      </section>
    </main>
  )
}
