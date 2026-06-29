'use client'

/*
 * INTENCION: Formulario de ingesta manual de cotizacion — componente de cliente
 * para /dashboard/quotes/new. Permite al producer ingresar una cotizacion
 * (prospect + quote) desde la interfaz web sin depender de CSV ni sistemas externos.
 *
 * POR QUE 'use client':
 *   - useActionState de React 19 requiere ejecucion en el cliente.
 *   - Necesitamos estado reactivo para mostrar errores de campo inline
 *     y deshabilitar el boton durante el procesamiento del Server Action.
 *   - La accion del formulario (createManualQuote) corre en el servidor.
 *
 * FLUJO:
 *   1. Usuario llena los campos y hace submit.
 *   2. createManualQuote() se ejecuta en el servidor con el FormData.
 *   3a. Si hay errores → estado actualiza, errores se muestran en el formulario.
 *   3b. Si es exito → el Server Action llama redirect() → browser navega a /dashboard/quotes.
 *       El formulario nunca ve el resultado exitoso.
 *
 * DECISION TECNICA — useActionState vs fetch manual:
 *   Se eligio useActionState porque:
 *   - Integra nativamente con Server Actions (mismo patron que /login).
 *   - Maneja isPending y FormData automaticamente.
 *   - No requiere un endpoint API separado ni manejo manual de fetch.
 *   Ver: app/login/page.tsx (patron identico aplicado al formulario de login)
 *
 * DECISION TECNICA — no preservar valores en error:
 *   Con useActionState y inputs HTML no controlados (sin value= reactivo),
 *   el browser retiene los valores que el usuario ingreso incluso cuando
 *   React re-renderiza el componente. No se necesita logica adicional.
 *
 * LO QUE NO HACE ESTE COMPONENTE:
 *   - No hace llamadas fetch directas a Supabase.
 *   - No usa el cliente Supabase (es cliente — sin acceso a cookies de sesion SSR).
 *   - No integra WhatsApp, IA ni ningun servicio externo.
 *   - No usa datos reales (aunque puede recibir datos reales en produccion futura).
 *
 * PRIVACIDAD:
 *   - Los inputs de nombre y telefono son PII. No loguear en consola del cliente.
 *   - Los errores mostrados al usuario no exponen datos internos del servidor.
 *
 * Ver: app/actions/quotes.ts (createManualQuote — la Server Action)
 * Ver: app/dashboard/quotes/new/page.tsx (el Server Component padre)
 * Ver: docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md (por que formulario manual)
 */

import { useActionState } from 'react'
import {
  createManualQuote,
  MANUAL_QUOTE_INITIAL_STATE,
  type ManualQuoteResult,
} from '@/app/actions/quotes'

// ============================================================
// Estilos reutilizables (objetos inline para no depender de CSS global)
// ============================================================

/*
 * Se definen como constantes fuera del render para evitar recreacion en cada ciclo.
 * Alternativa futura: migrar a CSS Modules o Tailwind si se agrega al proyecto.
 */
const styles = {
  section: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
  } as React.CSSProperties,

  sectionTitle: {
    margin: '0 0 1rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#374151',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #f1f5f9',
  } as React.CSSProperties,

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    marginBottom: '1rem',
  } as React.CSSProperties,

  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#374151',
  } as React.CSSProperties,

  labelOptional: {
    fontSize: '0.78rem',
    fontWeight: 400,
    color: '#9ca3af',
    marginLeft: '0.3rem',
  } as React.CSSProperties,

  input: {
    padding: '0.55rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.88rem',
    color: '#111827',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  inputError: {
    borderColor: '#f87171',
    background: '#fff5f5',
  } as React.CSSProperties,

  hint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    margin: 0,
  } as React.CSSProperties,

  fieldError: {
    fontSize: '0.78rem',
    color: '#dc2626',
    fontWeight: 500,
    margin: 0,
  } as React.CSSProperties,
}

// ============================================================
// Componente principal
// ============================================================

export default function QuoteForm() {
  /*
   * useActionState (React 19): conecta el Server Action con el estado del formulario.
   *   - state: resultado de createManualQuote (mensaje de error + fieldErrors)
   *   - formAction: la accion que conectar al prop action del <form>
   *   - isPending: true mientras el Server Action procesa (bloquea el submit)
   */
  const [state, formAction, isPending] = useActionState<ManualQuoteResult, FormData>(
    createManualQuote,
    MANUAL_QUOTE_INITIAL_STATE
  )

  return (
    <form
      action={formAction}
      style={{ maxWidth: '640px' }}
      noValidate /* La validacion server-side es la fuente de verdad — no el browser */
    >
      {/*
       * Banner de error general (se muestra si hay un error no especifico de campo).
       * Los errores de campo se muestran inline bajo cada input.
       */}
      {state.isError && state.message && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.88rem',
            color: '#b91c1c',
            fontWeight: 500,
          }}
        >
          {state.message}
        </div>
      )}

      {/* ── Seccion 1: Datos del prospecto ──────────────────────────────── */}
      <div style={styles.section}>
        <p style={styles.sectionTitle}>Datos del prospecto</p>

        {/* Campo: Nombre completo */}
        <div style={styles.fieldGroup}>
          <label htmlFor="full_name" style={styles.label}>
            Nombre completo
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            placeholder="Juan Perez"
            required
            disabled={isPending}
            autoComplete="off"
            style={{
              ...styles.input,
              ...(state.fieldErrors?.full_name ? styles.inputError : {}),
            }}
          />
          {state.fieldErrors?.full_name && (
            <p style={styles.fieldError} role="alert">{state.fieldErrors.full_name}</p>
          )}
        </div>

        {/* Campo: Telefono WhatsApp */}
        <div style={styles.fieldGroup}>
          <label htmlFor="phone" style={styles.label}>
            Telefono WhatsApp
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+59899123456"
            required
            disabled={isPending}
            autoComplete="off"
            style={{
              ...styles.input,
              ...(state.fieldErrors?.phone ? styles.inputError : {}),
            }}
          />
          {state.fieldErrors?.phone ? (
            <p style={styles.fieldError} role="alert">{state.fieldErrors.phone}</p>
          ) : (
            <p style={styles.hint}>
              Formato E.164: codigo de pais + numero. Ej: +59899123456 (Uruguay movil)
            </p>
          )}
        </div>

        {/* Campo: Email (opcional) */}
        <div style={styles.fieldGroup}>
          <label htmlFor="email" style={styles.label}>
            Email <span style={styles.labelOptional}>(opcional)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="juan.perez@email.com"
            disabled={isPending}
            autoComplete="off"
            style={{
              ...styles.input,
              ...(state.fieldErrors?.email ? styles.inputError : {}),
            }}
          />
          {state.fieldErrors?.email && (
            <p style={styles.fieldError} role="alert">{state.fieldErrors.email}</p>
          )}
        </div>

        {/* Campo: Consentimiento / base de contacto */}
        <div style={styles.fieldGroup}>
          <label htmlFor="consent_status" style={styles.label}>
            Base de contacto
          </label>
          {/*
           * consent_status: el producer declara la base legal para contactar al prospect.
           * 'granted' = tiene relacion previa (cliente que pidio cotizacion, cliente de cartera).
           * Esto es requerido por Ley 18.331 (Uruguay) antes de enviar mensajes al prospect.
           * Ver: docs/02-product/RECUPERADOR_COTIZACIONES.md — consideraciones legales.
           */}
          <select
            id="consent_status"
            name="consent_status"
            defaultValue="granted"
            disabled={isPending}
            style={styles.input}
          >
            <option value="granted">Otorgado — tengo relacion previa con este contacto</option>
            <option value="unknown">Sin declarar — necesito confirmarlo</option>
            <option value="revoked">Revocado — no contactar</option>
          </select>
          <p style={styles.hint}>
            El sistema solo podra enviar mensajes WhatsApp a prospects con consentimiento otorgado.
          </p>
        </div>
      </div>

      {/* ── Seccion 2: Datos de la cotizacion ───────────────────────────── */}
      <div style={styles.section}>
        <p style={styles.sectionTitle}>Datos de la cotizacion</p>

        {/* Campo: Tipo de seguro */}
        <div style={styles.fieldGroup}>
          <label htmlFor="insurance_type" style={styles.label}>
            Tipo de seguro
          </label>
          {/*
           * Valores del enum insurance_type en el schema v2.0.
           * Ver: types/database.ts — Database['public']['Enums']['insurance_type']
           */}
          <select
            id="insurance_type"
            name="insurance_type"
            defaultValue=""
            required
            disabled={isPending}
            style={{
              ...styles.input,
              ...(state.fieldErrors?.insurance_type ? styles.inputError : {}),
            }}
          >
            <option value="" disabled>Seleccionar tipo de seguro...</option>
            <option value="auto">Automotor</option>
            <option value="home">Hogar</option>
            <option value="life">Vida</option>
            <option value="commercial">Comercial</option>
            <option value="other">Otro</option>
          </select>
          {state.fieldErrors?.insurance_type && (
            <p style={styles.fieldError} role="alert">{state.fieldErrors.insurance_type}</p>
          )}
        </div>

        {/* Fila: Fecha + Monto (lado a lado en pantallas anchas) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Campo: Fecha de cotizacion */}
          <div style={styles.fieldGroup}>
            <label htmlFor="quote_date" style={styles.label}>
              Fecha de cotizacion
            </label>
            <input
              id="quote_date"
              name="quote_date"
              type="date"
              required
              disabled={isPending}
              defaultValue={getTodayDateString()}
              style={{
                ...styles.input,
                ...(state.fieldErrors?.quote_date ? styles.inputError : {}),
              }}
            />
            {state.fieldErrors?.quote_date && (
              <p style={styles.fieldError} role="alert">{state.fieldErrors.quote_date}</p>
            )}
          </div>

          {/* Campo: Monto cotizado */}
          <div style={styles.fieldGroup}>
            <label htmlFor="quoted_amount" style={styles.label}>
              Monto cotizado <span style={styles.labelOptional}>(opcional)</span>
            </label>
            <input
              id="quoted_amount"
              name="quoted_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="5000"
              disabled={isPending}
              style={{
                ...styles.input,
                ...(state.fieldErrors?.quoted_amount ? styles.inputError : {}),
              }}
            />
            {state.fieldErrors?.quoted_amount && (
              <p style={styles.fieldError} role="alert">{state.fieldErrors.quoted_amount}</p>
            )}
          </div>
        </div>

        {/* Fila: Moneda + Aseguradora */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Campo: Moneda */}
          <div style={styles.fieldGroup}>
            <label htmlFor="currency" style={styles.label}>
              Moneda <span style={styles.labelOptional}>(default: UYU)</span>
            </label>
            {/*
             * currency es TEXT libre en el schema v2.0, no es un enum.
             * Ofrecemos UYU y USD como opciones principales para Uruguay.
             * Ver: types/database.ts — quotes.Row.currency: string
             */}
            <select
              id="currency"
              name="currency"
              defaultValue="UYU"
              disabled={isPending}
              style={styles.input}
            >
              <option value="UYU">UYU — Pesos uruguayos</option>
              <option value="USD">USD — Dolares americanos</option>
            </select>
          </div>
        </div>

        {/* Campo: Descripcion del riesgo (y referencia de cotizacion) */}
        <div style={styles.fieldGroup}>
          <label htmlFor="risk_description" style={styles.label}>
            Descripcion del riesgo / referencia <span style={styles.labelOptional}>(opcional)</span>
          </label>
          {/*
           * NOTA: La tabla quotes NO tiene campo quote_reference en el schema v2.0.
           * Ver: docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md
           * Usamos risk_description para guardar la referencia textual si el
           * producer quiere registrarla. Ej: "COT-001: Toyota Hilux 2022"
           */}
          <input
            id="risk_description"
            name="risk_description"
            type="text"
            placeholder="Ej: COT-001 — Toyota Hilux 2022, o Casa 3 dorm. zona Carrasco"
            disabled={isPending}
            style={styles.input}
          />
          <p style={styles.hint}>
            Usa este campo para agregar una referencia interna o descripcion del bien asegurado.
          </p>
        </div>

        {/* Campo: Notas internas */}
        <div style={styles.fieldGroup}>
          <label htmlFor="internal_notes" style={styles.label}>
            Notas internas <span style={styles.labelOptional}>(opcional)</span>
          </label>
          <textarea
            id="internal_notes"
            name="internal_notes"
            placeholder="Notas privadas del producer. No se comparten con el prospect."
            rows={3}
            disabled={isPending}
            style={{
              ...styles.input,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
        </div>
      </div>

      {/* ── Acciones del formulario ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '0.6rem 1.5rem',
            background: isPending ? '#94a3b8' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {isPending ? 'Guardando...' : 'Guardar cotizacion'}
        </button>

        {/* Link de cancelar — vuelve a la lista sin cambios */}
        <a
          href="/dashboard/quotes"
          style={{
            fontSize: '0.88rem',
            color: '#6b7280',
            textDecoration: 'none',
          }}
          tabIndex={isPending ? -1 : undefined}
        >
          Cancelar
        </a>
      </div>

      {/*
       * Aviso de entorno de desarrollo — recordatorio visible en la UI.
       * Eliminar o condicionar con NODE_ENV cuando se use en produccion.
       */}
      <p
        style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: '#9ca3af',
          borderTop: '1px dashed #e2e8f0',
          paddingTop: '0.75rem',
        }}
      >
        Los datos ingresados aqui son guardados en la base de datos local.
        No se envian mensajes WhatsApp hasta que el flujo de seguimiento este integrado.
        Ver: <code>docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md</code>
      </p>
    </form>
  )
}

// ============================================================
// Utilidades locales
// ============================================================

/**
 * INTENCION: Obtener la fecha de hoy en formato YYYY-MM-DD para el input type="date".
 * Se ejecuta en el cliente — usa la zona horaria del browser.
 *
 * DECISION: No usamos la fecha del servidor porque el campo es un defaultValue
 * que solo se aplica al primer render. El producer puede cambiarla si la cotizacion
 * es de una fecha anterior.
 */
function getTodayDateString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
