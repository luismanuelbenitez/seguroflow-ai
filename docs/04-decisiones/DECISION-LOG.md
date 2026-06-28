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

*Próximas decisiones pendientes: proveedor WABA definitivo (DECISION-003), número WABA del piloto, retención de datos.*
