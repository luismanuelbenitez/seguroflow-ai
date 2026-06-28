# AI_BRIEF.md — Contexto rápido para instancias de IA

> Leer este archivo primero. Cubre todo lo esencial en una sola página.
> Fecha de última actualización: **2026-06-28**

---

## Qué es SeguroFlow AI

Plataforma de IA operativa y comercial para **productores de seguros, corredores
y aseguradoras**. Automatiza los flujos comerciales que hoy se pierden por falta
de capacidad operativa.

**Mercado inicial:** Uruguay.
**Expansión prevista:** Argentina, Paraguay y región hispanoamericana.

---

## El problema

Los productores de seguros generan cotizaciones que no se convierten en pólizas
porque no hacen seguimiento a tiempo. No es precio ni competencia: es ausencia
de contacto en la ventana crítica de 24–96 horas post-cotización.

---

## La promesa

SeguroFlow AI hace el seguimiento que el productor no tiene tiempo de hacer.
Automatiza el contacto por WhatsApp, clasifica las respuestas y escala al
productor solo cuando hay oportunidad real o situación que requiere criterio humano.

---

## Primer MVP — Recuperador de Cotizaciones

**Módulo:** MVP-01 — Recuperador Automático de Cotizaciones No Cerradas por WhatsApp.

Flujo en 3 pasos:
1. El productor carga sus cotizaciones sin respuesta.
2. El sistema detecta las elegibles, genera un mensaje personalizado y lo envía por WhatsApp.
3. Si el prospecto responde, el sistema clasifica y escala al productor con contexto.

---

## Qué hace la IA en este MVP

- Detectar cotizaciones vencidas sin respuesta según umbral configurable.
- Generar mensajes de seguimiento personalizados (nombre, tipo de seguro, monto).
- Enviarlos por WhatsApp Business API en nombre del productor.
- Clasificar respuestas del prospecto: interés, pregunta, declinación, escalar.
- Responder preguntas frecuentes aprobadas previamente por el productor.
- Notificar al productor con contexto completo cuando hay respuesta relevante.

---

## Qué la IA NO hace (límites duros, no configurables)

- Confirmar emisión de póliza.
- Prometer o detallar coberturas.
- Negociar precio o condiciones.
- Interpretar cláusulas legales de pólizas.
- Aceptar o rechazar un riesgo.
- Mentir sobre ser automatizada si el prospecto pregunta.
- Responder fuera del guión aprobado sin escalar.

Ante cualquier duda → el sistema escala al productor.

---

## Arquitectura esperada (hipótesis, no confirmada)

| Capa | Opción probable |
|---|---|
| Frontend / Dashboard | Next.js (App Router) |
| Base de datos | PostgreSQL via Supabase |
| WhatsApp Business API | Por confirmar: Twilio / 360dialog / Meta directa |
| LLM (generación y clasificación) | Claude (Anthropic) — preferencia declarada |
| Hosting | Supabase + Vercel (SaaS) / Docker (on-premise futuro) |
| Auth | Supabase Auth |

Stack definitivo no está cerrado — ver DECISION-LOG.md antes de asumir.

---

## Estado actual del proyecto (2026-06-28)

- Fase de documentación y diseño funcional.
- **Sin código. Sin infraestructura. Sin cuenta de WhatsApp Business activada.**
- Documentación funcional completa: flujos, estados, mensajes, datos, piloto.
- Decisión de stack técnico: pendiente.
- Entrevistas con productores piloto: pendiente.

---

## Próximo paso

Antes de escribir una sola línea de código:
1. Entrevistar 3–5 productores con DISCOVERY_QUESTIONS.md.
2. Tomar la decisión de stack y registrarla en DECISION-LOG.md.
3. Seleccionar proveedor de WhatsApp Business API y crear cuenta sandbox.

---

## Archivos clave para continuar trabajando

```
docs/00-ai-context/CODING_RULES.md        ← reglas de codificación obligatorias
docs/00-ai-context/CURRENT_STATE.md       ← estado exacto del proyecto hoy
docs/02-mvp/MVP-01-recuperador.md         ← spec del módulo a programar
docs/02-product/RECUPERADOR_COTIZACIONES.md ← flujo completo y riesgos
docs/02-product/USER_FLOWS.md             ← flujos de usuario detallados
docs/02-product/MESSAGE_SEQUENCES.md      ← textos y variantes de mensajes
docs/05-architecture/DATA_MODEL.md        ← tablas y relaciones
docs/07-go-to-market/PILOT_PLAN.md        ← plan del piloto
docs/04-decisiones/DECISION-LOG.md        ← decisiones técnicas tomadas
```
