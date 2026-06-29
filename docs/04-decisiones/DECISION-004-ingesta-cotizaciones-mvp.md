# DECISION-004 — Estrategia de Ingesta de Cotizaciones para el MVP

- **Fecha:** 2026-06-29
- **Estado:** Aceptada
- **Módulo:** Dashboard del producer — carga de cotizaciones (prospects + quotes)
- **Depende de:** DECISION-003 (modelo multi-tenant y RLS), DATA_MODEL.md v2.0
- **Desbloquea:** Implementación del formulario manual de carga de cotizaciones

---

## Contexto

El MVP-01 (Recuperador de Cotizaciones por WhatsApp) requiere que el producer
pueda ingresar cotizaciones no cerradas al sistema para que SeguroFlow AI inicie
el seguimiento automático.

El sistema necesita crear dos registros por cotización:
1. Un `prospect` (el cliente potencial) — si no existe ya en la base.
2. Una `quote` asociada a ese prospect y al producer.

La pregunta es **cómo** permite el MVP que el producer cargue esos datos.

Hay dos opciones principales evaluadas: formulario manual y CSV.

---

## 1. Opción A — Formulario manual web

El producer ingresa cada cotización llenando un formulario en `/dashboard/quotes/new`.
Un campo por campo, con validación en tiempo real. Un submit → un prospect + una quote.

### Pros

- **Validación inmediata en el servidor.** Cada campo se valida antes de insertar
  en la base de datos. No hay riesgo de filas corruptas o formatos inválidos.
- **Implementación rápida.** 1-2 días para un formulario funcional con los campos
  mínimos. No requiere parsing, mapeo de columnas ni manejo de archivos.
- **Valida el modelo de campos temprano.** Al hacer que el producer lo llene a mano,
  se descubre rápidamente qué campos son imprescindibles, cuáles confunden,
  qué enums son incompletos. Esa retroalimentación es crítica antes de escalar.
- **Sin riesgo de PII en archivos.** Los datos se ingresan campo a campo. No hay
  archivo con datos masivos de contacto que pueda ser logueado, cacheado o expuesto
  por error en el procesamiento.
- **Tecnicamente simple.** Un Server Component con un `<form>` y una Server Action.
  No hay dependencias de parsers de CSV ni lógica de mapeo de columnas.
- **Correcto para el piloto de 1-3 productores.** Un productor piloto típicamente
  tiene 10-50 cotizaciones pendientes. Llenar un formulario por cotización es viable
  y permite que el producer revise cada dato mientras lo ingresa.

### Contras

- **No escala para volúmenes altos.** Si un productor tiene 200+ cotizaciones, llenar
  el formulario una por una es impracticable. Este problema aparece en fase post-piloto,
  no en el MVP.
- **No permite importar datos existentes de CRMs.** Los productores con CRM propio
  querrán importar su base completa. El formulario no lo resuelve.
- **Una cotización por submit.** Si el producer quiere cargar 20 cotizaciones seguidas,
  el flujo es más lento que un CSV.

### Riesgos

- El producer podría frustrarse si tiene muchas cotizaciones para cargar.
  **Mitigación:** en el piloto, ayudar al productor a cargar las primeras cotizaciones
  en la sesión de onboarding. No es self-service total desde el día uno.
- Datos incompletos: el producer puede no tener todos los campos al momento de cargar.
  **Mitigación:** la mayoría de los campos son opcionales. Solo `full_name`, `phone`
  e `insurance_type` son obligatorios (ver sección 4).

### Velocidad de implementación estimada

1-2 días de desarrollo: Server Action + Server Component con validación básica.

### Valor para el piloto

**Alto.** Exactamente lo que se necesita para validar el flujo end-to-end con 1-3
productores: ingresar datos reales manualmente, verificar que el sistema los procesa
correctamente y desencadena el seguimiento.

---

## 2. Opción B — Carga de archivo CSV

El producer sube un archivo `.csv` desde su sistema o planilla, y el sistema
lo parsea, valida y crea los registros en batch.

### Pros

- **Carga masiva.** Permite importar 200+ cotizaciones de una sola vez.
- **Productores con CRM pueden exportar.** Si el CRM tiene exportación CSV, el
  onboarding puede completarse en un solo paso.
- **Velocidad de datos iniciales.** Un producer con historial de cotizaciones puede
  cargar todo su pipeline desde el día uno.

### Contras

- **Complejidad técnica 3-5x mayor.** Requiere: manejo de archivo multipart,
  parser CSV (headers, encoding, delimitadores), mapeo de columnas al schema de la DB,
  validación fila por fila, manejo de errores parciales (¿qué pasa si fila 50 de 100 falla?),
  feedback de resultado al usuario.
- **El modelo de campos no está validado aún.** Si hacemos CSV antes de haber
  testeado el formulario con productores reales, construimos un importador para
  campos que quizás cambien. Es deuda técnica garantizada.

### Riesgo de columnas inconsistentes

Los producers exportan desde planillas Excel o CRMs propios. Los nombres de columna
van a variar:
- "Nombre", "Nombre prospecto", "Cliente", "Asegurado", "full_name"
- "Telefono", "Tel.", "Celular WhatsApp", "phone"
- "Monto", "Suma asegurada", "Premio", "Cotización", "quoted_amount"

El sistema necesita un mecanismo de mapeo de columnas (UI adicional o convención fija).
Sin eso, el CSV rechaza el 80% de los archivos reales.

### Riesgo de datos mal formateados

- Teléfonos en formatos mixtos: `099123456`, `+598 99 123 456`, `099-123-456`
- Fechas: `15/03/2026`, `2026-03-15`, `15 mar 2026`, `March 15, 2026`
- Montos: `5.000`, `5,000`, `$5000`, `5000 UYU`
- Encoding: UTF-8 vs Windows-1252 — tildes y ñ se corrompen

Cada variante requiere lógica de normalización. Una fila mal formateada puede
corromper el siguiente registro si el parser no es robusto.

### Riesgo de PII

El CSV contiene todos los datos de contacto (nombres, teléfonos, emails) de todos
los prospectos del producer, en texto plano. Un error en el procesamiento
puede causar:
- El archivo completo siendo logueado en el servidor.
- El archivo siendo cacheado en el cliente o en Next.js.
- PII expuesto en errores de validación enviados al frontend.

La Ley 18.331 (Uruguay) y las regulaciones de la industria aseguradora exigen
tratamiento cuidadoso de estos datos. El CSV requiere controles adicionales
que el formulario no necesita.

### Mayor complejidad técnica

Requiere implementar:
- Upload de archivo (multipart/form-data, límite de tamaño, validación MIME).
- Parser CSV con manejo de encoding y delimitadores.
- Validación y normalización de cada fila.
- Transacción para insertar en batch (si falla una fila, ¿rollback total o parcial?).
- UI de feedback: "100 filas procesadas, 3 errores en filas 12, 45, 78".
- Posible UI de previsualización antes del import definitivo.

Estimación: 5-10 días de desarrollo robusto. El MVP se retrasa.

---

## 3. Recomendación para el MVP

### Formulario manual primero. CSV en fase posterior.

El formulario manual es la decisión correcta para el MVP por tres razones:

1. **Velocidad sobre completitud.** El piloto necesita funcionar con 10-50 cotizaciones.
   El formulario cubre ese volumen. Optimizar para 1000 cotizaciones antes de validar
   con 1 producer real es prematura.

2. **Validar el modelo de campos antes de cementarlo.** El CSV requiere que el modelo
   de campos esté estable (nombres, tipos, opcionales vs. requeridos). El formulario
   ayuda a descubrir qué campos son realmente necesarios y cómo los entienden los
   producers. CSV viene después, cuando sabemos qué columnas mapear.

3. **Menor riesgo de PII.** En desarrollo y en el piloto, queremos minimizar la
   superficie de exposición de datos de contacto. Campo a campo es más seguro que
   archivo masivo.

### El CSV queda como:

- **Fase post-piloto**, una vez que el modelo de campos esté validado con productores reales.
- **Funcionalidad opcional**, no bloquea el lanzamiento del piloto.
- **Prioridad decidida junto al producer piloto**: si el primer producer tiene 500+
  cotizaciones y el formulario manual es impracticable, se sube la prioridad del CSV.
  Pero no se asume que será necesario antes de validarlo.

---

## 4. Campos mínimos para ingesta manual

### Datos del prospect

| Campo | Tabla.Columna | Requerido | Tipo | Notas |
|---|---|---|---|---|
| Nombre completo | `prospects.full_name` | **Sí** | TEXT | Nombre y apellido del asegurado |
| Teléfono WhatsApp | `prospects.phone` | **Sí** | TEXT | Formato E.164 (+598...). El sistema enviará mensajes a este número. |
| Email de contacto | `prospects.email` | No | TEXT | Para notificaciones adicionales. No es el canal principal. |
| Consentimiento | `prospects.consent_status` | **Sí** | ENUM | Default: `granted`. El producer declara tener relación previa con el contacto. Ver nota legal. |

### Datos de la cotización

| Campo | Tabla.Columna | Requerido | Tipo | Notas |
|---|---|---|---|---|
| Tipo de seguro | `quotes.insurance_type` | **Sí** | ENUM | `auto`, `home`, `life`, `commercial`, `other` |
| Fecha de cotización | `quotes.quote_date` | **Sí** | DATE | Fecha en que se hizo la cotización original |
| Monto cotizado | `quotes.quoted_amount` | No | NUMERIC | Puede ser nulo si el producer no lo tiene al momento de cargar |
| Moneda | `quotes.currency` | No | TEXT | Default: `UYU`. Puede ser `USD` para seguros de vida o comerciales. |
| Aseguradora | `quotes.insurer_name` | No | TEXT | Si el producer ya tiene una aseguradora asignada |
| Descripción del riesgo | `quotes.risk_description` | No | TEXT | Libre: "Toyota Hilux 2022", "Casa 3 dormitorios zona Carrasco", etc. |
| Notas internas | `quotes.internal_notes` | No | TEXT | Para uso del producer. No se muestra al prospect. |
| Canal de origen | `quotes.origin_channel` | No | TEXT | Default: `manual`. Permite distinguir de `webhook`, `csv`, `demo_local`. |

### Campos que NO están en el schema v2.0 actual

| Campo mencionado | Situación |
|---|---|
| `quote_reference` | **No existe** en el schema v2.0. La referencia del producer va en `risk_description` o `internal_notes` hasta que se decida agregar la columna. |
| Vendedor asignado | **No existe** en el schema v2.0. El MVP tiene 1 usuario por producer. Cuando se implemente multi-agente, vendrá en `quotes.assigned_to` o similar. |

### Nota legal sobre consentimiento

El campo `consent_status = 'granted'` implica que el producer declara tener
una relación previa con el prospecto (cliente que pidió la cotización, cliente
de cartera, lead obtenido por medio propio).

**SeguroFlow AI no valida este dato.** La responsabilidad legal es del producer.
En el onboarding del piloto, el producer debe firmar o declarar este compromiso
antes de cargar datos reales.

Ver: `docs/02-product/RECUPERADOR_COTIZACIONES.md` — sección de consideraciones legales.

---

## 5. Reglas de seguridad que aplican a la ingesta

Estas reglas se aplicarán tanto al formulario como al futuro CSV. Se documentan
aquí para que sean consideradas en la implementación.

| Regla | Formulario | CSV (futuro) |
|---|---|---|
| No usar service role en frontend | ✅ Server Action con cliente del usuario | ✅ Igual |
| Respetar RLS (`producer_id IN get_my_producer_ids()`) | ✅ Políticas `prospects_insert` y `quotes_insert` | ✅ Igual |
| No loguear PII (teléfonos, nombres) en producción | ✅ Solo loguear códigos de error | ✅ Más crítico: no loguear el archivo completo |
| Validar `producer_id` en la Server Action | ✅ Via `getCurrentProducerContext()` | ✅ Igual |
| Sanitizar inputs (no permitir SQL injection vía texto libre) | ✅ Supabase usa prepared statements | ✅ Igual |
| No usar datos reales en desarrollo | ✅ Ver `supabase/seed.local.example.sql` | ✅ Usar CSV de prueba con datos ficticios |
| No ejecutar `supabase db push` sin confirmación humana | ✅ Solo desarrollo local | ✅ Igual |
| No tocar TuHoroscopoCosmico.com | ✅ Repos separados | ✅ Igual |
| No integrar WhatsApp todavía | ✅ El formulario solo crea datos; no activa seguimiento | ✅ Igual |
| No integrar IA todavía | ✅ No hay clasificación en la ingesta | ✅ Igual |

---

## 6. Decisión final

### ¿Qué se implementará primero?

**Formulario manual de carga de cotizaciones en `/dashboard/quotes/new`.**

Implementación mínima viable:
- Server Component con `<form>` (sin biblioteca de formularios externa).
- Server Action `createQuote()` en `app/actions/quotes.ts` (extiende el archivo existente).
- Validación básica server-side: campos requeridos, formato de teléfono E.164, tipo de seguro válido.
- Lógica de deduplicación: si el prospect con ese `(producer_id, phone)` ya existe → reusar.
- Redirección a `/dashboard/quotes` post-submit.
- Mensaje de confirmación con el nombre del prospect y el tipo de seguro creado.

### ¿Qué queda fuera de alcance de esta fase?

- CSV upload.
- Importación desde CRMs externos.
- Formulario de edición de cotización existente.
- Paginación de la lista de quotes (OK para <20 quotes en piloto).
- Filtros y búsqueda en la lista.
- Campo de "vendedor asignado" (no existe en el schema actual).

### ¿Qué desbloquea esta decisión?

1. **La implementación del formulario.** Ya se puede proceder a desarrollar
   `/dashboard/quotes/new` sin más debates de diseño.
2. **El onboarding del producer piloto.** Con el formulario, el producer puede
   ingresar sus 10-50 cotizaciones activas en la sesión de onboarding.
3. **La validación del modelo de campos.** Al tener productores reales llenando
   el formulario, sabremos qué campos agregar, cuáles sobran, qué enums son
   incompletos (por ejemplo: ¿falta `moto`, `embarcacion` en `insurance_type`?).
4. **El flujo end-to-end del MVP-01.** Con cotizaciones reales en la base,
   se puede activar el seguimiento automático por WhatsApp (próximas fases).

---

## 7. Consecuencias para el código existente

- `app/actions/quotes.ts` ya existe. Se le agregará `createQuote()` junto al
  `createDemoQuote()` ya implementado. La función demo queda como referencia
  de la estructura esperada.
- `lib/quotes/get-quotes-for-current-producer.ts` no requiere cambios.
  Las quotes creadas por el formulario aparecerán automáticamente en la lista.
- No se requieren nuevas migraciones: todos los campos listados en la sección 4
  existen en el schema v2.0 (`001_base_multitenant_schema.sql`).
- Si en el futuro se agrega `quote_reference` como columna, requerirá una
  migración nueva (no DECISION-003, no modificar migración 001).

---

*Versión: 1.0 — Fecha: 2026-06-29*
*Mantenido por: el equipo fundador de SeguroFlow AI*
