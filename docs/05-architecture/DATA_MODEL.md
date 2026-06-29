# DATA_MODEL.md
# Modelo de Datos — MVP Recuperador de Cotizaciones

> **Versión:** 2.0 — 2026-06-28
> **Estado:** Diseño completo y alineado. Migración 001 generada en `/supabase/migrations/`. Pendiente de validación local.
> **Alineado con:** DECISION-002 (Supabase/PostgreSQL), DECISION-003 (multi-tenant y RLS).
>
> **Nomenclatura:** inglés en `snake_case` para todas las tablas y columnas.
>
> **Privacidad:** Las entidades marcadas con `[PII]` contienen datos personales
> sujetos a la Ley 18.331 de Uruguay. Ver `CODING_RULES.md §5`.
>
> **Este documento es diseño de datos, no SQL definitivo.**
> Las migraciones reales viven en `/supabase/migrations/`.

---

## Principio fundamental: `producer_id` ≠ `auth.uid()`

Esta distinción es crítica. Confundirlos crearía deuda arquitectónica irrecuperable.

| Concepto | Qué representa | De dónde viene |
|---|---|---|
| `auth.uid()` | Una **persona física** que inició sesión | Supabase Auth |
| `producer_id` | Una **organización comercial** (el tenant) | Tabla `producers` |

Un `producer` puede tener varios usuarios en el futuro (el productor más su
asistente, una corredora con varios vendedores). En el MVP hay 1 usuario por
productor, pero el modelo no impone esa restricción: la tabla `producer_members`
la maneja desde el día uno.

---

## Capa de identidad y tenancy (3 tablas)

Estas tres tablas gobiernan quién puede ver qué. El resto del sistema las
referencia pero no debería depender de su estructura interna.

---

### `auth.users` — gestionado por Supabase

No se define aquí. Supabase Auth lo mantiene internamente. Solo importa que
`auth.uid()` devuelve el UUID del usuario autenticado en la sesión actual.

Toda política RLS que necesite verificar la identidad del usuario actual usa
`auth.uid()` — nunca se pasa como parámetro ni se almacena en tablas de negocio.

---

### `profiles` — datos personales del usuario

Extiende `auth.users` con información de la persona. Relación 1:1.
Se crea automáticamente via trigger en cuanto se registra un usuario.

```
profiles
├── id              UUID, PK — IGUAL a auth.uid() (FK implícita a auth.users.id)
├── full_name       TEXT
├── display_name    TEXT        — nombre que aparece en la UI ("Gonzalo R.")
├── phone           TEXT [PII]  — teléfono personal, para recibir alertas del sistema
├── avatar_url      TEXT NULLABLE
├── created_at      TIMESTAMPTZ DEFAULT now()
└── updated_at      TIMESTAMPTZ DEFAULT now()
```

**RLS:** cada usuario solo puede leer y editar su propio perfil.
```
POLICY: id = auth.uid()
```

---

### `producers` — la organización comercial (el tenant)

Representa al productor individual, corredor o corredora que usa el sistema.
Su `id` es el `producer_id` que viaja por todas las tablas de negocio.
Este UUID **no es** el `auth.uid()` de ningún usuario.

```
producers
├── id                  UUID, PK  — el producer_id que referencia todo el sistema
├── name                TEXT      — nombre comercial ("Seguros Rodríguez", "Gómez & Asoc.")
├── contact_name        TEXT      — persona principal de contacto
├── waba_number         TEXT      — número WhatsApp Business en E.164 (+59899123456)
├── waba_provider       TEXT      — 'twilio' | '360dialog' | 'meta_direct'
├── waba_config_ref     TEXT      — referencia al secreto en vault (NUNCA la key real)
├── follow_up_hours     INTEGER DEFAULT 48  — umbral para activar seguimiento
├── send_mode           TEXT DEFAULT 'manual'  — 'manual' | 'automatic'
├── message_signature   TEXT      — texto de cierre para mensajes salientes
├── plan                TEXT DEFAULT 'pilot'   — 'pilot' | 'starter' | 'pro' | 'enterprise'
├── status              TEXT DEFAULT 'active'  — 'active' | 'inactive' | 'suspended'
├── created_at          TIMESTAMPTZ DEFAULT now()
└── updated_at          TIMESTAMPTZ DEFAULT now()
```

**Nota de seguridad:** `waba_config_ref` almacena únicamente un identificador
(ej.: nombre de la variable de entorno o clave en Supabase Vault). La API key
real de WhatsApp nunca vive en esta columna ni en ninguna tabla.

**RLS:** un usuario puede leer los producers a los que pertenece vía
`producer_members`. Solo el service role puede crear nuevos producers.

---

### `producer_members` — vincula usuarios con producers

La tabla puente. Define qué usuarios pertenecen a qué producer y con qué rol.
En el MVP siempre habrá exactamente una fila por producer con `role = 'owner'`.
El diseño no impone ese límite.

```
producer_members
├── id              UUID, PK
├── producer_id     UUID, FK → producers.id
├── user_id         UUID, FK → auth.users.id
├── role            TEXT DEFAULT 'owner'
│                   Valores MVP:    'owner'
│                   Valores futuros: 'admin' | 'agent' | 'viewer'
├── is_active       BOOLEAN DEFAULT true
├── invited_at      TIMESTAMPTZ DEFAULT now()
├── accepted_at     TIMESTAMPTZ NULLABLE  — null si la invitación no fue aceptada aún
└── created_at      TIMESTAMPTZ DEFAULT now()

UNIQUE (producer_id, user_id)
```

**MVP:** el proceso de invitación no existe todavía. Los miembros se insertan
manualmente en el onboarding. La columna `role` existe pero en el MVP no se
evalúa en lógica de negocio — solo se verifica la membresía activa.

**RLS:** un usuario puede ver sus propias membresías.
```
POLICY: user_id = auth.uid()
```

---

## Función de acceso: `get_my_producer_ids()`

Esta función es la **única fuente de verdad** para las políticas RLS.
Todas las tablas de negocio la usan. No se repite la lógica de membresía en
ningún otro lugar.

```
FUNCIÓN: get_my_producer_ids()
RETORNA: SETOF UUID
LENGUAJE: SQL

INTENCIÓN:
  Devuelve todos los producer_id a los que pertenece el usuario de la sesión
  actual (auth.uid()), filtrando solo membresías activas.

IMPLEMENTACIÓN (conceptual — el SQL exacto va en la migración):
  SELECT producer_id
  FROM producer_members
  WHERE user_id = auth.uid()
    AND is_active = true
```

**Requisitos de seguridad para la implementación real:**

1. **`SECURITY DEFINER`** — necesario para que la función pueda leer
   `producer_members` aunque el usuario no tenga acceso directo a esa tabla.

2. **`SET search_path = public, pg_temp`** (o el schema que corresponda) —
   obligatorio en funciones `SECURITY DEFINER` para evitar que un atacante
   manipule `search_path` e inyecte objetos maliciosos que la función ejecute
   con privilegios elevados.

3. **Referencias schema-qualified** — dentro de la función, referenciar tablas
   como `public.producer_members`, no solo `producer_members`.

4. **`STABLE`** — marcar la función como estable porque no modifica datos y su
   resultado es constante dentro de una transacción.

**Patrón de uso en políticas RLS:**
```
-- Patrón estándar aplicado en todas las tablas de negocio:
USING (producer_id IN (SELECT get_my_producer_ids()))
```

---

## Capa de datos de negocio (7 tablas)

Todas llevan `producer_id` explícito — no derivado via JOIN.
Esto es una denormalización deliberada por dos razones:
1. **Rendimiento RLS:** la política no necesita JOIN, solo `producer_id IN (...)`.
2. **Trazabilidad:** cualquier fila identifica su tenant sin navegar relaciones.

---

### `prospects` `[PII]`

Persona o empresa que recibió una cotización. Un mismo prospecto puede tener
múltiples cotizaciones con el mismo producer a lo largo del tiempo.

```
prospects
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id
├── full_name           TEXT [PII]  — nombre completo o razón social
├── phone               TEXT [PII]  — número en E.164 (+59899XXXXXX)
├── email               TEXT [PII] NULLABLE
├── consent_status      TEXT DEFAULT 'unknown'
│                       Valores: 'unknown' | 'granted' | 'revoked'
├── opt_out             BOOLEAN DEFAULT false
├── opt_out_at          TIMESTAMPTZ NULLABLE
├── internal_notes      TEXT NULLABLE  — notas del producer, nunca exponer al prospecto
├── archived_at         TIMESTAMPTZ NULLABLE  — soft delete, preserva historial de opt-out
├── created_at          TIMESTAMPTZ DEFAULT now()
└── updated_at          TIMESTAMPTZ DEFAULT now()

UNIQUE (producer_id, phone)
```

**Regla de opt-out:** si `opt_out = true`, el sistema nunca envía mensajes a
este número desde este producer. Se refuerza con un trigger en `whatsapp_messages`
(ver DECISION-003 §7 — doble barrera).

**Soft delete obligatorio:** los prospects no se borran con `DELETE`. Se archivan
con `archived_at`. Preservar el registro de opt-out es un requisito legal.

**RLS:**
```
POLICY SELECT/INSERT/UPDATE: producer_id IN (SELECT get_my_producer_ids())
POLICY DELETE: no existe — solo soft delete vía archived_at
```

---

### `quotes`

El objeto central del sistema. Cada cotización de seguro que el producer generó
y que está en seguimiento o fue cerrada.

```
quotes
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id
├── prospect_id         UUID, FK → prospects.id
├── insurance_type      TEXT
│                       Valores: 'auto' | 'home' | 'life' | 'commercial' | 'other'
├── risk_description    TEXT NULLABLE  — "Toyota Hilux 2021", "Apto. Pocitos 3 amb."
├── insurer_name        TEXT NULLABLE  — con quién se cotizó
├── quoted_amount       NUMERIC(12,2) NULLABLE
├── currency            CHAR(3) DEFAULT 'UYU'  — ISO 4217: UYU, USD
├── quote_date          DATE       — fecha en que el producer emitió la cotización
├── expiry_date         DATE NULLABLE  — hasta cuándo es válida
├── follow_up_start_at  TIMESTAMPTZ NULLABLE
│                       calculado = quote_date + producers.follow_up_hours
│                       Si es null, el sistema calcula al activar el seguimiento
├── status              TEXT DEFAULT 'pending_follow_up'  — ver tabla de estados abajo
├── origin_channel      TEXT NULLABLE  — cómo llegó el lead (referido, web, llamada...)
├── internal_notes      TEXT NULLABLE
├── approved_message    TEXT NULLABLE
│                       Texto final del mensaje después de aprobación del producer.
│                       Solo relevante en send_mode = 'manual'.
├── created_at          TIMESTAMPTZ DEFAULT now()
└── updated_at          TIMESTAMPTZ DEFAULT now()
```

**RLS:**
```
POLICY SELECT/INSERT/UPDATE: producer_id IN (SELECT get_my_producer_ids())
POLICY DELETE: no existe — estado 'cancelled' es el estado final de descarte
```

---

#### Estados de `quotes.status`

| Estado | Descripción | Quién lo asigna |
|---|---|---|
| `pending_follow_up` | Ingresada, dentro del período de espera | Sistema |
| `scheduled` | Umbral vencido, en cola para envío | Sistema |
| `pending_approval` | Mensaje generado, esperando aprobación (modo manual) | Sistema |
| `contacted` | Primer mensaje enviado | Sistema |
| `no_response_1` | 24h sin respuesta al primer mensaje | Sistema |
| `contacted_2` | Segundo mensaje enviado | Sistema |
| `responded` | El prospecto respondió algo | Sistema (vía webhook) |
| `interested` | El prospecto confirmó interés activo | Sistema o Producer |
| `human_handoff` | El sistema escaló al producer | Sistema |
| `closed_won` | Póliza emitida | Producer (manual) |
| `closed_lost` | El prospecto declinó explícitamente | Sistema o Producer |
| `no_response` | Sin respuesta tras todos los intentos | Sistema |
| `paused` | El producer pausó el seguimiento | Producer (manual) |
| `cancelled` | El producer decidió no continuar | Producer (manual) |
| `opt_out` | El prospecto pidió baja en esta cotización | Sistema (vía webhook) |
| `error` | Error técnico en el envío, requiere revisión | Sistema |

**Estados terminales** (no se puede salir de ellos sin acción explícita):
`closed_won`, `closed_lost`, `cancelled`, `opt_out`

---

### `whatsapp_messages` `[PII indirecto]`

Registro de cada mensaje enviado o recibido. Es el log conversacional de la
cotización. Nunca se borra.

```
whatsapp_messages
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id  — denormalizado para RLS
├── quote_id            UUID, FK → quotes.id
├── prospect_id         UUID, FK → prospects.id  — denormalizado para lookups rápidos
├── direction           TEXT
│                       Valores: 'outbound' (sistema→prospecto) | 'inbound' (prospecto→sistema)
├── body                TEXT [PII indirecto]  — contenido real del mensaje
├── template_name       TEXT NULLABLE  — nombre del template HSM (solo si outbound)
├── waba_message_id     TEXT NULLABLE  — ID externo asignado por el proveedor WhatsApp
├── delivery_status     TEXT NULLABLE
│                       Valores: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
│                       Solo aplica a outbound. Los inbound se consideran 'received'.
├── sent_at             TIMESTAMPTZ NULLABLE
├── delivered_at        TIMESTAMPTZ NULLABLE
├── read_at             TIMESTAMPTZ NULLABLE
├── failed_at           TIMESTAMPTZ NULLABLE
├── failure_reason      TEXT NULLABLE
├── metadata            JSONB NULLABLE  — payload bruto del webhook, para debugging
└── created_at          TIMESTAMPTZ DEFAULT now()
```

**Nota de privacidad crítica:** `body` contiene el mensaje real del prospecto.
Tratar como PII. No loguear en texto plano. No incluir en mensajes de error.

**Sin DELETE:** los mensajes son evidencia del flujo conversacional. Se archiva
la cotización, no los mensajes individuales.

**Trigger de opt-out:** antes de cada INSERT en esta tabla, un trigger verifica
que `prospect_id` no tenga `opt_out = true`. Si lo tiene, lanza una excepción.
Es la segunda barrera después de la validación en capa de aplicación.

**RLS:**
```
POLICY SELECT/INSERT: producer_id IN (SELECT get_my_producer_ids())
POLICY UPDATE: producer_id IN (SELECT get_my_producer_ids())
  — solo para actualizar delivery_status desde el webhook vía service role
POLICY DELETE: no existe
```

---

### `ai_classifications`

Resultado del análisis que el LLM hace sobre cada mensaje inbound del prospecto.
Una fila por mensaje clasificado. No se modifica una vez creada.

```
ai_classifications
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id  — denormalizado para RLS
├── quote_id            UUID, FK → quotes.id
├── message_id          UUID, FK → whatsapp_messages.id  — el mensaje analizado
├── classification      TEXT
│                       Valores: 'interested' | 'needs_more_info' | 'price_objection' |
│                                'coverage_objection' | 'wants_human_contact' |
│                                'not_interested' | 'opt_out_requested' |
│                                'unclear_response' | 'angry_or_sensitive'
├── confidence          NUMERIC(4,3)  — score 0.000 a 1.000
├── summary             TEXT  — resumen en lenguaje natural para mostrar al producer
├── suggested_action    TEXT  — acción sugerida al sistema: 'respond' | 'escalate' | 'close'
├── requires_human      BOOLEAN  — true si debe derivarse al producer
├── raw_llm_response    JSONB NULLABLE
│                       Respuesta completa del LLM para debugging. Nunca exponer en UI.
└── created_at          TIMESTAMPTZ DEFAULT now()
```

**Regla de negocio:** si `confidence < 0.80`, el sistema siempre escala al
producer independientemente del valor de `classification`.

**Sin UPDATE ni DELETE:** la clasificación es inmutable. Si hay un error,
se crea una nueva clasificación, no se modifica la existente.

**RLS:**
```
POLICY SELECT: producer_id IN (SELECT get_my_producer_ids())
POLICY INSERT: producer_id IN (SELECT get_my_producer_ids())
  — en la práctica lo inserta el webhook handler vía service role
POLICY UPDATE/DELETE: no existen
```

---

### `human_handoffs`

Registra cada derivación al producer humano. Cuando el sistema escala, crea
una fila aquí. El producer la resuelve desde el dashboard.

```
human_handoffs
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id  — denormalizado para RLS
├── quote_id            UUID, FK → quotes.id
├── prospect_id         UUID, FK → prospects.id  — denormalizado para lookups
├── reason              TEXT  — motivo de la derivación
│                       Valores: 'prospect_interested' | 'prospect_has_question' |
│                                'price_objection' | 'coverage_objection' |
│                                'human_requested' | 'low_confidence_classification' |
│                                'angry_or_sensitive' | 'unclear_response' |
│                                'is_bot_question'
├── summary             TEXT  — contexto para el producer: qué dijo el prospecto, qué hizo el sistema
├── status              TEXT DEFAULT 'pending'
│                       Valores: 'pending' | 'accepted' | 'resolved'
├── resolved_at         TIMESTAMPTZ NULLABLE
├── resolution_notes    TEXT NULLABLE  — nota del producer al cerrar la derivación
└── created_at          TIMESTAMPTZ DEFAULT now()
```

**RLS:**
```
POLICY SELECT/INSERT/UPDATE: producer_id IN (SELECT get_my_producer_ids())
POLICY DELETE: no existe
```

---

### `quote_events` — audit log, append-only

Historial completo e inmutable de todo lo que le sucedió a una cotización.
Cada cambio de estado, cada mensaje enviado, cada clasificación, cada acción
del producer queda registrada aquí. Es la fuente de verdad histórica.

**Nunca se modifica ni borra una fila de esta tabla.**

```
quote_events
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id  — denormalizado para RLS
├── quote_id            UUID, FK → quotes.id
├── event_type          TEXT  — ver lista de tipos abajo
├── previous_status     TEXT NULLABLE  — estado de la cotización antes del evento
├── new_status          TEXT NULLABLE  — estado de la cotización después del evento
├── actor               TEXT
│                       Valores: 'system' | 'producer' | 'webhook'
│                       'system'   = proceso automático interno
│                       'producer' = acción manual desde el dashboard
│                       'webhook'  = evento entrante desde WhatsApp
├── description         TEXT NULLABLE  — descripción legible del evento
└── created_at          TIMESTAMPTZ DEFAULT now()
```

**Tipos de evento:**

| event_type | Cuándo ocurre |
|---|---|
| `quote_created` | Se ingresó la cotización |
| `follow_up_scheduled` | El sistema activó el seguimiento automático |
| `message_generated` | El LLM generó el texto del mensaje |
| `producer_approved_message` | El producer aprobó el mensaje (modo manual) |
| `message_sent` | El mensaje salió por WhatsApp |
| `message_delivered` | WhatsApp confirmó entrega |
| `message_read` | WhatsApp confirmó lectura (si disponible) |
| `message_failed` | Error en el envío |
| `prospect_replied` | El prospecto respondió algo |
| `ai_classified_response` | El LLM clasificó la respuesta del prospecto |
| `human_handoff_created` | El sistema derivó al producer |
| `human_handoff_resolved` | El producer cerró la derivación |
| `status_changed` | Cualquier cambio de estado de la cotización |
| `quote_closed_won` | Póliza emitida |
| `quote_closed_lost` | Prospecto declinó |
| `opt_out_received` | El prospecto pidió baja |
| `follow_up_paused` | El producer pausó el seguimiento |
| `follow_up_cancelled` | El producer descartó la cotización |
| `opt_out_blocked_send` | Se intentó enviar a un prospecto con opt-out (bloqueado) |

**RLS:**
```
POLICY SELECT: producer_id IN (SELECT get_my_producer_ids())
POLICY INSERT: producer_id IN (SELECT get_my_producer_ids())
  — los eventos de sistema/webhook los inserta el service role
POLICY UPDATE: no existe
POLICY DELETE: no existe
```

---

### `approved_responses`

Banco de respuestas predefinidas que el producer configura para que la IA
pueda responder sin escalar. El sistema busca matching por keywords; si hay
coincidencia con suficiente confianza, responde con el texto exacto de esta tabla.

```
approved_responses
├── id                  UUID, PK
├── producer_id         UUID, FK → producers.id
├── example_question    TEXT      — ejemplo de pregunta del prospecto
├── keywords            TEXT[]    — palabras clave para matching
├── response_text       TEXT      — texto exacto que la IA enviará (no generado, fijo)
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMPTZ DEFAULT now()
└── updated_at          TIMESTAMPTZ DEFAULT now()
```

**RLS:**
```
POLICY SELECT/INSERT/UPDATE: producer_id IN (SELECT get_my_producer_ids())
POLICY DELETE: permitido (el producer puede eliminar sus propias respuestas)
```

---

## Relaciones entre entidades

```
auth.users (Supabase)
    │  1:1
    ▼
profiles
    │  N:M
    ▼
producer_members ──────► producers (el tenant — producer_id)
                               │
                 ┌─────────────┼──────────────────────┐
                 │             │                       │
                 ▼             ▼                       ▼
           prospects        approved_responses    (configuración)
                 │
           ┌─────┴──────────────────────────────────┐
           │                                        │
           ▼                                        │
         quotes ◄───────────────────────────────────┘
           │
    ┌──────┼───────────────────────────────┐
    │      │                               │
    ▼      ▼                               ▼
whatsapp_  quote_events              human_handoffs
messages   (append-only)
    │
    ▼
ai_classifications
```

**Cardinalidades clave:**
- Un producer tiene muchos prospects, quotes, y approved_responses.
- Un prospect puede tener muchas quotes (con el mismo producer).
- Una quote tiene muchos whatsapp_messages, quote_events y human_handoffs.
- Un whatsapp_message tiene a lo sumo una ai_classification (el mensaje inbound).

---

## Índices recomendados

```sql
-- Detección de cotizaciones elegibles para activar seguimiento (cron job)
CREATE INDEX idx_quotes_followup
  ON quotes (producer_id, status, follow_up_start_at)
  WHERE status IN ('pending_follow_up', 'scheduled');

-- Webhook WhatsApp: recibe un waba_message_id y necesita encontrar la fila rápido
CREATE INDEX idx_waba_messages_external_id
  ON whatsapp_messages (waba_message_id)
  WHERE waba_message_id IS NOT NULL;

-- Webhook WhatsApp: recibe un número de teléfono y necesita encontrar el prospecto
CREATE INDEX idx_prospects_phone
  ON prospects (producer_id, phone)
  WHERE opt_out = false;

-- Dashboard: derivaciones pendientes del producer
CREATE INDEX idx_human_handoffs_pending
  ON human_handoffs (producer_id, status, created_at)
  WHERE status = 'pending';

-- Audit trail: historial cronológico de una cotización
CREATE INDEX idx_quote_events_quote
  ON quote_events (quote_id, created_at);

-- Clasificaciones IA: buscar la última clasificación de un mensaje
CREATE INDEX idx_ai_classifications_message
  ON ai_classifications (message_id, created_at);
```

---

## Lo que el sistema NUNCA almacena

| Dato | Por qué no |
|---|---|
| API key de WhatsApp (real) | Solo se almacena `waba_config_ref` — una referencia al vault |
| Tokens de sesión de Supabase Auth | Los maneja Supabase internamente |
| Contraseñas en ninguna forma | Auth delegado a Supabase |
| Datos de la póliza emitida | No es dominio de SeguroFlow AI; vive en el sistema del producer |
| Grabaciones de audio o voz | El MVP no tiene canal de voz |
| Números de documento sin justificación | Solo si el producer ya lo tiene y es estrictamente necesario |
| Historial de otros producers | RLS lo impide; cada tenant solo ve sus datos |

---

## Consideraciones para versión on-premise / private cloud

El modelo es portátil a cualquier instancia PostgreSQL. Puntos a revisar:

- **Cifrado de columnas PII** (`full_name`, `phone`, `email` en prospects):
  usar `pgcrypto` para cifrado a nivel de columna, o cifrado a nivel de aplicación
  antes de insertar, dependiendo del modelo de amenazas del cliente.
- **Supabase self-hosted:** el proyecto usa Supabase OSS, que incluye Auth y
  el motor de RLS. El mismo esquema funciona sin cambios.
- **Secrets management:** en SaaS, `waba_config_ref` apunta a Supabase Vault o
  variables de entorno. En on-premise, puede apuntar a HashiCorp Vault, AWS SSM,
  o variables del servidor. La columna solo cambia su valor; el código de
  aplicación que la resuelve usa el proveedor configurado.
- **Retención de datos:** la política de cuánto tiempo viven `whatsapp_messages`
  y `quote_events` es una decisión pendiente. Definir antes de poner datos reales
  en producción (ver CURRENT_STATE.md — decisiones pendientes).

---

## Relación entre el flujo de seguimiento y el modelo de datos (DECISION-005)

> Esta sección muestra cómo el flujo de seguimiento de DECISION-005 se apoya
> en las tablas ya definidas. No requiere tablas nuevas ni cambios de schema.
> Es una guía conceptual para entender qué tabla sirve a qué propósito del flujo.

### Qué tabla cumple cada rol en el flujo

| Rol en el flujo | Tabla | Campo clave | Notas |
|---|---|---|---|
| Estado actual de la cotización | `quotes` | `status` | El estado recorre `pending_follow_up → scheduled → pending_approval → contacted → ...` |
| Texto del mensaje aprobado | `quotes` | `approved_message` | Se llena cuando el producer aprueba en el dashboard. Es el texto que se enviará. |
| Historia completa e inmutable | `quote_events` | `event_type` | Append-only. Cada transición de estado, cada aprobación, cada envío, queda aquí. |
| Log conversacional (mensajes) | `whatsapp_messages` | `direction`, `body` | Outbound: mensajes que el sistema envía. Inbound: respuestas del prospect. |
| Clasificación de respuesta del prospect | `ai_classifications` | `classification`, `confidence` | Una fila por mensaje inbound clasificado. Inmutable una vez creada. |
| Escalamiento al producer | `human_handoffs` | `reason`, `status` | Cuando el sistema no puede responder solo. El producer lo resuelve desde el dashboard. |
| Respuestas predefinidas (FAQ) | `approved_responses` | `keywords`, `response_text` | El producer configura respuestas fijas para preguntas comunes. No se genera con IA. |
| Bloqueo por opt-out (primera barrera) | `prospects` | `opt_out` | Si `true`, la capa de aplicación no permite preparar mensajes. |
| Bloqueo por opt-out (segunda barrera) | trigger en `whatsapp_messages` | — | Trigger `enforce_prospect_opt_out` rechaza INSERT si `prospect.opt_out = true`. |

### Qué campos de `quotes` son clave para el flujo

```
quotes
  ├── status              ← motor del flujo: todos los estados del seguimiento
  ├── approved_message    ← texto final aprobado por el producer antes del envío
  ├── follow_up_start_at  ← calculado como quote_date + producers.follow_up_hours
  └── internal_notes      ← notas del producer; nunca exponer al prospect
```

`quotes.approved_message` actúa como "cola de aprobación" de un solo mensaje:
el sistema lo pre-llena con el texto sugerido y el producer lo aprueba o edita.
No es una cola multi-mensaje — cada cotización tiene un texto aprobado a la vez.

### Por qué no se necesita una tabla nueva para el MVP

El flujo de seguimiento manual asistido de DECISION-005 es posible sin cambios
de schema porque:

1. `quote_events` ya tiene todos los `event_type` necesarios (ver sección anterior).
2. `quotes.approved_message` ya existe y sirve como punto de aprobación.
3. `whatsapp_messages` ya está preparado para outbound e inbound con timestamps.
4. `human_handoffs` ya cubre los escalamientos.
5. El trigger de opt-out ya existe en la migración 001.

**Cuando se necesitarán tablas nuevas:**
- Multi-mensaje aprobado: si en el futuro el producer quiere aprobar M1 y M2 a la
  vez, `approved_message` (una sola columna) no alcanza. Se necesitaría una tabla
  `quote_pending_messages` o similar. Esto se evalúa post-piloto.
- Templates personalizados por producer: si el producer quiere guardar sus propias
  variantes de los templates HSM, se necesitaría una tabla `message_templates`.

---

## Proximo paso

Este documento está completo y alineado con DECISION-002, DECISION-003 y DECISION-005.

**Migración 001 ya generada** en `supabase/migrations/001_base_multitenant_schema.sql`.

Contiene: 15 ENUMs, 10 tablas, `get_my_producer_ids()`, triggers de opt-out y
auto-profile, 25 políticas RLS, 10 tablas con RLS habilitado, 7 índices.

**Siguiente paso técnico: validar en entorno local.**

```bash
supabase start
supabase db push
```

Verificar antes de avanzar a código de aplicación:
- El trigger `enforce_prospect_opt_out` rechaza INSERTs outbound a prospectos con `opt_out=true`.
- La función `get_my_producer_ids()` devuelve solo los producers del usuario autenticado.
- El trigger `on_auth_user_created` crea un `profiles` al registrar un usuario.
- `quote_events` rechaza UPDATE y DELETE (audit log append-only).

**No aplicar en producción todavía.**
Si la validación local falla, corregir `001_base_multitenant_schema.sql` antes de
escribir cualquier código de aplicación. Ver checklist completo en `supabase/README.md`.
