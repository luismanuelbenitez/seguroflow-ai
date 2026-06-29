/*
 * INTENCION: Banner de disclaimer para el MVP local de demo comercial.
 * Aclara claramente que la pantalla usa datos simulados y NO envía WhatsApp real.
 * Se coloca en la parte superior de cada pantalla del dashboard para que
 * el producer piloto (y el equipo) no confundan la demo con produccion.
 *
 * SERVER COMPONENT: no necesita 'use client'. Banner estatico.
 *
 * USO:
 *   <DemoDisclaimer />
 *   <DemoDisclaimer message="Esta pantalla simula el outbox. No envía mensajes reales." />
 */

type DemoDisclaimerProps = {
  /** Mensaje personalizado. Usa el default si no se pasa. */
  message?: string
  /** Variante visual: 'info' (azul, default) o 'warning' (amarillo) */
  variant?: 'info' | 'warning'
}

export default function DemoDisclaimer({
  message,
  variant = 'info',
}: DemoDisclaimerProps) {
  const isWarning = variant === 'warning'

  const text =
    message ??
    'Demo local: no envía WhatsApp real, no usa IA y no contiene datos reales de prospectos.'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.6rem 0.9rem',
        background: isWarning ? '#fffbeb' : '#eff6ff',
        border: `1px solid ${isWarning ? '#fcd34d' : '#bfdbfe'}`,
        borderRadius: '7px',
        marginBottom: '1.25rem',
        fontSize: '0.8rem',
        color: isWarning ? '#78350f' : '#1e40af',
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>
        {isWarning ? '⚠️' : 'ℹ️'}
      </span>
      <span>{text}</span>
    </div>
  )
}
