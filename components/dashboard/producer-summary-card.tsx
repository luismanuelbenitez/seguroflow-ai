import type { ProducerContextSuccess } from '@/lib/producers/get-current-producer-context'

/*
 * INTENCION: Mostrar el resumen del producer asociado al usuario autenticado.
 * Tiene dos estados:
 *   A) Con producer: muestra nombre, rol y estado.
 *   B) Sin producer: muestra mensaje informativo de estado vacio esperado.
 *
 * POR QUE SERVER COMPONENT (sin 'use client'):
 *   - Solo muestra datos que recibe por props — sin estado reactivo.
 *   - Es llamado desde app/dashboard/page.tsx, que ya obtiene todos los datos.
 *   - No necesita fetch ni interacciones del usuario.
 *
 * ESTADO VACIO (hasProducer: false):
 *   En entorno local sin datos de prueba, el usuario autenticado no tendra
 *   un producer_member asociado. Es el estado inicial esperado.
 *   El mensaje informativo guia al desarrollador sobre el proximo paso.
 *
 * USO:
 *   import ProducerSummaryCard from '@/components/dashboard/producer-summary-card'
 *   <ProducerSummaryCard context={ctx} />
 *
 * Ver: lib/producers/get-current-producer-context.ts (fuente de datos)
 * Ver: docs/00-ai-context/CURRENT_STATE.md (proximo paso: seed local)
 * Ver: supabase/migrations/001_base_multitenant_schema.sql (tabla producers)
 */

type ProducerSummaryCardProps = {
  /**
   * Contexto del producer. Puede tener hasProducer: false si el usuario
   * aun no tiene membresía activa (estado normal en desarrollo local).
   */
  context: ProducerContextSuccess
}

export default function ProducerSummaryCard({ context }: ProducerSummaryCardProps) {
  // ── Estado vacio: sin producer asociado ─────────────────────────────────
  if (!context.hasProducer) {
    return (
      <section
        style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <p
          style={{
            margin: 0,
            fontWeight: 600,
            color: '#0369a1',
            fontSize: '0.95rem',
          }}
        >
          Sin productor/broker asociado
        </p>

        <p
          style={{
            marginTop: '0.75rem',
            marginBottom: 0,
            color: '#0c4a6e',
            lineHeight: 1.6,
            fontSize: '0.9rem',
          }}
        >
          Tu usuario todavia no esta asociado a un productor/broker.
          Esto es esperado en entorno local hasta crear datos de prueba.
        </p>

        {/*
         * Si el error fue por falla de query (no por falta de datos),
         * mostramos un aviso tecnico adicional para facilitar el debug.
         */}
        {context.error === 'query_failed' && (
          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: 0,
              color: '#b91c1c',
              fontSize: '0.8rem',
              background: '#fee2e2',
              padding: '0.5rem 0.75rem',
              borderRadius: '4px',
            }}
          >
            Error tecnico al consultar producer_members. Verificar que Supabase local este
            corriendo (<code>npx supabase@2.108.0 start</code>) y que la migracion 001 este
            aplicada (<code>npx supabase@2.108.0 db reset</code>).
          </p>
        )}

        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            background: '#e0f2fe',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: '#0c4a6e',
          }}
        >
          <strong>Proximo paso para desarrolladores:</strong>
          <br />
          Crear un seed local o un flujo de onboarding minimo para insertar un registro
          en <code>producers</code> y otro en <code>producer_members</code> con tu user_id.
          <br />
          Ver: <code>docs/00-ai-context/CURRENT_STATE.md</code>
        </div>
      </section>
    )
  }

  // ── Con producer: mostrar datos ──────────────────────────────────────────
  const { producer, membership } = context

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* Cabecera de la tarjeta */}
      <p
        style={{
          margin: 0,
          fontSize: '0.75rem',
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        Productor / Broker
      </p>

      <h2
        style={{
          margin: '0.4rem 0 0',
          fontSize: '1.35rem',
          fontWeight: 700,
          color: '#0f172a',
        }}
      >
        {producer!.name}
      </h2>

      {/* Datos de la membresia */}
      <div
        style={{
          marginTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {/* Rol del usuario en este producer */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Tu rol
          </p>
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.95rem',
              color: '#1e293b',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {membership!.role}
          </p>
        </div>

        {/* Estado del producer */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Estado
          </p>
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.95rem',
              color: producer!.status === 'active' ? '#166534' : '#b45309',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {producer!.status}
          </p>
        </div>

        {/* Plan del producer */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Plan
          </p>
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.95rem',
              color: '#1e293b',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {producer!.plan}
          </p>
        </div>

        {/* Modo de envio */}
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Modo de envio
          </p>
          <p
            style={{
              margin: '0.25rem 0 0',
              fontSize: '0.95rem',
              color: '#1e293b',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {producer!.send_mode}
          </p>
        </div>
      </div>

      {/* Footer: contacto del producer */}
      {producer!.contact_name && (
        <p
          style={{
            marginTop: '1rem',
            marginBottom: 0,
            fontSize: '0.82rem',
            color: '#64748b',
          }}
        >
          Contacto: {producer!.contact_name}
        </p>
      )}
    </section>
  )
}
