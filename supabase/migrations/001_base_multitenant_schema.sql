-- =============================================================================
-- MIGRACIÃ“N 001: Esquema base multi-tenant
-- Proyecto   : SeguroFlow AI
-- Fecha      : 2026-06-28
-- Basado en  : docs/05-architecture/DATA_MODEL.md v2.0
--              docs/04-decisiones/DECISION-002-stack-tecnologico-inicial.md
--              docs/04-decisiones/DECISION-003-multitenant-rls.md
-- =============================================================================
--
-- QUÃ‰ HACE ESTA MIGRACIÃ“N:
--   Crea el esquema completo de la base de datos para el MVP-01 (Recuperador de
--   Cotizaciones). Incluye tablas, enums, funciÃ³n central de RLS, triggers de
--   seguridad, polÃ­ticas de acceso e Ã­ndices de rendimiento.
--
-- QUÃ‰ NO INCLUYE:
--   - Datos de prueba ni seeds.
--   - Integraciones con WhatsApp, LLM ni servicios externos.
--   - LÃ³gica de negocio (esa vive en la aplicaciÃ³n Next.js).
--   - ConfiguraciÃ³n de Storage ni Realtime.
--
-- PRINCIPIO CENTRAL (DECISION-003):
--   producer_id  â‰   auth.uid()
--   Los usuarios (auth.users) y los tenants comerciales (producers) son entidades
--   distintas. La tabla producer_members los vincula. Todas las tablas de negocio
--   llevan producer_id explÃ­cito para RLS performante sin JOINs en las polÃ­ticas.
--
-- PRIVACIDAD (Ley 18.331, Uruguay):
--   Las tablas prospects y whatsapp_messages contienen datos PII. EstÃ¡n
--   protegidas por RLS. No se loguean en texto plano fuera de la base de datos.
--
-- CÃ“MO APLICAR:
--   Ver /supabase/README.md antes de ejecutar contra cualquier entorno.
-- =============================================================================


-- =============================================================================
-- SECCIÃ“N 0 â€” EXTENSIONES
-- =============================================================================
--
-- gen_random_uuid() estÃ¡ disponible nativamente en PostgreSQL 13+ (que Supabase
-- usa), por lo que uuid-ossp NO es necesaria para generaciÃ³n de UUIDs.
--
-- pgcrypto: disponible pero no activada en esta migraciÃ³n. Documentada aquÃ­
-- porque la versiÃ³n on-premise/enterprise la necesitarÃ¡ para cifrado en reposo
-- de columnas PII (full_name, phone, email en prospects).
-- Ver: docs/05-architecture/DATA_MODEL.md Â§Consideraciones on-premise
--
-- Si se activa pgcrypto en el futuro, agregar aquÃ­:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- SECCIÃ“N 1 â€” TIPOS ENUM
-- =============================================================================
--
-- INTENCIÃ“N: centralizar los valores vÃ¡lidos para campos de estado y categorÃ­a.
-- Los ENUMs de PostgreSQL garantizan integridad sin necesidad de foreign keys a
-- tablas de lookup. Son inmutables salvo ALTER TYPE ADD VALUE, que es seguro y
-- no requiere reescritura de filas existentes.
--
-- ADVERTENCIA: eliminar un valor de un ENUM existente en producciÃ³n requiere
-- una migraciÃ³n destructiva. Solo agregar valores, nunca eliminar.


-- Tipo de seguro cotizado
CREATE TYPE insurance_type AS ENUM (
  'auto',         -- Seguro de automÃ³vil
  'home',         -- Seguro de hogar
  'life',         -- Seguro de vida
  'commercial',   -- Seguro comercial / empresarial
  'other'         -- Otros tipos (accidentes personales, viaje, etc.)
);

-- Estado de una cotizaciÃ³n a lo largo de su ciclo de vida
-- Ver: docs/02-product/RECUPERADOR_COTIZACIONES.md Â§4 (tabla de estados)
-- Ver: docs/05-architecture/DATA_MODEL.md Â§quotes.status
CREATE TYPE quote_status AS ENUM (
  'pending_follow_up',  -- Ingresada, dentro del perÃ­odo de espera
  'scheduled',          -- Umbral vencido, en cola para envÃ­o
  'pending_approval',   -- Mensaje generado, esperando aprobaciÃ³n del producer (modo manual)
  'contacted',          -- Primer mensaje enviado al prospecto
  'no_response_1',      -- 24h sin respuesta al primer mensaje
  'contacted_2',        -- Segundo mensaje enviado
  'responded',          -- El prospecto respondiÃ³ algo (positivo, negativo o ambiguo)
  'interested',         -- El prospecto confirmÃ³ interÃ©s activo
  'human_handoff',      -- El sistema derivÃ³ la cotizaciÃ³n al producer humano
  'closed_won',         -- PÃ³liza emitida â€” ESTADO TERMINAL
  'closed_lost',        -- El prospecto declinÃ³ explÃ­citamente â€” ESTADO TERMINAL
  'no_response',        -- Sin respuesta tras todos los intentos automÃ¡ticos
  'paused',             -- El producer pausÃ³ el seguimiento manualmente
  'cancelled',          -- El producer descartÃ³ la cotizaciÃ³n â€” ESTADO TERMINAL
  'opt_out',            -- El prospecto pidiÃ³ no ser contactado â€” ESTADO TERMINAL
  'error'               -- Error tÃ©cnico en el envÃ­o, requiere revisiÃ³n manual
);

-- Modo de envÃ­o de mensajes del producer
CREATE TYPE send_mode AS ENUM (
  'manual',     -- El producer aprueba cada mensaje antes de que salga
  'automatic'   -- El sistema envÃ­a sin intervenciÃ³n humana
);

-- Estado del productor en el sistema
CREATE TYPE producer_status AS ENUM (
  'active',     -- Activo y operativo
  'inactive',   -- Desactivado voluntariamente
  'suspended'   -- Suspendido por el administrador (ej: pago vencido)
);

-- Plan de servicio del producer
CREATE TYPE producer_plan AS ENUM (
  'pilot',      -- Piloto gratuito â€” 1-3 productores iniciales
  'starter',    -- Plan bÃ¡sico (definir en go-to-market)
  'pro',        -- Plan profesional
  'enterprise'  -- Plan enterprise / on-premise
);

-- Rol del usuario dentro de un producer
-- En el MVP solo se usa 'owner'. Los demÃ¡s existen en el esquema para no
-- requerir ALTER TABLE cuando se implemente el sistema de invitaciones.
CREATE TYPE member_role AS ENUM (
  'owner',   -- Control total sobre el producer
  'admin',   -- GestiÃ³n de miembros y configuraciÃ³n (futuro)
  'agent',   -- Puede operar cotizaciones, no cambiar configuraciÃ³n (futuro)
  'viewer'   -- Solo lectura (futuro)
);

-- Estado del consentimiento del prospecto para ser contactado
CREATE TYPE consent_status AS ENUM (
  'unknown',  -- No se verificÃ³ consentimiento explÃ­cito (caso por defecto en piloto)
  'granted',  -- Prospecto dio consentimiento explÃ­cito
  'revoked'   -- Prospecto revocÃ³ el consentimiento
);

-- Proveedor de WhatsApp Business API
CREATE TYPE waba_provider AS ENUM (
  'twilio',       -- Twilio (usado en sandbox de desarrollo)
  '360dialog',    -- 360dialog / Sinch (opciÃ³n para piloto real)
  'meta_direct'   -- Meta Cloud API directa
);

-- DirecciÃ³n de un mensaje de WhatsApp
CREATE TYPE message_direction AS ENUM (
  'outbound',  -- Sistema â†’ Prospecto
  'inbound'    -- Prospecto â†’ Sistema
);

-- Estado de entrega de un mensaje saliente
CREATE TYPE delivery_status AS ENUM (
  'pending',    -- Encolado, no enviado aÃºn
  'sent',       -- Enviado a la API de WhatsApp
  'delivered',  -- WhatsApp confirmÃ³ entrega en el dispositivo del prospecto
  'read',       -- WhatsApp confirmÃ³ lectura (requiere soporte del proveedor)
  'failed'      -- Error definitivo en el envÃ­o
);

-- ClasificaciÃ³n de la respuesta del prospecto por el LLM
-- Ver: docs/02-product/MESSAGE_SEQUENCES.md Â§Respuestas automÃ¡ticas
CREATE TYPE ai_classification AS ENUM (
  'interested',           -- El prospecto muestra interÃ©s activo
  'needs_more_info',      -- El prospecto pide mÃ¡s informaciÃ³n (no objeciÃ³n)
  'price_objection',      -- El prospecto cuestiona el precio
  'coverage_objection',   -- El prospecto cuestiona la cobertura
  'wants_human_contact',  -- El prospecto pide hablar con una persona
  'not_interested',       -- El prospecto declina claramente
  'opt_out_requested',    -- El prospecto pide no ser contactado mÃ¡s
  'unclear_response',     -- La respuesta es ambigua, no se puede clasificar
  'angry_or_sensitive'    -- Tono negativo o situaciÃ³n delicada â€” escalar siempre
);

-- AcciÃ³n sugerida por el LLM al sistema tras clasificar una respuesta
CREATE TYPE ai_suggested_action AS ENUM (
  'respond',   -- El sistema puede responder con una respuesta aprobada
  'escalate',  -- Derivar al producer humano
  'close'      -- Cerrar la cotizaciÃ³n como perdida
);

-- Motivo por el cual se derivÃ³ una cotizaciÃ³n al producer
CREATE TYPE handoff_reason AS ENUM (
  'prospect_interested',           -- El prospecto mostrÃ³ interÃ©s activo
  'prospect_has_question',         -- El prospecto hizo una pregunta que requiere criterio
  'price_objection',               -- ObjeciÃ³n de precio que el LLM no puede resolver
  'coverage_objection',            -- Pregunta de cobertura â€” lÃ­mite duro de la IA
  'human_requested',               -- El prospecto pidiÃ³ hablar con una persona
  'low_confidence_classification', -- El LLM clasificÃ³ con confianza < 0.80
  'angry_or_sensitive',            -- Tono negativo o caso delicado
  'unclear_response',              -- Respuesta ambigua sin clasificaciÃ³n confiable
  'is_bot_question'                -- El prospecto preguntÃ³ si es un bot
);

-- Estado de una derivaciÃ³n al producer
CREATE TYPE handoff_status AS ENUM (
  'pending',   -- Esperando que el producer tome acciÃ³n
  'accepted',  -- El producer vio y aceptÃ³ la derivaciÃ³n
  'resolved'   -- El producer cerrÃ³ y resolviÃ³ la derivaciÃ³n
);

-- Actor que generÃ³ un evento en el audit log
-- Estos son los Ãºnicos tres valores vÃ¡lidos. Ver: DATA_MODEL.md Â§quote_events.actor
CREATE TYPE quote_event_actor AS ENUM (
  'system',    -- Proceso automÃ¡tico interno (cron job, lÃ³gica de negocio)
  'producer',  -- AcciÃ³n manual del producer desde el dashboard
  'webhook'    -- Evento entrante desde la API de WhatsApp
);


-- =============================================================================
-- SECCIÃ“N 2 â€” TABLA: profiles
-- =============================================================================
--
-- INTENCIÃ“N: extender auth.users con informaciÃ³n de la persona.
-- RelaciÃ³n 1:1 con auth.users. La columna id es el mismo UUID que auth.uid().
-- Esta tabla se popula automÃ¡ticamente via trigger (ver SecciÃ³n 5).
--
-- PRIVACIDAD: phone es PII. No loguear en texto plano.
-- RLS: cada usuario solo puede leer y actualizar su propio perfil.

CREATE TABLE public.profiles (
  -- id es igual a auth.uid() del usuario autenticado.
  -- FK implÃ­cita a auth.users.id (no se declara FK explÃ­cita para evitar
  -- dependencias que compliquen el self-host de Supabase Auth).
  id            UUID PRIMARY KEY,

  full_name     TEXT,
  display_name  TEXT,         -- Nombre corto que aparece en la UI ("Gonzalo R.")
  phone         TEXT,         -- [PII] TelÃ©fono personal del usuario, para alertas del sistema
  avatar_url    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Perfil extendido del usuario autenticado. RelaciÃ³n 1:1 con auth.users. '
  'Se crea automÃ¡ticamente via trigger on_auth_user_created al registrar un usuario. '
  'Columna phone es PII â€” no loguear en texto plano.';

COMMENT ON COLUMN public.profiles.id IS
  'UUID igual a auth.uid(). ActÃºa como FK a auth.users.id.';

COMMENT ON COLUMN public.profiles.phone IS
  '[PII] TelÃ©fono personal del usuario para recibir alertas del sistema (no del prospecto). '
  'No loguear completo. Usar mÃ¡scara: +598 9XX XXX X89.';


-- =============================================================================
-- SECCIÃ“N 3 â€” TABLA: producers
-- =============================================================================
--
-- INTENCIÃ“N: representa la organizaciÃ³n comercial (el tenant).
-- Su id es el producer_id que viaja por TODAS las tablas de negocio.
-- ESTE UUID NO ES auth.uid(). Ver DECISION-003 Â§1.
--
-- SEGURIDAD: waba_config_ref NO almacena la API key real. Solo almacena
-- el nombre o identificador del secreto en el vault (Supabase Vault,
-- variable de entorno, etc.). La aplicaciÃ³n resuelve la key real en runtime.
--
-- RLS: un usuario puede leer los producers donde es miembro activo en
-- producer_members. Solo el service role puede crear producers.

CREATE TABLE public.producers (
  -- Este UUID es el producer_id. No es auth.uid() de ningÃºn usuario.
  -- Es el identificador del tenant comercial en todo el sistema.
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name              TEXT        NOT NULL, -- Nombre comercial ("Seguros RodrÃ­guez")
  contact_name      TEXT        NOT NULL, -- Persona principal de contacto

  -- NÃºmero de WhatsApp Business en formato E.164 (+59899XXXXXX)
  waba_number       TEXT,
  waba_provider     waba_provider,

  -- SEGURIDAD CRÃTICA: este campo NUNCA almacena la API key real de WhatsApp.
  -- Solo almacena una referencia (nombre de variable de entorno o clave de vault).
  -- La aplicaciÃ³n resuelve el secreto real en runtime desde el proveedor configurado.
  waba_config_ref   TEXT,

  follow_up_hours   INTEGER     NOT NULL DEFAULT 48,  -- Horas de espera antes de activar seguimiento
  send_mode         send_mode   NOT NULL DEFAULT 'manual',
  message_signature TEXT,                             -- Texto de cierre en mensajes salientes
  plan              producer_plan NOT NULL DEFAULT 'pilot',
  status            producer_status NOT NULL DEFAULT 'active',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.producers IS
  'OrganizaciÃ³n comercial (productor, corredor, corredora) que usa el sistema. '
  'Es el tenant en el modelo multi-tenant. Su id es el producer_id que referencia '
  'todas las tablas de negocio. ATENCIÃ“N: producer_id â‰  auth.uid(). Ver DECISION-003.';

COMMENT ON COLUMN public.producers.waba_config_ref IS
  'Referencia al secreto de WhatsApp Business API en el vault o variable de entorno. '
  'NUNCA almacenar la API key real en esta columna. La aplicaciÃ³n resuelve el secreto '
  'en runtime. Ejemplo de valor: "WABA_KEY_PRODUCER_123" (nombre de env var).';

COMMENT ON COLUMN public.producers.follow_up_hours IS
  'Horas de espera desde quote_date hasta activar el seguimiento automÃ¡tico. '
  'Default: 48h. Configurable por producer.';


-- =============================================================================
-- SECCIÃ“N 4 â€” TABLA: producer_members
-- =============================================================================
--
-- INTENCIÃ“N: tabla puente que vincula usuarios (auth.users) con producers.
-- Define quÃ© usuarios pertenecen a quÃ© producer y con quÃ© rol.
-- En el MVP: 1 usuario por producer con role = 'owner'.
-- El diseÃ±o soporta mÃºltiples usuarios por producer sin cambios de esquema.
--
-- El proceso de invitaciÃ³n no estÃ¡ implementado en el MVP. Los miembros se
-- insertan manualmente en el onboarding asistido.
--
-- RLS: un usuario solo puede ver sus propias membresÃ­as.

CREATE TABLE public.producer_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  producer_id   UUID        NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  -- user_id referencia auth.users.id. No se declara FK explÃ­cita para evitar
  -- dependencias con el schema auth de Supabase.
  user_id       UUID        NOT NULL,

  role          member_role NOT NULL DEFAULT 'owner',

  -- is_active permite suspender el acceso sin borrar el registro histÃ³rico.
  is_active     BOOLEAN     NOT NULL DEFAULT true,

  -- invited_at y accepted_at para el flujo de invitaciones (futuro).
  -- En MVP, invited_at = created_at y accepted_at se setea inmediatamente.
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at   TIMESTAMPTZ,          -- NULL si la invitaciÃ³n no fue aceptada todavÃ­a

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un usuario no puede tener dos membresÃ­as al mismo producer.
  CONSTRAINT producer_members_unique_membership UNIQUE (producer_id, user_id)
);

COMMENT ON TABLE public.producer_members IS
  'Tabla puente entre usuarios (auth.users) y producers. Define acceso y rol. '
  'MVP: 1 usuario/producer con role=owner. El esquema soporta mÃºltiples usuarios '
  'sin cambios. Proceso de invitaciÃ³n no implementado en MVP â€” inserciÃ³n manual.';

COMMENT ON COLUMN public.producer_members.role IS
  'MVP: siempre ''owner''. Los valores admin/agent/viewer existen en el tipo '
  'pero no se evalÃºan en lÃ³gica de negocio hasta implementar el sistema de roles.';

COMMENT ON COLUMN public.producer_members.is_active IS
  'false = suspensiÃ³n de acceso sin eliminar el registro. '
  'La funciÃ³n get_my_producer_ids() filtra solo membresÃ­as activas (is_active = true).';


-- =============================================================================
-- SECCIÃ“N 5 â€” TABLA: prospects
-- =============================================================================
--
-- INTENCIÃ“N: representa a la persona o empresa que recibiÃ³ una cotizaciÃ³n.
-- Un prospect puede tener mÃºltiples quotes con el mismo producer.
--
-- PRIVACIDAD [PII]: full_name, phone y email son datos personales sujetos
-- a la Ley 18.331 de Uruguay. No loguear en texto plano.
--
-- OPT-OUT: si opt_out = true, el sistema NUNCA envÃ­a mensajes a este nÃºmero
-- desde este producer. Se refuerza con un trigger en whatsapp_messages.
-- Ver SecciÃ³n 8 (trigger enforce_prospect_opt_out).
--
-- SOFT DELETE: los prospects no se borran con DELETE. Se archivan con
-- archived_at para preservar el historial de opt-out (requisito legal).
--
-- RLS: acceso filtrado por producer_id. Sin polÃ­tica DELETE.

CREATE TABLE public.prospects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- producer_id es el tenant. Denormalizado aquÃ­ (y en todas las tablas de negocio)
  -- para que las polÃ­ticas RLS no necesiten JOINs. Ver DECISION-003 Â§4.
  producer_id     UUID            NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,

  full_name       TEXT            NOT NULL, -- [PII] Nombre completo o razÃ³n social
  phone           TEXT            NOT NULL, -- [PII] NÃºmero en formato E.164 (+59899XXXXXX)
  email           TEXT,                     -- [PII] Email opcional

  consent_status  consent_status  NOT NULL DEFAULT 'unknown',

  -- opt_out: impide cualquier contacto saliente desde este producer a este nÃºmero.
  -- Doble barrera: validaciÃ³n en aplicaciÃ³n + trigger enforce_prospect_opt_out.
  opt_out         BOOLEAN         NOT NULL DEFAULT false,
  opt_out_at      TIMESTAMPTZ,

  internal_notes  TEXT,                    -- Notas del producer. NUNCA exponer al prospecto.

  -- Soft delete. NULL = prospect activo. Fecha = archivado.
  -- No usar DELETE porque se perderÃ­a el historial de opt-out.
  archived_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- Un nÃºmero de telÃ©fono solo puede aparecer una vez por producer.
  -- Previene duplicados accidentales de prospectos.
  CONSTRAINT prospects_unique_phone_per_producer UNIQUE (producer_id, phone)
);

COMMENT ON TABLE public.prospects IS
  '[PII] Persona o empresa que recibiÃ³ una cotizaciÃ³n. '
  'full_name, phone y email son datos personales sujetos a Ley 18.331 Uruguay. '
  'No loguear en texto plano. Soft delete via archived_at â€” nunca usar DELETE.';

COMMENT ON COLUMN public.prospects.phone IS
  '[PII CRÃTICO] NÃºmero en formato E.164. En logs usar mÃ¡scara: +598 9XX XXX X89. '
  'Si opt_out=true, ningÃºn proceso puede enviar mensajes a este nÃºmero.';

COMMENT ON COLUMN public.prospects.opt_out IS
  'Barrera principal de opt-out. Si true, el trigger enforce_prospect_opt_out '
  'rechaza cualquier INSERT en whatsapp_messages con direction=outbound para este prospect.';

COMMENT ON COLUMN public.prospects.internal_notes IS
  'Notas internas del producer. No deben ser visibles ni enviadas al prospecto bajo ninguna circunstancia.';


-- =============================================================================
-- SECCIÃ“N 6 â€” TABLA: quotes
-- =============================================================================
--
-- INTENCIÃ“N: objeto central del sistema. Cada cotizaciÃ³n de seguro en seguimiento.
-- El estado (status) controla en quÃ© punto del flujo automÃ¡tico estÃ¡ la cotizaciÃ³n.
-- Ver: docs/02-product/RECUPERADOR_COTIZACIONES.md Â§4 (Ã¡rbol de estados)
--
-- RLS: acceso filtrado por producer_id. Sin polÃ­tica DELETE (usar 'cancelled').

CREATE TABLE public.quotes (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id         UUID            NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  prospect_id         UUID            NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,

  insurance_type      insurance_type  NOT NULL,
  risk_description    TEXT,           -- DescripciÃ³n del riesgo: "Toyota Hilux 2021", "Apto. Pocitos"
  insurer_name        TEXT,           -- Nombre de la aseguradora con quien se cotizÃ³
  quoted_amount       NUMERIC(12, 2), -- Prima cotizada (mensual o anual segÃºn contexto)
  currency            CHAR(3)         NOT NULL DEFAULT 'UYU', -- ISO 4217: UYU, USD

  quote_date          DATE            NOT NULL, -- Fecha en que el producer emitiÃ³ la cotizaciÃ³n
  expiry_date         DATE,                     -- Hasta cuÃ¡ndo es vÃ¡lida la cotizaciÃ³n

  -- Momento desde el cual el sistema puede iniciar el seguimiento.
  -- Se calcula como quote_date + producers.follow_up_hours al activar el seguimiento.
  -- NULL al ingreso; el sistema lo setea cuando procesa la cotizaciÃ³n.
  follow_up_start_at  TIMESTAMPTZ,

  status              quote_status    NOT NULL DEFAULT 'pending_follow_up',
  origin_channel      TEXT,           -- CÃ³mo llegÃ³ el lead: referido, web, llamada, etc.
  internal_notes      TEXT,

  -- Texto final del mensaje despuÃ©s de ser aprobado por el producer (modo manual).
  -- NULL en modo automatic. Se guarda para auditorÃ­a: muestra exactamente quÃ©
  -- texto aprobÃ³ el producer antes del envÃ­o.
  approved_message    TEXT,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quotes IS
  'CotizaciÃ³n de seguro en seguimiento. Objeto central del sistema. '
  'El campo status controla el flujo automÃ¡tico. Estados terminales: '
  'closed_won, closed_lost, cancelled, opt_out. Sin polÃ­tica DELETE â€” usar cancelled.';

COMMENT ON COLUMN public.quotes.approved_message IS
  'Texto exacto del mensaje aprobado por el producer en modo manual. '
  'Se guarda para auditorÃ­a: permite saber quÃ© aprobÃ³ el producer y quÃ© se enviÃ³. '
  'NULL en modo automatic (el sistema envÃ­a sin aprobaciÃ³n previa).';

COMMENT ON COLUMN public.quotes.follow_up_start_at IS
  'Timestamp desde el cual el sistema puede iniciar el seguimiento. '
  'Calculado por la aplicaciÃ³n como quote_date + producers.follow_up_hours. '
  'El cron job consulta este campo para detectar cotizaciones elegibles. '
  'Ver Ã­ndice idx_quotes_followup en SecciÃ³n 11.';


-- =============================================================================
-- SECCIÃ“N 7 â€” TABLA: whatsapp_messages
-- =============================================================================
--
-- INTENCIÃ“N: log conversacional completo de cada cotizaciÃ³n.
-- Registra mensajes enviados (outbound) y recibidos (inbound).
-- Nunca se borran. Son evidencia del flujo y base del audit trail.
--
-- PRIVACIDAD [PII indirecto]: el campo body contiene el contenido real de los
-- mensajes del prospecto. Tratar como PII. No loguear en texto plano.
-- No incluir en mensajes de error ni stack traces.
--
-- TRIGGER: enforce_prospect_opt_out (ver SecciÃ³n 8) rechaza INSERTs con
-- direction='outbound' si el prospecto tiene opt_out=true.
--
-- prospect_id estÃ¡ denormalizado (se puede derivar via quotes) para lookups
-- rÃ¡pidos del webhook de WhatsApp por nÃºmero de telÃ©fono.
--
-- RLS: sin polÃ­tica DELETE.

CREATE TABLE public.whatsapp_messages (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id     UUID              NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  quote_id        UUID              NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,

  -- Denormalizado de quotes.prospect_id para lookups directos por nÃºmero de telÃ©fono
  -- sin necesidad de JOIN. Ãštil en el handler del webhook de WhatsApp.
  prospect_id     UUID              NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,

  direction       message_direction NOT NULL,

  -- [PII indirecto] Contenido real del mensaje. Puede contener texto del prospecto.
  -- No loguear. No incluir en mensajes de error.
  body            TEXT              NOT NULL,

  template_name   TEXT,              -- Nombre del template HSM de Meta (solo outbound)
  waba_message_id TEXT,              -- ID externo asignado por el proveedor WABA

  -- Solo aplica a mensajes outbound. Los inbound se reciben sin status delivery.
  delivery_status delivery_status,

  sent_at         TIMESTAMPTZ,       -- CuÃ¡ndo se enviÃ³ a la API de WABA
  delivered_at    TIMESTAMPTZ,       -- CuÃ¡ndo confirmÃ³ entrega WhatsApp
  read_at         TIMESTAMPTZ,       -- CuÃ¡ndo confirmÃ³ lectura (si el proveedor lo soporta)
  failed_at       TIMESTAMPTZ,       -- CuÃ¡ndo fallÃ³ definitivamente el envÃ­o
  failure_reason  TEXT,              -- Motivo del fallo (de la API de WABA)

  -- Payload completo del webhook para debugging. NUNCA exponer en la UI.
  -- Puede contener informaciÃ³n sensible del proveedor.
  metadata        JSONB,

  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_messages IS
  '[PII indirecto] Log conversacional de la cotizaciÃ³n. '
  'El campo body contiene texto del prospecto â€” tratar como PII. '
  'Sin polÃ­tica DELETE. Sin UPDATE (el webhook actualiza delivery_status via service role). '
  'El trigger enforce_prospect_opt_out bloquea outbound si prospect.opt_out=true.';

COMMENT ON COLUMN public.whatsapp_messages.body IS
  '[PII INDIRECTO] Contenido real del mensaje. Puede contener informaciÃ³n personal '
  'del prospecto. No loguear en texto plano. No incluir en mensajes de error.';

COMMENT ON COLUMN public.whatsapp_messages.waba_message_id IS
  'ID externo del mensaje en la API de WhatsApp (Twilio, 360dialog, Meta). '
  'Se usa en el handler del webhook para correlacionar actualizaciones de estado '
  'con el registro local. Ver Ã­ndice idx_waba_messages_external_id.';

COMMENT ON COLUMN public.whatsapp_messages.metadata IS
  'Payload bruto del webhook para debugging. Puede contener tokens o datos del proveedor. '
  'NUNCA exponer en la UI pÃºblica. Usar solo para diagnÃ³stico interno.';


-- =============================================================================
-- SECCIÃ“N 8 â€” TABLA: ai_classifications
-- =============================================================================
--
-- INTENCIÃ“N: resultado del anÃ¡lisis del LLM sobre cada mensaje inbound.
-- Una fila por mensaje clasificado. Inmutable una vez creada.
--
-- REGLA DE NEGOCIO: si confidence < 0.80, el sistema escala siempre al
-- producer, independientemente del valor de classification.
--
-- raw_llm_response: respuesta completa del LLM para debugging.
-- Nunca exponer en la UI. Puede contener texto del prospecto (PII).
--
-- RLS: sin UPDATE ni DELETE.

CREATE TABLE public.ai_classifications (
  id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id         UUID                  NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  quote_id            UUID                  NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,

  -- El mensaje inbound que fue clasificado
  message_id          UUID                  NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE RESTRICT,

  classification      ai_classification     NOT NULL,

  -- Score de confianza del LLM: 0.000 a 1.000.
  -- Si confidence < 0.80 â†’ la aplicaciÃ³n escala al producer sin importar classification.
  confidence          NUMERIC(4, 3)         NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  summary             TEXT                  NOT NULL, -- Resumen en lenguaje natural para el producer
  suggested_action    ai_suggested_action   NOT NULL,
  requires_human      BOOLEAN               NOT NULL, -- true si la aplicaciÃ³n debe escalar

  -- Respuesta completa del LLM para debugging. [PII indirecto si contiene texto del prospecto]
  -- NUNCA exponer en la UI. Solo para diagnÃ³stico interno.
  raw_llm_response    JSONB,

  created_at          TIMESTAMPTZ           NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_classifications IS
  'Resultado del anÃ¡lisis del LLM sobre mensajes inbound. Inmutable â€” sin UPDATE ni DELETE. '
  'Si confidence < 0.80, la aplicaciÃ³n escala al producer independientemente de classification. '
  'raw_llm_response es solo para debugging â€” nunca exponer en UI.';

COMMENT ON COLUMN public.ai_classifications.confidence IS
  'Score 0.000 a 1.000. Umbral crÃ­tico: si < 0.80, requires_human debe ser true '
  'y la aplicaciÃ³n genera un human_handoff. LÃ³gica en capa de aplicaciÃ³n, no en DB.';


-- =============================================================================
-- SECCIÃ“N 9 â€” TABLA: human_handoffs
-- =============================================================================
--
-- INTENCIÃ“N: registra cada derivaciÃ³n al producer humano.
-- Cuando el sistema escala, crea una fila aquÃ­. El producer la resuelve
-- desde el dashboard. Sin polÃ­tica DELETE.
--
-- RLS: acceso filtrado por producer_id.

CREATE TABLE public.human_handoffs (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id       UUID            NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  quote_id          UUID            NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,

  -- Denormalizado de quotes.prospect_id para mostrar el nombre del prospecto
  -- directamente en el dashboard sin JOIN adicional.
  prospect_id       UUID            NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,

  reason            handoff_reason  NOT NULL,

  -- Contexto para el producer: quÃ© dijo el prospecto, quÃ© hizo el sistema,
  -- por quÃ© se escala. Generado por el sistema al crear la derivaciÃ³n.
  summary           TEXT            NOT NULL,

  status            handoff_status  NOT NULL DEFAULT 'pending',
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,           -- Nota del producer al cerrar la derivaciÃ³n

  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.human_handoffs IS
  'Derivaciones al producer humano. El producer las ve y resuelve desde el dashboard. '
  'Sin polÃ­tica DELETE. El campo summary da contexto de quÃ© pasÃ³ y por quÃ© se escala.';


-- =============================================================================
-- SECCIÃ“N 10 â€” TABLA: quote_events (APPEND-ONLY)
-- =============================================================================
--
-- INTENCIÃ“N: audit log completo e inmutable de todo lo que le ocurre a una
-- cotizaciÃ³n. Es la fuente de verdad histÃ³rica del sistema.
--
-- APPEND-ONLY: las polÃ­ticas RLS solo permiten SELECT e INSERT.
-- No existen polÃ­ticas UPDATE ni DELETE. Postgres las deniega por defecto
-- cuando RLS estÃ¡ habilitado y no hay polÃ­tica permisiva para esa operaciÃ³n.
--
-- Los eventos de sistema (actor='system') y webhook (actor='webhook') los
-- inserta el service role desde la aplicaciÃ³n. Ver DECISION-003 Â§6.
--
-- PRIVACIDAD: el campo description puede contener texto generado que
-- referencia datos del prospecto. No loguear en texto plano.

CREATE TABLE public.quote_events (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id     UUID              NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  quote_id        UUID              NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,

  event_type      TEXT              NOT NULL, -- Ver lista en DATA_MODEL.md Â§quote_events
  previous_status quote_status,              -- Estado de la cotizaciÃ³n ANTES del evento
  new_status      quote_status,              -- Estado de la cotizaciÃ³n DESPUÃ‰S del evento
  actor           quote_event_actor NOT NULL,

  -- DescripciÃ³n legible del evento para el audit trail.
  -- Puede referenciar nombre o telÃ©fono del prospecto â€” tratar con cuidado.
  description     TEXT,

  -- Solo INSERT. Sin updated_at porque esta tabla es inmutable.
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quote_events IS
  'Audit log append-only de todo lo ocurrido a una cotizaciÃ³n. INMUTABLE. '
  'Solo polÃ­ticas SELECT e INSERT. Sin UPDATE ni DELETE por diseÃ±o. '
  'Actor ''system'' y ''webhook'' usan service role â€” ver DECISION-003 Â§6.';

COMMENT ON COLUMN public.quote_events.event_type IS
  'Valores documentados en DATA_MODEL.md Â§quote_events. '
  'Ejemplos: quote_created, message_sent, prospect_replied, opt_out_received. '
  'Usar TEXT en lugar de ENUM para permitir nuevos tipos sin migraciones.';


-- =============================================================================
-- SECCIÃ“N 11 â€” TABLA: approved_responses
-- =============================================================================
--
-- INTENCIÃ“N: banco de respuestas predefinidas del producer para que la IA
-- pueda responder sin escalar. El sistema hace matching por keywords; si hay
-- coincidencia con confianza suficiente, responde con response_text exacto.
-- La IA no genera texto para estas respuestas â€” usa el texto fijo del producer.
--
-- RLS: el producer puede hacer SELECT, INSERT, UPDATE y DELETE de sus propias
-- respuestas (Ãºnica tabla donde DELETE estÃ¡ permitido para usuarios normales).

CREATE TABLE public.approved_responses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id       UUID        NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,

  example_question  TEXT        NOT NULL, -- Ejemplo de la pregunta del prospecto
  keywords          TEXT[]      NOT NULL DEFAULT '{}', -- Palabras clave para matching

  -- Texto exacto que la IA enviarÃ¡ al prospecto. No es generado por el LLM.
  -- El producer lo definiÃ³ y aprobÃ³ explÃ­citamente.
  response_text     TEXT        NOT NULL,

  is_active         BOOLEAN     NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.approved_responses IS
  'Respuestas predefinidas por el producer para que la IA responda sin escalar. '
  'response_text es texto fijo aprobado por el producer â€” no generado por LLM. '
  'Ãšnica tabla de negocio con polÃ­tica DELETE para usuarios normales.';

COMMENT ON COLUMN public.approved_responses.response_text IS
  'Texto exacto que el sistema enviarÃ¡ al prospecto. El producer lo definiÃ³ y aprobÃ³. '
  'La IA no modifica ni parafrasea este texto: lo envÃ­a tal cual.';


-- =============================================================================
-- SECCIÃ“N 12 â€” TRIGGER: auto-crear profile al registrar usuario
-- =============================================================================
--
-- INTENCIÃ“N: cuando Supabase Auth crea un nuevo registro en auth.users,
-- este trigger crea automÃ¡ticamente la fila correspondiente en public.profiles.
-- Garantiza que la relaciÃ³n 1:1 se mantenga sin intervenciÃ³n de la aplicaciÃ³n.
--
-- SEGURIDAD: SECURITY DEFINER con search_path fijo para evitar ataques de
-- path hijacking. Ver DECISION-003 Â§2 y CODING_RULES.md Â§5.
--
-- FLUJO:
--   1. Supabase Auth hace INSERT en auth.users.
--   2. El trigger on_auth_user_created dispara esta funciÃ³n.
--   3. Se inserta una fila en public.profiles con el mismo UUID y el nombre
--      extraÃ­do de raw_user_meta_data (si fue provisto en el signup).
--
-- SALIDA: TRIGGER (retorna NEW sin modificarlo)
-- ERRORES: si la inserciÃ³n falla, el INSERT en auth.users hace rollback.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path fijo: previene que un atacante cree objetos en otros schemas
-- que esta funciÃ³n (con privilegios elevados) pueda ejecutar inadvertidamente.
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name)
  VALUES (
    NEW.id,
    -- raw_user_meta_data puede contener full_name si el cliente lo enviÃ³ en signup.
    -- COALESCE garantiza que nunca se inserte NULL donde no corresponde.
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      ''
    )
  );
  RETURN NEW;
END;
$$;

-- El trigger se crea en auth.users (schema gestionado por Supabase).
-- Supabase permite triggers en auth.users desde migraciones de usuario.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- SECCIÃ“N 13 â€” FUNCIÃ“N: get_my_producer_ids()
-- =============================================================================
--
-- INTENCIÃ“N: fuente Ãºnica de verdad para determinar a quÃ© producers tiene
-- acceso el usuario autenticado actualmente. Todas las polÃ­ticas RLS de tablas
-- de negocio llaman a esta funciÃ³n. La lÃ³gica de membresÃ­a no se repite.
--
-- ENTRADAS: ninguna (usa auth.uid() internamente para identificar al usuario)
--
-- SALIDAS: SETOF UUID â€” el conjunto de producer_id accesibles para auth.uid()
--
-- SEGURIDAD CRÃTICA:
--   SECURITY DEFINER: la funciÃ³n corre con los privilegios del owner de la
--   funciÃ³n (generalmente el role que crea el schema), no del usuario que la llama.
--   Esto es necesario porque los usuarios no tienen acceso directo a toda la
--   tabla producer_members â€” solo pueden leer sus propias filas. La funciÃ³n
--   lee la tabla con privilegios elevados pero devuelve solo los producer_id
--   del usuario que la invoca.
--
--   SET search_path = public, pg_temp: OBLIGATORIO en funciones SECURITY DEFINER.
--   Sin esto, un atacante con permisos de CREATE podrÃ­a crear un schema con
--   el mismo nombre de tabla y "secuestrar" la ejecuciÃ³n de la funciÃ³n.
--
--   Referencias schema-qualified: se usa public.producer_members (no solo
--   producer_members) para que el search_path fijo sea efectivo.
--
--   STABLE: la funciÃ³n no modifica datos y su resultado es constante dentro
--   de una transacciÃ³n. Permite al planner de PostgreSQL cachear el resultado
--   cuando se llama mÃºltiples veces en la misma query.
--
-- PATRÃ“N DE USO EN POLÃTICAS RLS:
--   USING (producer_id IN (SELECT public.get_my_producer_ids()))

CREATE OR REPLACE FUNCTION public.get_my_producer_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  -- Devuelve todos los producer_id donde el usuario actual (auth.uid())
  -- tiene una membresÃ­a activa. Filtra is_active=true para excluir
  -- membresÃ­as suspendidas o invitaciones no aceptadas.
  SELECT producer_id
  FROM public.producer_members
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

COMMENT ON FUNCTION public.get_my_producer_ids() IS
  'Fuente Ãºnica de verdad para RLS. Devuelve los producer_id accesibles para auth.uid(). '
  'SECURITY DEFINER con search_path fijo. Llamar siempre con schema-qualified: '
  'public.get_my_producer_ids(). Ver DECISION-003 Â§3.';


-- =============================================================================
-- SECCIÃ“N 14 â€” TRIGGER: enforce_prospect_opt_out en whatsapp_messages
-- =============================================================================
--
-- INTENCIÃ“N: segunda barrera de protecciÃ³n del opt-out (la primera es la
-- validaciÃ³n en capa de aplicaciÃ³n). Si un bug en la aplicaciÃ³n intenta enviar
-- un mensaje outbound a un prospecto con opt_out=true, este trigger lo bloquea
-- a nivel de base de datos y lanza una excepciÃ³n.
--
-- Solo bloquea mensajes 'outbound'. Los mensajes 'inbound' (del prospecto al
-- sistema) siempre se registran independientemente del opt-out.
--
-- FLUJO:
--   1. La aplicaciÃ³n hace INSERT en whatsapp_messages.
--   2. El trigger se ejecuta BEFORE INSERT.
--   3. Si direction='outbound' Y prospect.opt_out=true â†’ RAISE EXCEPTION.
--   4. Si direction='inbound' O prospect.opt_out=false â†’ RETURN NEW (permite insert).
--
-- ENTRADAS: NEW (fila siendo insertada en whatsapp_messages)
-- SALIDAS: NEW (si se permite el INSERT) o excepciÃ³n (si se bloquea)
-- ERRORES: SQLSTATE P0001 con mensaje descriptivo que incluye prospect_id
--          (nunca el nÃºmero de telÃ©fono para no exponer PII en logs de error)

CREATE OR REPLACE FUNCTION public.check_prospect_opt_out()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_opt_out BOOLEAN;
BEGIN
  -- Solo verificar para mensajes salientes (sistema â†’ prospecto).
  -- Los mensajes entrantes (prospecto â†’ sistema) siempre se registran.
  IF NEW.direction = 'outbound' THEN

    SELECT opt_out
    INTO v_opt_out
    FROM public.prospects
    WHERE id = NEW.prospect_id;

    IF v_opt_out IS TRUE THEN
      -- SEGURIDAD: se incluye prospect_id (UUID) pero NO el nÃºmero de telÃ©fono
      -- para evitar exponer PII en mensajes de error y logs de la aplicaciÃ³n.
      RAISE EXCEPTION
        'Opt-out violation: cannot send outbound message to opted-out prospect (prospect_id: %)',
        NEW.prospect_id
        USING ERRCODE = 'P0001';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_prospect_opt_out
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_prospect_opt_out();

COMMENT ON FUNCTION public.check_prospect_opt_out() IS
  'Segunda barrera de opt-out. Bloquea INSERTs outbound a prospectos con opt_out=true. '
  'La primera barrera es la validaciÃ³n en capa de aplicaciÃ³n. '
  'El error incluye prospect_id pero NO el telÃ©fono (PII). Ver DECISION-003 Â§7.';


-- =============================================================================
-- SECCIÃ“N 15 â€” HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================================================
--
-- INTENCIÃ“N: activar Row Level Security en todas las tablas de negocio y de
-- identidad. Sin esta instrucciÃ³n, las polÃ­ticas creadas en la SecciÃ³n 16
-- no tienen efecto.
--
-- IMPORTANTE: habilitar RLS por sÃ­ solo no bloquea el service role.
-- El service role de Supabase bypasea RLS por defecto (diseÃ±o de Supabase).
-- Esto es correcto e intencional para el webhook handler y el cron job.
-- Ver DECISION-003 Â§6 para cuidados de seguridad del service role.

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_handoffs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_responses ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECCIÃ“N 16 â€” POLÃTICAS RLS
-- =============================================================================
--
-- CONVENCIÃ“N:
--   - El nombre de la polÃ­tica sigue el patrÃ³n: "{tabla}_{operaciÃ³n}_{scope}"
--   - Todas las tablas de negocio usan get_my_producer_ids() para filtrar acceso.
--   - La ausencia de polÃ­tica para una operaciÃ³n = DENY por defecto (con RLS habilitado).
--   - quote_events NO tiene polÃ­ticas UPDATE ni DELETE â€” append-only por diseÃ±o.
--   - prospects NO tiene polÃ­tica DELETE â€” soft delete via archived_at.
--
-- SERVICE ROLE:
--   El service role de Supabase bypasea RLS. El webhook handler y el cron job
--   usan service role y son responsables de filtrar por producer_id en sus queries.


-- â”€â”€ profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Cada usuario solo puede leer su propio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Cada usuario solo puede actualizar su propio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- INSERT: manejado por el trigger handle_new_user (SECURITY DEFINER).
-- Los usuarios no insertan directamente en profiles.


-- â”€â”€ producers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- El usuario puede ver los producers donde tiene membresÃ­a activa
CREATE POLICY "producers_select_member"
  ON public.producers FOR SELECT
  USING (id IN (SELECT public.get_my_producer_ids()));

-- El usuario puede actualizar los datos del producer donde tiene membresÃ­a activa.
-- En el MVP solo hay un owner por producer, asÃ­ que cualquier miembro activo puede.
-- En versiones con roles, restringir a owner/admin en la capa de aplicaciÃ³n.
CREATE POLICY "producers_update_member"
  ON public.producers FOR UPDATE
  USING (id IN (SELECT public.get_my_producer_ids()));

-- INSERT de producers: solo service role (onboarding asistido, sin autoservicio en MVP).


-- â”€â”€ producer_members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- El usuario solo puede ver sus propias membresÃ­as
CREATE POLICY "producer_members_select_own"
  ON public.producer_members FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE de membresÃ­as: solo service role (proceso de invitaciÃ³n no existe en MVP).


-- â”€â”€ prospects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "prospects_select"
  ON public.prospects FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "prospects_insert"
  ON public.prospects FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "prospects_update"
  ON public.prospects FOR UPDATE
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- Sin polÃ­tica DELETE: soft delete via archived_at. Ver SecciÃ³n 5.


-- â”€â”€ quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "quotes_select"
  ON public.quotes FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "quotes_insert"
  ON public.quotes FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "quotes_update"
  ON public.quotes FOR UPDATE
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- Sin polÃ­tica DELETE: usar status='cancelled'. Ver SecciÃ³n 6.


-- â”€â”€ whatsapp_messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "whatsapp_messages_select"
  ON public.whatsapp_messages FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "whatsapp_messages_insert"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

-- UPDATE: solo para actualizar delivery_status desde el webhook.
-- En producciÃ³n, esto lo hace el service role (bypasea RLS).
-- Esta polÃ­tica cubre el caso de que la aplicaciÃ³n actualice el estado en nombre
-- del producer desde el dashboard (ej: marcar como fallido manualmente).
CREATE POLICY "whatsapp_messages_update"
  ON public.whatsapp_messages FOR UPDATE
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- Sin polÃ­tica DELETE.


-- â”€â”€ ai_classifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "ai_classifications_select"
  ON public.ai_classifications FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- INSERT: en producciÃ³n lo hace el service role desde el webhook handler.
-- Esta polÃ­tica permite que la aplicaciÃ³n inserte en nombre del producer
-- si fuera necesario.
CREATE POLICY "ai_classifications_insert"
  ON public.ai_classifications FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

-- Sin polÃ­tica UPDATE ni DELETE: inmutable por diseÃ±o.


-- â”€â”€ human_handoffs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "human_handoffs_select"
  ON public.human_handoffs FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "human_handoffs_insert"
  ON public.human_handoffs FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

-- UPDATE: el producer actualiza el status cuando resuelve la derivaciÃ³n
CREATE POLICY "human_handoffs_update"
  ON public.human_handoffs FOR UPDATE
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- Sin polÃ­tica DELETE.


-- â”€â”€ quote_events (APPEND-ONLY) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--
-- La ausencia de polÃ­ticas UPDATE y DELETE hace que Postgres las deniegue
-- automÃ¡ticamente cuando RLS estÃ¡ habilitado. Esto garantiza la inmutabilidad
-- del audit log sin necesidad de cÃ³digo adicional.

CREATE POLICY "quote_events_select"
  ON public.quote_events FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- INSERT: la aplicaciÃ³n y el service role pueden insertar eventos.
-- El service role inserta eventos con actor='system' y actor='webhook'.
CREATE POLICY "quote_events_insert"
  ON public.quote_events FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

-- SIN polÃ­tica UPDATE ni DELETE â€” append-only por diseÃ±o de auditorÃ­a.


-- â”€â”€ approved_responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "approved_responses_select"
  ON public.approved_responses FOR SELECT
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "approved_responses_insert"
  ON public.approved_responses FOR INSERT
  WITH CHECK (producer_id IN (SELECT public.get_my_producer_ids()));

CREATE POLICY "approved_responses_update"
  ON public.approved_responses FOR UPDATE
  USING (producer_id IN (SELECT public.get_my_producer_ids()));

-- DELETE: permitido â€” el producer puede eliminar sus propias respuestas aprobadas.
-- Es la Ãºnica tabla de negocio con polÃ­tica DELETE para usuarios normales.
CREATE POLICY "approved_responses_delete"
  ON public.approved_responses FOR DELETE
  USING (producer_id IN (SELECT public.get_my_producer_ids()));


-- =============================================================================
-- SECCIÃ“N 17 â€” ÃNDICES
-- =============================================================================
--
-- INTENCIÃ“N: cubrir los patrones de acceso crÃ­ticos identificados en
-- docs/05-architecture/DATA_MODEL.md Â§Ãndices recomendados.
-- Solo se crean los Ã­ndices necesarios para el MVP. MÃ¡s Ã­ndices = mÃ¡s overhead
-- en escrituras. Agregar nuevos Ã­ndices cuando los query plans lo justifiquen.


-- Cron job de seguimiento: detecta cotizaciones elegibles para activar.
-- Filtra por status relevantes y producer_id para escanear solo filas activas.
CREATE INDEX idx_quotes_followup
  ON public.quotes (producer_id, status, follow_up_start_at)
  WHERE status IN ('pending_follow_up', 'scheduled');

-- Webhook de WhatsApp: recibe el ID externo (waba_message_id) y debe
-- encontrar la fila local en O(log n). Solo indexa filas donde el ID existe.
CREATE INDEX idx_waba_messages_external_id
  ON public.whatsapp_messages (waba_message_id)
  WHERE waba_message_id IS NOT NULL;

-- Webhook de WhatsApp: recibe el nÃºmero de telÃ©fono del prospecto y necesita
-- encontrar el prospect_id para correlacionar con la cotizaciÃ³n activa.
-- El filtro archived_at IS NULL excluye prospectos archivados del Ã­ndice.
CREATE INDEX idx_prospects_phone
  ON public.prospects (producer_id, phone)
  WHERE archived_at IS NULL;

-- Dashboard del producer: muestra derivaciones pendientes al top de la lista.
-- El filtro parcial hace el Ã­ndice mucho mÃ¡s pequeÃ±o (solo filas pending).
CREATE INDEX idx_human_handoffs_pending
  ON public.human_handoffs (producer_id, status, created_at)
  WHERE status = 'pending';

-- Audit trail: historial cronolÃ³gico de una cotizaciÃ³n.
-- Usado al mostrar el detalle de una cotizaciÃ³n en el dashboard.
CREATE INDEX idx_quote_events_quote
  ON public.quote_events (quote_id, created_at);

-- RLS performance: get_my_producer_ids() hace un scan de producer_members
-- por user_id con is_active=true. Este Ã­ndice lo hace O(log n).
CREATE INDEX idx_producer_members_user_active
  ON public.producer_members (user_id)
  WHERE is_active = true;

-- Dashboard: cotizaciones por producer y estado (para filtros y conteos).
CREATE INDEX idx_quotes_producer_status
  ON public.quotes (producer_id, status, created_at DESC);
