# Supabase — SeguroFlow AI

Este directorio contiene las migraciones de base de datos de SeguroFlow AI.
La base de datos es PostgreSQL gestionada por Supabase.

---

## Estructura

```
supabase/
└── migrations/
    └── 001_base_multitenant_schema.sql   ← esta migración
```

---

## Migración 001 — `001_base_multitenant_schema.sql`

### Qué contiene

| Sección | Descripción |
|---|---|
| Tipos ENUM | 15 tipos para estados, roles, clasificaciones y proveedores |
| `profiles` | Perfil extendido del usuario. Relación 1:1 con `auth.users`. |
| `producers` | La organización comercial (el tenant). Su `id` es el `producer_id` de todo el sistema. |
| `producer_members` | Tabla puente: qué usuarios pertenecen a qué producer y con qué rol. |
| `prospects` | Prospectos con datos PII. Soft delete via `archived_at`. |
| `quotes` | Cotizaciones en seguimiento. Objeto central del sistema. |
| `whatsapp_messages` | Log conversacional. Trigger de opt-out activo. |
| `ai_classifications` | Resultados del LLM. Inmutable (sin UPDATE ni DELETE). |
| `human_handoffs` | Derivaciones al producer humano. |
| `quote_events` | Audit log append-only. Sin UPDATE ni DELETE por diseño. |
| `approved_responses` | Respuestas predefinidas por el producer. |
| `handle_new_user()` | Trigger: crea `profiles` automáticamente al registrar un usuario en `auth.users`. |
| `get_my_producer_ids()` | Función SECURITY DEFINER: fuente única de verdad para RLS. |
| `check_prospect_opt_out()` | Trigger: bloquea mensajes outbound a prospectos con opt-out. |
| RLS habilitado | En las 10 tablas. Políticas mínimas: SELECT, INSERT, UPDATE según tabla. |
| Índices | 7 índices de rendimiento para los patrones de acceso del MVP. |

### Qué NO contiene

- Datos de seed ni fixtures de prueba.
- Configuración de WhatsApp, Twilio ni ningún proveedor externo.
- Lógica de negocio de la aplicación (eso vive en Next.js).
- API keys, secretos ni valores reales de ningún tipo.
- Configuración de Storage, Realtime ni Edge Functions.
- Rol `super_admin` de SeguroFlow AI (administrador de todos los tenants).
- Proceso de invitación de miembros (post-MVP).

---

## Principio de diseño central

```
producer_id  ≠  auth.uid()
```

Los usuarios y los tenants son entidades distintas. Ver [DECISION-003](../docs/04-decisiones/DECISION-003-multitenant-rls.md).

Todo acceso a tablas de negocio pasa por:
```sql
USING (producer_id IN (SELECT public.get_my_producer_ids()))
```

El service role (webhook, cron) bypasea RLS por diseño de Supabase. Es correcto e intencional.
Cualquier operación del service role debe quedar registrada con `actor = 'system'` en `quote_events`.

---

## Cómo revisar antes de aplicar

Pasos recomendados antes de ejecutar contra cualquier entorno:

1. **Leer la migración completa.** Cada tabla tiene comentarios que explican intención, seguridad y decisiones de diseño.
2. **Verificar que los ENUMs son correctos.** Una vez creados, eliminar valores requiere migración destructiva.
3. **Confirmar que el trigger `on_auth_user_created` tiene acceso a `auth.users`.** En Supabase cloud sí. En self-host puede requerir permisos adicionales.
4. **Confirmar que `get_my_producer_ids()` usa referencias schema-qualified** (`public.producer_members`, no `producer_members`). Están en la migración, verificar que no se modificaron.

---

## Seguridad de entorno remoto (Remote Safety)

> Leer antes de ejecutar cualquier comando que no sea `db reset`.

### Proyecto autorizado

| Campo | Valor |
|---|---|
| Nombre | seguroflow-ai |
| Project ref | `fawlbfkkxufyhnghynjk` |

### Proyecto PROHIBIDO desde este repo

**TuHoroscopoCosmico.com** — proyecto Supabase distinto en la misma cuenta.
Ningun comando de este repo debe ejecutarse contra ese proyecto.

### db reset vs db push

| Comando | Entorno | Permitido |
|---|---|---|
| `supabase db reset` | Local (Docker) | Si — validacion local, sin riesgo |
| `supabase db push` | Remoto (nube) | Solo con confirmacion humana + project-ref verificado |

### Verificacion obligatoria antes de db push

```bash
# 1. Verificar que el project-ref activo es el correcto
cat supabase/.temp/project-ref
# → debe mostrar exactamente: fawlbfkkxufyhnghynjk

# 2. Ver diff antes de aplicar
npx supabase@2.108.0 db diff --schema public

# 3. Solo si los pasos anteriores son correctos y hay OK humano:
npx supabase@2.108.0 db push
```

Si el project-ref no es `fawlbfkkxufyhnghynjk`: **no ejecutar**. Ver `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`.

---

## Cómo aplicar

### Entorno local (recomendado para desarrollo)

> **`db reset` = local (Docker). `db push` = remoto (nube).**
> `db push` esta PROHIBIDO sin verificar primero que project-ref = `fawlbfkkxufyhnghynjk`.
> El proyecto `TuHoroscopoCosmico.com` esta PROHIBIDO desde este repo.

Requiere Docker Desktop corriendo y Supabase CLI disponible.

```bash
# Iniciar stack local (primera vez o tras reiniciar Docker)
npx supabase@2.108.0 start

# Aplicar migraciones SOLO en local — NO toca el proyecto remoto
npx supabase@2.108.0 db reset
# ↑ Este comando es seguro: opera solo contra Docker local.
# ↑ NO ejecutar supabase db push aqui. db push es remoto.

# O ejecutar directamente en psql local
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/001_base_multitenant_schema.sql
```

### Entorno remoto (staging o produccion)

```bash
# 1. Verificar project-ref antes de linkear
# El project-ref permitido es: fawlbfkkxufyhnghynjk

# Vincular con el proyecto de Supabase correcto
npx supabase@2.108.0 link --project-ref fawlbfkkxufyhnghynjk

# Verificar link activo
cat supabase/.temp/project-ref

# Ver diff antes de aplicar
npx supabase@2.108.0 db diff --schema public

# Aplicar migraciones (solo con confirmacion humana explicita)
npx supabase@2.108.0 db push
```

**No ejecutar contra produccion sin haber validado en local primero.**
**No ejecutar db push sin verificar que project-ref = `fawlbfkkxufyhnghynjk`.**

---

## Checklist antes de aplicar en producción

- [ ] La migración fue revisada y ejecutada en entorno local sin errores.
- [ ] Los ENUMs reflejan exactamente los valores del `DATA_MODEL.md v2.0`.
- [ ] El trigger `enforce_prospect_opt_out` fue probado: intentar insertar un mensaje outbound a un prospecto con `opt_out=true` debe lanzar excepción `P0001`.
- [ ] La función `get_my_producer_ids()` fue probada: un usuario solo ve los producers donde es miembro activo.
- [ ] El trigger `on_auth_user_created` fue probado: al crear un usuario en `auth.users`, se crea automáticamente una fila en `profiles`.
- [ ] Las columnas `waba_config_ref` en `producers` no contienen ninguna API key real.
- [ ] Se verificó que `quote_events` rechaza UPDATE y DELETE (probar con cliente de DB).
- [ ] Se tiene un snapshot (backup) del proyecto Supabase antes de aplicar.

---

## Archivos relacionados

| Archivo | Propósito |
|---|---|
| `docs/05-architecture/DATA_MODEL.md` | Especificación de tablas. Fuente de verdad del esquema. |
| `docs/04-decisiones/DECISION-003-multitenant-rls.md` | Modelo multi-tenant y RLS — decisión de arquitectura base. |
| `docs/00-ai-context/CODING_RULES.md` | Reglas de codificación aplicadas a los comentarios SQL. |

---

## Próximas migraciones previstas

| Migración | Contenido |
|---|---|
| `002_*` | A definir según avance del MVP. Posibles candidatos: índices adicionales tras profiling, campo `max_followup_attempts` en `producers`, campo `model_used` en `ai_classifications`. |

No crear migraciones adicionales hasta que el MVP-01 esté funcionando y se identifiquen necesidades reales.
