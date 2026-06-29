# SeguroFlow AI

Plataforma de IA operativa y comercial para productores, corredores y aseguradoras.

## MVP inicial

Recuperador automático de cotizaciones no cerradas por WhatsApp.

## Visión

Ser una capa de IA operativa/comercial para el mercado asegurador uruguayo y regional.

## Estado

Auth basico implementado: magic link con Supabase Auth.
Login → /auth/callback → /dashboard protegido con getUser().
Proximo paso: dashboard funcional del producer (quotes, prospects).

---

## Estructura del proyecto

```
seguroflow-ai/
  app/                        # Next.js App Router (paginas y layouts)
  components/                 # Componentes React reutilizables (pendiente)
  lib/
    supabase/
      client.ts               # Cliente Supabase para el browser (publishable key)
      server.ts               # Cliente Supabase server-side con cookies SSR
    ai/
      adapters/               # Adapters para proveedores LLM (Claude, etc.)
    whatsapp/
      adapters/               # Adapters para proveedores WABA (Twilio, 360dialog)
  server/                     # Servicios server-side, webhooks, jobs
  types/                      # Tipos TypeScript compartidos
  docs/                       # Documentacion del proyecto
    00-ai-context/            # Reglas para IAs y estado del proyecto
    02-mvp/                   # Specs funcionales del MVP
    04-decisiones/            # Decisiones de arquitectura (DECISION-XXX)
    05-architecture/          # Modelo de datos
  supabase/
    migrations/               # Migraciones SQL de Supabase
      001_base_multitenant_schema.sql
    README.md                 # Instrucciones para aplicar migraciones
  public/                     # Assets estaticos
```

## Primeros pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Completar .env.local con los valores reales (nunca commitear .env.local)

# 3. Validar la migracion en entorno local (requiere Docker Desktop)
# Requiere Supabase CLI: npx supabase@2.108.0 [comando]
npx supabase@2.108.0 start
npx supabase@2.108.0 db reset   # Aplica migraciones localmente (NO a produccion)

# 4. Iniciar servidor de desarrollo
npm run dev
```

## Probar Auth localmente

Requiere Supabase local corriendo (`npx supabase@2.108.0 start`) y Docker Desktop activo.

```bash
# 1. Obtener las keys del Supabase local
npx supabase@2.108.0 status
# → copia "API URL" como NEXT_PUBLIC_SUPABASE_URL
# → copia "anon key" como NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# 2. Configurar .env.local (no commitear)
cp .env.example .env.local
# Completar:
#   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key de supabase status>
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 3. Iniciar la app
npm run dev

# 4. Ir a http://localhost:3000/login e ingresar un email

# 5. Ver el email con el magic link en Inbucket (email local de Supabase)
#    http://localhost:54324

# 6. Hacer click en el link del email → redirige a /dashboard
```

**Variables requeridas para Auth:**

| Variable | Descripcion | Local |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `http://localhost:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key (safe para cliente) | ver `supabase status` |
| `NEXT_PUBLIC_SITE_URL` | URL base de la app (para callback del magic link) | `http://localhost:3000` |

**Nota:** Auth usa el Supabase local (Docker) o el remoto segun `NEXT_PUBLIC_SUPABASE_URL`.
No aplica migraciones. No ejecuta `supabase db push`.

---

## Dashboard local

El dashboard en `/dashboard` requiere sesion activa (login previo).

- Verifica que el usuario tiene una membresia activa en `producer_members`.
- Si no hay datos de prueba locales, muestra un estado vacio informativo — es comportamiento esperado.
- No consulta ni crea datos reales.
- No requiere migracion remota (`supabase db push`).
- Los emails del magic link se capturan en Inbucket local: `http://localhost:54324`

**Flujo local completo:**
```
/login → (magic link en Inbucket) → /auth/callback → /dashboard
```

---

## Seed local de producer demo

El dashboard en `/dashboard` requiere que el usuario tenga una membresía activa en
`producer_members`. Tras un `supabase db reset`, la base de datos está vacía y el
dashboard muestra un estado vacío informativo.

Para ver el dashboard con datos de prueba, hay que crear un producer ficticio y
asociarlo al usuario autenticado local.

**Flujo completo:**

```bash
# 1. Iniciar Supabase local y la app
npx supabase@2.108.0 start
npm run dev

# 2. Loguearse con magic link
#    Ir a http://localhost:3000/login → ingresar email → ver link en Inbucket (http://localhost:54324)

# 3. Obtener el user_id del usuario autenticado
#    Ir a http://localhost:3000/dev/user → copiar el UUID que aparece como "user.id"

# 4. Copiar el archivo de ejemplo y reemplazar el placeholder
cp supabase/seed.local.example.sql /tmp/seed.local.sql
# Editar /tmp/seed.local.sql: reemplazar LOCAL_AUTH_USER_ID por el UUID del paso 3

# 5. Ejecutar el SQL como service role (usar Supabase Studio local)
#    Ir a http://localhost:54323 → SQL Editor → pegar el contenido del SQL → Run

# 6. Volver al dashboard y verificar
#    Ir a http://localhost:3000/dashboard → debe aparecer "Productor Demo Local"
```

**Métodos para ejecutar el SQL:**

| Método | Comando / URL |
|---|---|
| Supabase Studio (recomendado) | `http://localhost:54323` → SQL Editor |
| psql directo | `psql postgresql://postgres:postgres@localhost:54322/postgres` |
| CLI Supabase | `npx supabase@2.108.0 db query --local --file <archivo>` |

**Notas importantes:**

- El seed usa datos ficticios. No crear datos de productores reales.
- El seed NO ejecuta `supabase db push`. Solo afecta la base de datos local.
- El producer demo tiene UUID fijo `00000000-0000-0000-0000-000000001001` para facilitar identificación.
- Para limpiar: `npx supabase@2.108.0 db reset` (reinicia la DB local completa).

Ver guía completa: `docs/05-architecture/LOCAL_SEEDING.md`

---

## Cotizaciones demo locales

La pantalla `/dashboard/quotes` muestra las cotizaciones del producer autenticado.

**Requisitos previos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Seed local ejecutado (producer + membership — ver sección anterior)

**Flujo:**

```
/login → /dashboard → "Ver cotizaciones demo" → /dashboard/quotes
```

En `/dashboard/quotes` hay un botón **"Crear cotización demo local"** que:
1. Crea un prospect ficticio (`Prospecto Demo Local`, teléfono `+59800000000`)
2. Crea una cotización de tipo `auto` con monto `UYU 5.000`
3. Marca la cotización con `origin_channel = 'demo_local'` para identificación
4. Es **idempotente**: si ya existe la cotización, no crea un duplicado

**Lo que NO hace:**
- No envía mensajes por WhatsApp
- No integra IA
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa el service role key en el frontend

**Notas técnicas:**
- La tabla `quotes` usa RLS: el usuario solo ve las cotizaciones de su propio producer
- Los datos de prospect son ficticios — el número `+59800000000` no existe en Uruguay
- El botón está disponible en desarrollo local; en producción, las cotizaciones se cargarán vía formulario o CSV (decisión pendiente)

---

## Carga manual local de cotizaciones

La pantalla `/dashboard/quotes/new` permite ingresar cotizaciones reales (o ficticias en local)
directamente desde la interfaz web.

**Requisitos previos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Seed local ejecutado (producer + membership — ver sección anterior)

**Flujo:**

```
/login → /dashboard → /dashboard/quotes → "+ Nueva cotización manual" → /dashboard/quotes/new
```

**Campos del formulario:**

| Campo | Tabla | Obligatorio |
|---|---|---|
| Nombre completo | `prospects.full_name` | Sí |
| Teléfono WhatsApp | `prospects.phone` (E.164) | Sí |
| Email | `prospects.email` | No |
| Base de contacto | `prospects.consent_status` | No (default: `granted`) |
| Tipo de seguro | `quotes.insurance_type` (enum) | Sí |
| Fecha de cotización | `quotes.quote_date` | Sí (default: hoy) |
| Monto cotizado | `quotes.quoted_amount` | No |
| Moneda | `quotes.currency` | No (default: `UYU`) |
| Descripción / referencia | `quotes.risk_description` | No |
| Notas internas | `quotes.internal_notes` | No |

**Deduplicación de prospects:**
Si ya existe un prospect con el mismo teléfono en el mismo producer, el sistema lo reutiliza.
No crea duplicados. Útil al cargar varias cotizaciones del mismo cliente.

**Formato de teléfono:**
E.164: `+` seguido de código de país y número. Ej: `+59899123456` (Uruguay móvil).
El sistema normaliza espacios y guiones antes de validar.

**Lo que NO hace:**
- No envía mensajes por WhatsApp
- No integra IA
- No usa datos reales (en local usa datos de prueba)
- No aplica migraciones remotas (`supabase db push`)
- No usa el service role key en el frontend

**Nota técnica:** `quote_reference` no existe en el schema v2.0. Usar el campo
`risk_description` para guardar referencias tipo `COT-001 — Toyota Hilux 2022`.
Ver: `docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md`

---

## Cola local de aprobación

La pantalla `/dashboard/approvals` muestra las cotizaciones que están listas para
que el producer revise y apruebe el mensaje de seguimiento inicial (M1).

**Requisitos previos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Seed local ejecutado (producer + membership — ver sección anterior)
- Al menos una cotización creada con estado `pending_follow_up`, `scheduled` o `pending_approval`

**Flujo:**

```
/login → /dashboard → "Cola de aprobación" → /dashboard/approvals
```

O desde cotizaciones:

```
/dashboard/quotes → "Cola de aprobación" → /dashboard/approvals
```

**Qué hace la cola de aprobación:**

1. Lista cotizaciones en estado `pending_follow_up`, `scheduled` o `pending_approval`
2. Para cada cotización, muestra los datos del prospecto y la cotización
3. Genera un mensaje M1 sugerido con plantilla estática (sin IA)
4. El producer puede editar el texto antes de aprobar
5. Al aprobar:
   - Guarda el texto en `quotes.approved_message`
   - Cambia el estado a `pending_approval` (si venía de `pending_follow_up` o `scheduled`)
   - Registra el evento en `quote_events` con `event_type = 'message_approved'`

**Plantilla del mensaje M1:**

El texto sugerido se genera en `lib/messages/templates.ts` con las variables:
- Nombre del prospecto (primer nombre)
- Nombre del producer (`contact_name`)
- Tipo de seguro en español
- Descripción del riesgo (si existe)
- Monto y moneda (si existen)

**Lo que NO hace:**
- No envía mensajes por WhatsApp (sin integración WABA)
- No integra IA (plantilla estática)
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa el service role key en el frontend

**Nota sobre `approved_responses`:**
La tabla `approved_responses` está diseñada para el banco de FAQs del producer
(respuestas a preguntas frecuentes del prospecto), no para aprobaciones por cotización.
La columna correcta para el texto aprobado de M1 es `quotes.approved_message`.
Ver: `docs/05-architecture/DATA_MODEL.md` — sección "Relación flujo-modelo de datos".

---

## Scheduler local manual

La pantalla `/dashboard/scheduler` simula el cron/job de produccion que detecta cotizaciones pendientes de seguimiento y las mueve al estado `scheduled`. **No envía mensajes por WhatsApp. No usa IA. No usa datos reales.**

**Prerequisitos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Al menos una cotizacion con `status = 'pending_follow_up'` (creada desde `/quotes/new`)

**Flujo completo:**

```
/quotes/new      → crear cotizacion manual
  ↓ (status: pending_follow_up)
/scheduler       → ver candidata, clic "Ejecutar scheduler local"
  ↓ (status: scheduled)
/approvals       → aparece en la cola — aprobar mensaje M1
  ↓ (status: pending_approval)
/outbox          → simular envio
  ↓ (status: contacted)
/quotes/[id]     → simular respuesta, ver timeline completo
```

**Que hace "Ejecutar scheduler local":**
1. Busca quotes del producer en `status = 'pending_follow_up'`
2. Excluye prospects con `opt_out = true` (bloqueadas — se muestran separadas en la UI)
3. Batch UPDATE de `quotes.status`: `pending_follow_up` → `scheduled`
4. Batch INSERT de `quote_events`: `event_type='follow_up_scheduled'`, `actor='system'`, visible en el timeline

**GAP documentado:**
La columna `follow_up_start_at` (TIMESTAMPTZ nullable) existe en el schema pero no se setea en el MVP local. En produccion, el scheduler solo procesaria quotes cuyo `follow_up_start_at <= NOW()`. Por ahora, toda quote en `pending_follow_up` es elegible.

**Quotes bloqueadas por opt-out:**
Se muestran en una seccion separada con badge rojo. El scheduler NO las procesa. El producer debe cerrarlas manualmente (`closed_lost` o `cancelled`) desde el timeline.

**Lo que NO hace:**
- No envía mensajes por WhatsApp
- No integra IA
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa service role key

---

## Simulacion local de respuestas inbound

Desde el timeline de una cotizacion (`/dashboard/quotes/[quoteId]`), el producer puede simular que el prospecto respondio por WhatsApp. **No recibe ningun mensaje real. No usa IA. No usa datos reales.**

**Prerequisitos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Al menos una cotizacion con `status = 'contacted'` (haber pasado por el outbox primero)

**Flujo completo:**

```
/quotes/new      → crear cotizacion manual
  ↓
/approvals       → aprobar mensaje M1
  ↓ (status: pending_approval)
/outbox          → simular envio del mensaje
  ↓ (status: contacted)
/quotes/[id]     → aparece panel "Simular respuesta del prospecto"
  ↓ elegir escenario
/quotes/[id]     → ver evento en el timeline, status actualizado
```

**Cuatro escenarios:**

| Escenario | Mensaje ficticio | Status resultante |
|---|---|---|
| Interesado | "Hola, si, me interesa..." | `interested` |
| Duda | "Tengo una duda sobre la cobertura..." | `responded` |
| No interesado | "Gracias, por ahora no me interesa." | `closed_lost` |
| Opt-out | "Por favor no me escriban mas." | `opt_out` |

**Que hace cada simulacion:**
1. INSERT en `whatsapp_messages` con `direction='inbound'`, `delivery_status='delivered'`, `waba_message_id=null`, `metadata.simulated=true`
2. UPDATE `quotes.status` → status del escenario elegido
3. INSERT en `quote_events` con `response_received` o `opt_out_received` (visible en timeline)
4. Si escenario opt-out: UPDATE `prospects.opt_out=true`, `prospects.opt_out_at=now()`

**Efectos del opt-out:**
- `prospects.opt_out=true` bloquea futuros seguimientos en `/dashboard/approvals` y `/dashboard/outbox`
- El detalle de la quote muestra badge rojo "OPT-OUT activo — No contactar"
- Los Server Actions de approvals, outbox e inbound validan `opt_out` en el servidor (doble barrera)

**Lo que NO hace:**
- No recibe mensajes por WhatsApp (sin webhook WABA)
- No integra IA
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa service role key

---

## Outbox local simulado

La pantalla `/dashboard/outbox` permite simular el envio de mensajes aprobados.
**No envia ningun mensaje por WhatsApp real.**

**Requisitos previos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Seed local ejecutado (producer + membership — ver sección "Seed local")
- Al menos una cotizacion con mensaje aprobado en `/dashboard/approvals`

**Flujo completo:**

```
/dashboard/quotes/new → crear cotizacion manual
  ↓
/dashboard/approvals → aprobar mensaje M1 (plantilla editable)
  ↓ (status cambia a pending_approval)
/dashboard/outbox → ver mensaje pendiente de envio simulado
  ↓ clic "Simular envio"
/dashboard/quotes/[quoteId] → ver evento message_sent en el timeline
```

**Que hace "Simular envio":**

1. Inserta un registro en `whatsapp_messages` con `direction='outbound'`, `delivery_status='sent'`, `sent_at=now()`, `waba_message_id=null`
2. Actualiza `quotes.status` de `pending_approval` a `contacted`
3. Inserta evento en `quote_events` con `event_type='message_sent'`, `actor='producer'`

**Comportamiento con opt-out:**
Si el prospect tiene `opt_out = true`, el boton "Simular envio" se reemplaza por un aviso de bloqueo. El Server Action valida opt_out nuevamente (doble barrera).

**Por que `waba_message_id = null`:**
En produccion, Twilio/360dialog retornan un ID de mensaje real al enviar. Ese ID se guarda en `waba_message_id` para rastrear delivery. En la simulacion local no hay ID externo — la columna es nullable en el schema.

**Lo que NO hace:**
- No envia mensajes por WhatsApp (sin integracion WABA)
- No integra IA
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa service role key en el frontend

---

## Vista de detalle de cotizacion con timeline

La ruta `/dashboard/quotes/[quoteId]` muestra el detalle completo de una cotizacion
con el historial de eventos (`quote_events`) en orden cronologico.

**Acceso:**
- Desde `/dashboard/quotes` → columna "Detalle" → "Ver →" por cada fila
- Desde `/dashboard/approvals` → "Ver timeline →" en cada tarjeta

**Contenido de la vista:**

| Seccion | Descripcion |
|---|---|
| Encabezado | Nombre del prospect, tipo de seguro, badge de estado, link a cola de aprobacion si es elegible |
| Cotizacion | Tipo, fecha, monto, aseguradora, descripcion, fechas de vencimiento y seguimiento |
| Prospecto | Nombre, telefono, email, consentimiento, estado de opt-out |
| Mensaje aprobado | Texto de `quotes.approved_message` si existe (modo MVP local) |
| Notas internas | `quotes.internal_notes` si existen |
| Timeline | Historial cronologico de `quote_events` con tipo, actor, transicion de estado y descripcion |

**Seguridad:**
- Si la quote no existe o pertenece a otro producer → "Cotizacion no encontrada" (sin revelar si existe en otro producer — previene information disclosure)
- Doble barrera: `producer_id` en la query + RLS en Supabase

**Nota sobre `quote_events`:**
- La tabla es **append-only** — no hay UPDATE ni DELETE
- El schema v2.0 NO tiene columna `metadata` en `quote_events`
- Columnas reales del timeline: `event_type`, `actor`, `previous_status`, `new_status`, `description`, `created_at`
- Event types conocidos: `quote_created` (desde cotizacion manual), `message_approved` (desde cola de aprobacion)

**Evento de creacion en cotizaciones manuales:**
Desde el Paso 20, `createManualQuote()` registra un evento `quote_created` en `quote_events`
cuando se crea una cotizacion. Las cotizaciones creadas antes de este paso no tienen
evento de creacion — su timeline estara vacio hasta que ocurra el primer `message_approved`.

**Lo que NO hace:**
- No envía mensajes WhatsApp
- No integra IA
- No usa service role
- No aplica migraciones remotas

---

## Métricas locales

La pantalla `/dashboard/metrics` muestra al producer un resumen del estado del flujo simulado. **No usa WhatsApp real. No usa IA. No usa datos reales.**

**Prerequisitos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Al menos una cotización cargada (desde `/quotes/new`)

**Qué muestra:**

| Sección | Métricas |
|---|---|
| Volumen | Cotizaciones totales, pendientes, programadas, en aprobacion |
| Embudo | Contactadas, sin respuesta, respondieron, interesadas |
| Resultados | Cerradas ganadas/perdidas, opt-outs (quotes y prospectos) |
| Mensajes | Outbound simulados, inbound simulados, tasa de respuesta, tasa de interés |
| Distribución | Tabla de todas las quotes por status con barra proporcional |
| Actividad | Últimos 5 eventos del timeline global con link al detalle |

**Tasas calculadas:**
- **Tasa de respuesta:** `inbound / outbound * 100` — qué % de mensajes enviados recibieron respuesta simulada
- **Tasa de interés:** `interested / ever_contacted * 100` — qué % de prospectos contactados mostraron interés
  - `ever_contacted` = todas las quotes en estados que implican al menos 1 mensaje enviado (no solo el status actual)

**Lo que NO hace:**
- No usa WhatsApp real (todos los mensajes son simulados)
- No integra IA
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa service role key

**GAP documentado:**
En producción se filtrarían los mensajes por `metadata.simulated=true` para separar envíos reales de simulaciones históricas. En MVP local todos los mensajes en `whatsapp_messages` son simulados, así que se cuentan todos.

---

## Supabase — seguridad de entorno

Este repo apunta **exclusivamente** al proyecto Supabase `seguroflow-ai` (ref: `fawlbfkkxufyhnghynjk`).

- No ejecutar comandos remotos (`db push`, `migration up`, `functions deploy`) sin verificar el project-ref primero.
- **Nunca** conectar este repo al proyecto `TuHoroscopoCosmico.com` ni a ningun otro proyecto Supabase.
- `supabase db reset` es local (seguro). `supabase db push` es remoto (requiere confirmacion humana).

Ver reglas completas: `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`

---

## Documentacion

Ver `docs/README.md` para el indice completo de documentacion.

Empezar siempre por: `docs/00-ai-context/AI_BRIEF.md`
