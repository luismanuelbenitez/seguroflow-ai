import type { Metadata } from 'next'

/*
 * INTENCION: Layout raiz de la aplicacion Next.js.
 * Define el HTML base, el idioma y los metadatos globales.
 *
 * DECISIONES TECNICAS:
 * - lang="es": el sistema opera en espanol (mercado Uruguay/region).
 * - Sin estilos globales todavia: el MVP-01 no tiene disenio de UI definido.
 *   Agregar cuando se diseNe el dashboard del producer.
 * - Sin providers (Context, Zustand, etc.) todavia: agregar solo cuando
 *   se necesiten y documentar el motivo.
 */
export const metadata: Metadata = {
  title: 'SeguroFlow AI',
  description: 'Recuperador automatico de cotizaciones por WhatsApp para productores de seguros.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
