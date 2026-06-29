'use client'

/*
 * INTENCION: Boton de cliente que dispara la Server Action createDemoQuote()
 * y refresca la pagina para mostrar la nueva quote en la lista.
 *
 * POR QUE 'use client':
 *   - Necesita estado de carga (isPending) para deshabilitar el boton mientras
 *     la Server Action se ejecuta en el servidor.
 *   - Necesita router.refresh() para revalidar los datos del Server Component padre.
 *
 * FLUJO:
 *   1. Usuario hace click en el boton.
 *   2. useTransition inicia — isPending = true, boton deshabilitado.
 *   3. createDemoQuote() se ejecuta en el servidor (crea prospect + quote si no existen).
 *   4. Segun el resultado, se muestra un mensaje de estado temporal.
 *   5. router.refresh() fuerza al Server Component padre (/dashboard/quotes) a refetchar.
 *   6. isPending = false — boton vuelve a estar disponible.
 *
 * ESTADO LOCAL:
 *   statusMessage: string | null — mensaje efimero post-accion.
 *   Desaparece al hacer click nuevamente o al refrescar.
 *
 * DECISION TECNICA:
 *   Se usa useTransition + useRouter().refresh() en lugar de revalidatePath()
 *   dentro de la Server Action porque revalidatePath no cruza el boundary
 *   client/server de forma confiable en Next.js 15 con App Router.
 *   El router.refresh() desde el cliente es la alternativa documentada.
 *
 * RESTRICCION DE USO:
 *   Este componente es de desarrollo local. Solo aparece en /dashboard/quotes.
 *   En produccion, la carga de cotizaciones sera via formulario o CSV (DECISION pendiente).
 *
 * Ver: app/actions/quotes.ts (la Server Action que llama)
 * Ver: app/dashboard/quotes/page.tsx (Server Component padre)
 * Ver: docs/05-architecture/LOCAL_SEEDING.md (contexto del flujo demo)
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDemoQuote } from '@/app/actions/quotes'

export default function CreateDemoQuoteButton() {
  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const router = useRouter()

  /**
   * INTENCION: Manejar el click del boton, ejecutar la accion y mostrar feedback.
   *
   * FLUJO:
   *   1. Limpia el mensaje anterior.
   *   2. Inicia transition (para isPending y no bloquear UI).
   *   3. Llama createDemoQuote() — puede crear o encontrar prospect/quote existente.
   *   4. Muestra mensaje de estado segun resultado.
   *   5. Si fue exitoso, refresca para mostrar la quote en la lista.
   */
  function handleClick() {
    // Resetear estado anterior antes de cada click
    setStatusMessage(null)
    setIsError(false)

    startTransition(async () => {
      const result = await createDemoQuote()

      if (!result.success) {
        // Mostrar error al usuario sin exponer detalles tecnicos internos
        const errorMessages: Record<typeof result.error, string> = {
          unauthenticated: 'Tu sesion expiro. Recarga la pagina e inicia sesion.',
          no_producer: 'No hay producer asociado a tu usuario. Ejecuta el seed local primero.',
          query_failed: 'Error al crear la cotizacion demo. Ver logs del servidor.',
        }
        setIsError(true)
        setStatusMessage(errorMessages[result.error])
        return
      }

      if (result.isExisting) {
        // La quote ya existia — no se duplico (comportamiento idempotente esperado)
        setIsError(false)
        setStatusMessage('La cotizacion demo ya existia. Se muestra en la lista.')
      } else {
        setIsError(false)
        setStatusMessage('Cotizacion demo creada. Actualizando lista...')
      }

      /*
       * Refrescar el Server Component padre para que la lista se actualice.
       * Esto llama de nuevo a getQuotesForCurrentProducer() en el servidor.
       */
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <button
        onClick={handleClick}
        disabled={isPending}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: isPending ? '#94a3b8' : '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.88rem',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          alignSelf: 'flex-start',
        }}
      >
        {isPending ? (
          <>
            {/* Indicador de carga simple — sin dependencias de iconos */}
            <span
              style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            Creando...
          </>
        ) : (
          'Crear cotizacion demo local'
        )}
      </button>

      {/*
       * Mensaje de estado temporal: confirmacion de exito o descripcion de error.
       * Desaparece cuando el usuario hace click nuevamente.
       */}
      {statusMessage && (
        <p
          role="status"
          aria-live="polite"
          style={{
            margin: 0,
            fontSize: '0.82rem',
            color: isError ? '#dc2626' : '#16a34a',
            fontWeight: 500,
          }}
        >
          {statusMessage}
        </p>
      )}

      {/*
       * Keyframes para el spinner — inline para no depender de CSS global.
       * Alternativa: agregar @keyframes spin a globals.css si se reutiliza.
       */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
