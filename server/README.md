# server/

Logica del lado servidor que no pertenece a las rutas de Next.js App Router.

Esta carpeta contiene servicios, jobs y utilitarios que corren exclusivamente
en el servidor y nunca se exponen al cliente.

## Estructura prevista

```
server/
  jobs/
    detect-eligible-quotes.ts    # Detecta cotizaciones listas para seguimiento
    send-followup-messages.ts    # Envia mensajes via adapter de WhatsApp
  webhooks/
    whatsapp.ts                  # Procesa eventos entrantes de la API WABA
  services/
    quote-processor.ts           # Logica de negocio: transiciones de estado
    message-generator.ts         # Genera mensajes via adapter de IA
    opt-out-handler.ts           # Maneja opt-outs y actualiza estado del prospecto
    ai-classifier.ts             # Clasifica respuestas del prospecto via adapter de IA
    handoff-creator.ts           # Crea derivaciones al producer humano
```

## Relacion con app/ (Next.js routes)

Los webhooks y jobs no viven en `app/api/` por claridad de separacion.
Los route handlers de Next.js en `app/api/` son entry points HTTP que
llaman a los servicios de esta carpeta, no implementan la logica directamente.

Ejemplo:
```
app/api/webhooks/whatsapp/route.ts   <- entry point HTTP, verifica firma HMAC
  -> server/webhooks/whatsapp.ts     <- logica de procesamiento del webhook
       -> server/services/ai-classifier.ts
       -> server/services/quote-processor.ts
```

## Reglas criticas

### 1. Verificacion HMAC obligatoria en webhooks

TODO webhook debe verificar la firma HMAC de la solicitud entrante ANTES
de procesar cualquier dato. Si la firma no coincide, rechazar con 401 y no
loguear el body.

```ts
// Primer paso en cualquier handler de webhook:
const isValid = verifyHmacSignature(rawBody, signature, process.env.WHATSAPP_WEBHOOK_SECRET!)
if (!isValid) return new Response('Unauthorized', { status: 401 })
```

### 2. Service role de Supabase solo en este directorio

El SUPABASE_SERVICE_ROLE_KEY bypasea RLS. Solo se usa en server/ para:
- El handler del webhook de WhatsApp.
- Los jobs de deteccion y envio de mensajes.
- Operaciones de mantenimiento.

NUNCA pasar el service role key a funciones client-side o a componentes React.

### 3. Audit trail obligatorio

Todo proceso automatico que use el service role DEBE registrar un evento
en quote_events con actor = 'system'. Sin excepcion.

Esto permite reconstruir el historial completo de cada cotizacion y
cumplir con el audit trail requerido.

### 4. No loguear PII

Nunca loguear numeros de telefono completos, nombres de prospectos ni
contenido de mensajes en logs de aplicacion o de error.
Mascara para telefono: +598 9XX XXX X89

### 5. Opt-out: doble barrera

Antes de enviar cualquier mensaje outbound:
1. (Capa de aplicacion) Verificar que prospect.opt_out = false.
2. (Capa de DB) El trigger enforce_prospect_opt_out en Supabase bloquea
   el INSERT si opt_out = true, como segunda barrera de seguridad.

## Referencia

- docs/04-decisiones/DECISION-003-multitenant-rls.md (service role, opt-out)
- docs/00-ai-context/CODING_RULES.md (PII, comentarios, seguridad)
- supabase/migrations/001_base_multitenant_schema.sql, Seccion 14 (trigger opt-out)
