# VERCEL_DEPLOY_PLAN.md — Plan de deploy en Vercel

> Este documento describe los pasos para conectar el repo GitHub nuevo con Vercel
> y desplegar la app Next.js en producción.
>
> **Estado:** Checklist pendiente. Local build exitoso. Repo nuevo configurado.
> **Última actualización: 2026-06-29**
>
> REGLA CRÍTICA: NO aplicar migraciones Supabase remotas sin confirmación humana.
> Ver: docs/00-ai-context/SUPABASE_SAFETY_RULES.md

---

## Objetivo

1. Conectar el repo GitHub nuevo con Vercel.
2. Desplegar la app Next.js como proyecto serverless.
3. Conectar Supabase cloud (`fawlbfkkxufyhnghynjk`) cuando se autorice explícitamente.
4. NO aplicar migraciones remotas automáticamente — requiere paso manual y explícito.

---

## Repositorio

| Campo | Valor |
|---|---|
| **Repo nuevo** | `https://github.com/luismanuelbenitez/seguroflow-ai.git` |
| **Rama** | `main` |
| **Framework** | Next.js 15.5.19 (App Router) |
| **Build command** | `npm run build` (ya verificado localmente) |
| **Output directory** | `.next` (automático con Next.js) |

---

## Variables de entorno requeridas en Vercel

> Estas variables se configuran en Vercel Dashboard → Project Settings → Environment Variables.
> NUNCA poner valores reales en archivos del repo.

| Variable | Descripción | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase cloud. Formato: `https://<ref>.supabase.co` | Sí |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key del proyecto Supabase cloud. Safe para el browser. | Sí |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app en Vercel. Ej: `https://seguroflow-ai.vercel.app` | Sí |

### Variables NO usar en Vercel todavía (pendiente de integración)

| Variable | Motivo de exclusión |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | No hay rutas que lo requieran todavía. Solo agregar cuando se implemente webhook/cron. |
| `AI_PROVIDER` / `AI_API_KEY` | IA no integrada todavía. |
| `WHATSAPP_*` | WhatsApp no integrado todavía. |

---

## Qué NO configurar en Vercel

- **No usar** `http://127.0.0.1:54321` como `NEXT_PUBLIC_SUPABASE_URL` — esa es la URL local.
- **No subir** service role key (`SUPABASE_SERVICE_ROLE_KEY`) hasta que sea necesario.
- **No subir** tokens de WhatsApp ni credenciales Twilio.
- **No subir** API keys de IA todavía.

---

## Supabase cloud permitido

| Campo | Valor |
|---|---|
| Proyecto | `seguroflow-ai` |
| Project ref | `fawlbfkkxufyhnghynjk` |
| URL | `https://fawlbfkkxufyhnghynjk.supabase.co` |
| Proyecto PROHIBIDO | `TuHoroscopoCosmico.com` — nunca desde este repo |

---

## Antes de conectar Supabase cloud

Antes de usar el proyecto cloud con datos reales, se deben aplicar las migraciones.
Este paso requiere confirmación humana explícita.

```bash
# Verificar que el project-ref sea el correcto ANTES de cualquier operacion remota
npx supabase@2.108.0 projects list
# → Confirmar: fawlbfkkxufyhnghynjk

# Verificar link activo del directorio
cat supabase/.temp/project-ref
# → Debe mostrar: fawlbfkkxufyhnghynjk

# Solo si ambas verificaciones pasan Y hay autorización humana explícita:
npx supabase@2.108.0 db push
```

Ver: `docs/00-ai-context/SUPABASE_SAFETY_RULES.md` para protocolo completo.

---

## Configuración de Auth en Supabase cloud (cuando se habilite)

Estos pasos son para cuando se configure el proyecto cloud para uso real.
NO hacer todavía.

1. En Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://tu-dominio.vercel.app`
   - Redirect URLs: `https://tu-dominio.vercel.app/auth/callback`

2. Crear usuario demo en cloud (solo para demo controlada):
   ```bash
   # Usando Admin API con service role — solo en terminal, nunca en frontend
   curl -X POST 'https://fawlbfkkxufyhnghynjk.supabase.co/auth/v1/admin/users' \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@seguroflow.ai","password":"Demo123456!","email_confirm":true}'
   ```

3. Ejecutar seed de producer demo en cloud (seguir docs/05-architecture/LOCAL_SEEDING.md).

---

## Checklist antes de deploy en Vercel

### Técnico
- [x] `npm run build` local pasa (14 rutas, sin errores TypeScript)
- [x] Repo nuevo configurado: `github.com/luismanuelbenitez/seguroflow-ai`
- [x] `.env.local` excluido del repo (no commiteable)
- [x] No hay secretos reales en código commitado
- [x] `supabase/.branches` y `supabase/.temp` excluidos por `supabase/.gitignore`
- [ ] Variables de entorno definidas en Vercel Dashboard
- [ ] Supabase cloud preparado con autorización humana explícita
- [ ] Auth URLs/callbacks actualizados en Supabase cloud
- [ ] Migraciones 001 y 002 aplicadas al proyecto cloud (con verificación de project-ref)

### Datos y seguridad
- [ ] NO hay datos reales todavía
- [ ] Seed de producer demo ejecutado en cloud (con datos ficticios)
- [ ] Usuario demo creado en cloud con password seguro

### Negocio
- [ ] Al menos 1 productor piloto confirmado antes de exponer URL pública
- [ ] URL de demo comunicada solo al piloto, no al público general

---

## Próximo paso recomendado

1. Ir a vercel.com → New Project → Import from GitHub.
2. Seleccionar `luismanuelbenitez/seguroflow-ai`.
3. Configurar las 3 variables requeridas.
4. En paralelo, autorizar y aplicar migraciones Supabase cloud (con confirmación explícita).
5. Validar que `/login` funciona con credenciales demo en la URL de Vercel.
6. Invitar al primer productor piloto con la URL de demo.

---

*Ver también: docs/00-ai-context/SUPABASE_SAFETY_RULES.md (restricciones Supabase)*
*Ver también: docs/07-go-to-market/PRE_PILOT_CHECKLIST.md (checklist completo de piloto)*
