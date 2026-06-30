import OpenAI from 'openai'
import type {
  AiAdapter,
  AiClassification,
  AiSuggestedAction,
  ClassifyResponseInput,
  ClassifyResponseOutput,
  GenerateMessageInput,
  GenerateMessageOutput,
} from './base'

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  auto: 'automóvil',
  home: 'hogar',
  life: 'vida',
  commercial: 'comercial',
  other: 'otro',
}

const SYSTEM_PROMPT_GENERATION = `Eres un asistente de seguimiento de cotizaciones de seguros en Uruguay.
Tu tarea es redactar un mensaje de WhatsApp profesional, cálido y conciso para hacer seguimiento
de una cotización que el prospecto aún no aceptó.

Reglas estrictas:
- Máximo 300 caracteres.
- No confirmes emisión de póliza ni coberturas específicas.
- No negocies precio ni condiciones.
- No digas que eres un bot si no te preguntan.
- Ante cualquier objeción compleja, invitá a hablar con el productor.
- Usá un tono uruguayo, profesional y amigable.
- No uses emojis en exceso (máximo 1-2).`

const SYSTEM_PROMPT_CLASSIFICATION = `Sos un clasificador de respuestas de prospectos para un sistema de seguros.
Dado el mensaje de un prospecto, clasificalo en UNA de las siguientes categorías:
- interested: muestra interés activo, quiere avanzar
- needs_more_info: pide más información sin objeción clara
- price_objection: cuestiona el precio o costo
- coverage_objection: cuestiona la cobertura o condiciones
- wants_human_contact: quiere hablar con una persona
- not_interested: declina claramente
- opt_out_requested: pide no ser contactado más
- unclear_response: respuesta ambigua sin clasificación clara
- angry_or_sensitive: tono negativo o situación delicada

Respondé SOLO en JSON con este formato exacto:
{
  "classification": "<categoría>",
  "confidence": <0.00-1.00>,
  "suggested_action": "<respond|escalate|close>",
  "summary": "<resumen en español de 1 frase>",
  "requires_human": <true|false>
}

Regla: si confidence < 0.80, requires_human debe ser true.
Regla: angry_or_sensitive, wants_human_contact y opt_out_requested siempre tienen requires_human=true.`

export function createOpenAiAdapter(
  apiKey: string,
  generationModel: string,
  classificationModel: string
): AiAdapter {
  const client = new OpenAI({ apiKey })

  return {
    async generateFollowUpMessage(input: GenerateMessageInput): Promise<GenerateMessageOutput> {
      const insuranceLabel = INSURANCE_TYPE_LABELS[input.insuranceType] ?? input.insuranceType
      const amountText =
        input.quotedAmount
          ? ` por ${input.currency} ${input.quotedAmount.toLocaleString('es-UY')}`
          : ''
      const riskText = input.riskDescription ? ` (${input.riskDescription})` : ''
      const insurerText = input.insurerName ? ` con ${input.insurerName}` : ''

      const userPrompt = `Escribí un mensaje de seguimiento para:
- Prospecto: ${input.prospectName}
- Producto: seguro de ${insuranceLabel}${riskText}${amountText}${insurerText}
- Productor: ${input.producerName}
${input.messageSignature ? `- Firma: ${input.messageSignature}` : ''}`

      const response = await client.chat.completions.create({
        model: generationModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_GENERATION },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      })

      const message = response.choices[0]?.message?.content?.trim() ?? ''

      return {
        message,
        modelUsed: generationModel,
        tokensUsed: response.usage?.total_tokens,
      }
    },

    async classifyProspectResponse(input: ClassifyResponseInput): Promise<ClassifyResponseOutput> {
      const userPrompt = input.conversationContext
        ? `Contexto previo: ${input.conversationContext}\n\nMensaje del prospecto: "${input.messageBody}"`
        : `Mensaje del prospecto: "${input.messageBody}"`

      const response = await client.chat.completions.create({
        model: classificationModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_CLASSIFICATION },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw)

      return {
        classification: (parsed.classification ?? 'unclear_response') as AiClassification,
        confidence: Number(parsed.confidence ?? 0.5),
        suggestedAction: (parsed.suggested_action ?? 'escalate') as AiSuggestedAction,
        summary: parsed.summary ?? 'Sin resumen disponible',
        requiresHuman: Boolean(parsed.requires_human ?? true),
        modelUsed: classificationModel,
      }
    },
  }
}
