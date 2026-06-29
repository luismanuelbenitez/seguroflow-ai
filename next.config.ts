import type { NextConfig } from 'next'

/*
 * INTENCION: Configuracion central de Next.js para SeguroFlow AI.
 *
 * DECISIONES TECNICAS:
 * - App Router habilitado por defecto en Next.js 15 (no requiere config adicional).
 * - No se agregan rewrites ni redirects todavia: la estructura de rutas del MVP
 *   es simple y no los requiere en esta etapa.
 * - No se configura imagenes externas todavia: el MVP no muestra imagenes de prospectos.
 *
 * Ver: docs/04-decisiones/DECISION-002-stack-tecnologico-inicial.md
 */
const nextConfig: NextConfig = {
  // Placeholder: agregar configuracion a medida que el proyecto lo requiera.
  // Documentar el motivo de cada opcion que se agregue.
}

export default nextConfig
