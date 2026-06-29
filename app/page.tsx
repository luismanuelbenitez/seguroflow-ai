/*
 * INTENCION: Pagina inicial del skeleton tecnico.
 * Esta pagina es un placeholder temporal. Sera reemplazada por:
 * - Una pantalla de login (Supabase Auth, magic link) cuando se implemente Auth.
 * - O un redirect al dashboard del producer si ya esta autenticado.
 *
 * No contiene logica de negocio ni llamadas a la base de datos.
 * Ver: docs/02-mvp/MVP-01-recuperador-cotizaciones.md para el flujo real.
 */
export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>SeguroFlow AI</h1>
      <p>Recuperador de Cotizaciones por WhatsApp</p>
      <hr />
      <p><strong>Estado:</strong> Skeleton tecnico inicial</p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Esta pagina sera reemplazada por el dashboard del producer.<br />
        Ver: <code>docs/02-mvp/MVP-01-recuperador-cotizaciones.md</code>
      </p>
    </main>
  )
}
