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
