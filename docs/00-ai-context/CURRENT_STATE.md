# CURRENT_STATE.md — Estado del Proyecto

> Este archivo refleja el estado real del proyecto en la fecha indicada.
> Actualizar cada vez que haya un avance significativo.
> **Última actualización: 2026-06-28**

---

## Estado general

**Fase:** Auth basico implementado. Listo para implementar dashboard del producer.
**Progreso:** Auth magic link completo (login → callback → dashboard protegido). npm run build exitoso. Migracion 001 validada localmente (NO aplicada remotamente). supabase db push sigue prohibido sin confirmacion humana.

---

## Qué documentos existen

### `/docs/00-ai-context/` — Contexto para IA
| Archivo | Contenido | Estado |
|---|---|---|
| `CODING_RULES.md` | Reglas de codificación obligatorias para humanos e IAs | Completo |
| `AI_BRIEF.md` | Resumen ejecutivo de una página para nuevas sesiones de IA | Completo |
| `CURRENT_STATE.md` | Este archivo — estado del proyecto | Completo |
| `SUPABASE_SAFETY_RULES.md` | Reglas criticas de seguridad: project-ref permitido, proyectos prohibidos, protocolo de verificacion | Completo |

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
| `DATA_MODEL.md` | 10 tablas en inglés, multi-tenant, RLS, enums en inglés, índices, trigger opt-out. Alineado con DECISION-003. | Completo v2.0 |

### `/docs/07-go-to-market/` — Salida al mercado
| Archivo | Contenido | Estado |
|---|---|---|
| `PILOT_PLAN.md` | Plan de 30 días con productores piloto, métricas, contingencias, precio | Completo |
| `DISCOVERY_QUESTIONS.md` | 32 preguntas para entrevistar productores antes de programar | Completo |

### `/docs/04-decisiones/` — Decisiones técnicas
| Archivo | Contenido | Estado |
|---|---|---|
| `DECISION-LOG.md` | Índice de decisiones — 3 entradas registradas | 3 entradas |
| `DECISION-002-stack-tecnologico-inicial.md` | Stack completo: Next.js, Supabase, Claude, Twilio, Vercel, Docker | Completo |
| `DECISION-003-multitenant-rls.md` | Modelo multi-tenant: profiles, producers, producer_members, RLS, opt-out, service role | Completo |

---

## Decisiones tomadas

| # | Decisión | Fecha |
|---|---|---|
| 001 | Arrancar con documentación completa antes de cualquier línea de código | 2026-06-28 |
| 002 | Stack: Next.js + TypeScript + Supabase + Claude + Twilio sandbox + Vercel + Docker | 2026-06-28 |
| 003 | Multi-tenant: producer_id ≠ auth.uid(). Tres tablas: profiles, producers, producer_members | 2026-06-28 |
| — | MVP es el Recuperador de Cotizaciones por WhatsApp, no una suite completa | 2026-06-28 |
| — | La IA asiste y escala; no emite, no promete cobertura, no interpreta pólizas | 2026-06-28 |
| — | Capa de abstracción LLM obligatoria: el código de negocio no llama a Anthropic directamente | 2026-06-28 |
| — | RLS via función get_my_producer_ids(). Todas las tablas de negocio llevan producer_id | 2026-06-28 |
| — | quote_events es append-only: sin UPDATE ni DELETE | 2026-06-28 |
| — | Opt-out reforzado con trigger en whatsapp_messages (doble barrera) | 2026-06-28 |
| — | Tablas en inglés snake_case. DATA_MODEL.md v2.0 actualizado y alineado con DECISION-003 | 2026-06-28 |
| — | Docker-friendly desde el inicio (aunque el deploy sea en Vercel) | 2026-06-28 |
| — | Mercado inicial: Uruguay. Diseño pensado para escalar a la región | 2026-06-28 |
| — | Máximo 2 mensajes automáticos por cotización sin intervención humana | 2026-06-28 |
| — | Piloto con 1–3 productores en modo gratuito + feedback estructurado | 2026-06-28 |

---

## Decisiones pendientes (no tomar sin registrar en DECISION-LOG.md)

| Decisión | Opciones en juego | Bloqueante para |
|---|---|---|
| Proveedor WABA definitivo para piloto real | 360dialog vs. Meta Cloud API directa | Mensajes a prospectos reales |
| Número WABA del piloto | ¿Número del productor o número central del sistema? | Onboarding del piloto |
| Retención de datos | ¿Cuánto tiempo se guardan mensajes y eventos? | Poner datos reales en producción |
| Máximo de mensajes por cotización | El MVP dice 2; ¿es suficiente? | Validar en discovery |
| Modo de carga de cotizaciones | CSV / formulario web / ambos | UI del productor |
| Precio y modelo de cobro | SaaS fijo / por cotización / por éxito | Post-piloto |

---

## Supabase Safety

> Ver reglas completas en `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`.

| Campo | Valor |
|---|---|
| Proyecto permitido | `seguroflow-ai` |
| Project ref permitido | `fawlbfkkxufyhnghynjk` |
| Proyecto PROHIBIDO | `TuHoroscopoCosmico.com` — nunca tocar desde este repo |
| Estado de migracion remota | **NO aplicada** — solo validada localmente con `db reset` |
| `supabase db push` | PROHIBIDO sin confirmacion humana explicita + verificacion de project-ref |
| Proximo paso Supabase | Dashboard local del producer + verificacion de producer_members. No remoto. La migracion remota espera hasta tener el proyecto cloud configurado. |

---

## Qué NO se debe hacer todavía

- **No ejecutar supabase db push** (migracion remota) hasta verificar project-ref = `fawlbfkkxufyhnghynjk`. Ver SUPABASE_SAFETY_RULES.md.
- **No tocar el proyecto TuHoroscopoCosmico.com** desde este repo bajo ninguna circunstancia.
- **No avanzar a consultas de negocio** sin verificar que el usuario pertenece a un producer (tabla producer_members).
- **No crear infraestructura productiva** hasta tener los templates HSM aprobados por Meta.
- **No contactar prospectos reales** con mensajes de prueba.
- **No comprometerse con productores** en fechas de entrega sin tener la primera migración de Supabase validada.
- **No agregar módulos nuevos** (renovaciones, cross-sell, app móvil) hasta tener el MVP-01 funcionando y validado.
- **No tomar nuevas decisiones de arquitectura** sin registrarlas en DECISION-LOG.md.

---

## Próximos pasos ordenados

```
✅ 1. Documentación funcional completa (DECISION-001)
✅ 2. Stack tecnológico definido (DECISION-002)
✅ 3. Modelo multi-tenant y RLS definido (DECISION-003)
✅ 4. DATA_MODEL.md actualizado: inglés, 10 tablas, producer_id, enums, índices
✅ 5. Primera migración de Supabase generada: supabase/migrations/001_base_multitenant_schema.sql
✅ 6. Skeleton Next.js 15 creado: app/, lib/, server/, types/, componentes base
✅ 7. npm install + npm run build exitosos (Next.js 15.5.19)
✅ 8. supabase db reset local exitoso: migracion 001 aplicada sin errores
✅ 9. types/database.ts generado desde DB local (10 tablas, ENUMs, funciones)
✅ 10. supabase/config.toml creado (supabase init)
✅ 11. Auth magic link implementado: /login → /auth/callback → /dashboard
        - lib/supabase/server.ts (createClient con cookies SSR)
        - app/actions/auth.ts (sendMagicLink, signOut — Server Actions)
        - app/login/page.tsx (formulario con useActionState React 19)
        - app/auth/callback/route.ts (intercambio code → sesion)
        - app/dashboard/page.tsx (ruta protegida con getUser())
   12. Entrevistar 3-5 productores → DISCOVERY_QUESTIONS.md
   13. Crear cuentas cloud: Supabase proyecto, Anthropic API, Twilio sandbox
   14. Disenar y enviar templates HSM a Meta (1-7 dias habiles de aprobacion)
   15. Implementar dashboard funcional del producer (quotes, prospects)
   16. Iniciar implementacion MVP-01 (deteccion de cotizaciones, envio de mensajes)
```

---

## Cosas a vigilar antes de programar

- La aprobación de templates HSM por Meta tarda hasta 7 días. Iniciar ese proceso
  en paralelo con el desarrollo de la base de datos.
- El productor piloto debe firmar o declarar que tiene relación previa con los
  prospectos (requisito legal Ley 18.331 Uruguay).
- Si se usa un número WABA central (no el del productor), hay implicaciones de
  confianza: el prospecto verá un número que no conoce.
