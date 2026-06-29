# CURRENT_STATE.md — Estado del Proyecto

> Este archivo refleja el estado real del proyecto en la fecha indicada.
> Actualizar cada vez que haya un avance significativo.
> **Última actualización: 2026-06-29**

---

## Estado general

**Fase:** Vista de detalle de cotizacion con timeline de quote_events implementada en /dashboard/quotes/[quoteId].
**Progreso:** Cola de aprobacion + detalle de cotizacion + timeline cronologico de eventos. createManualQuote() ahora registra evento quote_created en quote_events. Links "Ver →" en lista de quotes, "Ver timeline →" en approvals. No hay nuevas migraciones. npm run build exitoso. supabase db push sigue prohibido.

**Usuario demo local:** demo@seguroflow.local (user_id: 491e5a58-02f2-49f0-a7af-06cc169f8fc1 — valido solo en la DB local actual)

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
| `LOCAL_SEEDING.md` | Guía de seed local: por qué, cómo, flujo completo, métodos de ejecución, restricciones de RLS | Completo |

### `/docs/07-go-to-market/` — Salida al mercado
| Archivo | Contenido | Estado |
|---|---|---|
| `PILOT_PLAN.md` | Plan de 30 días con productores piloto, métricas, contingencias, precio | Completo |
| `DISCOVERY_QUESTIONS.md` | 32 preguntas para entrevistar productores antes de programar | Completo |

### `/docs/04-decisiones/` — Decisiones técnicas
| Archivo | Contenido | Estado |
|---|---|---|
| `DECISION-LOG.md` | Índice de decisiones — 5 entradas registradas | 5 entradas |
| `DECISION-002-stack-tecnologico-inicial.md` | Stack completo: Next.js, Supabase, Claude, Twilio, Vercel, Docker | Completo |
| `DECISION-003-multitenant-rls.md` | Modelo multi-tenant: profiles, producers, producer_members, RLS, opt-out, service role | Completo |
| `DECISION-004-ingesta-cotizaciones-mvp.md` | Formulario manual primero, CSV post-piloto | Completo |
| `DECISION-005-flujo-seguimiento-whatsapp-mvp.md` | Flujo manual asistido: 3 mensajes, aprobación del producer, sin WABA todavía | Completo |

---

## Decisiones tomadas

| # | Decisión | Fecha |
|---|---|---|
| 001 | Arrancar con documentación completa antes de cualquier línea de código | 2026-06-28 |
| 002 | Stack: Next.js + TypeScript + Supabase + Claude + Twilio sandbox + Vercel + Docker | 2026-06-28 |
| 003 | Multi-tenant: producer_id ≠ auth.uid(). Tres tablas: profiles, producers, producer_members | 2026-06-28 |
| 004 | Ingesta de cotizaciones MVP: formulario manual primero. CSV diferido a fase post-piloto | 2026-06-29 |
| 005 | Flujo de seguimiento WhatsApp: modo manual asistido. 3 mensajes max, aprobacion del producer | 2026-06-29 |
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
| Modo de carga de cotizaciones | CSV / formulario web / ambos — formulario ya implementado; CSV post-piloto | Validar con productores |
| Precio y modelo de cobro | SaaS fijo / por cotización / por éxito | Post-piloto |

---

## Supabase Safety

> Ver reglas completas en `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`.

| Campo | Valor |
|---|---|
| Proyecto permitido | `seguroflow-ai` |
| Project ref permitido | `fawlbfkkxufyhnghynjk` |
| Proyecto PROHIBIDO | `TuHoroscopoCosmico.com` — nunca tocar desde este repo |
| Estado de migracion remota | **NO aplicada** — migraciones 001 y 002 validadas solo localmente |
| `supabase db push` | PROHIBIDO sin confirmacion humana explicita + verificacion de project-ref |
| Proximo paso Supabase | Migraciones 001 y 002 listas para produccion cuando se configure el proyecto cloud. |

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
        - app/auth/callback/route.ts (intercambio code → sesion, open redirect protegido)
        - app/dashboard/page.tsx (ruta protegida con getUser())
✅ 12. Dashboard local del producer con verificacion de producer_members
        - lib/producers/get-current-producer-context.ts (helper server-side)
        - components/dashboard/dashboard-shell.tsx (layout con header + logout)
        - components/dashboard/producer-summary-card.tsx (producer info o estado vacio)
        - app/dashboard/page.tsx actualizado con contexto de producer
✅ 13. Seed local de producer demo ejecutado y validado
        - supabase/seed.local.example.sql (ejemplo con ON CONFLICT, requiere reemplazar LOCAL_AUTH_USER_ID)
        - app/dev/user/page.tsx (pagina dev-only para obtener el user.id del usuario autenticado)
        - docs/05-architecture/LOCAL_SEEDING.md (guia completa del flujo de seed)
        - README.md actualizado con seccion "Seed local de producer demo"
        - Seed ejecutado: producer '00000000-0000-0000-0000-000000001001' + membership para user 491e5a58...
        - RLS verificado via REST API: authenticated solo ve sus propios datos
        - El seed NO ejecuto supabase db push — solo afecta la DB local de Docker
✅ 14. Migracion 002_grants.sql creada (bug fix critico)
        - Migracion 001 no incluia GRANT statements
        - CLI supabase 2.x tiene auto_expose_new_tables=false por defecto
        - Sin GRANTs, el rol authenticated no podia hacer SELECT/INSERT/UPDATE/DELETE
        - Solucion: migracion 002 con GRANTs explicitos para authenticated y service_role
        - Aplicada localmente con supabase db reset (NO remotamente)
✅ 15. Pantalla de cotizaciones demo: /dashboard/quotes
        - lib/quotes/get-quotes-for-current-producer.ts (helper con query N+1 evitado)
        - app/actions/quotes.ts (Server Action createDemoQuote — idempotente)
        - components/dashboard/quotes-list.tsx (tabla con estado vacio, error, badges)
        - components/dashboard/create-demo-quote-button.tsx (Client Component con useTransition)
        - app/dashboard/quotes/page.tsx (ruta protegida, breadcrumb, link a /dashboard)
        - app/dashboard/page.tsx actualizado: link "Ver cotizaciones demo"
        - README.md: seccion "Cotizaciones demo locales"
        - Flujo: login → /dashboard → /dashboard/quotes → crear demo → ver en lista
        - No envia WhatsApp, no usa IA, no usa service role, no usa datos reales
✅ 16. DECISION-004: Estrategia de ingesta de cotizaciones definida
        - Formulario manual primero (1-2 dias de implementacion)
        - CSV diferido a fase post-piloto (modelo de campos no validado aun)
        - No requiere nuevas migraciones (todos los campos en schema v2.0)
        - Documenta campos minimos, reglas PII, nota legal sobre consentimiento
✅ 17. Formulario manual de cotizaciones: /dashboard/quotes/new
        - app/actions/quotes.ts: createManualQuote() con firma (prevState, FormData) para useActionState
        - Validacion server-side: full_name, phone E.164, insurance_type (enum), quote_date, quoted_amount
        - Normalizacion de telefono: strip espacios/guiones antes de validar
        - Deduplicacion de prospect por (producer_id, phone) — reutiliza si existe
        - redirect('/dashboard/quotes') en exito — el cliente nunca ve resultado exitoso
        - En error: retorna fieldErrors por campo para mostrar inline en el formulario
        - components/dashboard/quote-form.tsx: Client Component con useActionState
        - app/dashboard/quotes/new/page.tsx: Server Component con auth guard y breadcrumb
        - app/dashboard/quotes/page.tsx: link "+ Nueva cotizacion manual" en el encabezado
        - README.md: seccion "Carga manual local de cotizaciones"
        - DECISION-004 aplicada: risk_description para referencias (quote_reference no existe en schema)
✅ 18. Definir primer flujo de seguimiento: secuencia de mensajes WhatsApp para quotes pending_follow_up
        - DECISION-005 creada: flujo manual asistido, 3 mensajes max, aprobacion explicita del producer
        - Secuencia MVP: M1 (24-48h) + M2 (48-72h post M1) + M3 (siempre manual, 5-7 dias)
        - M3 nunca es automatico — preserva la regla "maximo 2 mensajes automaticos sin intervencion"
        - Sin cambios de schema: usa quotes.status, quotes.approved_message, quote_events, whatsapp_messages, human_handoffs
        - MESSAGE_SEQUENCES.md actualizado: variante D (M2 objeciones) + variante E (M3 cierre elegante)
        - USER_FLOWS.md actualizado: Flujo 8 "Recuperacion manual asistida de cotizacion" con diagrama completo
        - DATA_MODEL.md actualizado: nueva seccion conceptual flujo-modelo de datos
        - DECISION-LOG.md actualizado: entrada DECISION-005
✅ 19. Cola local de aprobacion de mensajes: /dashboard/approvals
        - lib/messages/templates.ts: buildInitialFollowUpMessage() — plantilla estatica M1, sin IA
        - lib/quotes/get-approval-queue.ts: query de quotes en pending_follow_up/scheduled/pending_approval
        - app/actions/approvals.ts: approveInitialFollowUpMessage() — valida sesion, opt_out, status elegible
          Actualiza quotes.approved_message + quotes.status → pending_approval
          Inserta quote_events (event_type='message_approved', actor='producer') para audit trail
          NO envia WhatsApp, NO llama IA, NO usa service role, NO usa datos reales
        - components/dashboard/approval-form.tsx: Client Component con useActionState, textarea editable
        - app/dashboard/approvals/page.tsx: Server Component con auth guard + lista de tarjetas
        - app/dashboard/page.tsx: link "Cola de aprobacion" visible si hasProducer
        - app/dashboard/quotes/page.tsx: link "Cola de aprobacion" en la barra de acciones
        - README.md: seccion "Cola local de aprobacion"
        - GAP documentado: approved_responses no tiene quote_id → se usa quotes.approved_message
        - Bug Supabase TS: .update({...} as any) no funciona → castear supabase.from('quotes') as any
        - npm run build: exitoso (11 rutas generadas)
✅ 20. Vista de detalle de cotizacion con timeline de eventos: /dashboard/quotes/[quoteId]
        - lib/quotes/get-quote-detail.ts: helper con 3 queries separadas (quote + prospect + events)
          Retorna discriminated union: notFound / success / error
          quote_events NO tiene columna metadata (documentado, columna no existe en schema v2.0)
          Doble barrera de propiedad: producer_id en query + RLS
        - app/dashboard/quotes/[quoteId]/page.tsx: ruta dinamica Next.js 15 (params es Promise)
          Timeline cronologico con dot de color por categoria, actor badge, transicion de estado
          Muestra approved_message e internal_notes (omitidos en la lista general)
          notFound → "no encontrada" sin revelar si existe en otro producer (info disclosure)
        - app/actions/quotes.ts: createManualQuote() ahora inserta evento quote_created en quote_events
          Degradacion elegante: si falla el INSERT de evento, la quote se creo igual (solo falla el audit log)
          actor='producer', previous_status=null, new_status='pending_follow_up'
        - components/dashboard/quotes-list.tsx: columna "Detalle" con link "Ver →" por fila
        - app/dashboard/approvals/page.tsx: link "Ver timeline →" en cada tarjeta de aprobacion
        - README.md: seccion "Vista de detalle de cotizacion con timeline"
        - CURRENT_STATE.md: este archivo
        - npm run build: pendiente de verificacion
   21. Entrevistar 3-5 productores → DISCOVERY_QUESTIONS.md
   22. Crear cuentas cloud: Supabase proyecto, Anthropic API, Twilio sandbox
   23. Disenar y enviar templates HSM a Meta (1-7 dias habiles de aprobacion)
   24. Iniciar implementacion MVP-01 (deteccion de cotizaciones, envio de mensajes)
```

---

## Cosas a vigilar antes de programar

- La aprobación de templates HSM por Meta tarda hasta 7 días. Iniciar ese proceso
  en paralelo con el desarrollo de la base de datos.
- El productor piloto debe firmar o declarar que tiene relación previa con los
  prospectos (requisito legal Ley 18.331 Uruguay).
- Si se usa un número WABA central (no el del productor), hay implicaciones de
  confianza: el prospecto verá un número que no conoce.
