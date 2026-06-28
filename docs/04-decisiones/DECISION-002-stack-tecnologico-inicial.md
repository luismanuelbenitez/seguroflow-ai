# DECISION-002 — Stack Tecnológico Inicial

- **Fecha:** 2026-06-28
- **Estado:** Aceptada
- **Módulo:** MVP-01 — Recuperador de Cotizaciones por WhatsApp
- **Registrada por:** sesión de diseño técnico inicial

---

## Contexto

El MVP-01 necesita: un dashboard web para el productor, procesamiento de
cotizaciones, envío y recepción de mensajes por WhatsApp, clasificación de
respuestas con IA y notificaciones. El stack debe ser rápido de implementar
para el piloto pero no debe crear deuda técnica que impida escalar o vender
una versión enterprise/on-premise después.

**Restricciones reales:**
- Proyecto nuevo, sin código existente que condicione.
- 1 desarrollador o equipo pequeño en la etapa inicial.
- Datos PII de prospectos uruguayos (Ley 18.331).
- Futuro requerimiento de versión on-premise para clientes enterprise.
- Mercado inicial: Uruguay. Mensajes en español rioplatense.

---

## 1. Frontend y Backend

### Opciones consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Next.js + TypeScript** | Full-stack en un repo, App Router, Server Actions, API Routes para webhooks, deploy simple en Vercel, excelente para dashboards | Curva de App Router si no se conoce bien |
| Express + React separados | Más control, familiar | Dos repositorios, más configuración, más fricción para MVP |
| Remix | Similar a Next.js, buenas primitivas | Ecosistema más pequeño, menos adopción |

### Decisión

**Next.js 14+ con TypeScript y App Router.**

Justificación:
- Un solo repositorio cubre frontend, backend y webhooks.
- Los webhooks de WhatsApp son simples `POST /api/webhooks/whatsapp` → Route Handler.
- Server Actions simplifican el dashboard del productor (formularios, actualizaciones de estado).
- TypeScript garantiza que el modelo de datos sea consistente entre capas.
- Vercel deployea Next.js sin configuración; Docker es posible en paralelo.

---

## 2. Base de datos

### Por qué NO Google Sheets para el piloto real

Google Sheets parece una solución rápida para el piloto, pero es inviable
en cuanto hay datos reales de contacto:

- **Sin control de acceso granular:** cualquiera con el link puede ver todos los datos.
- **Sin audit trail real:** no hay registro de quién cambió qué y cuándo.
- **Sin ACID:** dos procesos simultáneos pueden corromper datos.
- **Sin RLS:** no se puede aislar datos por productor si hay más de uno.
- **Ley 18.331 Uruguay:** los datos de contacto de prospectos son PII.
  Guardarlos en una planilla compartida sin controles es un riesgo legal real.
- **No escala:** cuando el piloto tenga 200 cotizaciones activas y webhooks
  llegando en tiempo real, Sheets no puede manejarlo.

Google Sheets puede usarse exclusivamente para demos internas sin datos reales
de personas identificables.

### Opciones consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Supabase (PostgreSQL)** | PostgreSQL completo, RLS nativo, Auth integrado, API REST y Realtime, self-hosteable, SDK TypeScript | Vendor lock-in en capa de servicios (mitigable con self-host) |
| PostgreSQL puro (Railway / Render) | Más control | Sin Auth ni RLS out-of-the-box, más configuración |
| PlanetScale (MySQL) | Buena DX | No es PostgreSQL, sin RLS, schema diferente al diseñado |
| MongoDB | Flexible para documentos | Modelo relacional definido no encaja bien, sin RLS nativo |

### Decisión

**Supabase con PostgreSQL.**

Justificación:
- El modelo de datos ya está diseñado en PostgreSQL (ver DATA_MODEL.md).
- RLS (Row Level Security) permite aislar datos por `producer_id` desde el día 1,
  lo que habilita multi-tenant sin reescribir la capa de datos después.
- Supabase es self-hosteable con Docker: el mismo código corre en cloud SaaS
  o en infraestructura del cliente enterprise sin cambios en la lógica.
- Auth, Realtime y Storage incluidos evitan integrar servicios adicionales en el MVP.

---

## 3. Autenticación

### Qué usar en el MVP

**Supabase Auth con magic link (email sin contraseña).**

Justificación:
- El piloto tiene 1–3 productores. No necesitan gestión de contraseñas.
- Magic link es más seguro que contraseña para usuarios no técnicos.
- Supabase Auth se integra con RLS: cada fila tiene `producer_id` y las
  políticas de base de datos lo hacen respetar automáticamente.
- Tiempo de implementación: horas, no días.

### Qué dejar para el futuro (multi-tenant)

No implementar en el MVP:
- Organizaciones / equipos con roles (admin, vendedor, visor).
- SSO / OAuth para corredoras con sistemas corporativos.
- Invitaciones a colaboradores.

**Cuidado de diseño que SÍ aplica desde el MVP:**
Toda tabla de datos de negocio debe tener `producer_id` (o equivalente) y una
política RLS que lo filtre. Esto es lo que hace que la transición a multi-tenant
no requiera reescribir la base de datos.

```sql
-- Ejemplo de política que debe existir desde el inicio:
CREATE POLICY "producer_isolation" ON quotes
  USING (producer_id = auth.uid());
```

---

## 4. WhatsApp Business API

### Conceptos clave

Para enviar mensajes iniciados por el sistema (fuera de la ventana de 24h de
una conversación activa), la API de WhatsApp exige plantillas HSM pre-aprobadas
por Meta. Esto aplica independientemente del proveedor que se use.

Existen dos caminos:
- **Meta Cloud API directa:** acceso sin intermediario.
- **BSP (Business Solution Provider):** proveedor certificado que abstrae la API de Meta.

### Opciones consideradas

| Proveedor | Tipo | Pros | Contras |
|---|---|---|---|
| **Meta Cloud API directa** | Directo | Sin costo por mensaje (solo Meta fees), control total, sin intermediario | Setup más complejo, soporte solo de Meta, sin sandbox fácil |
| **Twilio** | BSP | Sandbox excelente para desarrollo, buena DX, SDK TypeScript maduro | Costo por mensaje más alto que otros BSPs, soporte en inglés principalmente |
| **360dialog (Sinch)** | BSP | Enfocado 100% en WhatsApp, buena presencia en LATAM, API limpia, precio competitivo | Menos conocido, soporte variable |
| **Infobip** | BSP | Muy confiable, LatAm fuerte, soporte en español | Pricing enterprise, onboarding complejo para piloto pequeño |
| **WATI** | BSP | Fácil de usar, orientado a pymes | Menos control técnico, no ideal para integración programática profunda |

### Recomendación por etapa

**Etapa piloto (desarrollo y pruebas):**
Usar **Twilio** con su sandbox de WhatsApp.
- El sandbox permite enviar mensajes sin aprobación de número ni plantillas.
- Permite desarrollar y probar el flujo completo antes de pasar por el proceso
  de aprobación de Meta.
- SDK TypeScript de primera clase.

**Etapa piloto real (con prospectos reales):**
Evaluar **360dialog** o **Meta Cloud API directa**.
- 360dialog: más económico para volúmenes de piloto pequeño (< 1.000 mensajes/mes).
- Meta directa: si se quiere evitar un intermediario y el equipo tiene capacidad técnica.

**Riesgos a tener en cuenta:**

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Aprobación de número WABA | El número del productor debe verificarse con Meta. Puede tardar días. | Iniciar el proceso antes de terminar el código. |
| Aprobación de templates HSM | Meta revisa y aprueba cada plantilla de mensaje. Tarda 1–7 días. | Diseñar los templates desde el principio, enviarlos a aprobación en paralelo. |
| Cambios de política de Meta | Meta puede cambiar precios o reglas de mensajería. | Usar la capa de abstracción del punto 5 para aislar la lógica de negocio. |
| Número del productor vs número central | ¿El prospecto recibe un mensaje de un número desconocido? | Preferir que el productor use su propio número WABA; requiere verificación individual. |

### Decisión

**Twilio para el sandbox de desarrollo. 360dialog o Meta directa para el piloto real.**
La decisión final entre 360dialog y Meta directa se toma después de evaluar
el volumen real del piloto y la capacidad técnica disponible.

---

## 5. LLM — Inteligencia Artificial

### Uso en el MVP

El LLM tiene dos roles distintos con requisitos diferentes:

| Tarea | Requisito | Modelo sugerido |
|---|---|---|
| **Generar mensajes** de seguimiento personalizados | Calidad de texto en español, tono natural, seguir instrucciones | Claude claude-sonnet-4-6 (Anthropic) |
| **Clasificar respuestas** del prospecto (interés / declinación / escalar) | Velocidad, bajo costo, clasificación confiable | Claude claude-haiku-4-5 (Anthropic) |

### Por qué Claude (Anthropic) como opción preferida

- Calidad de texto en español rioplatense: superior a alternativas para
  comunicaciones de negocios con tono natural.
- Instrucciones de sistema detalladas: respeta los límites definidos (no promete
  cobertura, no negocia precio) de manera más confiable.
- Política de datos: Anthropic no usa las conversaciones de la API para entrenar
  modelos por defecto. Crítico dado que procesamos datos de prospectos.
- La API es compatible con el patrón de abstracción descrito abajo.

### Capa de abstracción — Requisito no negociable

**El código de negocio nunca debe llamar directamente a la API de Anthropic o OpenAI.**

Se debe implementar una interfaz (adapter pattern) que aísle la lógica de negocio
del proveedor de IA. Esto es obligatorio porque:

- En la versión enterprise/on-premise, el cliente puede requerir un LLM local
  (Ollama + Llama/Mistral) por razones de privacidad o regulación.
- Los precios y modelos disponibles cambian frecuentemente.
- Facilita pruebas unitarias (mockear el adaptador es trivial).

Estructura mínima de la capa de abstracción:

```
src/
  lib/
    ai/
      types.ts          ← interfaz LLMProvider, tipos de entrada/salida
      adapters/
        anthropic.ts    ← implementación con Claude
        openai.ts       ← implementación alternativa (o para fallback)
        mock.ts         ← para tests
      index.ts          ← exporta el proveedor activo según variable de entorno
```

La variable de entorno `AI_PROVIDER=anthropic` (o `openai`, `ollama`) controla
qué adaptador se usa. **Cero referencias a `@anthropic-ai/sdk` fuera de `adapters/anthropic.ts`.**

### Decisión

**Claude claude-sonnet-4-6 para generación de mensajes. Claude claude-haiku-4-5 para clasificación.**
Con capa de abstracción obligatoria desde el primer día de código.

---

## 6. Arquitectura general

### SaaS cloud primero, portable desde el inicio

```
┌─────────────────────────────────────────────┐
│  Vercel (o cualquier host que corra Docker)  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │         Next.js App                 │   │
│  │  - Dashboard web (productor)        │   │
│  │  - API Routes (webhooks WhatsApp)   │   │
│  │  - Server Actions (formularios)     │   │
│  └───────────────┬─────────────────────┘   │
└──────────────────┼──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ┌────▼────┐          ┌─────▼──────┐
   │Supabase │          │  LLM API   │
   │(Postgres│          │ (Anthropic)│
   │ + Auth) │          └────────────┘
   └─────────┘
        │
   ┌────▼────────┐
   │WhatsApp BSP │
   │(Twilio/360d)│
   └─────────────┘
```

### Docker-friendly desde el inicio

Aunque el deploy inicial sea en Vercel + Supabase cloud, el proyecto debe tener
un `Dockerfile` y `docker-compose.yml` funcionales desde las primeras semanas.

Razón: cuando aparezca el primer cliente enterprise que requiera on-premise,
no habrá tiempo de "dockerizar" un proyecto que no estaba pensado para eso.

Lo que debe ser self-hosteable:
- La aplicación Next.js (Dockerfile estándar).
- La base de datos (Supabase self-hosted o PostgreSQL directo).
- El worker de seguimiento (proceso que revisa cotizaciones vencidas).

Lo que **no** necesita ser self-hosteable en el MVP:
- El LLM (el adaptador permite cambiarlo por uno local después).
- La API de WhatsApp (no hay alternativa on-premise real para WhatsApp).

---

## 7. Seguridad y privacidad

### Principios aplicados desde el día 1

**Secretos:**
- Ninguna clave o token en el repositorio. Nunca. Ni en comentarios.
- `.env.example` con todas las variables documentadas pero sin valores.
- `.gitignore` incluye `.env`, `.env.local`, `.env.production` desde el inicio.
- En producción: variables de entorno en la plataforma de deploy (Vercel, Railway, etc.).

**Logs:**
- Nunca loguear números de teléfono completos, nombres, emails ni contenido de mensajes.
- Usar máscaras en logs: `+598 9XX XXX X89`.
- Los logs de webhook de WhatsApp deben sanitizarse antes de escribir.
- Nivel de log configurable por variable de entorno (`LOG_LEVEL=info|debug|error`).

**Base de datos:**
- RLS activo desde la primera migración.
- Columnas PII (`nombre`, `telefono`, `email`) a considerar para cifrado en reposo
  con `pgcrypto` en versión enterprise. En el MVP de piloto, la seguridad de
  Supabase cloud cubre el at-rest encryption.
- Tabla `quote_events` como audit log inmutable (nunca se borra, solo se agrega).

**Datos mínimos:**
- No pedir ni guardar lo que no se usa. `document_number` del prospecto: no pedir
  a menos que el productor lo tenga y sea estrictamente necesario.
- Respetar opt-out inmediatamente: si `opt_out = true`, ningún proceso envía mensajes.

**No usar datos para entrenamiento:**
- La API de Anthropic no usa datos de API para entrenamiento por defecto.
- Verificar y documentar la política vigente del proveedor LLM elegido antes de
  procesar datos reales de prospectos.
- Incluir esta garantía en los términos del productor piloto.

**Webhooks:**
- Verificar la firma HMAC en cada webhook entrante de WhatsApp.
  (Meta envía `X-Hub-Signature-256`; rechazar cualquier request sin firma válida.)
- El endpoint de webhook no requiere autenticación de usuario pero sí verificación
  de firma. Esta validación va antes de cualquier lógica de negocio.

---

## 8. Decisión final — Stack recomendado

| Capa | Tecnología elegida | Alternativa si falla |
|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** | Remix |
| Base de datos | **Supabase (PostgreSQL)** | PostgreSQL en Railway |
| Auth | **Supabase Auth (magic link)** | — |
| WhatsApp (dev) | **Twilio sandbox** | — |
| WhatsApp (piloto real) | **360dialog o Meta Cloud API directa** | Twilio producción |
| LLM generación | **Claude claude-sonnet-4-6 (Anthropic)** | GPT-4o |
| LLM clasificación | **Claude claude-haiku-4-5 (Anthropic)** | GPT-4o-mini |
| Hosting | **Vercel** (SaaS) + Docker disponible | Railway, Render |
| CI/CD | **GitHub Actions** | — |

---

## Qué desbloquea esta decisión

- Se puede iniciar la configuración del repositorio y el entorno de desarrollo.
- Se puede crear la cuenta de Supabase y diseñar las primeras migraciones.
- Se puede crear la cuenta de Twilio y configurar el sandbox de WhatsApp.
- Se puede crear la cuenta de Anthropic y obtener las API keys para desarrollo.
- Se puede escribir el `Dockerfile` base y el `docker-compose.yml` para local.
- Se puede comenzar a programar siguiendo `CODING_RULES.md`.

---

## Qué queda pendiente (no bloquea el inicio, pero hay que resolver)

- [ ] **Número WABA del productor piloto:** ¿usa su número actual o abre uno nuevo?
      Iniciar el proceso de verificación con Meta lo antes posible (puede tardar semanas).
- [ ] **Templates HSM:** diseñar y enviar a aprobación de Meta en paralelo al desarrollo.
      Sin templates aprobados no se puede contactar prospectos reales.
- [ ] **Proveedor final para piloto real:** 360dialog vs. Meta directa.
      Decidir una vez que el sandbox esté funcionando y se vea la complejidad real.
- [ ] **Política de retención de datos:** ¿cuánto tiempo se guardan mensajes y eventos?
      Definir antes de poner datos reales en producción.
- [ ] **Dominio y URL de producción:** necesario para configurar el webhook de WhatsApp.
