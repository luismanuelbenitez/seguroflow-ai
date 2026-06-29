# LOCAL_SEEDING.md — Seed local de datos de desarrollo

> **Este documento es solo para desarrollo local.**
> No aplica a producción. No requiere `supabase db push`.

---

## Por qué necesitamos seed local

El dashboard en `/dashboard` verifica que el usuario autenticado tenga una membresía activa
en `producer_members`. En un entorno local recién inicializado (con `supabase db reset`),
la base de datos está vacía: no hay producers ni membresías.

Sin datos de prueba, el dashboard muestra un estado vacío informativo — comportamiento
correcto, pero que no permite desarrollar ni testear el flujo real del producer.

El seed local crea un **producer ficticio** y lo asocia al usuario autenticado local,
permitiendo que el dashboard muestre datos reales de prueba.

---

## Qué NO es este seed

| Lo que NO hace | Por qué importa |
|---|---|
| No ejecuta `supabase db push` | No toca el proyecto remoto |
| No crea datos de productores reales | Solo datos ficticios de prueba |
| No modifica la migración 001 | El esquema no cambia |
| No es automático | El desarrollador lo ejecuta manualmente cuando lo necesita |
| No aplica en producción | El onboarding en producción tiene su propio flujo |
| No genera membresías para otros usuarios | Solo asocia el usuario autenticado local |

---

## Proyecto remoto — estado prohibido

| Campo | Valor |
|---|---|
| Proyecto permitido | `seguroflow-ai` / ref: `fawlbfkkxufyhnghynjk` |
| Proyecto PROHIBIDO | `TuHoroscopoCosmico.com` — nunca tocar desde este repo |
| `supabase db push` | PROHIBIDO sin confirmación humana explícita + verificación de project-ref |

**Esta tarea es 100% local. No toca el proyecto remoto bajo ninguna circunstancia.**

---

## Cómo funciona el seed local

### Por qué el SQL debe ejecutarse con service role

Las políticas RLS de la migración 001 establecen que:

- `INSERT` en `producers`: solo service role (sin política de INSERT para usuarios regulares).
- `INSERT` en `producer_members`: solo service role.

Esto es correcto en producción: los producers no se crean solos, requieren un proceso de
onboarding asistido. En desarrollo local, el desarrollador actúa como service role
ejecutando el SQL directamente en el entorno local.

### Métodos para ejecutar el SQL con service role local

**Opción A — Supabase Studio (recomendado para desarrollo):**

Supabase Studio corre en `http://localhost:54323` cuando el stack local está activo.
El editor SQL de Studio ejecuta queries con service role por defecto.

```
http://localhost:54323 → SQL Editor → (pegar el contenido de seed.local.example.sql)
```

**Opción B — psql directo:**

```bash
# Requiere Docker corriendo y Supabase local activo
psql postgresql://postgres:postgres@localhost:54322/postgres
```

Y dentro de psql, copiar y pegar el SQL del archivo `supabase/seed.local.example.sql`.

**Opción C — Supabase CLI `db query`:**

```bash
npx supabase@2.108.0 db query --local --file supabase/seed.local.example.sql
```

> Nota: verificar que `npx supabase@2.108.0 db query` esté disponible en la versión
> instalada del CLI. Si no, usar la Opción A o B.

---

## Flujo completo del seed local

```
1. npx supabase@2.108.0 start          → Iniciar stack local (Docker debe estar activo)
2. npm run dev                         → Iniciar app Next.js en localhost:3000
3. /login → magic link → Inbucket     → Autenticarse (http://localhost:54324)
4. /dev/user                           → Obtener el user.id del usuario autenticado
5. Copiar el user.id                   → UUID del usuario autenticado local
6. Editar seed.local.example.sql       → Reemplazar LOCAL_AUTH_USER_ID por el UUID
7. Ejecutar el SQL (Studio o psql)     → Insertar producer demo + membresía
8. /dashboard                          → Verificar que aparece el producer demo
```

---

## El archivo seed

Ver: `supabase/seed.local.example.sql`

- Es un **ejemplo**, no se ejecuta automáticamente.
- Requiere reemplazar `LOCAL_AUTH_USER_ID` con el UUID real del usuario autenticado local.
- Usa `ON CONFLICT ... DO NOTHING` para ser idempotente (se puede ejecutar múltiples veces).
- Inserta un producer con UUID fijo `00000000-0000-0000-0000-000000001001` (fácil de identificar como demo).

---

## Dónde obtener el user_id local

### Opción A — Página /dev/user (recomendado)

La app incluye una página de desarrollo en `http://localhost:3000/dev/user` que muestra
el email y user.id del usuario autenticado. No accesible en producción (devuelve 404).

### Opción B — Supabase Studio

```
http://localhost:54323 → Authentication → Users → (ver el UUID del usuario)
```

### Opción C — SQL en Studio

```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

---

## Qué hace el seed (resumen del SQL)

```sql
-- 1. Inserta un producer ficticio con UUID fijo (fácil de identificar)
INSERT INTO public.producers (id, name, contact_name, plan, status, send_mode, follow_up_hours)
VALUES ('00000000-0000-0000-0000-000000001001', 'Productor Demo Local', ...)
ON CONFLICT (id) DO NOTHING;

-- 2. Asocia el usuario autenticado como owner del producer demo
INSERT INTO public.producer_members (producer_id, user_id, role, is_active, accepted_at)
VALUES ('00000000-0000-0000-0000-000000001001', '<TU_USER_ID>', 'owner', true, now())
ON CONFLICT (producer_id, user_id) DO NOTHING;
```

---

## Limpiar los datos de prueba

Si querés empezar de cero, la forma más sencilla es:

```bash
# Reinicia la DB local y re-aplica la migración 001 (vacía la DB)
npx supabase@2.108.0 db reset
```

Esto elimina todos los datos locales incluyendo el producer demo y el usuario autenticado.
Necesitarás volver a loguearte con magic link y re-ejecutar el seed si querés datos de prueba.

---

## Relación con el flujo de onboarding en producción

El seed local **no** reemplaza el flujo de onboarding en producción. En producción:

- Un administrador crea el producer via un proceso asistido (no autoservicio en el MVP).
- El INSERT en `producers` y `producer_members` lo hace el service role del backend.
- El producer recibe un magic link de invitación para activar su cuenta.
- Ver: `docs/02-mvp/MVP-01-recuperador-cotizaciones.md` para el flujo completo.

El seed local es un atajo solo para desarrollo — no existe en el código de producción.
