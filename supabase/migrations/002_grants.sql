-- =============================================================================
-- MIGRACION 002: Permisos de acceso a tablas (GRANT)
-- Proyecto   : SeguroFlow AI
-- Fecha      : 2026-06-29
-- =============================================================================
--
-- QUE HACE ESTA MIGRACION:
--   Otorga permisos de acceso a tablas, secuencias y funciones del schema public
--   a los roles 'authenticated' y 'anon' de Supabase.
--
-- POR QUE ES NECESARIA (BUG EN MIGRACION 001):
--   La migracion 001 define RLS policies pero no incluye GRANT statements.
--   En versiones recientes del Supabase CLI (>= 2.x), la opcion
--   'auto_expose_new_tables' esta deshabilitada por defecto. Sin GRANTs
--   explicitos, el role 'authenticated' no puede ejecutar SELECT, INSERT,
--   UPDATE ni DELETE en las tablas — solo tiene REFERENCES, TRIGGER y TRUNCATE.
--   Resultado: PostgREST retorna 'permission denied for table ...' y el
--   dashboard no puede consultar producer_members ni producers.
--
-- RELACION CON RLS:
--   Los GRANTs otorgan la CAPACIDAD de realizar operaciones sobre las tablas.
--   Las politicas RLS (migracion 001, Seccion 16) determinan QUE FILAS puede
--   ver o modificar cada usuario. Ambas capas son necesarias:
--     - Sin GRANT: el usuario no puede hacer la operacion (error de permiso).
--     - Sin RLS:   el usuario podria ver filas de otros tenants.
--   Las dos capas se complementan — no se reemplazan.
--
-- POR QUE 'anon' RECIBE USAGE/EXECUTE PERO NO DML:
--   El role 'anon' corresponde a requests sin JWT valido. Nuestra aplicacion
--   requiere autenticacion para todo acceso a datos. No otorgamos SELECT ni
--   DML a 'anon' sobre tablas de negocio — solo USAGE en el schema y EXECUTE
--   en funciones publicas (ej: get_my_producer_ids — aunque solo retorna datos
--   utiles si hay una sesion activa).
--
-- APLICACION:
--   Local:      supabase db reset (aplica automaticamente)
--   Produccion: supabase db push (cuando el proyecto remoto este configurado)
--               REQUIERE confirmacion humana y verificacion de project-ref.
--               Ver: docs/00-ai-context/SUPABASE_SAFETY_RULES.md
--
-- Ver: supabase/migrations/001_base_multitenant_schema.sql (RLS policies)
-- Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md
-- =============================================================================


-- =============================================================================
-- SECCION 1 - GRANT DE SCHEMA
-- =============================================================================
--
-- Permite a authenticated y anon usar el schema public (necesario para acceder
-- a objetos dentro del schema). Sin USAGE en el schema, los GRANTs en tablas
-- individuales no tienen efecto.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;


-- =============================================================================
-- SECCION 2 - GRANT EN TABLAS PARA 'authenticated'
-- =============================================================================
--
-- El role 'authenticated' corresponde a usuarios con JWT valido (sesion activa).
-- Las RLS policies de la migracion 001 filtran que filas puede ver cada usuario.
-- Estos GRANTs solo habilitan la CAPACIDAD tecnica de realizar las operaciones.
--
-- DELETE: se otorga en todas las tablas aunque la mayoria no tenga politica DELETE.
-- La ausencia de politica DELETE + RLS habilitado equivale a DENY. El GRANT no
-- cambia esto — es inerte si no hay politica que lo permita.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.profiles
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.producers
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.producer_members
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.prospects
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.quotes
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.whatsapp_messages
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ai_classifications
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.human_handoffs
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.quote_events
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.approved_responses
  TO authenticated;


-- =============================================================================
-- SECCION 3 - GRANT EN FUNCIONES PARA 'authenticated'
-- =============================================================================
--
-- get_my_producer_ids() es SECURITY DEFINER y la llaman las politicas RLS.
-- Las politicas se evaluan como el usuario que hace la query, por lo que el
-- role 'authenticated' debe poder ejecutar la funcion.
-- Sin EXECUTE, PostgreSQL rechaza la llamada aunque la funcion sea SECURITY DEFINER.

GRANT EXECUTE ON FUNCTION public.get_my_producer_ids() TO authenticated;


-- =============================================================================
-- SECCION 4 - GRANT PARA 'anon' (minimo necesario)
-- =============================================================================
--
-- 'anon' = requests sin JWT. La app requiere autenticacion para todo acceso
-- a datos de negocio. No otorgamos DML sobre tablas a 'anon'.
--
-- Solo otorgamos EXECUTE en get_my_producer_ids() por completitud, aunque
-- la funcion devuelve un set vacio sin sesion activa (auth.uid() = NULL).

GRANT EXECUTE ON FUNCTION public.get_my_producer_ids() TO anon;


-- =============================================================================
-- SECCION 5 - GRANT PARA 'service_role'
-- =============================================================================
--
-- service_role en Supabase bypasea RLS por diseno. Sin embargo, tambien
-- necesita GRANTs explicitos en la capa de PostgREST.
-- Estos GRANTs cubren el webhook handler, el cron job y cualquier operacion
-- del sistema que requiera service role.
--
-- Ver: docs/04-decisiones/DECISION-003-multitenant-rls.md, Seccion 6.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.profiles,
     public.producers,
     public.producer_members,
     public.prospects,
     public.quotes,
     public.whatsapp_messages,
     public.ai_classifications,
     public.human_handoffs,
     public.quote_events,
     public.approved_responses
  TO service_role;

GRANT EXECUTE ON FUNCTION public.get_my_producer_ids() TO service_role;
