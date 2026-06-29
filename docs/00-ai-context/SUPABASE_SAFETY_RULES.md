# SUPABASE_SAFETY_RULES.md — Reglas de Seguridad de Entorno Supabase

> LEER ANTES de ejecutar cualquier comando Supabase remoto.
> Estas reglas aplican a humanos e IAs por igual.
> **Ultima actualizacion: 2026-06-28**

---

## Proyecto permitido

| Campo | Valor |
|---|---|
| **Nombre** | seguroflow-ai |
| **Project ref** | `fawlbfkkxufyhnghynjk` |
| **Uso** | Unico proyecto Supabase autorizado para este repo |

---

## Proyecto PROHIBIDO

| Campo | Valor |
|---|---|
| **Nombre** | TuHoroscopoCosmico.com |
| **Estado** | PROHIBIDO desde este repo |
| **Razon** | Proyecto completamente distinto. Ningun comando, migracion ni operacion de este repo debe ejecutarse contra el. |

Este repo **nunca** debe conectarse, modificar, leer ni escribir datos en el proyecto TuHoroscopoCosmico.com.
Ni siquiera para inspeccion o diagnostico.

---

## Reglas criticas — operaciones remotas

### Regla 1: verificar project-ref antes de cualquier operacion remota

Antes de ejecutar cualquier comando que opere contra Supabase en la nube
(`db push`, `migration up`, `functions deploy`, `link`, `gen types --project-ref`, etc.):

```bash
# Verificar el project-ref vinculado
npx supabase@2.108.0 projects list

# Verificar el link activo del directorio
cat supabase/.temp/project-ref 2>/dev/null || echo "No hay link activo"
```

Si el project-ref no es exactamente `fawlbfkkxufyhnghynjk`: **detenerse**.
No continuar. No asumir. No "probar igual".

### Regla 2: si el project-ref no coincide, no ejecutar

```
project-ref esperado:  fawlbfkkxufyhnghynjk
project-ref obtenido:  [cualquier otro valor]

→ DETENERSE. No ejecutar el comando.
→ Reportar el project-ref obtenido al usuario humano.
→ Esperar confirmacion explicita antes de continuar.
```

### Regla 3: por defecto, solo validacion local

El modo de operacion por defecto de este repo es **local**.

| Comando | Entorno | Estado por defecto |
|---|---|---|
| `supabase db reset` | Local (Docker) | PERMITIDO — validacion de migraciones |
| `supabase start` | Local (Docker) | PERMITIDO — levanta stack local |
| `supabase db push` | Remoto (nube) | PROHIBIDO hasta confirmacion humana |
| `supabase migration up` | Remoto (nube) | PROHIBIDO hasta confirmacion humana |
| `supabase functions deploy` | Remoto (nube) | PROHIBIDO hasta confirmacion humana |

### Regla 4: nunca aplicar migraciones remotas sin confirmacion humana explicita

Una IA o un script automatico no puede decidir por si solo aplicar migraciones al proyecto remoto.
Requiere que el usuario humano diga explicitamente algo equivalente a:

> "Aplica la migracion al proyecto remoto seguroflow-ai (ref: fawlbfkkxufyhnghynjk)"

Una instruccion ambigua como "aplica la migracion" o "haz el push" NO es suficiente.
Ante ambiguedad: preguntar al usuario humano antes de ejecutar.

### Regla 5: nunca commitear ni exponer el service role key

El `SUPABASE_SERVICE_ROLE_KEY` para el proyecto `fawlbfkkxufyhnghynjk` es un secreto.
- No commitear en ningun archivo del repo.
- No loguearlo en ningun servicio de monitoreo.
- No incluirlo en variables de entorno publicas (NEXT_PUBLIC_*).
- Solo vive en `.env.local` (ignorado por .gitignore) o en las variables de entorno del servidor de deploy.

---

## Protocolo de verificacion antes de operacion remota

Ejecutar estos pasos en orden. Si alguno falla o el resultado no coincide: **detenerse**.

```bash
# Paso 1: verificar que el CLI tiene el proyecto correcto vinculado
npx supabase@2.108.0 projects list
# → buscar "fawlbfkkxufyhnghynjk" en la lista

# Paso 2: verificar el link activo del directorio local
cat supabase/.temp/project-ref
# → debe mostrar: fawlbfkkxufyhnghynjk

# Paso 3: si se va a ejecutar db push, mostrar el diff primero
npx supabase@2.108.0 db diff --schema public
# → revisar que el diff sea el esperado, sin cambios destructivos inesperados

# Solo si los 3 pasos anteriores son correctos y hay confirmacion humana:
npx supabase@2.108.0 db push
```

---

## Por que estas reglas existen

La cuenta Supabase del usuario contiene al menos dos proyectos:

1. **seguroflow-ai** (`fawlbfkkxufyhnghynjk`) — este repo.
2. **TuHoroscopoCosmico.com** — proyecto productivo completamente distinto.

Aplicar una migracion al proyecto equivocado podria:
- Destruir datos productivos de TuHoroscopoCosmico.com.
- Crear tablas o ENUMs incompatibles en un proyecto en produccion.
- Ser irreversible sin restauracion desde backup.

El costo de verificar el project-ref es cero.
El costo de aplicar al proyecto equivocado puede ser total.

---

## Referencia rapida

```
PROYECTO PERMITIDO:   seguroflow-ai
PROJECT REF:          fawlbfkkxufyhnghynjk
PROYECTO PROHIBIDO:   TuHoroscopoCosmico.com

PERMITIDO sin confirmacion:  supabase db reset   (local)
PROHIBIDO sin confirmacion:  supabase db push    (remoto)
PROHIBIDO siempre:           tocar TuHoroscopoCosmico.com
```

---

## Archivos relacionados

| Archivo | Contenido |
|---|---|
| `supabase/README.md` | Instrucciones de migracion y checklist de produccion |
| `docs/00-ai-context/CODING_RULES.md` | Reglas generales de codificacion |
| `docs/00-ai-context/CURRENT_STATE.md` | Estado actual del proyecto y proximos pasos |
| `.env.example` | Variables de entorno requeridas (sin valores reales) |
