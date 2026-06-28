# DATA_MODEL.md — Modelo de Datos MVP

## Proyecto

**SeguroFlow AI**

## Módulo

**MVP-01 — Recuperador de Cotizaciones por WhatsApp**

---

## Objetivo del documento

Definir el modelo de datos mínimo necesario para implementar el MVP del Recuperador de Cotizaciones.

Este documento no contiene SQL definitivo. Su objetivo es dejar claro qué entidades existen, qué datos se guardan, cómo se relacionan y qué estados deben manejarse antes de comenzar la implementación técnica.

---

## Principios del modelo de datos

* Guardar solo los datos necesarios para el seguimiento comercial.
* Mantener trazabilidad completa de mensajes, respuestas y cambios de estado.
* Diseñar desde el inicio pensando en multi-productor, aunque el piloto sea con 1–3 productores.
* Separar prospectos, cotizaciones, mensajes, eventos y clasificaciones de IA.
* No guardar datos sensibles innecesarios.
* Permitir auditoría básica.
* Preparar el sistema para futura versión SaaS, private cloud u on-premise.

---

## Entidades principales

### 1. Producers

Representa al productor, broker o corredora que usa SeguroFlow AI.

Campos sugeridos:

| Campo                    | Tipo      | Descripción                              |
| ------------------------ | --------- | ---------------------------------------- |
| id                       | uuid      | Identificador único                      |
| name                     | text      | Nombre comercial del productor o broker  |
| contact_name             | text      | Persona responsable                      |
| email                    | text      | Email de contacto                        |
| phone                    | text      | Teléfono de contacto                     |
| whatsapp_business_number | text      | Número autorizado para envíos, si aplica |
| status                   | text      | active / inactive / pilot                |
| created_at               | timestamp | Fecha de creación                        |
| updated_at               | timestamp | Última actualización                     |

---

### 2. Prospects

Representa a la persona o empresa que recibió una cotización.

Campos sugeridos:

| Campo           | Tipo      | Descripción                                   |
| --------------- | --------- | --------------------------------------------- |
| id              | uuid      | Identificador único                           |
| producer_id     | uuid      | Productor asociado                            |
| full_name       | text      | Nombre del prospecto                          |
| phone           | text      | Teléfono WhatsApp                             |
| email           | text      | Email opcional                                |
| document_number | text      | Documento opcional, evitar si no es necesario |
| consent_status  | text      | unknown / granted / revoked                   |
| opt_out         | boolean   | Indica si pidió baja                          |
| created_at      | timestamp | Fecha de creación                             |
| updated_at      | timestamp | Última actualización                          |

Notas:

* En MVP, el teléfono es obligatorio.
* El documento de identidad no debería pedirse salvo que el productor ya lo tenga y sea necesario.
* Si el prospecto pide baja, no se le debe volver a contactar.

---

### 3. Quotes

Representa una cotización no cerrada.

Campos sugeridos:

| Campo                | Tipo      | Descripción                           |
| -------------------- | --------- | ------------------------------------- |
| id                   | uuid      | Identificador único                   |
| producer_id          | uuid      | Productor asociado                    |
| prospect_id          | uuid      | Prospecto asociado                    |
| insurance_type       | text      | auto / hogar / vida / comercio / otro |
| insurer_name         | text      | Aseguradora cotizada, opcional        |
| quote_reference      | text      | Número o referencia de cotización     |
| quoted_amount        | numeric   | Prima o costo cotizado, opcional      |
| currency             | text      | UYU / USD                             |
| quote_date           | timestamp | Fecha de emisión de cotización        |
| follow_up_start_at   | timestamp | Fecha en que debe iniciar seguimiento |
| status               | text      | Estado comercial de la cotización     |
| assigned_seller_name | text      | Vendedor/productor asignado           |
| notes                | text      | Notas internas                        |
| created_at           | timestamp | Fecha de creación                     |
| updated_at           | timestamp | Última actualización                  |

Estados sugeridos para `status`:

```text
pending_follow_up
scheduled
contacted
responded
interested
needs_more_info
human_handoff
closed_won
closed_lost
no_response
opt_out
cancelled
error
```

---

### 4. WhatsApp Messages

Representa cada mensaje enviado o recibido por WhatsApp.

Campos sugeridos:

| Campo               | Tipo      | Descripción                          |
| ------------------- | --------- | ------------------------------------ |
| id                  | uuid      | Identificador único                  |
| quote_id            | uuid      | Cotización asociada                  |
| prospect_id         | uuid      | Prospecto asociado                   |
| producer_id         | uuid      | Productor asociado                   |
| direction           | text      | outbound / inbound                   |
| message_body        | text      | Contenido del mensaje                |
| template_name       | text      | Nombre de plantilla usada, si aplica |
| whatsapp_message_id | text      | ID externo del proveedor             |
| status              | text      | Estado técnico del mensaje           |
| sent_at             | timestamp | Fecha de envío                       |
| delivered_at        | timestamp | Fecha de entrega                     |
| read_at             | timestamp | Fecha de lectura, si está disponible |
| failed_at           | timestamp | Fecha de error                       |
| failure_reason      | text      | Motivo del error                     |
| created_at          | timestamp | Fecha de creación                    |

Estados sugeridos para `status`:

```text
pending
sent
delivered
read_if_available
responded
failed
```

---

### 5. AI Classifications

Representa la clasificación que hace la IA sobre una respuesta del prospecto.

Campos sugeridos:

| Campo                 | Tipo      | Descripción                     |
| --------------------- | --------- | ------------------------------- |
| id                    | uuid      | Identificador único             |
| quote_id              | uuid      | Cotización asociada             |
| message_id            | uuid      | Mensaje entrante analizado      |
| classification        | text      | Resultado de clasificación      |
| confidence            | numeric   | Confianza estimada              |
| summary               | text      | Resumen breve para el productor |
| suggested_next_action | text      | Acción sugerida                 |
| requires_human        | boolean   | Si debe intervenir una persona  |
| created_at            | timestamp | Fecha de creación               |

Clasificaciones sugeridas:

```text
interested
needs_more_info
price_objection
coverage_objection
wants_human_contact
not_interested
opt_out_requested
unclear_response
angry_or_sensitive
```

Regla:
La IA clasifica y resume. No decide emisión, cobertura, aceptación ni condiciones comerciales.

---

### 6. Human Handoffs

Representa una derivación al productor o vendedor.

Campos sugeridos:

| Campo       | Tipo      | Descripción                   |
| ----------- | --------- | ----------------------------- |
| id          | uuid      | Identificador único           |
| quote_id    | uuid      | Cotización asociada           |
| producer_id | uuid      | Productor asociado            |
| prospect_id | uuid      | Prospecto asociado            |
| reason      | text      | Motivo de derivación          |
| summary     | text      | Resumen para el humano        |
| status      | text      | pending / accepted / resolved |
| assigned_to | text      | Persona asignada              |
| created_at  | timestamp | Fecha de creación             |
| resolved_at | timestamp | Fecha de resolución           |

Motivos comunes:

```text
prospect_interested
prospect_has_question
price_objection
coverage_objection
human_requested
sensitive_case
unclear_response
```

---

### 7. Quote Events

Representa el historial de eventos de una cotización.

Campos sugeridos:

| Campo       | Tipo      | Descripción         |
| ----------- | --------- | ------------------- |
| id          | uuid      | Identificador único |
| quote_id    | uuid      | Cotización asociada |
| event_type  | text      | Tipo de evento      |
| description | text      | Descripción breve   |
| metadata    | jsonb     | Datos adicionales   |
| created_at  | timestamp | Fecha del evento    |

Eventos sugeridos:

```text
quote_created
follow_up_scheduled
message_sent
message_delivered
message_read
message_failed
prospect_replied
ai_classified_response
human_handoff_created
status_changed
quote_closed_won
quote_closed_lost
opt_out_requested
```

---

## Relaciones principales

```text
Producer
  └── Prospects
  └── Quotes
        └── WhatsApp Messages
        └── AI Classifications
        └── Human Handoffs
        └── Quote Events
```

Reglas:

* Un productor puede tener muchos prospectos.
* Un prospecto puede tener muchas cotizaciones.
* Una cotización pertenece a un prospecto y a un productor.
* Una cotización puede tener muchos mensajes.
* Una cotización puede tener muchas clasificaciones de IA.
* Una cotización puede generar una o más derivaciones humanas.
* Todo cambio importante debe quedar registrado como evento.

---

## Datos mínimos para cargar una cotización

Para el piloto, una cotización puede cargarse con:

```text
producer_id
prospect_full_name
prospect_phone
insurance_type
quote_date
quoted_amount opcional
currency opcional
assigned_seller_name opcional
notes opcional
```

No se debe exigir más información que la necesaria para iniciar seguimiento.

---

## Consideraciones de privacidad

* No almacenar datos sensibles si no son necesarios.
* Registrar si el prospecto pidió baja.
* No contactar prospectos con `opt_out = true`.
* Mantener trazabilidad de mensajes y eventos.
* Permitir auditoría posterior de qué se envió, cuándo y por qué.
* No usar datos del productor o prospecto para entrenamiento de modelos.

---

## Decisiones tomadas

* El MVP usará una base estructurada, preferentemente Supabase/PostgreSQL.
* Google Sheets puede servir solo para demo interna sin datos reales.
* El sistema debe guardar mensajes, estados y eventos.
* La IA será asistiva y no decisoria.
* El modelo debe permitir piloto pequeño, pero no bloquear evolución multi-productor.

---

## Preguntas abiertas

* ¿El productor cargará cotizaciones por CSV, formulario o ambas?
* ¿Qué proveedor de WhatsApp se usará inicialmente?
* ¿Cada productor usará su propio número autorizado o se usará un número central durante el piloto?
* ¿Qué datos mínimos reales suelen tener disponibles los productores?
* ¿Cómo se validará que una cotización fue efectivamente recuperada?
* ¿El cierre de venta se cargará manualmente o se inferirá por estado?
* ¿Qué reportes mínimos necesita ver el productor en el dashboard?

---

## Próximo paso

Convertir este modelo conceptual en:

1. Esquema inicial de tablas.
2. Definición de enums.
3. Reglas de seguridad por productor.
4. Flujo de carga CSV/formulario.
5. Dashboard mínimo de cotizaciones.
