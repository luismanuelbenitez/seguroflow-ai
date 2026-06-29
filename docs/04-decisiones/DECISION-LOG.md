# DECISION-LOG.md — Registro de Decisiones de SeguroFlow AI

> Este archivo registra decisiones técnicas y de producto significativas,
> junto con el contexto y las alternativas consideradas.
> Toda decisión importante tomada en el proyecto debe quedar aquí.

---

## Formato de entrada

```
## [DECISION-XXX] Título de la decisión

- **Fecha:** YYYY-MM-DD
- **Estado:** Propuesta | Aceptada | Rechazada | Reemplazada por DECISION-XXX
- **Tomada por:** [quién o qué sesión la definió]

### Contexto
¿Por qué hubo que tomar esta decisión?

### Opciones consideradas
1. Opción A — pros y contras.
2. Opción B — pros y contras.

### Decisión tomada
Opción X. Justificación.

### Consecuencias
¿Qué cambia, qué se habilita, qué se dificulta?
```

---

## [DECISION-001] Creación del proyecto SeguroFlow AI

- **Fecha:** 2026-06-28
- **Estado:** Aceptada

### Contexto
Se inicia un nuevo producto SaaS orientado al sector asegurador en Uruguay,
con foco en automatización de seguimiento comercial via WhatsApp e IA.

### Decisión tomada
Arrancar con documentación antes de cualquier línea de código. Establecer
reglas de codificación en `/docs/00-ai-context/CODING_RULES.md` como archivo
obligatorio para toda sesión de desarrollo.

### Consecuencias
Cualquier instancia de IA o desarrollador que trabaje en el proyecto tiene
un punto de referencia claro sobre cómo debe ser el código.

---

## [DECISION-002] Stack tecnológico inicial del MVP-01

- **Fecha:** 2026-06-28
- **Estado:** Aceptada
- **Documento completo:** [DECISION-002-stack-tecnologico-inicial.md](DECISION-002-stack-tecnologico-inicial.md)

### Decisión tomada

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14+ (App Router) + TypeScript |
| Base de datos | Supabase (PostgreSQL) con RLS desde la primera migración |
| Auth | Supabase Auth (magic link para el piloto) |
| WhatsApp (dev) | Twilio sandbox |
| WhatsApp (piloto real) | 360dialog o Meta Cloud API directa (a confirmar) |
| LLM generación | Claude claude-sonnet-4-6 (Anthropic) via capa de abstracción |
| LLM clasificación | Claude claude-haiku-4-5 (Anthropic) via capa de abstracción |
| Hosting | Vercel (SaaS) + Dockerfile disponible para on-premise |

### Consecuencias

- Se puede iniciar el repositorio y la configuración del entorno.
- Se puede crear la cuenta de Supabase y escribir las primeras migraciones.
- Se puede conectar Twilio sandbox para desarrollo de WhatsApp.
- **Pendiente antes del piloto real:** aprobación de número WABA y templates HSM con Meta.

---

## [DECISION-003] Modelo multi-tenant, usuarios y RLS

- **Fecha:** 2026-06-28
- **Estado:** Aceptada
- **Documento completo:** [DECISION-003-multitenant-rls.md](DECISION-003-multitenant-rls.md)

### Decisión tomada

`producer_id` **no es** `auth.uid()`. Son entidades separadas.

Tres tablas de identidad:
- `profiles` — extiende `auth.users`, datos personales del usuario (1:1).
- `producers` — la organización comercial / tenant, con su propio UUID.
- `producer_members` — tabla puente con `role`. En MVP: 1 usuario/productor con rol `owner`.

Función central de RLS: `get_my_producer_ids()` — devuelve los `producer_id`
del usuario actual. Todas las políticas de negocio la llaman.

Todas las tablas de negocio llevan `producer_id` explícito (denormalización
deliberada para rendimiento de RLS y trazabilidad de auditoría).

`quote_events` es append-only: sin política de UPDATE ni DELETE.

El opt-out del prospecto se refuerza con un trigger en `whatsapp_messages`.

Los procesos de sistema (webhook, cron) usan service role y deben registrar
`actor = 'system'` en `quote_events`.

Nomenclatura de tablas: **inglés** en `snake_case`.

### Consecuencias

- Se puede escribir la primera migración de Supabase.
- DATA_MODEL.md fue actualizado a v2.0 y quedó alineado con DECISION-003: inglés snake_case, producer_id como tenant, modelo profiles/producers/producer_members y RLS desde la primera migración.
- El proceso de alta de un productor nuevo queda pendiente de definir.

---

---

## [DECISION-004] Estrategia de ingesta de cotizaciones para el MVP

- **Fecha:** 2026-06-29
- **Estado:** Aceptada
- **Documento completo:** [DECISION-004-ingesta-cotizaciones-mvp.md](DECISION-004-ingesta-cotizaciones-mvp.md)

### Contexto

El MVP-01 requiere que el producer pueda ingresar cotizaciones (prospects + quotes)
al sistema. Dos opciones evaluadas: formulario manual web o carga de CSV.

### Opciones consideradas

1. **Formulario manual** — campo a campo, validación en tiempo real, 1-2 días de implementación.
2. **CSV upload** — carga masiva, mapeo de columnas, 5-10 días de implementación, riesgo PII.

### Decisión tomada

**Formulario manual primero.** CSV queda como fase post-piloto.

Razones: el formulario valida el modelo de campos con productores reales antes de
construir un importador. El piloto requiere 10-50 cotizaciones — volumen manejable a mano.
La superficie de exposición de PII es menor campo a campo que en un archivo CSV masivo.

### Consecuencias

- Se puede implementar `/dashboard/quotes/new` con Server Action `createQuote()`.
- El onboarding del producer piloto puede completarse en la sesión inicial.
- El CSV queda diferido hasta que el modelo de campos esté validado con productores reales.
- No se requieren nuevas migraciones: todos los campos necesarios existen en el schema v2.0.

---

*Próximas decisiones pendientes: proveedor WABA definitivo, retención de datos, gestión de secrets para multi-productor, campo quote_reference (agregar columna o usar campos existentes).*
