# SeguroFlow AI

Plataforma de IA operativa y comercial para productores, corredores y aseguradoras.

## MVP inicial

Recuperador automático de cotizaciones no cerradas por WhatsApp.

## Visión

Ser una capa de IA operativa/comercial para el mercado asegurador uruguayo y regional.

## Estado

Auth email + password implementado (DECISION-007). Magic link disponible como fallback.
Login → /dashboard protegido con getUser().
MVP local completo: flujo simulado quotes → scheduler → approvals → outbox → metrics.

---

## Estructura del proyecto

```
seguroflow-ai/
  app/                        # Next.js App Router (paginas y layouts)
  components/                 # Componentes React reutilizables
  lib/
    supabase/
      client.ts               # Cliente Supabase para el browser (publishable key)
      server.ts               # Cliente Supabase server-side con cookies SSR + flowType pkce
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

# 3. Iniciar Supabase local (requiere Docker Desktop)
npx supabase@2.108.0 start
npx supabase@2.108.0 db reset   # Aplica migraciones localmente (NO a produccion)

# 4. Iniciar servidor de desarrollo
npm run dev
```

---

## Login local con email + password

**Estrategia de auth: email + password (DECISION-007)**

El acceso principal es email + password. Magic link queda como fallback técnico
secundario — no es el flujo recomendado para la demo.

### Credenciales demo local

| Campo | Valor |
|---|---|
| Email | `demo@seguroflow.local` |
| Password | `Demo123456!` |

> Estas credenciales son solo para el entorno local de desarrollo.
> No usar en producción. No usar datos reales.

### Pasos para entrar

```
1. Supabase local corriendo: npx supabase@2.108.0 start
2. App corriendo: npm run dev
3. Abrir http://127.0.0.1:3000/login
4. Ingresar email: demo@seguroflow.local
5. Ingresar password: Demo123456!
6. Click "Entrar" → redirige a /dashboard
```

### Crear/restaurar usuario demo (si se pierde tras db reset)

Si después de un `supabase db reset` el usuario demo no tiene password, restaurarlo
via la Admin API local (service role key — solo en terminal, nunca en frontend):

```bash
# Obtener la service_role key local
npx supabase@2.108.0 status

# Setear password via Admin API (reemplazar SERVICE_ROLE_KEY con el valor real)
curl -s -X PUT http://127.0.0.1:54321/auth/v1/admin/users/491e5a58-02f2-49f0-a7af-06cc169f8fc1 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"Demo123456!","email_confirm":true}'
```

O via Supabase Studio en `http://localhost:54323` → Authentication → Users.

### Variables de entorno requeridas

| Variable | Descripcion | Local |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key (safe para cliente) | ver `supabase status` |
| `NEXT_PUBLIC_SITE_URL` | URL base de la app (para callback y cookies PKCE) | `http://127.0.0.1:3000` |

> IMPORTANTE: `NEXT_PUBLIC_SITE_URL` debe coincidir con el host desde donde accedés
> al browser. Si usás `127.0.0.1:3000` en la barra del browser, usar `http://127.0.0.1:3000`.
> La cookie PKCE se setea para ese host — si no coincide con el callback, el magic link falla.
> Para email + password esto no afecta.

### ¿Qué gestiona Supabase Auth?

- Supabase Auth gestiona el hash de passwords. No se guarda contraseña manualmente.
- Las sessions se manejan via cookies HttpOnly en el servidor (SSR).
- No se ejecuta `supabase db push`.
- No se toca el proyecto remoto (`fawlbfkkxufyhnghynjk`) sin autorización humana.

### Magic link (fallback técnico)

El magic link sigue disponible en `app/actions/auth.ts` como `sendMagicLink()`.
No aparece como flujo principal en la UI. Si se usa:

- Requiere que el `NEXT_PUBLIC_SITE_URL` coincida con el host del browser (ver arriba).
- Los emails se capturan en Mailpit: `http://localhost:54324`
- Los links son de un solo uso y expiran en 1 hora.

---

## Dashboard local

El dashboard en `/dashboard` requiere sesión activa (login previo).

- Verifica que el usuario tiene una membresía activa en `producer_members`.
- Si no hay datos de prueba locales, muestra un estado vacío informativo.
- No consulta ni crea datos reales.
- No requiere migración remota (`supabase db push`).

**Flujo local completo:**
```
/login (email+password) → /dashboard → /quotes/new → /scheduler → /approvals → /outbox → /metrics
```

---

## Seed local de producer demo

El dashboard requiere que el usuario tenga una membresía activa en `producer_members`.
Tras un `supabase db reset`, se aplica el seed automático (`supabase/seed.sql`).

El seed crea:
- Producer demo: "Productor Demo Local"
- Usuario demo: `demo@seguroflow.local`
- Membresía: `demo@seguroflow.local` → `Productor Demo Local` (owner)
- Cotizaciones y prospectos de prueba (datos ficticios)

**Si el seed no incluye el usuario real** (`mbenitezmdeo@gmail.com`), agregar membresía manualmente:

```sql
-- En Supabase Studio (localhost:54323) o via psql
INSERT INTO public.producer_members (user_id, producer_id, role, is_active, accepted_at)
SELECT
  u.id,
  '00000000-0000-0000-0000-000000001001',
  'owner',
  true,
  NOW()
FROM auth.users u
WHERE u.email = 'mbenitezmdeo@gmail.com'
ON CONFLICT (user_id, producer_id) DO NOTHING;
```

---

## Reglas críticas

```
NO ejecutar supabase db push             — migraciones solo con autorización explícita
NO ejecutar comandos remotos Supabase    — proyecto fawlbfkkxufyhnghynjk prohibido sin OK
NO tocar TuHoroscopoCosmico.com         — repositorio completamente separado
NO integrar WhatsApp real               — flujo local simulado hasta piloto autorizado
NO integrar IA real                     — sin llamadas a LLM hasta piloto autorizado
NO usar service role en frontend        — solo en terminal/servidor
NO usar datos reales                    — todo el desarrollo usa datos ficticios
NO registrar usuarios públicamente      — acceso controlado, sin signup abierto
```
