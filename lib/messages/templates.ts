/*
 * INTENCION: Plantillas estaticas de mensajes WhatsApp para el MVP.
 * No usa IA. No llama APIs externas. Solo construye texto a partir de datos
 * de la cotizacion y el producer.
 *
 * DECISION (DECISION-005): En el piloto, los mensajes se generan con plantillas
 * estaticas y el producer los aprueba antes de enviar. No hay generacion con LLM
 * en esta etapa. Las plantillas se disenan para sonar humanas y no parecer spam.
 *
 * RESTRICTION IMPORTANTE:
 *   - Estas funciones NO prometen envio real.
 *   - NO dicen que el mensaje fue enviado.
 *   - Tono: humano, breve, con salida digna para el prospecto.
 *   - Sincrono puro — no hay async, no hay efectos secundarios.
 *
 * Ver: docs/02-product/MESSAGE_SEQUENCES.md (variantes A/B/C/D/E)
 * Ver: docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md
 */

// ============================================================
// Tipos de entrada para las plantillas
// ============================================================

/**
 * Datos minimos para construir el Mensaje 1 (seguimiento inicial).
 * Todos los campos son opcionales salvo los que tienen fallback definido
 * — la funcion nunca debe fallar por datos faltantes.
 */
export interface InitialFollowUpInput {
  /** Nombre completo del prospecto (PII — no loguear) */
  prospectName: string
  /** Nombre del producer para la firma del mensaje */
  producerName: string
  /** insurance_type del enum DB → etiqueta legible via getInsuranceTypeLabel() */
  insuranceTypeLabel: string
  /** Descripcion del riesgo, ej: "Toyota Hilux 2021" o "Apto. Pocitos 3 amb." */
  riskDescription?: string | null
  /** Monto cotizado para incluir en el mensaje si existe */
  quotedAmount?: number | null
  /** Moneda ISO 4217 (UYU/USD). Solo se muestra si también hay quotedAmount */
  currency?: string | null
}

// ============================================================
// Helpers internos
// ============================================================

/**
 * Extrae el primer nombre del prospecto para un tono mas personal.
 * Fallback al nombre completo si es una sola palabra o esta vacio.
 */
function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return 'estimado/a'
  const parts = trimmed.split(/\s+/)
  return parts[0] ?? trimmed
}

/**
 * Formatea el monto con separador de miles para mayor legibilidad.
 * Usa punto como separador de miles (estilo uruguayo).
 * Devuelve string vacio si el monto no es un numero positivo.
 */
function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (!amount || amount <= 0 || !currency) return ''
  // Formato simple sin Intl para evitar diferencias entre entornos locales
  const formatted = Math.round(amount).toLocaleString('es-UY')
  return ` por ${currency} ${formatted}/mes`
}

// ============================================================
// Plantilla M1 — Seguimiento inicial
// ============================================================

/**
 * INTENCION: Construir el texto del Mensaje 1 (seguimiento inicial).
 *
 * Este es el primer contacto del sistema con el prospecto. El tono debe ser:
 * - Calido pero no invasivo
 * - Breve (el prospecto lee en WhatsApp, no en email)
 * - Con "salida digna": si el prospecto no quiere seguir, puede decirlo sin drama
 *
 * EQUIVALENTE A: Variante A/B de MESSAGE_SEQUENCES.md (sin riesgo → B, con riesgo → A)
 *
 * NO llama a ninguna IA. El texto es estatico con variables interpoladas.
 *
 * @param input - Datos de la cotizacion y el producer
 * @returns Texto del mensaje listo para mostrar al producer para revision/aprobacion
 */
export function buildInitialFollowUpMessage(input: InitialFollowUpInput): string {
  const {
    prospectName,
    producerName,
    insuranceTypeLabel,
    riskDescription,
    quotedAmount,
    currency,
  } = input

  const firstName = extractFirstName(prospectName)
  const amountStr = formatAmount(quotedAmount, currency)

  // Frase del riesgo: si hay descripcion, da mas contexto personal
  const riskPhrase = riskDescription
    ? ` para tu ${riskDescription}`
    : ''

  /*
   * Estructura del mensaje (Variante A con riesgo, Variante B sin riesgo):
   *   Linea 1: saludo personal + de quien viene
   *   Linea 2: contexto de la cotizacion
   *   Linea 3: invitacion a responder
   *   Linea 4: salida digna (no presionar)
   *
   * No incluir informacion de cobertura ni compromisos — eso lo hace el producer.
   */
  return `Hola ${firstName} 👋

Te escribo de parte de ${producerName}. Hace unos días preparamos una cotización de ${insuranceTypeLabel}${riskPhrase}${amountStr}.

¿Tuviste oportunidad de revisarla? Si tenés alguna duda o querés ajustar algo, con gusto lo vemos.

Si ya lo resolviste, también está bien — avisame y te saco de la lista 😊`
}

// ============================================================
// Mapa de etiquetas legibles para insurance_type
// ============================================================

/**
 * INTENCION: Traducir el enum insurance_type al español para las plantillas.
 *
 * Este mapa vive aqui (y no en get-quotes-for-current-producer.ts) porque
 * las plantillas necesitan la etiqueta en minuscula para que quede natural
 * en medio de una oracion ("cotizacion de seguro de auto"), mientras que
 * la lista de quotes la necesita capitalizada ("Automotor").
 *
 * Si se agrega un nuevo valor al enum, agregar aqui tambien.
 */
export function getInsuranceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    auto: 'seguro de auto',
    home: 'seguro de hogar',
    life: 'seguro de vida',
    commercial: 'seguro comercial',
    other: 'seguro',
  }
  return labels[type] ?? 'seguro'
}
