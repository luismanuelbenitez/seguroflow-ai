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

## Arquitectura — decidida por DECISION-002 y DECISION-003

| Capa | Tecnología elegida |
|---|---|
| Frontend / Backend | Next.js 15 (App Router) + TypeScript |
| Base de datos | Supabase (PostgreSQL) con RLS desde la primera migración |
| Auth | Supabase Auth (magic link para el piloto) |
| WhatsApp (desarrollo) | Twilio sandbox |
| WhatsApp (piloto real) | 360dialog o Meta Cloud API directa — a confirmar |
| LLM generación | Claude claude-sonnet-4-6 (Anthropic) via capa de abstracción |
| LLM clasificación | Claude claude-haiku-4-5 (Anthropic) via capa de abstracción |
| Hosting | Vercel (SaaS) + Dockerfile disponible para on-premise |
| Modelo multi-tenant | producers ≠ auth.uid(). Tablas: profiles, producers, producer_members |

Ver detalle completo en DECISION-002 y DECISION-003.

---

## Estado actual del proyecto (2026-06-28)

- **Fase:** Skeleton tecnico validado. Listo para implementar primer modulo.
- Skeleton Next.js 15 creado: `app/`, `lib/`, `server/`, `types/`, `components/`. `npm run build` exitoso (Next.js 15.5.19).
- Migracion 001 validada localmente con `npx supabase@2.108.0 db reset`. Sin errores. **NO aplicada remotamente.**
- `types/database.ts` generado desde DB local (10 tablas, 15 ENUMs, 3 funciones, 833 lineas).
- `supabase/config.toml` creado con `supabase init`. Proyecto local funcionando.
- Documentacion funcional completa: flujos, estados, mensajes, datos, piloto, decisiones.
- Stack tecnico decidido: DECISION-002 (Next.js + Supabase + Claude + Twilio + Vercel).
- Modelo multi-tenant y RLS decidido: DECISION-003 (producers, profiles, producer_members).
- DATA_MODEL.md v2.0 alineado: 10 tablas en ingles, producer_id en todas, RLS definido.
- Entrevistas con productores piloto: pendiente.
- Sin infraestructura productiva. Sin cuenta de WhatsApp Business activada.
- **Regla critica:** Leer `docs/00-ai-context/SUPABASE_SAFETY_RULES.md` antes de cualquier comando remoto de Supabase.

---

## Próximo paso

1. Implementar Auth basico local: login/logout con Supabase Auth magic link (no remoto aun).
2. Entrevistar 3–5 productores con DISCOVERY_QUESTIONS.md.
3. Crear cuentas cloud: Supabase proyecto, Anthropic API, Twilio sandbox.
4. Diseñar y enviar templates HSM a Meta (aprobación tarda 1–7 días hábiles).
5. Aplicar migracion remota: solo cuando el proyecto Supabase cloud este creado y verificado.
   Ver `supabase/README.md` y `docs/00-ai-context/SUPABASE_SAFETY_RULES.md` (project-ref: `fawlbfkkxufyhnghynjk`).

---

## Archivos clave para continuar trabajando

```
docs/00-ai-context/CODING_RULES.md             ← reglas de codificación obligatorias
docs/00-ai-context/CURRENT_STATE.md            ← estado exacto del proyecto hoy
docs/00-ai-context/SUPABASE_SAFETY_RULES.md    ← LEER antes de cualquier comando remoto Supabase
docs/02-mvp/MVP-01-recuperador-cotizaciones.md ← spec del módulo a programar
docs/02-product/RECUPERADOR_COTIZACIONES.md    ← flujo completo y riesgos
docs/02-product/USER_FLOWS.md                  ← flujos de usuario detallados
docs/02-product/MESSAGE_SEQUENCES.md           ← textos y variantes de mensajes
docs/05-architecture/DATA_MODEL.md             ← tablas y relaciones
docs/07-go-to-market/PILOT_PLAN.md             ← plan del piloto
docs/04-decisiones/DECISION-LOG.md             ← decisiones técnicas tomadas
supabase/README.md                             ← instrucciones de migración y safety remoto
```
