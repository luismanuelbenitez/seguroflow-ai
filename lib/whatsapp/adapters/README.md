# lib/whatsapp/adapters/

Adapters para proveedores de WhatsApp Business API (WABA).

## Regla critica

El codigo de negocio NUNCA debe depender directamente de un proveedor WABA.

**Incorrecto:**
```ts
import twilio from 'twilio'
const client = twilio(accountSid, authToken)
await client.messages.create({ from: 'whatsapp:+...', to: 'whatsapp:+...', body: '...' })
```

**Correcto:**
```ts
import { sendWhatsappMessage } from '@/lib/whatsapp/adapters/twilio'
await sendWhatsappMessage({ to: prospect.phone, body: message })
```

## Por que este patron

El proveedor WABA definitivo para el piloto real aun no esta decidido.
Ver: docs/00-ai-context/CURRENT_STATE.md (decisiones pendientes).

Con este patron, cambiar de Twilio sandbox a 360dialog en produccion
requiere solo cambiar WHATSAPP_PROVIDER en las variables de entorno.
El codigo de negocio del recuperador de cotizaciones no se toca.

## Adapters previstos

| Archivo | Proveedor | Entorno |
|---|---|---|
| `base.ts` | — | Interfaz comun que todos los adapters deben implementar |
| `twilio.ts` | Twilio | Sandbox de desarrollo y pruebas |
| `360dialog.ts` | 360dialog / Sinch | Opcion para el piloto real |
| `meta.ts` | Meta Cloud API directa | Opcion para escala |

## Variables de entorno requeridas

```
WHATSAPP_PROVIDER=twilio
WHATSAPP_WEBHOOK_SECRET=<secreto HMAC - nunca en codigo>
```

## Seguridad: verificacion de webhooks

TODOS los webhooks de WhatsApp deben verificar la firma HMAC antes de
procesar cualquier dato. Si la firma no coincide, rechazar con 401.

Esta verificacion debe ocurrir como primer paso en el handler, antes de
parsear el body o hacer cualquier consulta a la base de datos.

Ver: server/README.md y docs/04-decisiones/DECISION-003-multitenant-rls.md, Seccion 6.

## Templates HSM

Los mensajes proactivos (outbound, iniciados por el sistema) requieren templates
aprobados por Meta. El proceso de aprobacion tarda 1-7 dias habiles.

No usar mensajes de texto libre en mensajes outbound sin template aprobado.
Ver: docs/02-product/MESSAGE_SEQUENCES.md

## Referencia

- docs/04-decisiones/DECISION-002-stack-tecnologico-inicial.md
- docs/00-ai-context/CURRENT_STATE.md (proveedor WABA: decision pendiente)
