# lib/ai/adapters/

Adapters para proveedores de LLM (Large Language Models).

## Regla critica

El codigo de negocio NUNCA debe importar directamente el SDK de un proveedor.

**Incorrecto:**
```ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()
```

**Correcto:**
```ts
import { generateFollowUpMessage } from '@/lib/ai/adapters/claude'
const message = await generateFollowUpMessage(quote, prospect)
```

## Por que este patron

Permite cambiar o agregar proveedores de LLM sin tocar el codigo de negocio.
Si Anthropic cambia su API, o se necesita un fallback a otro proveedor, o se
quiere correr Ollama en on-premise, solo cambia el adapter. La logica del
recuperador de cotizaciones no se modifica.

## Adapters previstos

| Archivo | Proveedor | Uso |
|---|---|---|
| `base.ts` | — | Interfaz comun que todos los adapters deben implementar |
| `claude.ts` | Anthropic Claude | Produccion: generacion + clasificacion |

Los modelos a usar (definidos en .env):
- `AI_GENERATION_MODEL`: generacion de mensajes de seguimiento (claude-sonnet-4-6)
- `AI_CLASSIFICATION_MODEL`: clasificacion de respuestas (claude-haiku-4-5-20251001)

## Variables de entorno requeridas

```
AI_PROVIDER=anthropic
AI_GENERATION_MODEL=claude-sonnet-4-6
AI_CLASSIFICATION_MODEL=claude-haiku-4-5-20251001
AI_API_KEY=<secreto - nunca en codigo>
```

## Limites duros de la IA (no configurables)

El adapter debe respetar los limites definidos en docs/00-ai-context/AI_BRIEF.md:

- No confirmar emision de poliza.
- No prometer ni detallar coberturas.
- No negociar precio ni condiciones.
- No interpretar clausulas legales.
- No mentir sobre ser automatizada si el prospecto pregunta.
- Ante cualquier duda -> escalar al producer.

## Referencia

- docs/04-decisiones/DECISION-002-stack-tecnologico-inicial.md
- docs/00-ai-context/AI_BRIEF.md (limites de la IA)
- docs/02-product/MESSAGE_SEQUENCES.md (mensajes y variantes)
