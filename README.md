# SeguroFlow AI

Plataforma de IA operativa y comercial para productores, corredores y aseguradoras.

## MVP inicial

Recuperador automático de cotizaciones no cerradas por WhatsApp.

## Visión

Ser una capa de IA operativa/comercial para el mercado asegurador uruguayo y regional.

## Estado

Skeleton tecnico validado. Next.js 15 + TypeScript buildea limpio.
Migracion 001 validada con supabase db reset local. Tipos generados.
Proximo paso: implementar Auth (login/logout) y primer modulo MVP-01.

---

## Estructura del proyecto

```
seguroflow-ai/
  app/                        # Next.js App Router (paginas y layouts)
  components/                 # Componentes React reutilizables (pendiente)
  lib/
    supabase/
      client.ts               # Cliente Supabase para el browser (publishable key)
      server.ts               # Cliente Supabase server-side (placeholder)
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

## Documentacion

Ver `docs/README.md` para el indice completo de documentacion.

Empezar siempre por: `docs/00-ai-context/AI_BRIEF.md`
