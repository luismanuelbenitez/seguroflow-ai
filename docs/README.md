# Documentación — SeguroFlow AI

> Índice navegable de toda la documentación del proyecto.
> Si sos una IA comenzando a trabajar aquí: empezá por `00-ai-context/AI_BRIEF.md`.

---

## `/00-ai-context/` — Contexto para instancias de IA

Leer siempre antes de trabajar en el proyecto.

| Archivo | Para qué sirve |
|---|---|
| [AI_BRIEF.md](00-ai-context/AI_BRIEF.md) | Resumen de 1 página: qué es, qué hace la IA, qué no hace, estado actual, próximo paso. |
| [CODING_RULES.md](00-ai-context/CODING_RULES.md) | Reglas de codificación obligatorias: comentarios, nombrado, errores, privacidad. |
| [CURRENT_STATE.md](00-ai-context/CURRENT_STATE.md) | Estado exacto del proyecto hoy: qué existe, qué está decidido, qué no, qué no hacer. |

---

## `/01-vision/` — Visión del producto

| Archivo | Para qué sirve |
|---|---|
| [VISION.md](01-vision/VISION.md) | Nombre comercial, visión, mercado inicial, pilares, modelo de negocio hipotético. |

---

## `/02-mvp/` — Definición del MVP

Un archivo por módulo. Cada uno es la spec funcional ejecutiva del módulo.

| Archivo | Para qué sirve |
|---|---|
| [MVP-01-recuperador-cotizaciones.md](02-mvp/MVP-01-recuperador-cotizaciones.md) | Spec del primer módulo: flujo, actores, alcance, estados, métricas, links a detalle. |

---

## `/02-product/` — Detalle funcional del producto

Documentación profunda de cada módulo. Leer cuando se va a programar.

| Archivo | Para qué sirve |
|---|---|
| [RECUPERADOR_COTIZACIONES.md](02-product/RECUPERADOR_COTIZACIONES.md) | Flujo completo del lead, límites de la IA, tabla de estados, riesgos, preguntas abiertas. |
| [USER_FLOWS.md](02-product/USER_FLOWS.md) | Flujos paso a paso para el productor, el prospecto y el sistema. Con diagramas ASCII. |
| [MESSAGE_SEQUENCES.md](02-product/MESSAGE_SEQUENCES.md) | Todos los mensajes de WhatsApp: variantes, respuestas automáticas, notificaciones. |

---

## `/03-arquitectura/` — Arquitectura (vacío)

Reservado para diagramas de arquitectura, decisiones de infraestructura,
ADRs técnicos y runbooks. Se completa cuando el stack esté definido.

---

## `/04-decisiones/` — Decisiones técnicas y de producto

| Archivo | Para qué sirve |
|---|---|
| [DECISION-LOG.md](04-decisiones/DECISION-LOG.md) | Registro cronológico de todas las decisiones importantes con contexto y alternativas. |

---

## `/05-architecture/` — Modelo de datos y arquitectura

| Archivo | Para qué sirve |
|---|---|
| [DATA_MODEL.md](05-architecture/DATA_MODEL.md) | Tablas, campos, tipos, enums, índices, relaciones y consideraciones de privacidad. |

---

## `/07-go-to-market/` — Salida al mercado y piloto

| Archivo | Para qué sirve |
|---|---|
| [PILOT_PLAN.md](07-go-to-market/PILOT_PLAN.md) | Plan de 30 días de piloto: perfil del productor ideal, métricas, onboarding, precio. |
| [DISCOVERY_QUESTIONS.md](07-go-to-market/DISCOVERY_QUESTIONS.md) | 32 preguntas para entrevistar productores y corredores antes de programar. |

---

## Orden de lectura recomendado

### Para entender el producto:
1. `00-ai-context/AI_BRIEF.md`
2. `01-vision/VISION.md`
3. `02-mvp/MVP-01-recuperador-cotizaciones.md`

### Para programar:
1. `00-ai-context/AI_BRIEF.md`
2. `00-ai-context/CODING_RULES.md`
3. `00-ai-context/CURRENT_STATE.md`
4. `02-product/RECUPERADOR_COTIZACIONES.md`
5. `02-product/USER_FLOWS.md`
6. `02-product/MESSAGE_SEQUENCES.md`
7. `05-architecture/DATA_MODEL.md`
8. `04-decisiones/DECISION-LOG.md`

### Para salir a validar con productores:
1. `07-go-to-market/DISCOVERY_QUESTIONS.md`
2. `07-go-to-market/PILOT_PLAN.md`
