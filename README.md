# SeguroFlow AI

Plataforma de IA operativa y comercial para productores, corredores y aseguradoras.

## MVP inicial

Recuperador automático de cotizaciones no cerradas por WhatsApp.

## Visión

Ser una capa de IA operativa/comercial para el mercado asegurador uruguayo y regional.

## Estado

Auth basico implementado: magic link con Supabase Auth.
Login → /auth/callback → /dashboard protegido con getUser().
Proximo paso: dashboard funcional del producer (quotes, prospects).

---

## Estructura del proyecto

```
seguroflow-ai/
  app/                        # Next.js App Router (paginas y layouts)
  components/                 # Componentes React reutilizables (pendiente)
  lib/
    supabase/
      client.ts               # Cliente Supabase para el browser (publishable key)
      server.ts               # Cliente Supabase server-side con cookies SSR
    ai/
      adapters/               # Adapters para proveedores LLM (Claude, etc.)
    whatsapp/
      adapters/               # Adapters para proveedores WABA (Twilio, 360dialog)
  server/                     # Servicios server-side, webhooks, jobs
  types/                      # Tipos TypeScript compartidos
  docs/                       # Documentacion del proyecto
    00-ai-context/            # Reglas para IAs y estado del proyecto
    02-mvp/                   # Specs funcionales del MVP
    04-decisiones/            # Decisiones de arquitectura (DECISION-XXX)
    05-architecture/          # Modelo de datos
  supabase/
    migrations/               # Migraciones SQL de Supabase
      001_base_multitenant_schema.sql
    README.md                 # Instrucciones para aplicar migraciones
  public/                     # Assets estaticos
```

## Primeros pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Completar .env.local con los valores reales (nunca commitear .env.local)

# 3. Validar la migracion en entorno local (requiere Docker Desktop)
# Requiere Supabase CLI: npx supabase@2.108.0 [comando]
npx supabase@2.108.0 start
npx supabase@2.108.0 db reset   # Aplica migraciones localmente (NO a produccion)

# 4. Iniciar servidor de desarrollo
npm run dev
```

## Probar Auth localmente

Requiere Supabase local corriendo (`npx supabase@2.108.0 start`) y Docker Desktop activo.

```bash
# 1. Obtener las keys del Supabase local
npx supabase@2.108.0 status
# → copia "API URL" como NEXT_PUBLIC_SUPABASE_URL
# → copia "anon key" como NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# 2. Configurar .env.local (no commitear)
cp .env.example .env.local
# Completar:
#   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key de supabase status>
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 3. Iniciar la app
npm run dev

# 4. Ir a http://localhost:3000/login e ingresar un email

# 5. Ver el email con el magic link en Inbucket (email local de Supabase)
#    http://localhost:54324

# 6. Hacer click en el link del email → redirige a /dashboard
```

**Variables requeridas para Auth:**

| Variable | Descripcion | Local |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `http://localhost:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key (safe para cliente) | ver `supabase status` |
| `NEXT_PUBLIC_SITE_URL` | URL base de la app (para callback del magic link) | `http://localhost:3000` |

**Nota:** Auth usa el Supabase local (Docker) o el remoto segun `NEXT_PUBLIC_SUPABASE_URL`.
No aplica migraciones. No ejecuta `supabase db push`.

---

## Dashboard local

El dashboard en `/dashboard` requiere sesion activa (login previo).

- Verifica que el usuario tiene una membresia activa en `producer_members`.
- Si no hay datos de prueba locales, muestra un estado vacio informativo — es comportamiento esperado.
- No consulta ni crea datos reales.
- No requiere migracion remota (`supabase db push`).
- Los emails del magic link se capturan en Inbucket local: `http://localhost:54324`

**Flujo local completo:**
```
/login → (magic link en Inbucket) → /auth/callback → /dashboard
```

---

## Seed local de producer demo

El dashboard en `/dashboard` requiere que el usuario tenga una membresía activa en
`producer_members`. Tras un `supabase db reset`, la base de datos está vacía y el
dashboard muestra un estado vacío informativo.

Para ver el dashboard con datos de prueba, hay que crear un producer ficticio y
asociarlo al usuario autenticado local.

**Flujo completo:**

```bash
# 1. Iniciar Supabase local y la app
npx supabase@2.108.0 start
npm run dev

# 2. Loguearse con magic link
#    Ir a http://localhost:3000/login → ingresar email → ver link en Inbucket (http://localhost:54324)

# 3. Obtener el user_id del usuario autenticado
#    Ir a http://localhost:3000/dev/user → copiar el UUID que aparece como "user.id"

# 4. Copiar el archivo de ejemplo y reemplazar el placeholder
cp supabase/seed.local.example.sql /tmp/seed.local.sql
# Editar /tmp/seed.local.sql: reemplazar LOCAL_AUTH_USER_ID por el UUID del paso 3

# 5. Ejecutar el SQL como service role (usar Supabase Studio local)
#    Ir a http://localhost:54323 → SQL Editor → pegar el contenido del SQL → Run

# 6. Volver al dashboard y verificar
#    Ir a http://localhost:3000/dashboard → debe aparecer "Productor Demo Local"
```

**Métodos para ejecutar el SQL:**

| Método | Comando / URL |
|---|---|
| Supabase Studio (recomendado) | `http://localhost:54323` → SQL Editor |
| psql directo | `psql postgresql://postgres:postgres@localhost:54322/postgres` |
| CLI Supabase | `npx supabase@2.108.0 db query --local --file <archivo>` |

**Notas importantes:**

- El seed usa datos ficticios. No crear datos de productores reales.
- El seed NO ejecuta `supabase db push`. Solo afecta la base de datos local.
- El producer demo tiene UUID fijo `00000000-0000-0000-0000-000000001001` para facilitar identificación.
- Para limpiar: `npx supabase@2.108.0 db reset` (reinicia la DB local completa).

Ver guía completa: `docs/05-architecture/LOCAL_SEEDING.md`

---

## Cotizaciones demo locales

La pantalla `/dashboard/quotes` muestra las cotizaciones del producer autenticado.

**Requisitos previos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Seed local ejecutado (producer + membership — ver sección anterior)

**Flujo:**

```
/login → /dashboard → "Ver cotizaciones demo" → /dashboard/quotes
```

En `/dashboard/quotes` hay un botón **"Crear cotización demo local"** que:
1. Crea un prospect ficticio (`Prospecto Demo Local`, teléfono `+59800000000`)
2. Crea una cotización de tipo `auto` con monto `UYU 5.000`
3. Marca la cotización con `origin_channel = 'demo_local'` para identificación
4. Es **idempotente**: si ya existe la cotización, no crea un duplicado

**Lo que NO hace:**
- No envía mensajes por WhatsApp
- No integra IA
- No usa datos reales
- No aplica migraciones remotas (`supabase db push`)
- No usa el service role key en el frontend

**Notas técnicas:**
- La tabla `quotes` usa RLS: el usuario solo ve las cotizaciones de su propio producer
- Los datos de prospect son ficticios — el número `+59800000000` no existe en Uruguay
- El botón está disponible en desarrollo local; en producción, las cotizaciones se cargarán vía formulario o CSV (decisión pendiente)

---

## Carga manual local de cotizaciones

La pantalla `/dashboard/quotes/new` permite ingresar cotizaciones reales (o ficticias en local)
directamente desde la interfaz web.

**Requisitos previos:**
- Login local con magic link (Mailpit: `http://localhost:54324`)
- Seed local ejecutado (producer + membership — ver sección anterior)

**Flujo:**

```
/login → /dashboard → /dashboard/quotes → "+ Nueva cotización manual" → /dashboard/quotes/new
```

**Campos del formulario:**

| Campo | Tabla | Obligatorio |
|---|---|---|
| Nombre completo | `prospects.full_name` | Sí |
| Teléfono WhatsApp | `prospects.phone` (E.164) | Sí |
| Email | `prospects.email` | No |
| Base de contacto | `prospects.consent_status` | No (default: `granted`) |
| Tipo de seguro | `quotes.insurance_type` (enum) | Sí |
| Fecha de cotización | `quotes.quote_date` | Sí (default: hoy) |
| Monto cotizado | `quotes.quoted_amount` | No |
| Moneda | `quotes.currency` | No (default: `UYU`) |
| Descripción / referencia | `quotes.risk_description` | No |
| Notas internas | `quotes.internal_notes` | No |

**Deduplicación de prospects:**
Si ya existe un prospect con el mismo teléfono en el mismo producer, el sistema lo reutiliza.
No crea duplicados. Útil al cargar varias cotizaciones del mismo cliente.

**Formato de teléfono:**
E.164: `+` seguido de código de país y número. Ej: `+59899123456` (Uruguay móvil).
El sistema normaliza espacios y guiones antes de validar.

**Lo que NO hace:**
- No envía mensajes por WhatsApp
- No integra IA
- No usa datos reales (en local usa datos de prueba)
- No aplica migraciones remotas (`supabase db push`)
- No usa el service role key en el frontend

**Nota técnica:** `quote_reference` no existe en el schema v2.0. Usar el campo
`risk_description` para guardar referencias tipo `COT-001 — Toyota Hilux 2022`.
Ver: `docs/04-decisiones/DECISION-004-ingesta-cotizaciones-mvp.md`

---

## Supabase — seguridad de entorno

Este repo apunta **exclusivamente** al proyecto Supabase `seguroflow-ai` (ref: `fawlbfkkxufyhnghynjk`).

- No ejecutar comandos remotos (`db push`, `migration up`, `functions deploy`) sin verificar el project-ref primero.
- **Nunca** conectar este repo al proyecto `TuHoroscopoCosmico.com` ni a ningun otro proyecto Supabase.
- `supabase db reset` es local (seguro). `supabase db push` es remoto (requiere confirmacion humana).

Ver reglas completas: `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`

---

## Documentacion

Ver `docs/README.md` para el indice completo de documentacion.

Empezar siempre por: `docs/00-ai-context/AI_BRIEF.md`
