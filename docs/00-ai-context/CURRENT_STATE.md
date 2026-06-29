# CURRENT_STATE.md — Estado del Proyecto

> Este archivo refleja el estado real del proyecto en la fecha indicada.
> Actualizar cada vez que haya un avance significativo.
> **Última actualización: 2026-06-29**

---

## Estado general

**Fase:** MVP local fase 1 completo + paquete go-to-market completo + estrategia de auth actualizada + repo nuevo configurado + Vercel deploy plan creado.
**Progreso:** Flujo completo simulado + métricas + polish visual + plan WhatsApp M2 + checklist pre-piloto + guion de demo + runbook de discovery + plantilla de feedback + mensajes de outreach + auth email+password como principal. npm run build exitoso (14 rutas, Next.js 15.5.19). Bug `use server` corregido en sesión anterior. Repo migrado a github.com/luismanuelbenitez/seguroflow-ai. Vercel deploy plan creado. Listo para conectar Vercel cuando se autorice. Sin WhatsApp real. Sin IA. Sin migraciones. supabase db push sigue prohibido. TuHoroscopoCosmico.com sigue prohibido.

**Auth principal:** Email + password (DECISION-007). Magic link disponible como fallback técnico, no visible en la UI.
**Usuario demo local:** demo@seguroflow.local / Demo123456! (user_id: 491e5a58-02f2-49f0-a7af-06cc169f8fc1 — valido solo en la DB local actual)

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

### `/docs/06-integrations/` — Integraciones
| Archivo | Contenido | Estado |
|---|---|---|
| `WHATSAPP_REAL_PLAN.md` | Plan técnico de integración WhatsApp real (M2): proveedores, flujo, variables de entorno, seguridad | Completo |

### `/docs/07-go-to-market/` — Salida al mercado
| Archivo | Contenido | Estado |
|---|---|---|
| `PILOT_PLAN.md` | Plan de 30 días con productores piloto, métricas, contingencias, precio | Completo |
| `DISCOVERY_QUESTIONS.md` | 32 preguntas para entrevistar productores antes de programar | Completo |
| `PRE_PILOT_CHECKLIST.md` | Checklist pre-piloto: requisitos técnicos, datos, legales, guion de demo, criterios de avance | Completo |
| `DEMO_SCRIPT_5_MIN.md` | Guion comercial de demo de 5 minutos: pitch, pasos, discovery, objeciones, cierre, versión 60s | Completo |
| `DISCOVERY_RUNBOOK.md` | Runbook de discovery: estructura de 30 min, preguntas pre/post demo, señales positivas/negativas, criterios de decisión para avanzar a piloto | Completo |
| `PRODUCER_FEEDBACK_TEMPLATE.md` | Plantilla de registro por productor: perfil, dolor, reacción a demo, objeciones, scores 1-5, decisión recomendada | Completo |
| `OUTREACH_MESSAGES.md` | Mensajes de contacto: WhatsApp frío/referido/conocido, LinkedIn, email, manejo de respuestas comunes | Completo |

### `/docs/04-decisiones/` — Decisiones técnicas
| Archivo | Contenido | Estado |
|---|---|---|
| `DECISION-LOG.md` | Índice de decisiones — 7 entradas registradas | 7 entradas |
| `DECISION-002-stack-tecnologico-inicial.md` | Stack completo: Next.js, Supabase, Claude, Twilio, Vercel, Docker | Completo |
| `DECISION-003-multitenant-rls.md` | Modelo multi-tenant: profiles, producers, producer_members, RLS, opt-out, service role | Completo |
| `DECISION-004-ingesta-cotizaciones-mvp.md` | Formulario manual primero, CSV post-piloto | Completo |
| `DECISION-005-flujo-seguimiento-whatsapp-mvp.md` | Flujo manual asistido: 3 mensajes, aprobación del producer, sin WABA todavía | Completo |
| `DECISION-007-auth-strategy-pilot.md` | Email + password como auth principal. Magic link → fallback. MFA/Google/Gmail: futuro | Completo |

---

## Decisiones tomadas

| # | Decisión | Fecha |
|---|---|---|
| 001 | Arrancar con documentación completa antes de cualquier línea de código | 2026-06-28 |
| 002 | Stack: Next.js + TypeScript + Supabase + Claude + Twilio sandbox + Vercel + Docker | 2026-06-28 |
| 003 | Multi-tenant: producer_id ≠ auth.uid(). Tres tablas: profiles, producers, producer_members | 2026-06-28 |
| 004 | Ingesta de cotizaciones MVP: formulario manual primero. CSV diferido a fase post-piloto | 2026-06-29 |
| 005 | Flujo de seguimiento WhatsApp: modo manual asistido. 3 mensajes max, aprobacion del producer | 2026-06-29 |
| 006 | Preparacion M2 WhatsApp real: documentacion de proveedores, flujo tecnico y checklist pre-piloto | 2026-06-29 |
| 007 | Auth email + password como metodo principal. Magic link queda como fallback tecnico secundario | 2026-06-29 |
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
✅ 11. Auth implementado: /login → /dashboard (DECISION-007: email+password como principal)
        - lib/supabase/server.ts (createClient con cookies SSR + flowType: 'pkce')
        - app/actions/auth.ts (signInWithPassword como principal, sendMagicLink como fallback)
        - app/login/page.tsx (formulario email+password con credenciales demo visibles)
        - app/auth/callback/route.ts (intercambio code → sesion, open redirect protegido — para magic link fallback)
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
        - npm run build: exitoso (12 rutas generadas)
✅ 21. Outbox local simulado: /dashboard/outbox
        - lib/outbox/get-local-outbox.ts: 2 queries (quotes status=pending_approval + approved_message IS NOT NULL,
          luego prospects). Dos queries para evitar inferencia 'never' de Supabase TS.
          opt_out=true: incluido con flag, no excluido — producer ve quote "varada" y entiende el bloqueo.
        - app/actions/outbox.ts: simulateSendApprovedMessage() — Server Action 9 pasos de validacion
          Paso 7: INSERT whatsapp_messages outbound simulado — columnas compatibles (sin gap):
            body=approved_message, direction='outbound', delivery_status='sent', sent_at=now(),
            waba_message_id=null, template_name='seguimiento_inicial_v1', metadata={simulated:true}
          Paso 8: UPDATE quotes.status 'pending_approval' → 'contacted' (patron supabase.from as any)
          Paso 9: INSERT quote_events event_type='message_sent', actor='producer'
          redirect('/dashboard/outbox') en exito
          GAP documentado: waba_message_id=null (en produccion recibiria ID del proveedor WABA)
        - components/dashboard/simulate-send-button.tsx: Client Component con useActionState
          failedQuoteId para aislamiento de errores (N forms por pagina, identico a approval-form)
          opt_out: muestra aviso bloqueante, no boton
        - app/dashboard/outbox/page.tsx: Server Component, auth guard, aviso MVP siempre visible
          Item: nombre, telefono, tipo, status, approved_message en panel verde, SimulateSendButton
          Estado vacio: link a /approvals y /quotes/new
        - app/dashboard/page.tsx: seccion "Outbox local" con link naranja, item en lista ✅
        - app/dashboard/approvals/page.tsx: link "Outbox local →" en navegacion
        - README.md: seccion "Outbox local simulado" con flujo, que hace, waba_message_id null
        - npm run build: exitoso (12 rutas generadas, /dashboard/outbox incluido)
        - WhatsApp real: NO integrado
        - IA real: NO integrada
        - db push: NO ejecutado
        - TuHoroscopoCosmico.com: NO tocado
✅ 22. Simulacion local de respuestas inbound: panel en /dashboard/quotes/[quoteId]
        - lib/messages/inbound-scenarios.ts: 4 escenarios estaticos (sin IA)
          interested → quote.status='interested', event_type='response_received'
          has_question → quote.status='responded', event_type='response_received'
          not_interested → quote.status='closed_lost', event_type='response_received'
          opt_out → quote.status='opt_out', event_type='opt_out_received', prospects.opt_out=true
          Cada escenario define: key, label, sampleMessage, targetStatus, shouldSetOptOut, eventDescription, eventType
          INBOUND_ELIGIBLE_STATUSES: contacted | contacted_2 | no_response_1 | no_response
        - app/actions/inbound.ts: simulateInboundResponse() — Server Action 10 pasos
          Paso 7: INSERT whatsapp_messages direction='inbound', delivery_status='delivered',
            waba_message_id=null, template_name=null, metadata={simulated:true, scenario:key}
          Paso 8: UPDATE prospects.opt_out=true (solo si shouldSetOptOut — patron supabase.from as any)
          Paso 9: UPDATE quotes.status → scenario.targetStatus (patron supabase.from as any)
          Paso 10: INSERT quote_events event_type=scenario.eventType, actor='webhook'
            actor='webhook' — semanticamente correcto: en prod llegaria via webhook WABA
          redirect('/dashboard/quotes/[quoteId]') en exito
          GAP documentado: waba_message_id=null en simulacion (en prod recibiria ID del prospect)
        - components/dashboard/simulate-inbound-form.tsx: Client Component con useActionState
          Un solo form con 4 botones submit (name="scenario" value={key}) — HTML estandar sin JS extra
          Sin failedQuoteId — un solo form por pagina (no hay N forms como en approvals/outbox)
          formatScenarioStatus() inline — no puede importar lib/quotes/get-quotes-for-current-producer
            porque ese modulo importa next/headers (server-only). Boundary client/server respetado.
          4 tarjetas con colores: verde (interesado), azul (duda), naranja (no interesado), rojo (opt-out)
        - app/dashboard/quotes/[quoteId]/page.tsx: panel condicional al final de la pagina
          Solo muestra SimulateInboundForm si quote.status IN INBOUND_ELIGIBLE_STATUSES
          QuoteStatusBadge: agregados colores para responded, no_response_1, contacted_2, paused
          formatEventType: agregado 'message_received' para futura compatibilidad
        - components/dashboard/quotes-list.tsx: QuoteStatusBadge ampliado
          Agregados: pending_approval, responded, no_response_1, contacted_2, paused
        - app/dashboard/page.tsx: item "Simulacion de respuestas inbound" en lista ✅
        - README.md: seccion "Simulacion local de respuestas inbound" con tabla de escenarios
        - npm run build: exitoso (12 rutas, /dashboard/quotes/[quoteId] 2.35kB con Client Component)
        - WhatsApp real: NO integrado
        - IA real: NO integrada
        - db push: NO ejecutado
        - TuHoroscopoCosmico.com: NO tocado
✅ 23. Scheduler local manual: /dashboard/scheduler
        - lib/scheduler/get-local-scheduler-preview.ts: 2 queries (quotes status=pending_follow_up,
          luego prospects). Separa candidates (opt_out=false) de blockedByOptOut (opt_out=true).
          GAP documentado: follow_up_start_at existe en schema pero es null en MVP local.
          Por ahora: toda quote en pending_follow_up es elegible (sin filtro de fecha).
          En produccion se agregaria: follow_up_start_at <= NOW().
        - app/actions/scheduler.ts: runLocalScheduler() — Server Action con useActionState
          Paso 5a: Batch UPDATE quotes.status 'pending_follow_up' → 'scheduled'
            Filtro adicional: .eq('status', eligible) para prevenir race conditions
            Patron (supabase.from('quotes') as any).update() — identico a outbox/approvals
          Paso 5b: Batch INSERT quote_events — Supabase soporta array en .insert()
            event_type='follow_up_scheduled', actor='system' (cron semantico)
            previous='pending_follow_up', new='scheduled'
            description='Scheduler local simulo que la cotizacion quedo lista...'
          Si batch events INSERT falla: degradacion elegante (quotes ya actualizadas)
          Retorna SchedulerResult: { ran, processedCount, skippedOptOutCount, errorIds }
          NO hace redirect — muestra resultado inline con RunSchedulerButton
        - components/dashboard/run-scheduler-button.tsx: Client Component con useActionState
          Muestra resumen de resultado inline (processedCount, skippedCount)
          Links post-ejecucion: 'Ver cola de aprobacion' + 'Recargar scheduler'
          NO hace redirect para preservar el resumen visible
        - app/dashboard/scheduler/page.tsx: Server Component, auth guard
          Lista candidatas con: nombre, telefono, tipo, status, fecha creacion, follow_up_start_at
          Seccion separada para blockedByOptOut con aviso rojo
          Link 'Timeline →' por candidata
          RunSchedulerButton al final con aviso MVP visible
          Nota tecnica al pie: GAP follow_up_start_at, futura M2 con no_response_1
        - app/dashboard/page.tsx: seccion 'Scheduler local' con link violeta, item en lista ✅
        - app/dashboard/approvals/page.tsx: link '← Scheduler local' en navegacion
          (Las quotes llegan a approvals desde scheduler → el link contextualiza el flujo)
        - README.md: seccion 'Scheduler local manual' con flujo, GAP, que hace/no hace
        - npm run build: exitoso (13 rutas, /dashboard/scheduler incluido)
        - WhatsApp real: NO integrado
        - IA real: NO integrada
        - db push: NO ejecutado
        - TuHoroscopoCosmico.com: NO tocado
✅ 30. Repo migrado al nuevo GitHub, build validado, Vercel deploy plan creado (2026-06-29)
        - Bug 'use server': ya corregido en sesion anterior (commits fix: remove all export const
          y fix: move MANUAL_QUOTE_INITIAL_STATE). En esta sesion se confirmo que el codigo esta limpio.
        - Causa raiz del error en browser: dev server bloqueaba .next\trace, impidiendo npm run build.
          Solucion: detener el dev server antes de ejecutar build. No era un bug de codigo.
        - npm run build: exitoso (14 rutas, Next.js 15.5.19, TypeScript sin errores)
        - .gitignore actualizado: agrega tsconfig.tsbuildinfo (archivo de build de TS no commiteable)
        - Verificacion de secretos: .env.local excluido, supabase/.branches excluido por supabase/.gitignore
          ningun secreto real en codigo commitado — solo comentarios de referencia
        - Git remotes actualizados:
          old-origin → https://github.com/mbenitezmdeo/seguroflow-ai.git (repo anterior)
          origin → https://github.com/luismanuelbenitez/seguroflow-ai.git (repo nuevo)
        - Push exitoso al repo nuevo: github.com/luismanuelbenitez/seguroflow-ai
        - docs/06-integrations/VERCEL_DEPLOY_PLAN.md creado:
          Variables requeridas, checklist pre-deploy, configuracion de Auth en cloud,
          protocolo de migraciones (requiere verificacion de project-ref y autorizacion humana)
        - db push: NO ejecutado
        - supabase db push: sigue prohibido sin autorizacion humana explicita
        - TuHoroscopoCosmico.com: NO tocado
        - WhatsApp real: NO integrado
        - IA real: NO integrada
        - Datos reales: NO usados
        - Migraciones remotas: NO aplicadas

✅ 29. Auth actualizado: email + password como metodo principal (DECISION-007)
        - app/actions/auth.ts: signInWithPassword() como accion principal; sendMagicLink() como fallback
        - app/login/page.tsx: formulario email + password; credenciales demo visibles en UI
        - lib/supabase/server.ts: flowType: 'pkce' agregado (fix de bug de auth anterior)
        - .env.local: NEXT_PUBLIC_SITE_URL cambiado a http://127.0.0.1:3000 (fix cookie domain)
        - Usuarios configurados via Admin API local (service role local en terminal, no en frontend):
          demo@seguroflow.local / Demo123456! (user_id: 491e5a58-02f2-49f0-a7af-06cc169f8fc1)
          mbenitezmdeo@gmail.com / Demo123456! (user_id: 01c76b54-af8f-4582-b42d-d655034c2431)
        - docs/04-decisiones/DECISION-007-auth-strategy-pilot.md: decision completa
        - DECISION-LOG.md: entrada DECISION-007 agregada
        - README.md: seccion "Login local con email + password" con credenciales, pasos, curl
        - AI_BRIEF.md: fila Auth actualizada
        - CURRENT_STATE.md: estado, usuario demo y pasos actualizados
        - docs/07-go-to-market/PRE_PILOT_CHECKLIST.md: auth section actualizada
        - Magic link: sigue disponible en codigo como fallback, no es el flujo central
        - MFA: futuro. Google login: futuro. Gmail integracion: modulo separado, futuro.
        - db push: NO ejecutado
        - TuHoroscopoCosmico.com: NO tocado
        - Datos reales: NO usados
        - Service role: usado SOLO en terminal local para setear passwords, nunca en frontend

✅ 28. Paquete de discovery comercial completo
        - docs/07-go-to-market/DISCOVERY_RUNBOOK.md:
          Objetivo de discovery (5 hipotesis a validar)
          Perfil ideal de productor + de donde sacar candidatos
          Estructura de reunion de 30 min (5 bloques con guia por bloque)
          Preguntas pre-demo (contexto, proceso, dolor)
          Preguntas post-demo (flujo, control, tiempos, metricas, piloto)
          Senales positivas y negativas (criterios para identificar perfil)
          Criterios de decision para avanzar a piloto real
        - docs/07-go-to-market/PRODUCER_FEEDBACK_TEMPLATE.md:
          Plantilla completa por productor: identificacion, perfil, situacion actual,
          dolor declarado, reaccion a la demo, objeciones, funcionalidades pedidas,
          scores 1-5 (dolor, urgencia, disposicion a probar, disposicion a pagar),
          decision recomendada (descartar / nutrir / piloto), resumen ejecutivo
        - docs/07-go-to-market/OUTREACH_MESSAGES.md:
          4 versiones de mensajes de contacto (WA frio, WA referido, WA conocido, LinkedIn, email)
          Manejo de respuestas comunes (que es, WA real, no tengo tiempo, mandame info, precio)
          Notas de seguimiento para registrar cada contacto
        - docs/07-go-to-market/PRE_PILOT_CHECKLIST.md actualizado con referencias
        - db push: NO ejecutado
        - WhatsApp real: NO integrado
        - TuHoroscopoCosmico.com: NO tocado
        - Datos reales: NO usados
✅ 27. Guion comercial de demo de 5 minutos — docs/07-go-to-market/DEMO_SCRIPT_5_MIN.md
        - Pitch inicial de 30 segundos (lenguaje natural, no corporativo)
        - 8 pasos de demo con qué mostrar y qué decir en cada pantalla
        - 13 preguntas de discovery para intercalar durante la demo
        - 8 objeciones probables con respuestas honestas
          (no prometer WhatsApp real ya listo, no prometer IA autonoma,
           no prometer cumplimiento legal definitivo)
        - Cierre con propuesta de siguiente paso concreta (10-20 cotizaciones prueba)
        - Version corta de 60 segundos para WhatsApp o llamada
        - PRE_PILOT_CHECKLIST.md actualizado: referencia al guion como paso previo recomendado
        - db push: NO ejecutado
        - WhatsApp real: NO integrado
        - TuHoroscopoCosmico.com: NO tocado
        - Datos reales: NO usados
✅ 26. Documentacion de transicion a piloto real — M2 WhatsApp + checklist pre-piloto
        - docs/06-integrations/WHATSAPP_REAL_PLAN.md:
          Analisis comparativo de 3 proveedores (Meta, Twilio, 360dialog) con pros/contras/riesgos
          Flujo tecnico propuesto M2: desde quote pending_approval hasta inbound webhook
          Variables de entorno esperadas (solo nombres, sin valores)
          Seguridad: firma webhook, validacion producer/prospect, idempotencia, opt-out
          Alcance fuera de M2: IA, clasificacion automatica, multi-provider, CSV masivo
          Recomendacion: adapter abstracto → Twilio sandbox → cloud → templates → piloto real
        - docs/07-go-to-market/PRE_PILOT_CHECKLIST.md:
          Objetivo del piloto (3 hipotesis a validar)
          Perfil ideal del primer producer (chico/mediano, cotiza por WA, pierde seguimiento)
          Requisitos operativos: infraestructura, proceso, roles
          Requisitos de datos: volumen inicial, formato E.164, proteccion de datos
          Requisitos legales [LEGAL]: validar con asesor - Ley 18.331, consentimiento WA,
            politica de privacidad, opt-out, terminos con el producer, politicas Meta/Twilio
          Metricas de exito: primarias (cuantitativas) + secundarias (cualitativas)
          Guion de demo para el producer: 9 pasos con frases sugeridas y puntos clave
          Criterios para avanzar al piloto real: tecnicos + proceso + legales + negocio
        - docs/04-decisiones/DECISION-LOG.md: entrada DECISION-006 agregada
        - CURRENT_STATE.md: este archivo actualizado
        - db push: NO ejecutado
        - WhatsApp real: NO integrado
        - IA: NO integrada
        - Migraciones: NO tocadas
        - TuHoroscopoCosmico.com: NO tocado
        - Datos reales: NO usados
✅ 25. UX de demo comercial — polish visual de todas las pantallas del dashboard
        - components/dashboard/dashboard-shell.tsx: header oscuro + sub-nav con 6 secciones
          Fondo #0f172a + logo "SF" en azul + nav bar con links a todas las rutas
          Max-width aumentado a 960px. Sin librerías adicionales.
        - components/ui/page-header.tsx: breadcrumb + titulo + subtitulo + slot de acciones
        - components/ui/demo-disclaimer.tsx: banner de disclaimer (info/warning) reutilizable
        - components/ui/section-card.tsx: card con header opcional + acento de color
        - components/ui/empty-state.tsx: estado vacio con CTA + links secundarios
        - app/dashboard/page.tsx: reescritura como home del producto
          Hero gradient con producto + tagline + badges MVP/activo
          Diagrama visual del flujo (6 pasos como pills clickeables)
          Grid de 6 quick-action cards con color por sección
          Status del MVP (checklist sin las pendientes que confunden en la demo)
        - /dashboard/quotes, /scheduler, /approvals, /outbox, /metrics, /quotes/[id]:
          PageHeader + DemoDisclaimer en todas las paginas
          Links de navegacion contextuales en cada header (anterior/siguiente en el flujo)
        - README.md: seccion "Demo comercial local" con flujo de 9 pasos y puntos clave
        - npm run build: pendiente
        - db push: NO ejecutado — TuHoroscopoCosmico.com: NO tocado
✅ 24. Métricas locales del MVP: /dashboard/metrics
        - lib/metrics/get-basic-dashboard-metrics.ts: helper server-side con 5 queries en paralelo (Promise.all)
            1. quotes: todos los del producer (id, status) → conteo en memoria con Map<QuoteStatus, number>
            2. prospects: count opt_out=true → optOutProspectsCount
            3. whatsapp_messages direction='outbound' → outboundSimulatedCount
            4. whatsapp_messages direction='inbound' → inboundSimulatedCount
            5. quote_events: ultimos 5 del producer → lastEvents
          Sigue patron de otros helpers: recibe producerId (caller maneja auth), NO llama getCurrentProducerContext().
          Workaround TypeScript 'never': cast explícito de .data en los 5 resultados.
          GAP documentado: metadata.simulated no filtrado (en MVP todo es simulado, en M2 habra que filtrar).
          GAP documentado: interestRate usa everContactedCount (no solo status='contacted' actual).
          Retorna BasicDashboardMetrics: todos los conteos en 0 si error (nunca undefined).
        - app/dashboard/metrics/page.tsx: Server Component, 4 secciones de cards + tabla + eventos
          Sección Volumen: totalQuotes, pendingFollowUpCount, scheduledCount, pendingApprovalCount
          Sección Embudo: contactedCount (contacted+contacted_2), noResponseCount, respondedCount, interestedCount
          Sección Resultados: closedWonCount, closedLostCount, optOutQuotesCount, optOutProspectsCount
          Sección Mensajes: outboundSimulatedCount, inboundSimulatedCount, responseRate%, interestRate%
          Tabla distribución: todos los statuses con count > 0, barras proporcionales visuales (CSS puro)
          Actividad reciente: últimos 5 eventos con formatEventType, formatActor, link a timeline
          Disclaimer MVP visible. Footer con notas técnicas y GAPs documentados.
          Sin gráficos. Sin librerías adicionales. Inline styles consistentes con el resto del proyecto.
        - app/dashboard/page.tsx: card 'Métricas locales' con link cyan (#0891b2) + item en lista ✅
        - README.md: sección 'Métricas locales' con tabla, tasas calculadas, GAP metadata.simulated
        - npm run build: pendiente
        - WhatsApp real: NO integrado
        - IA real: NO integrada
        - db push: NO ejecutado
        - TuHoroscopoCosmico.com: NO tocado
   Proximos pasos recomendados (elegir uno para la siguiente sesion):

   PROXIMO PASO INMEDIATO:

   Ejecutar 3-5 entrevistas de discovery con productores reales.
   Paquete completo disponible en docs/07-go-to-market/:
     - OUTREACH_MESSAGES.md → para contactar productores
     - DISCOVERY_RUNBOOK.md → para conducir la reunion
     - DEMO_SCRIPT_5_MIN.md → guion de la demo
     - PRODUCER_FEEDBACK_TEMPLATE.md → para registrar feedback
     - DISCOVERY_QUESTIONS.md → preguntas de profundidad adicionales

   NO avanzar a WhatsApp real ni a cloud hasta tener:
     - al menos 2/3 productores con dolor confirmado (score dolor >= 3/5)
     - al menos 1 productor que acepte piloto controlado

   Una vez completado el discovery, decidir:
     B) DECISION PROVEEDOR WHATSAPP — DECISION-007 sobre proveedor WABA
        (solo si el discovery confirma dolor y disposicion a piloto)
     C) PREPARACION ENTORNO CLOUD — Supabase cloud con autorizacion humana explicita
        REQUIERE verificar project-ref antes de cualquier supabase db push

   Tareas pendientes de la lista original:
   27. Crear cuentas cloud: Supabase proyecto + Anthropic API + Twilio sandbox (depende de C)
   28. Disenar y enviar templates HSM a Meta — 1-7 dias habiles (iniciar en paralelo con C)
   29. Primer mensaje real de prueba a un numero del equipo (depende de B y C)
```

---

## Cosas a vigilar antes de programar

- La aprobación de templates HSM por Meta tarda hasta 7 días. Iniciar ese proceso
  en paralelo con el desarrollo de la base de datos.
- El productor piloto debe firmar o declarar que tiene relación previa con los
  prospectos (requisito legal Ley 18.331 Uruguay).
- Si se usa un número WABA central (no el del productor), hay implicaciones de
  confianza: el prospecto verá un número que no conoce.
