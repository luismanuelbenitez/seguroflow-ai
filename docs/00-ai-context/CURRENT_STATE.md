# CURRENT_STATE.md — Estado del Proyecto

> Este archivo refleja el estado real del proyecto en la fecha indicada.
> Actualizar cada vez que haya un avance significativo.
> **Última actualización: 2026-06-28**

---

## Estado general

**Fase:** Definición funcional y arquitectura. Pre-código.
**Progreso:** La documentación del MVP-01 está completa. Nada está programado todavía.

---

## Qué documentos existen

### `/docs/00-ai-context/` — Contexto para IA
| Archivo | Contenido | Estado |
|---|---|---|
| `CODING_RULES.md` | Reglas de codificación obligatorias para humanos e IAs | Completo |
| `AI_BRIEF.md` | Resumen ejecutivo de una página para nuevas sesiones de IA | Completo |
| `CURRENT_STATE.md` | Este archivo — estado del proyecto | Completo |

### `/docs/01-vision/` — Visión del producto
| Archivo | Contenido | Estado |
|---|---|---|
| `VISION.md` | Nombre, visión, mercado, pilares, modelo de negocio | Completo |

### `/docs/02-mvp/` — Definición del MVP
| Archivo | Contenido | Estado |
|---|---|---|
| `MVP-01-recuperador-cotizaciones.md` | Spec funcional del primer módulo: flujo, alcance, estados, métricas | Completo |

### `/docs/02-product/` — Detalle del producto
| Archivo | Contenido | Estado |
|---|---|---|
| `RECUPERADOR_COTIZACIONES.md` | Flujo completo, límites de IA, estados, riesgos, decisiones pendientes | Completo |
| `USER_FLOWS.md` | 7 flujos de usuario detallados con diagramas ASCII | Completo |
| `MESSAGE_SEQUENCES.md` | Todos los mensajes WhatsApp, variantes, respuestas automáticas | Completo |

### `/docs/05-architecture/` — Arquitectura
| Archivo | Contenido | Estado |
|---|---|---|
| `DATA_MODEL.md` | Tablas, campos, enums, índices, relaciones, consideraciones PII | Completo |

### `/docs/07-go-to-market/` — Salida al mercado
| Archivo | Contenido | Estado |
|---|---|---|
| `PILOT_PLAN.md` | Plan de 30 días con productores piloto, métricas, contingencias, precio | Completo |
| `DISCOVERY_QUESTIONS.md` | 32 preguntas para entrevistar productores antes de programar | Completo |

### `/docs/04-decisiones/` — Decisiones técnicas
| Archivo | Contenido | Estado |
|---|---|---|
| `DECISION-LOG.md` | DECISION-001: inicio del proyecto con documentación antes de código | 1 entrada |

---

## Decisiones tomadas

| # | Decisión | Fecha |
|---|---|---|
| 001 | Arrancar con documentación completa antes de cualquier línea de código | 2026-06-28 |
| — | MVP es el Recuperador de Cotizaciones por WhatsApp, no una suite completa | 2026-06-28 |
| — | La IA asiste y escala; no emite, no promete cobertura, no interpreta pólizas | 2026-06-28 |
| — | Modelo de datos en PostgreSQL (Supabase como opción preferida pero no cerrada) | 2026-06-28 |
| — | Mercado inicial: Uruguay. Diseño pensado para escalar a la región | 2026-06-28 |
| — | Máximo 2 mensajes automáticos por cotización sin intervención humana | 2026-06-28 |
| — | Piloto con 1–3 productores en modo gratuito + feedback estructurado | 2026-06-28 |

---

## Decisiones pendientes (no tomar sin registrar en DECISION-LOG.md)

| Decisión | Opciones en juego | Bloqueante para |
|---|---|---|
| Stack tecnológico completo | Next.js + Supabase (probable) vs. alternativas | Inicio de programación |
| Proveedor de WhatsApp Business API | Twilio / 360dialog / Infobip / Meta directa | Envío de mensajes |
| LLM para generación y clasificación | Claude (preferencia) vs. alternativas | Generación de mensajes |
| Número WABA en piloto | ¿Número propio del productor o número central compartido? | Onboarding del piloto |
| Máximo de mensajes por cotización | El MVP dice 2; ¿es suficiente? | Validar en discovery |
| Modo de carga de cotizaciones | CSV / formulario web / ambos | UI del productor |
| Precio y modelo de cobro | SaaS fijo / por cotización / por éxito | Post-piloto |

---

## Qué NO se debe hacer todavía

- **No escribir código.** La decisión de stack no está cerrada.
- **No crear infraestructura** (base de datos, servidores, cuentas de servicios) antes de decidir el stack.
- **No contactar prospectos reales** con mensajes de prueba.
- **No comprometerse con productores** en fechas de entrega sin tener el stack definido.
- **No agregar módulos nuevos** (renovaciones, cross-sell, app móvil) hasta tener el MVP-01 funcionando y validado.
- **No tomar decisiones de stack** sin registrarlas en DECISION-LOG.md.

---

## Próximos pasos ordenados

```
1. Entrevistar 3–5 productores → DISCOVERY_QUESTIONS.md
2. Cerrar stack tecnológico → DECISION-LOG.md DECISION-002
3. Seleccionar proveedor WABA → DECISION-LOG.md DECISION-003
4. Crear cuenta sandbox de WhatsApp Business
5. Diseñar y registrar templates HSM con Meta (1–7 días hábiles de aprobación)
6. Iniciar programación siguiendo CODING_RULES.md
```

---

## Cosas a vigilar antes de programar

- La aprobación de templates HSM por Meta tarda hasta 7 días. Iniciar ese proceso
  en paralelo con el desarrollo de la base de datos.
- El productor piloto debe firmar o declarar que tiene relación previa con los
  prospectos (requisito legal Ley 18.331 Uruguay).
- Si se usa un número WABA central (no el del productor), hay implicaciones de
  confianza: el prospecto verá un número que no conoce.
