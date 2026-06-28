# DATA_MODEL.md
# Modelo de Datos — MVP Recuperador de Cotizaciones

> **Versión:** 1.0 — 2026-06-28
> **Estado:** Diseño conceptual. No hay código ni migraciones todavía.
> **Stack asumido:** Relacional (PostgreSQL via Supabase es la opción probable).
>   Si el stack cambia, revisar y actualizar este documento antes de programar.
>
> **Privacidad:** Las entidades marcadas con [PII] contienen datos personales
>   sujetos a la Ley 18.331 de Uruguay. Ver CODING_RULES.md §5.

---

## Entidades principales

### 1. `productores` [PII parcial]

Representa a un productor o corredor de seguros usando el sistema.
En el MVP: un productor = una cuenta = un número de WhatsApp Business.

```
productores
├── id                      UUID, PK
├── nombre_display          TEXT — cómo se presenta en los mensajes ("Gonzalo Seguros")
├── email                   TEXT [PII] — para notificaciones del sistema
├── telefono_personal       TEXT [PII] — para recibir alertas por WhatsApp
├── numero_waba             TEXT — número de WhatsApp Business (E.164, ej: +59899123456)
├── waba_api_key_ref        TEXT — referencia al secreto en vault (NO la key en sí)
├── umbral_espera_horas     INTEGER DEFAULT 48 — cuándo activar el seguimiento
├── modo_envio              ENUM('manual', 'automatico') DEFAULT 'manual'
├── firma_mensaje           TEXT — texto de cierre para los mensajes
├── activo                  BOOLEAN DEFAULT true
├── creado_en               TIMESTAMPTZ DEFAULT now()
└── actualizado_en          TIMESTAMPTZ DEFAULT now()
```

**Notas de diseño:**
- `waba_api_key_ref` almacena solo un identificador (ej.: nombre del secreto en
  AWS Secrets Manager o variable de entorno), nunca la clave real.
- En el MVP un productor gestiona su propia cuenta. Multi-tenant viene después.

---

### 2. `prospectos` [PII]

Persona o empresa que recibió una cotización. Puede tener múltiples cotizaciones
a lo largo del tiempo con el mismo productor.

```
prospectos
├── id                      UUID, PK
├── productor_id            UUID, FK → productores.id
├── nombre                  TEXT [PII] — nombre completo o razón social
├── telefono                TEXT [PII] — número en formato E.164
├── email                   TEXT [PII] NULLABLE
├── opt_out                 BOOLEAN DEFAULT false — si pidió no recibir más mensajes
├── opt_out_en              TIMESTAMPTZ NULLABLE
├── notas_internas          TEXT NULLABLE — notas del productor, nunca exponer al prospecto
├── creado_en               TIMESTAMPTZ DEFAULT now()
└── actualizado_en          TIMESTAMPTZ DEFAULT now()
```

**Restricción crítica:**
- Si `opt_out = true`, el sistema NUNCA envía mensajes a este número desde este productor.
- El par `(productor_id, telefono)` debe ser único: un mismo número no puede estar
  duplicado para el mismo productor.

```sql
UNIQUE (productor_id, telefono)
```

---

### 3. `cotizaciones`

El objeto central del sistema. Una cotización es una oferta de seguro que el
productor hizo al prospecto y que todavía no fue cerrada (ni ganada ni perdida).

```
cotizaciones
├── id                      UUID, PK
├── productor_id            UUID, FK → productores.id
├── prospecto_id            UUID, FK → prospectos.id
├── tipo_seguro             ENUM('auto','hogar','vida','comercio','otro')
├── descripcion_riesgo      TEXT NULLABLE — "Toyota Hilux 2021", "Apto. Pocitos"
├── aseguradora             TEXT NULLABLE — con quién se cotizó
├── monto_cotizado          NUMERIC(12,2) NULLABLE
├── moneda                  CHAR(3) DEFAULT 'UYU' — ISO 4217: UYU, USD
├── fecha_cotizacion        DATE — fecha en que se emitió la cotización
├── fecha_vencimiento       DATE NULLABLE — hasta cuándo es válida
├── estado                  ENUM(ver tabla de estados abajo) DEFAULT 'NUEVA'
├── canal_origen            TEXT NULLABLE — cómo llegó el lead
├── notas_internas          TEXT NULLABLE
├── mensaje_aprobado        TEXT NULLABLE — texto final del primer mensaje (guardado post-aprobación)
├── creado_en               TIMESTAMPTZ DEFAULT now()
└── actualizado_en          TIMESTAMPTZ DEFAULT now()
```

**Valores del ENUM `estado`:**

| Valor | Descripción |
|---|---|
| `NUEVA` | Ingresada, dentro del período de espera |
| `EN_SEGUIMIENTO` | Venció el umbral, flujo activo |
| `PENDIENTE_APROBACION` | Mensaje generado, esperando aprobación del productor (modo manual) |
| `CONTACTADA` | Primer mensaje enviado |
| `SIN_RESPUESTA_1` | 24h sin respuesta al primer mensaje |
| `CONTACTADA_2` | Segundo mensaje enviado |
| `RESPONDIO` | El prospecto envió algún mensaje |
| `REQUIERE_ATENCION_HUMANA` | El sistema escaló al productor |
| `INTERESADO` | El prospecto confirmó interés activo |
| `CERRADA_GANADA` | Se emitió la póliza |
| `CERRADA_PERDIDA` | El prospecto declinó |
| `AGOTADO` | Sin respuesta tras todos los intentos |
| `PAUSADA` | El productor pausó el flujo |
| `DESCARTADA` | El productor decidió no continuar |

---

### 4. `mensajes`

Registro de cada mensaje enviado o recibido, asociado a una cotización.
Es el log conversacional. Nunca se borra (solo soft-delete si aplica).

```
mensajes
├── id                      UUID, PK
├── cotizacion_id           UUID, FK → cotizaciones.id
├── direccion               ENUM('OUTBOUND', 'INBOUND')
│                           OUTBOUND = sistema → prospecto
│                           INBOUND  = prospecto → sistema
├── texto                   TEXT [PII indirecto] — contenido del mensaje
├── template_id             TEXT NULLABLE — ID del template HSM usado (si OUTBOUND)
├── estado_entrega          ENUM('ENVIADO','ENTREGADO','LEIDO','FALLIDO') NULLABLE
│                           Solo aplica a OUTBOUND; INBOUND siempre es 'RECIBIDO'
├── clasificacion_ia        ENUM(...) NULLABLE — cómo clasificó la IA el mensaje entrante
│                           Valores: 'POSITIVO','NEGATIVO','PREGUNTA_GUION',
│                                    'PREGUNTA_FUERA_GUION','OPT_OUT','INCIERTO'
├── confianza_clasificacion NUMERIC(4,3) NULLABLE — score 0.000 a 1.000
├── waba_message_id         TEXT NULLABLE — ID del mensaje en WhatsApp Business API
├── enviado_en              TIMESTAMPTZ DEFAULT now()
└── metadatos               JSONB NULLABLE — datos adicionales de la API (headers, etc.)
```

**Nota de privacidad:** `texto` contiene el mensaje real del prospecto. Tratar
como PII. No loguear en texto plano en logs de producción.

---

### 5. `eventos_cotizacion`

Audit log de cada cambio de estado de una cotización. Permite reconstruir
toda la historia operativa.

```
eventos_cotizacion
├── id                      UUID, PK
├── cotizacion_id           UUID, FK → cotizaciones.id
├── estado_anterior         TEXT — valor del estado antes del cambio
├── estado_nuevo            TEXT — valor del estado después del cambio
├── motivo                  TEXT NULLABLE — razón del cambio (automático o manual)
├── actor                   ENUM('SISTEMA','PRODUCTOR')
├── creado_en               TIMESTAMPTZ DEFAULT now()
```

---

### 6. `respuestas_aprobadas`

Banco de respuestas que el productor configuró para que la IA pueda responder
sin escalamiento. Cada una tiene una o más preguntas "trigger" y una respuesta
fija (no generada por IA).

```
respuestas_aprobadas
├── id                      UUID, PK
├── productor_id            UUID, FK → productores.id
├── pregunta_ejemplo        TEXT — ejemplo de la pregunta del prospecto
├── keywords                TEXT[] — palabras clave para matching
├── respuesta               TEXT — texto exacto que la IA enviará
├── activa                  BOOLEAN DEFAULT true
├── creado_en               TIMESTAMPTZ DEFAULT now()
```

---

## Relaciones entre entidades

```
productores (1)
    │
    ├──(N) prospectos
    │           │
    │           └──(N) cotizaciones (1)
    │                       │
    │                       ├──(N) mensajes
    │                       └──(N) eventos_cotizacion
    │
    └──(N) respuestas_aprobadas
```

---

## Índices recomendados (para MVP)

```sql
-- Búsqueda de cotizaciones elegibles para activar seguimiento
CREATE INDEX idx_cotizaciones_estado_fecha
  ON cotizaciones (estado, fecha_cotizacion)
  WHERE estado = 'NUEVA';

-- Webhook de WhatsApp: buscar cotización por mensaje recibido
CREATE INDEX idx_mensajes_waba_id ON mensajes (waba_message_id);

-- Opt-out check antes de enviar
CREATE INDEX idx_prospectos_telefono_optout
  ON prospectos (productor_id, telefono, opt_out);
```

---

## Datos que el sistema NUNCA almacena

- La clave privada o token de la WhatsApp Business API (solo referencias a vault).
- Tokens de sesión de usuario (manejar en capa de autenticación, no en tablas de negocio).
- Contraseñas en texto plano.
- Grabaciones de llamadas (el MVP no tiene canal de voz).
- Datos de la póliza emitida (eso vive en el sistema del productor o la aseguradora).

---

## Consideraciones para versión futura (on-premise / private cloud)

El modelo de datos está diseñado para ser exportable a PostgreSQL en cualquier
infraestructura. Puntos a tener en cuenta para on-premise:
- Cifrado en reposo de columnas PII (`nombre`, `telefono`, `email`) usando
  `pgcrypto` o cifrado a nivel de aplicación.
- Separación de la tabla `prospectos` en esquema aislado con RLS (Row Level Security)
  si múltiples productores comparten una instancia.
- Backup y retención de `mensajes` y `eventos_cotizacion` según política de la empresa.
