# WHATSAPP_REAL_PLAN.md — Plan de Integración WhatsApp Real (M2)

> **Estado:** Documentación de planificación. No se ha integrado WhatsApp real.
> No se ha ejecutado supabase db push. No se han tocado migraciones.
> Este documento describe la hoja de ruta técnica para el momento en que se
> decida avanzar — no autoriza ninguna acción de código o infraestructura.
>
> **Última actualización:** 2026-06-29

---

## 1. Objetivo de la integración

El MVP-01 simuló localmente el envío de mensajes WhatsApp para validar el flujo
completo sin riesgo. El objetivo de M2 es reemplazar esa simulación por envío real
controlado, manteniendo las siguientes garantías del piloto:

- **Aprobación humana previa obligatoria.** El producer revisa y aprueba cada mensaje
  antes de enviarlo. El sistema no actúa por su cuenta en el piloto.
- **Registro completo.** Cada mensaje outbound e inbound queda en `whatsapp_messages`
  y cada transición de estado en `quote_events`.
- **Opt-out como barrera obligatoria.** Ningún mensaje se envía a un prospect con
  `opt_out = true`, sin excepción.
- **Máximo 2 mensajes automáticos sin intervención humana** (M1, M2). M3 es siempre
  disparo manual del producer.

Lo que M2 NO incluye: IA generativa, clasificación automática de respuestas,
templates definitivos aprobados por Meta, ni multi-proveedor avanzado.

---

## 2. Opciones de proveedor

No se ha tomado una decisión definitiva. A continuación se analizan las tres
opciones principales para que la decisión sea informada.

---

### 2.1 Meta WhatsApp Cloud API (directo)

La API oficial de Meta, sin intermediario. El producer debe registrar un número
WABA (WhatsApp Business Account) y los templates HSM deben ser aprobados por Meta.

**Pros:**
- Sin costo de intermediario. Solo se pagan las conversaciones a Meta.
- Acceso directo a las capacidades más nuevas (botones interactivos, listas, etc.).
- Sin dependencia de un BSP externo que pueda cambiar precios o condiciones.
- Ideal a largo plazo si el volumen justifica la complejidad.

**Contras:**
- El onboarding WABA puede tardar días o semanas (verificación de empresa en Meta).
- La aprobación de templates HSM tarda entre 1 y 7 días hábiles (puede rechazarse).
- El webhook debe estar en HTTPS accesible desde internet — requiere deploy real
  (Vercel o similar) antes de poder hacer cualquier prueba real.
- La documentación oficial de Meta es extensa y cambia frecuentemente.
- Sandbox limitado: no hay un "modo sandbox" oficial para Meta Cloud API
  (las pruebas reales llegan a números reales).

**Complejidad:** Media-alta. Requiere deploy en producción para testear webhooks.

**Requisitos previos:**
- Cuenta de empresa verificada en Meta Business Suite.
- Número de teléfono dedicado para WABA (no puede ser un número ya registrado en WhatsApp personal).
- Templates HSM aprobados antes de enviar el primer mensaje fuera de ventana de 24h.
- Webhook HTTPS público (ngrok o Vercel para dev, producción para piloto).

**Riesgos:**
- Un template rechazado paraliza el flujo hasta que Meta lo apruebe.
- Si el número recibe muchos reportes de spam, Meta puede suspenderlo.
- Sin sandbox oficial, los errores de integración se ven en mensajes reales.

**Recomendación para piloto:** Viable a largo plazo. Para el primer piloto es la
opción de menor costo marginal, pero el proceso de onboarding puede alargar meses
el tiempo hasta el primer mensaje real. Evaluar si el productor piloto ya tiene
un número WABA activo.

---

### 2.2 Twilio WhatsApp Sandbox / Producción

Twilio actúa como BSP (Business Solution Provider): intermedia con Meta y simplifica
la integración técnica. Tiene un sandbox oficial para desarrollo sin aprobación de Meta.

**Pros:**
- **Sandbox disponible inmediatamente.** Con una cuenta gratuita de Twilio y un join
  al sandbox, se pueden recibir y enviar mensajes reales sin aprobación de templates.
  Ideal para validar el webhook y el flujo completo antes del piloto.
- SDK oficial para Node.js con tipos TypeScript.
- Documentación detallada y estable.
- El webhook puede probarse localmente con Twilio CLI + tunel ngrok.
- Modo producción requiere número WABA aprobado por Meta (vía Twilio), pero
  Twilio asiste en el proceso.

**Contras:**
- Markup de Twilio sobre el precio de Meta (costo mayor por conversación).
- Dependencia de un tercero: si Twilio cambia precios o condiciones, hay que migrar.
- El sandbox tiene limitaciones (los prospectos deben unirse manualmente al sandbox).
- En producción, igual requiere templates HSM aprobados.

**Complejidad:** Baja-media. El sandbox es el path de menor fricción para empezar.

**Requisitos previos:**
- Cuenta en twilio.com (gratuita para sandbox).
- Para producción: número WABA aprobado (Twilio ayuda en el proceso).
- Webhook HTTPS público para recibir mensajes inbound.

**Riesgos:**
- El sandbox solo sirve para validación técnica: los prospectos reales no pueden
  usarlo sin unirse manualmente (no válido para piloto real con prospectos).
- El costo por conversación es mayor que Meta directo a escala.

**Recomendación para piloto:** Es la opción recomendada para el primer paso de M2.
El sandbox permite validar todo el flujo técnico (webhook, outbound, inbound, opt-out,
eventos) sin comprometerse con Meta ni con prospectos reales. Luego se puede migrar
a producción Twilio o a Meta directo según la evolución del piloto.

---

### 2.3 360dialog u otro BSP regional

360dialog es un BSP (Business Solution Provider) que opera como intermediario con Meta,
con foco en el mercado latinoamericano y europeo.

**Pros:**
- Menor costo que Twilio en algunos mercados de la región.
- Soporte en español.
- Proceso de onboarding WABA a veces más rápido que Meta directo.
- API compatible con Meta Cloud API (menor lock-in que Twilio).

**Contras:**
- Menos documentación en inglés y menos ejemplos públicos de integración.
- SDK menos maduro que Twilio para TypeScript/Node.
- Dependencia de un proveedor regional cuya continuidad es menor que Twilio o Meta.
- Sin sandbox oficial equivalente al de Twilio.

**Complejidad:** Media. Similar a Meta directo pero con la intermediación de 360dialog.

**Requisitos previos:**
- Cuenta en 360dialog.
- Número WABA verificado.
- Templates aprobados por Meta (360dialog asiste).

**Riesgos:**
- Si 360dialog tiene problemas de servicio, el sistema de mensajería queda sin
  respaldo inmediato.
- El onboarding puede ser más opaco que con Meta directo o Twilio.

**Recomendación para piloto:** No recomendado como primera opción para el MVP.
Evaluar solo si el producer piloto ya tiene una cuenta con 360dialog activa.

---

### Resumen comparativo

| Criterio | Meta Cloud API | Twilio (sandbox → prod) | 360dialog |
|---|---|---|---|
| Sandbox para dev | No oficial | Sí, inmediato | No |
| Costo por conversación | Más bajo (largo plazo) | Mayor (markup Twilio) | Medio |
| Complejidad de onboarding | Alta | Baja → Media | Media |
| SDK TypeScript | Comunidad (no oficial) | Oficial | Comunidad |
| Tiempo hasta primer mensaje | Semanas | Días (sandbox) | Semanas |
| Dependencia de tercero | Solo Meta | Meta + Twilio | Meta + 360dialog |
| Recomendado para piloto | No como primer paso | Sí | No como primer paso |

---

## 3. Flujo técnico propuesto M2

Este diagrama describe el flujo completo una vez integrado un proveedor WABA real.
Es una extensión del flujo actual del MVP, no un reemplazo de la lógica existente.

```
[Producer]
    │
    │ 1. La quote llega a status = 'pending_approval'
    │    (desde /scheduler local o desde el scheduler automático futuro)
    │
    ▼
[/dashboard/approvals]
    │
    │ 2. El producer revisa el mensaje M1 y hace clic en "Aprobar"
    │    → approveInitialFollowUpMessage() actualiza:
    │       quotes.approved_message = mensaje aprobado
    │       quotes.status = 'pending_approval'
    │       quote_events INSERT (event_type='message_approved', actor='producer')
    │
    ▼
[/dashboard/outbox]
    │
    │ 3. La quote aparece en el outbox lista para enviar
    │
    ▼
[sendApprovedMessage() — NUEVO en M2]
    │
    │ 4. Validaciones previas al envío:
    │    - prospects.opt_out = false (barrera obligatoria)
    │    - quotes.status = 'pending_approval'
    │    - quotes.approved_message IS NOT NULL
    │    - Producer tiene WABA activo (waba_number IS NOT NULL)
    │
    │ 5. Llamada al adapter del proveedor WABA:
    │    lib/whatsapp/send-message.ts
    │    → WhatsApp provider adapter (Twilio / Meta / 360dialog)
    │    → proveedor devuelve message_id externo
    │
    │ 6. En éxito: INSERT whatsapp_messages
    │    direction='outbound'
    │    delivery_status='sent'
    │    waba_message_id = message_id del proveedor (antes era null)
    │    body = approved_message
    │    template_name = 'seguimiento_inicial_v1'
    │    sent_at = now()
    │    metadata = { provider: 'twilio' | 'meta' | ... }
    │
    │ 7. UPDATE quotes.status 'pending_approval' → 'contacted'
    │
    │ 8. INSERT quote_events
    │    event_type='message_sent'
    │    actor='system'  ← en M2 es system porque lo envió el servidor, no el producer directamente
    │
    ▼
[Webhook inbound — NUEVO en M2]
    │
    │ 9. El prospecto responde por WhatsApp
    │    → proveedor llama al webhook de la aplicación
    │    → app/api/webhooks/whatsapp/route.ts
    │
    │ 10. Validación de firma del webhook
    │     (HMAC-SHA256 con WHATSAPP_APP_SECRET)
    │     → Rechazar si la firma no coincide (401)
    │
    │ 11. Idempotencia: verificar que waba_message_id no exista ya
    │     en whatsapp_messages antes de insertar
    │
    │ 12. INSERT whatsapp_messages
    │     direction='inbound'
    │     delivery_status='delivered'
    │     waba_message_id = message_id del proveedor
    │     body = texto del mensaje
    │     received_at = now()
    │     metadata = { provider: '...', raw_payload: ... (sin PII innecesaria) }
    │
    │ 13. INSERT quote_events
    │     event_type='response_received'
    │     actor='webhook'
    │
    │ 14. Notificar al producer (email, in-app, o ambos — a definir)
    │
    ▼
[Producer clasifica la respuesta manualmente]
    │    (En M2 no hay clasificación automática con IA)
    │    El producer va a /dashboard/quotes/[quoteId]
    │    y usa el panel "Simular respuesta" → ahora renombrado "Clasificar respuesta"
    │    para mover la quote al estado correcto
    │
    ▼
[Opt-out — barrera siempre activa]
    │
    │ Si el mensaje inbound contiene palabras clave de opt-out
    │ (STOP, DETENER, NO MAS, etc.):
    │
    │ → prospects.opt_out = true (UPDATE inmediato)
    │ → INSERT quote_events event_type='opt_out_received', actor='webhook'
    │ → Todas las quotes activas del prospect quedan bloqueadas
    │    (el trigger existente en whatsapp_messages ya bloquea futuros INSERTs)
    │
    └─ Ningún mensaje futuro puede enviarse a ese número
```

---

## 4. Variables de entorno esperadas

Solo nombres. Nunca commitear valores. Nunca exponer en el frontend.

```bash
# Proveedor activo: 'twilio' | 'meta' | '360dialog'
WHATSAPP_PROVIDER=

# Token de acceso al proveedor (API key de Twilio o access token de Meta)
WHATSAPP_ACCESS_TOKEN=

# ID del número de teléfono registrado en el proveedor
WHATSAPP_PHONE_NUMBER_ID=

# Token secreto para verificar el webhook al registrarlo con el proveedor
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# Secreto de la aplicación para validar la firma HMAC de los payloads inbound
WHATSAPP_APP_SECRET=

# ID de la cuenta WABA (WhatsApp Business Account)
WHATSAPP_BUSINESS_ACCOUNT_ID=

# URL pública de la aplicación (para construir webhook URLs en el código)
NEXT_PUBLIC_SITE_URL=
```

**Reglas de seguridad de variables:**

- `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_APP_SECRET` son server-side only.
  Nunca deben tener el prefijo `NEXT_PUBLIC_`.
- `.env.local` nunca se commitea al repositorio (ya está en `.gitignore`).
- En Vercel u otro hosting: cargar como variables de entorno del proyecto,
  nunca como texto en el código fuente.
- Rotar tokens si hay evidencia de exposición.
- Usar variables distintas para staging y producción.

---

## 5. Seguridad

### 5.1 Verificación de firma de webhook

Todo payload inbound del proveedor WABA debe ser verificado antes de procesarse.
Los detalles varían por proveedor, pero el patrón general es HMAC-SHA256:

```
// Pseudocódigo — adaptar según el proveedor elegido
const expectedSignature = hmac('sha256', WHATSAPP_APP_SECRET, rawBody)
if (receivedSignature !== expectedSignature) {
  return Response(401)  // rechazar sin procesar
}
```

Esta verificación debe ocurrir antes de cualquier acceso a la base de datos.
Un atacante que conozca la URL del webhook no debe poder insertar eventos falsos.

### 5.2 Validación de producer/prospect

Antes de procesar cualquier mensaje inbound, verificar:
- Que el número de teléfono inbound corresponde a un prospect en la base de datos.
- Que el prospect tiene al menos una quote activa con un producer.
- Que el producer tiene `waba_number` configurado.

No revelar en los logs si el número existe o no (evitar enumeración de prospects).

### 5.3 No service role en frontend

El service role de Supabase (con permisos para saltear RLS) nunca debe usarse
en código que corre en el cliente. Si alguna operación futura requiere service role
en un contexto server-side, documentarlo aquí con justificación explícita.

**Operaciones que pueden requerir service role en M2:**
- El webhook inbound corre como Route Handler de Next.js (server-side).
  Puede usar service role si la RLS impide al webhook escribir en `whatsapp_messages`
  sin pertenecer a un producer específico. Alternativa: diseñar la función de inserción
  con `SECURITY DEFINER` en PostgreSQL.

### 5.4 Idempotencia de webhooks

Los proveedores WABA pueden reenviar el mismo evento más de una vez. Antes de insertar
en `whatsapp_messages`, verificar que `waba_message_id` no exista ya:

```sql
-- El índice único en waba_message_id previene duplicados si se usa INSERT ... ON CONFLICT DO NOTHING
-- Verificar que existe este índice en el schema antes de M2
```

### 5.5 Logs sin PII innecesaria

Los logs del servidor nunca deben incluir:
- El cuerpo completo del mensaje del prospecto.
- El número de teléfono en texto plano si se puede evitar.
- Tokens o secretos.

El campo `metadata` en `whatsapp_messages` puede almacenar el `raw_payload` del proveedor
para debugging, pero documentar qué se almacena y por cuánto tiempo.

### 5.6 Opt-out como barrera obligatoria

La verificación de `opt_out = true` debe ocurrir en el servidor, nunca confiar solo
en el cliente. Si el opt-out llega via webhook, debe actualizarse en `prospects`
antes de procesar cualquier otra acción de esa quote.

---

## 6. Alcance fuera de M2

Las siguientes funcionalidades quedan explícitamente fuera de M2 para mantener el
foco del piloto:

| Funcionalidad | Estado | Fase sugerida |
|---|---|---|
| IA generativa para redactar mensajes | Fuera | M3 |
| Clasificación automática de respuestas (interesado / no interesado) | Fuera | M3 |
| Templates HSM definitivos y aprobados por Meta | Requerido para prod | M2 prep |
| Multi-proveedor avanzado (cambio de proveedor en caliente) | Fuera | Post-piloto |
| Importación masiva de prospectos por CSV | Fuera (DECISION-004) | Post-piloto |
| Integración con sistemas core de aseguradoras | Fuera | Post-MVP |
| App móvil para el producer | Fuera | Post-MVP |
| Renovaciones automáticas | Fuera | Post-MVP |
| Cross-sell | Fuera | Post-MVP |
| Análisis de sentimiento | Fuera | M3+ |
| Reportes avanzados / BI | Fuera | Post-piloto |

---

## 7. Recomendación: camino conservador para M2

El camino recomendado para llegar al primer mensaje real sin riesgos innecesarios:

### Paso 1: Adapter abstracto local (código — sin deploy)
Crear `lib/whatsapp/adapter.ts` con una interfaz común:
```typescript
interface WhatsAppAdapter {
  sendMessage(to: string, body: string): Promise<{ messageId: string }>
}
```
Implementar `LocalSimulatedAdapter` (lo que ya existe) y `TwilioAdapter`.
El código de negocio (outbox, webhook) no depende del proveedor concreto.

### Paso 2: Sandbox de Twilio (técnico, sin prospectos reales)
- Crear cuenta gratuita de Twilio.
- Configurar sandbox: número central de Twilio, no el del producer.
- Unirse al sandbox desde el teléfono del equipo para probar el flujo completo.
- Validar: outbound, inbound, webhook, idempotencia, opt-out.
- No enviar mensajes a prospectos reales en esta fase.

### Paso 3: Entorno cloud preparado
- Crear proyecto Supabase cloud (ref: `fawlbfkkxufyhnghynjk` — validar antes).
- Aplicar migraciones 001 y 002 solo después de autorización humana explícita.
- Deploy en Vercel con las variables de entorno de Twilio sandbox.
- Probar el webhook con Twilio CLI + URL de Vercel.

### Paso 4: Templates HSM
- Redactar template M1 para aprobación de Meta.
- Enviarlo a través del proceso de aprobación (Twilio asiste o Meta Business Suite).
- Esperar aprobación (1–7 días hábiles). Sin template aprobado, solo se puede
  responder dentro de la ventana de 24h de una conversación iniciada por el prospecto.

### Paso 5: Primer mensaje real controlado
- Elegir 1-2 prospectos del equipo (no clientes reales).
- Enviar el primer mensaje M1 real con el número del producer (o central).
- Validar el flujo completo end-to-end: outbound → inbound → webhook → evento → timeline.

### Paso 6: Piloto real con prospectos reales
- Solo después de que el paso 5 esté validado.
- Con consentimiento documentado del prospecto.
- Con el checklist pre-piloto completado (ver PRE_PILOT_CHECKLIST.md).

---

## Referencias

- DECISION-005: flujo de seguimiento WhatsApp para el MVP → `docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md`
- DATA_MODEL.md: tablas `whatsapp_messages`, `quote_events`, `prospects.opt_out` → `docs/05-architecture/DATA_MODEL.md`
- MESSAGE_SEQUENCES.md: plantillas M1, M2, M3 → `docs/02-product/MESSAGE_SEQUENCES.md`
- PRE_PILOT_CHECKLIST.md: checklist antes del primer piloto real → `docs/07-go-to-market/PRE_PILOT_CHECKLIST.md`
- SUPABASE_SAFETY_RULES.md: reglas de migraciones y project-ref → `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`
