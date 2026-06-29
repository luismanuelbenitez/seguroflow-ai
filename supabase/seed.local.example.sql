-- =============================================================================
-- SEED LOCAL DE EJEMPLO — Solo para desarrollo local
-- Archivo   : supabase/seed.local.example.sql
-- Proyecto  : SeguroFlow AI
-- =============================================================================
--
-- ATENCION — LEER ANTES DE EJECUTAR:
--
--   1. Este archivo es un EJEMPLO. No se ejecuta automaticamente.
--      Copiarlo/adaptarlo y ejecutarlo manualmente en el entorno local.
--
--   2. Solo aplica a entorno LOCAL (supabase start / Docker).
--      NUNCA ejecutar contra el proyecto remoto (supabase db push).
--
--   3. Reemplazar LOCAL_AUTH_USER_ID con el UUID real del usuario
--      autenticado en el entorno local. Ver instrucciones mas abajo.
--
--   4. No contiene datos reales. Todos los datos son ficticios.
--
--   5. Por que hay que ejecutarlo como service role:
--      Las politicas RLS de la migracion 001 bloquean INSERT en
--      producers y producer_members para usuarios regulares. Solo el
--      service role puede insertar en estas tablas (diseno intencional
--      del MVP: el onboarding en produccion es asistido, no autoservicio).
--      En entorno local, el SQL editor de Supabase Studio y psql directo
--      corren como service role -> pueden ejecutar este seed.
--
-- COMO EJECUTAR:
--   Opcion A (recomendado): Supabase Studio en http://localhost:54323
--                            -> SQL Editor -> pegar este SQL
--   Opcion B: psql postgresql://postgres:postgres@localhost:54322/postgres
--   Opcion C: npx supabase@2.108.0 db query --local --file supabase/seed.local.example.sql
--
-- COMO OBTENER EL USER_ID:
--   Opcion A (recomendado): http://localhost:3000/dev/user (pagina de desarrollo)
--   Opcion B: Supabase Studio -> Authentication -> Users -> copiar el UUID
--   Opcion C: SQL: SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
--
-- PROYECTO REMOTO PROHIBIDO:
--   Este seed es EXCLUSIVAMENTE para el stack local de Docker.
--   Proyecto remoto permitido: seguroflow-ai / fawlbfkkxufyhnghynjk
--   Proyecto PROHIBIDO: TuHoroscopoCosmico.com
--   supabase db push: PROHIBIDO sin confirmacion humana + verificacion de project-ref.
--
-- Ver: docs/05-architecture/LOCAL_SEEDING.md
-- Ver: docs/00-ai-context/SUPABASE_SAFETY_RULES.md
-- =============================================================================


-- =============================================================================
-- PASO 0 — Verificacion de entorno (opcional pero recomendado)
-- =============================================================================
--
-- Descomentar para confirmar que se esta ejecutando contra el DB local
-- y no contra un proyecto remoto.
--
-- DO $$
-- BEGIN
--   -- En el stack local de Supabase, current_database() es 'postgres'
--   IF current_database() != 'postgres' THEN
--     RAISE EXCEPTION
--       'Este seed solo debe ejecutarse en el entorno local. '
--       'Base de datos actual: %. Abortar.',
--       current_database();
--   END IF;
--   RAISE NOTICE 'Entorno verificado: base de datos local (%).', current_database();
-- END;
-- $$;


-- =============================================================================
-- PASO 1 — Producer ficticio de demo
-- =============================================================================
--
-- UUID fijo: 00000000-0000-0000-0000-000000001001
-- Facil de identificar en la DB como dato de prueba.
-- ON CONFLICT (id) DO NOTHING: idempotente, se puede ejecutar multiples veces.
--
-- Valores de ENUMs (definidos en migracion 001):
--   producer_status: 'active' | 'inactive' | 'suspended'
--   producer_plan  : 'pilot' | 'starter' | 'pro' | 'enterprise'
--   send_mode      : 'manual' | 'automatic'

INSERT INTO public.producers (
  id,
  name,
  contact_name,
  plan,
  status,
  send_mode,
  follow_up_hours,
  waba_number,
  waba_provider,
  waba_config_ref,
  message_signature
)
VALUES (
  '00000000-0000-0000-0000-000000001001',
  'Productor Demo Local',
  'Demo Desarrollador',
  'pilot',        -- producer_plan: etapa de piloto gratuito
  'active',       -- producer_status: activo
  'manual',       -- send_mode: mensajes requieren aprobacion del producer
  48,             -- follow_up_hours: esperar 48h antes de activar seguimiento
  NULL,           -- waba_number: NULL = sin WhatsApp configurado (solo demo local)
  NULL,           -- waba_provider: NULL = sin proveedor WABA configurado
  NULL,           -- waba_config_ref: NULL = sin referencia a secreto de API
  'Demo Local - SeguroFlow AI'  -- message_signature
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- PASO 2 — Membresia del usuario autenticado como owner del producer demo
-- =============================================================================
--
-- REEMPLAZAR LOCAL_AUTH_USER_ID con el UUID real del usuario autenticado local.
--
-- Ejemplo de UUID valido: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- Obtener en: http://localhost:3000/dev/user
--             O: Supabase Studio -> Authentication -> Users
--             O: SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1;
--
-- Valores de ENUMs (definidos en migracion 001):
--   member_role: 'owner' | 'admin' | 'agent' | 'viewer'
--
-- ON CONFLICT: usa el unique constraint producer_members_unique_membership
--   que garantiza (producer_id, user_id) unico. Seguro si se ejecuta dos veces.

INSERT INTO public.producer_members (
  producer_id,
  user_id,
  role,
  is_active,
  invited_at,
  accepted_at
)
VALUES (
  '00000000-0000-0000-0000-000000001001',  -- producer_id del demo de arriba
  'LOCAL_AUTH_USER_ID',                     -- REEMPLAZAR con tu UUID de auth.users
  'owner',                                  -- member_role: control total
  true,                                     -- is_active: membresia activa
  now(),                                    -- invited_at: ahora (MVP: sin flujo de invitacion)
  now()                                     -- accepted_at: aceptado inmediatamente
)
ON CONFLICT (producer_id, user_id) DO NOTHING;


-- =============================================================================
-- VERIFICACION — Confirmar que el seed se aplicó correctamente
-- =============================================================================
--
-- Ejecutar despues del seed para confirmar:

-- Ver el producer creado:
SELECT id, name, status, plan, send_mode
FROM public.producers
WHERE id = '00000000-0000-0000-0000-000000001001';

-- Ver la membresia creada (reemplazar LOCAL_AUTH_USER_ID):
SELECT pm.id, pm.user_id, pm.role, pm.is_active, p.name AS producer_name
FROM public.producer_members pm
JOIN public.producers p ON p.id = pm.producer_id
WHERE pm.producer_id = '00000000-0000-0000-0000-000000001001';
