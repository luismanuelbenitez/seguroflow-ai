// Tipos de entrada/salida compartidos por todos los adaptadores de IA.
// Cambiar de proveedor = cambiar el adaptador, no el código de negocio.

export type GenerateMessageInput = {
  prospectName: string
  insuranceType: string
  riskDescription: string | null
  insurerName: string | null
  quotedAmount: number | null
  currency: string
  producerName: string
  messageSignature: string | null
}

export type GenerateMessageOutput = {
  message: string
  modelUsed: string
  tokensUsed?: number
}

export type ClassifyResponseInput = {
  messageBody: string
  conversationContext?: string
}

export type ClassifyResponseOutput = {
  classification: AiClassification
  confidence: number
  suggestedAction: AiSuggestedAction
  summary: string
  requiresHuman: boolean
  modelUsed: string
}

export type AiClassification =
  | 'interested'
  | 'needs_more_info'
  | 'price_objection'
  | 'coverage_objection'
  | 'wants_human_contact'
  | 'not_interested'
  | 'opt_out_requested'
  | 'unclear_response'
  | 'angry_or_sensitive'

export type AiSuggestedAction = 'respond' | 'escalate' | 'close'

export interface AiAdapter {
  generateFollowUpMessage(input: GenerateMessageInput): Promise<GenerateMessageOutput>
  classifyProspectResponse(input: ClassifyResponseInput): Promise<ClassifyResponseOutput>
}
