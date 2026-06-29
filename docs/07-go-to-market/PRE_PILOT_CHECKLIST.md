# PRE_PILOT_CHECKLIST.md — Checklist Pre-Piloto con Primer Productor

> **Estado:** Documentación de planificación. No se han cargado datos reales.
> No se ha ejecutado supabase db push. No se han aplicado migraciones remotas.
> Este documento es un checklist de referencia — no autoriza ninguna acción
> hasta que cada ítem sea confirmado por un humano responsable.
>
> **Nota legal:** Todos los ítems marcados como "[LEGAL]" deben ser validados
> con asesor legal o contador antes de proceder. Este documento no constituye
> asesoramiento legal. No afirma cumplimiento legal definitivo.
>
> **Última actualización:** 2026-06-29

---

## 1. Objetivo del piloto

El primer piloto tiene tres objetivos de validación:

1. **Validar la hipótesis central del producto:**
   ¿El seguimiento asistido por WhatsApp recupera cotizaciones no cerradas que de
   otra forma se hubieran perdido? ¿Cuántas y en qué tiempo?

2. **Validar la percepción de valor del producer:**
   ¿El producer percibe que el sistema le ahorra tiempo y le ayuda a cerrar más
   negocios? ¿Lo usaría con sus propios clientes? ¿Pagaría por ello?

3. **Validar el flujo técnico en condiciones reales:**
   ¿El flujo local simulado se sostiene con mensajes reales, prospectos reales
   y WhatsApp real? ¿Hay fricciones de UX que no se vieron en la demo local?

**Métricas de éxito a medir** (ver sección 6).

---

## 2. Perfil ideal del primer productor piloto

No es necesario que el primero sea el más grande. Es necesario que sea el que
más pueda validar la hipótesis con el menor riesgo.

### Perfil buscado:
- Productor o broker independiente chico o mediano (no una empresa grande).
- Cotiza seguros de auto, vida, hogar o salud por WhatsApp.
- Pierde cotizaciones porque no tiene tiempo para hacer el seguimiento manual.
- Tiene entre 5 y 50 cotizaciones nuevas por mes (volumen manejable para el piloto).
- Puede dedicar 30–60 minutos por semana a revisar y aprobar mensajes.
- Acepta que el sistema está en fase piloto y puede tener bugs.
- Tiene buena relación con sus prospectos (reduce el riesgo de quejas).
- Tiene un número de WhatsApp ya establecido con sus clientes (o acepta usar
  un número nuevo asignado para el piloto).

### Señales de alerta (descartar para el primer piloto):
- Producers que esperan automatización total sin revisión humana.
- Producers con más de 100 cotizaciones por mes (el volumen superaría la capacidad
  del sistema manual en M2).
- Producers que no tienen familiaridad con WhatsApp Business.
- Producers con prospectos en sectores regulados donde el contacto comercial
  tiene restricciones adicionales.

---

## 3. Requisitos operativos

### 3.1 Infraestructura técnica

- [ ] **Dominio o URL de demo disponible.**
      La app debe estar accesible en una URL fija (no `localhost`).
      Opciones: subdominio de Vercel (`proyecto.vercel.app`) o dominio propio.

- [ ] **Supabase cloud configurado** (solo estructura, sin datos reales todavía).
      - Proyecto cloud creado en Supabase.
      - Project ref verificado = `fawlbfkkxufyhnghynjk`.
      - **Migraciones 001 y 002 aplicadas con autorización humana explícita.**
        NO ejecutar `supabase db push` sin confirmación del responsable del proyecto.
      - Ver SUPABASE_SAFETY_RULES.md antes de cualquier acción remota.

- [ ] **Auth funcionando en producción.**
      - Magic link enviado al email del producer piloto.
      - El producer puede hacer login desde su teléfono y desde la computadora.
      - Sesión persiste correctamente.

- [ ] **Usuario producer creado en la base de datos cloud.**
      - `auth.users` con el email del producer piloto.
      - `profiles` creado.
      - `producers` creado con los datos del producer.
      - `producer_members` creado (role = 'owner').
      - Verificar con una sesión autenticada que `/dashboard` carga sin errores.

- [ ] **Número WhatsApp definido y configurado.**
      - ¿Número del producer o número central del sistema? (decisión pendiente).
      - Si es número central: el producer debe comunicar a sus prospectos que
        recibirán mensajes desde ese número.
      - Si es número del producer: el número debe estar registrado como WABA.
      - `producers.waba_number` guardado en la base de datos en formato E.164.

- [ ] **Proveedor WABA definido y configurado.**
      - Variables de entorno cargadas en el entorno de producción/staging.
      - Webhook registrado y verificado con el proveedor.
      - Un mensaje de prueba enviado a un número del equipo y recibido correctamente.
      - Un webhook inbound de prueba recibido y registrado en `whatsapp_messages`.
      - Ver WHATSAPP_REAL_PLAN.md para detalles técnicos.

- [ ] **Templates HSM aprobados por Meta** (si aplica al proveedor elegido).
      - Template M1 enviado a aprobación.
      - Template aprobado recibido con nombre exacto para usar en el código.
      - Nombre del template guardado en el código (`template_name` en `whatsapp_messages`).

### 3.2 Proceso y roles

- [ ] **Responsable humano del seguimiento asignado.**
      Alguien del equipo (o el propio producer) debe revisar la cola de aprobación
      al menos una vez al día durante el piloto. Si nadie lo hace, las cotizaciones
      no se moverán.

- [ ] **Protocolo de incidencias definido.**
      Si un mensaje se envía por error, si un prospecto se queja, o si el sistema
      falla: ¿quién lo resuelve y cómo? Tenerlo escrito antes del piloto.

- [ ] **Duración del piloto acordada con el producer.**
      Sugerido: 30 días con revisión a las 2 semanas.
      Expectativas alineadas sobre qué se va a medir y qué no.

---

## 4. Requisitos de datos

### 4.1 Volumen inicial recomendado

- Empezar con **no más de 10–20 cotizaciones reales** para el primer piloto.
- Las primeras 2–5 cotizaciones deben ser con prospectos conocidos del equipo
  o personas de confianza del producer (no clientes fríos).
- Escalar solo después de validar el flujo end-to-end sin errores.

### 4.2 Datos mínimos necesarios por cotización

| Campo | Descripción | Obligatorio |
|---|---|---|
| `prospects.full_name` | Nombre completo del prospecto | Sí |
| `prospects.phone` | Teléfono en formato E.164 (+598...) | Sí |
| `quotes.insurance_type` | Tipo de seguro (enum existente) | Sí |
| `quotes.quote_date` | Fecha de la cotización original | Sí |
| `quotes.quoted_amount` | Monto cotizado | No (pero útil para el mensaje) |
| `quotes.risk_description` | Descripción del riesgo cotizado | No |

### 4.3 Formato de teléfonos

Todos los números deben estar en formato E.164 antes de cargarlos:
- Uruguay: `+598 99 123 456` → `+59899123456`
- Sin espacios, sin guiones, con código de país.
- El formulario de nueva cotización ya normaliza este formato.

### 4.4 Protección de datos

- No cargar datos sensibles innecesarios (cédula, ingresos, historial médico, etc.).
- Los campos mínimos (nombre, teléfono, tipo de seguro) son suficientes para M2.
- Definir quién puede ver los datos de prospectos en el sistema:
  solo el producer propietario via RLS — verificar que RLS esté activo en la base cloud.
- No compartir accesos de base de datos con terceros.
- [LEGAL] Verificar requisitos de retención y eliminación de datos según la
  normativa aplicable antes de cargar datos reales.

---

## 5. Requisitos legales y compliance

> **Importante:** Esta sección describe aspectos que deben ser validados con
> un asesor legal o contador. No constituye asesoramiento legal. No afirma
> cumplimiento legal definitivo. Las referencias normativas son orientativas.

### 5.1 [LEGAL] Protección de datos personales

- Uruguay: validar con asesor los requisitos de la Ley 18.331 (Protección de Datos
  Personales) y su decreto reglamentario.
- Preguntas a validar con asesor:
  - ¿La base de datos de prospectos del producer califica como "base de datos personal"
    bajo la ley uruguaya?
  - ¿El producer debe registrar la base de datos ante la URCDP (Unidad Reguladora)?
  - ¿Qué datos mínimos son suficientes para el seguimiento comercial bajo la ley?
  - ¿Hay requisitos de almacenamiento seguro o residencia de datos en Uruguay?

### 5.2 [LEGAL] Consentimiento para comunicaciones por WhatsApp

- Meta exige que los destinatarios hayan optado por recibir mensajes de la empresa
  (opt-in documentable) para mensajes fuera de la ventana de 24h.
- Preguntas a validar con asesor:
  - ¿La relación preexistente del producer con el prospecto (cotización solicitada)
    constituye consentimiento suficiente bajo la ley uruguaya y las políticas de Meta?
  - ¿Es necesario un opt-in explícito por escrito o es suficiente el opt-in implícito
    derivado de la solicitud de cotización?
  - ¿Cómo documentar el consentimiento para demostrar cumplimiento si hay una queja?

### 5.3 [LEGAL] Política de privacidad y términos de servicio

- Antes del piloto, el producer debe conocer:
  - Qué datos del prospecto se guardan en el sistema.
  - Quién tiene acceso (solo el producer via RLS).
  - Cómo se pueden eliminar los datos si el prospecto lo solicita.
- Validar si el producer debe informar a sus prospectos que sus datos están siendo
  procesados por un sistema de terceros (SeguroFlow AI).

### 5.4 Mecanismo de opt-out

- El sistema ya tiene opt-out implementado técnicamente (`prospects.opt_out = true`).
- Validar con asesor que el mecanismo de opt-out cumple los requisitos legales:
  - ¿Es suficiente con que el prospecto responda "STOP" al mensaje?
  - ¿Debe haber una confirmación de opt-out al prospecto?
  - ¿El opt-out debe ser permanente o puede revertirse si el prospecto lo solicita?

### 5.5 [LEGAL] Términos comerciales con el producer

- Acordar por escrito con el producer piloto:
  - El sistema está en fase piloto y puede tener errores.
  - El producer es responsable de los mensajes que aprueba.
  - El producer tiene relación previa con los prospectos cuyos datos carga.
  - El producer no cargará datos de personas que no lo hayan contactado.
  - La participación en el piloto es gratuita a cambio de feedback estructurado.

### 5.6 Políticas de Meta / Twilio

- Meta: los mensajes deben cumplir las políticas de WhatsApp Business.
  Mensajes de venta fría no permitidos; seguimiento de cotización solicitada sí aplica.
- Twilio: revisar los términos de servicio para uso con datos de prospectos reales.
- Los templates HSM deben ser aprobados por Meta antes de enviar mensajes fuera
  de la ventana de 24h de conversación iniciada por el prospecto.

---

## 6. Métricas de éxito del piloto

### Métricas primarias (cuantitativas)

| Métrica | Descripción | Cómo medir |
|---|---|---|
| Cotizaciones cargadas | Total de cotizaciones ingresadas al sistema | Dashboard /metrics |
| Mensajes M1 aprobados | Mensajes revisados y aprobados por el producer | Dashboard /metrics |
| Mensajes enviados | Mensajes efectivamente enviados por WhatsApp | whatsapp_messages direction='outbound' |
| Respuestas recibidas | Mensajes inbound del prospecto | whatsapp_messages direction='inbound' |
| Tasa de respuesta | Respuestas / Enviados | Dashboard /metrics (responseRate) |
| Interesados | Cotizaciones con status='interested' | Dashboard /metrics |
| Tasa de interés | Interesados / Contactados | Dashboard /metrics (interestRate) |
| No interesados | Cotizaciones con status='closed_lost' | Dashboard /metrics |
| Opt-outs | Prospectos que pidieron no ser contactados | Dashboard /metrics |
| Conversiones reales | Pólizas vendidas (si el producer las informa) | Manual — el producer reporta |

### Métricas secundarias (cualitativas)

| Pregunta | Método |
|---|---|
| ¿El producer percibe valor? | Entrevista al final del piloto |
| ¿El producer usaría el sistema con más prospectos? | Pregunta directa |
| ¿El producer pagaría por el servicio? ¿Cuánto? | Pregunta directa |
| ¿Hubo prospectos que se quejaron del contacto? | Seguimiento con el producer |
| ¿Hay fricciones de UX que dificultaron el uso? | Observación y entrevista |
| ¿El tiempo de revisión de mensajes fue razonable? | Pregunta directa |

---

## 7. Guion de demo para el producer

Usar este guion durante la sesión de onboarding del producer piloto.
Duración estimada: 30–45 minutos.

### Paso 1: Dashboard — presentar el flujo completo

> "Este es el panel principal. Desde acá vas a gestionar todas las cotizaciones
> que hayas enviado pero que todavía no cerraste. El sistema te ayuda a hacer
> el seguimiento sin que tengas que acordarte uno por uno."

Mostrar: `/dashboard`
- Señalar las 6 secciones del flujo.
- Mostrar los badges MVP para ser transparente sobre el estado del sistema.

---

### Paso 2: Crear una cotización de prueba

> "Empecemos con un ejemplo tuyo. Ponemos los datos de una cotización real
> que tengas pendiente de seguimiento."

Ir a: `/dashboard/quotes/new`
- Cargar una cotización con datos ficticios primero.
- Mostrar la validación del formulario (teléfono E.164, tipo de seguro).
- Confirmar que aparece en la lista de cotizaciones.

---

### Paso 3: Scheduler — mover la cotización a "lista para seguimiento"

> "Cuando el sistema detecta que es el momento de contactar al prospecto,
> lo mueve a la cola de seguimiento. Esto es lo que haría el scheduler automático
> en el piloto real. Acá lo podés hacer vos manualmente."

Ir a: `/dashboard/scheduler`
- Mostrar la cotización en la lista de candidatas.
- Ejecutar el scheduler.
- Mostrar que la cotización pasó a "scheduled".

---

### Paso 4: Aprobar el mensaje M1

> "El sistema te sugiere un mensaje de seguimiento. Vos lo revisás, lo editás si
> querés personalizarlo, y lo aprobás. Nunca sale nada sin tu OK."

Ir a: `/dashboard/approvals`
- Mostrar el mensaje M1 generado automáticamente con los datos de la cotización.
- Editar el mensaje si el producer quiere cambiarlo.
- Hacer clic en "Aprobar mensaje".

**Punto de conversación clave:**
> "En el piloto real, en vez de esta simulación, esto envía el WhatsApp directamente.
> Pero vos siempre aprobás primero — el sistema no manda nada sin tu revisión."

---

### Paso 5: Outbox — simular el envío

> "Acá ves los mensajes aprobados listos para salir. En la demo local simulamos
> el envío para no mandar un WhatsApp real. En el piloto real, este botón envía el mensaje."

Ir a: `/dashboard/outbox`
- Mostrar el mensaje aprobado en el outbox.
- Hacer clic en "Simular envío".
- Mostrar que la cotización pasó a "contacted".

---

### Paso 6: Timeline de la cotización

> "Acá podés ver todo lo que pasó con esta cotización: cuándo se creó, cuándo
> se agendó el seguimiento, qué mensaje se aprobó, cuándo se envió el WhatsApp.
> Es el historial completo."

Ir a: `/dashboard/quotes/[id]`
- Recorrer el timeline de eventos.
- Señalar que cada evento tiene fecha, actor (vos, el sistema, el prospecto) y descripción.

---

### Paso 7: Simular una respuesta inbound

> "Ahora simulamos que el prospecto te respondió. En el piloto real, esto llega
> automáticamente cuando el prospecto escribe al número."

Desde el timeline de la cotización:
- Hacer clic en uno de los escenarios (Interesado, Con dudas, No interesado, Opt-out).
- Mostrar cómo cambia el estado de la cotización.
- Mostrar que el evento queda en el timeline.
- Si se elige opt-out: mostrar que el prospecto queda bloqueado para futuros mensajes.

**Punto de conversación clave sobre opt-out:**
> "Si el prospecto dice que no quiere ser contactado, el sistema lo bloquea de
> inmediato. No le llega nada más, sin excepción."

---

### Paso 8: Métricas

> "Acá podés ver un resumen de todo: cuántas cotizaciones tenés, cuántos mensajes
> salieron, cuántos prospectos respondieron, cuántos están interesados."

Ir a: `/dashboard/metrics`
- Recorrer las 4 secciones (Volumen, Embudo, Resultados, Mensajes).
- Señalar la tasa de respuesta y la tasa de interés.

**Punto de conversación clave:**
> "En el piloto real estas métricas van a reflejar tus cotizaciones reales.
> Vas a poder ver qué porcentaje de prospectos responde y cuántos terminan
> comprando una póliza gracias al seguimiento."

---

### Paso 9: Explicar cómo sería con WhatsApp real

> "Lo que vimos hoy es la demo local: todo funciona, pero los mensajes no salen
> de verdad. En el piloto real la diferencia es esta: cuando aprobás el mensaje
> y hacés clic en 'Enviar', el WhatsApp le llega al prospecto en su teléfono.
> Y cuando él te responde, vos lo ves acá en el timeline automáticamente."

Explicar claramente:
- El flujo de aprobación no cambia.
- El timeline no cambia.
- Las métricas no cambian.
- Lo único que cambia es que el mensaje de WhatsApp es real.

Preguntar al producer:
- "¿Esto es lo que necesitabas?"
- "¿Qué cambiarías del mensaje M1 para que suene como vos?"
- "¿Tenés prospectos en este momento que podrían participar del piloto?"

---

## 8. Criterios para avanzar al piloto real

Todos estos criterios deben estar cumplidos antes de enviar el primer mensaje
WhatsApp real a un prospecto real.

### Criterios técnicos

- [ ] Demo local estable: el flujo completo funciona sin errores en el entorno local.
- [ ] Entorno cloud preparado: Supabase cloud con migraciones 001 y 002 aplicadas (con autorización).
- [ ] WhatsApp real configurado: proveedor elegido, credentials cargadas, webhook verificado.
- [ ] Un mensaje de prueba enviado y recibido a un número del equipo (no un prospecto real).
- [ ] Webhook inbound registrado y verificado con un mensaje de prueba.
- [ ] RLS verificado en la base cloud: el producer solo ve sus propios datos.

### Criterios de proceso

- [ ] Mensaje M1 revisado y aprobado por el producer para su propia voz y estilo.
- [ ] Responsable humano del seguimiento definido y disponible.
- [ ] Protocolo de incidencias escrito.
- [ ] Duración y expectativas del piloto acordadas por escrito.

### Criterios legales (validar con asesor)

- [ ] [LEGAL] Checklist legal mínimo revisado con asesor.
- [ ] [LEGAL] Consentimiento de los prospectos verificado (relación previa documentable).
- [ ] [LEGAL] Política de privacidad o aviso informativo definido.
- [ ] [LEGAL] Mecanismo de opt-out validado.
- [ ] [LEGAL] Acuerdo con el producer sobre responsabilidades firmado o documentado.

### Criterios de negocio

- [ ] Producer piloto seleccionado y onboardeado (ha visto la demo y ha aceptado participar).
- [ ] Primeras 5–10 cotizaciones cargadas con datos verificados (no datos ficticios).
- [ ] Número de WhatsApp definido y comunicado al producer.

---

## Referencias

- WHATSAPP_REAL_PLAN.md: plan técnico de integración → `docs/06-integrations/WHATSAPP_REAL_PLAN.md`
- PILOT_PLAN.md: plan de 30 días con métricas y contingencias → `docs/07-go-to-market/PILOT_PLAN.md`
- DISCOVERY_QUESTIONS.md: preguntas de discovery para entrevistar producers → `docs/07-go-to-market/DISCOVERY_QUESTIONS.md`
- SUPABASE_SAFETY_RULES.md: reglas de migraciones y project-ref → `docs/00-ai-context/SUPABASE_SAFETY_RULES.md`
- DECISION-005: flujo manual asistido → `docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md`
