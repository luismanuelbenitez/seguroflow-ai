# USER_FLOWS.md
# Flujos de Usuario — Recuperador de Cotizaciones No Cerradas

> **Versión:** 1.0 — 2026-06-28
> **Personas:** Productor de seguros, Prospecto (asegurado potencial), Sistema (IA).

---

## Personas involucradas

**A. El Productor**
Productor individual o corredor de seguros en Uruguay. Maneja entre 20 y 100
cotizaciones activas por mes. Vive en WhatsApp y el teléfono. No tiene asistente.
No quiere aprender un sistema complejo.

**B. El Prospecto**
Persona o empresa que pidió una cotización de seguro. Puede estar comparando
con otros productores. No sabe (en el MVP) que el seguimiento es automatizado.

**C. El Sistema (SeguroFlow AI)**
Procesa los datos, detecta oportunidades, genera mensajes, los envía y clasifica
respuestas. Nunca actúa por fuera de los límites definidos en RECUPERADOR_COTIZACIONES.md.

---

## FLUJO 1 — Onboarding del Productor (una vez)

```
PRODUCTOR                         SISTEMA
    |                                 |
    |--- Accede al dashboard web ----->|
    |                                 |
    |<-- Formulario de configuración --|
    |    · Nombre para mensajes        |
    |    · Número WhatsApp Business    |
    |    · Umbral de espera (horas)    |
    |    · Modo: manual / automático   |
    |    · Firma de mensajes           |
    |                                 |
    |--- Sube respuestas aprobadas --->|
    |    (preguntas frecuentes + resp) |
    |                                 |
    |--- Conecta WhatsApp Business --->|
    |    (OAuth / API key)             |
    |                                 |
    |<-- Confirmación: sistema listo --|
    |                                 |
```

**Resultado:** El sistema está configurado y listo para recibir cotizaciones.

---

## FLUJO 2 — Ingreso de una cotización nueva

```
PRODUCTOR                         SISTEMA
    |                                 |
    |--- Opción A: sube CSV ---------->|
    |    (una o varias cotizaciones)   |
    |                                 |
    |--- Opción B: formulario web ---->|
    |    (cotización individual)       |
    |                                 |
    |<-- Validación de datos ----------|
    |    · ¿Teléfono válido?           |
    |    · ¿Campos obligatorios?       |
    |                                 |
    |<-- Si error: lista de errores ---|
    |                                 |
    |<-- Si OK: cotización en NUEVA ---|
    |    con countdown visible         |
    |                                 |
```

**Estado resultante:** `NUEVA` — el sistema espera el umbral.

---

## FLUJO 3 — Activación automática del seguimiento

```
SISTEMA (sin intervención del productor)
    |
    |-- Cada hora: revisa cotizaciones en estado NUEVA
    |   cuya fecha_cotizacion + umbral_horas <= ahora
    |
    |-- Para cada cotización elegible:
    |   |
    |   |-- Genera mensaje personalizado con IA
    |   |
    |   |-- MODO MANUAL: notifica al productor para aprobación
    |   |       PRODUCTOR aprueba → envío
    |   |       PRODUCTOR rechaza / edita → nuevo texto → envío
    |   |       PRODUCTOR ignora 4h → notificación recordatorio
    |   |
    |   |-- MODO AUTOMÁTICO: envía directamente
    |   |
    |   |-- Estado → EN_SEGUIMIENTO → CONTACTADA
    |   |
    |   |-- Registra: timestamp de envío, texto enviado, estado WABA
    |
```

---

## FLUJO 4 — El prospecto responde

```
PROSPECTO                SISTEMA                    PRODUCTOR
    |                       |                           |
    |-- Responde WA -------->|                           |
    |                       |                           |
    |                       |-- Recibe webhook ----------|
    |                       |                           |
    |                       |-- Clasifica respuesta:    |
    |                       |                           |
    |                       |  CASO A: Respuesta positiva / interés
    |                       |  ("sí me interesa", "¿podemos hablar?")
    |                       |     Estado → INTERESADO   |
    |                       |     Notifica al productor <|
    |                       |     Mensaje auto: "¡Perfecto! [Productor]
    |                       |      te contacta en breve."
    |                       |                           |
    |                       |  CASO B: Pregunta del guión aprobado
    |                       |  ("¿cuánto tiempo es válida?")
    |                       |     Responde con texto aprobado
    |                       |     Registra el intercambio
    |                       |     Notifica al productor (informativo)
    |                       |                           |
    |                       |  CASO C: Declinación explícita
    |                       |  ("no me interesa", "ya lo hice con otro")
    |                       |     Estado → CERRADA_PERDIDA
    |                       |     Mensaje auto: "Entendido, gracias.
    |                       |      Cualquier cosa estamos a las órdenes."
    |                       |     Notifica al productor
    |                       |                           |
    |                       |  CASO D: Escalar (todo lo demás)
    |                       |     Estado → REQUIERE_ATENCION_HUMANA
    |                       |     Notifica al productor URGENTE <|
    |                       |     Mensaje auto: "Gracias por responder.
    |                       |      [Productor] te va a contactar."
    |                       |                           |
```

---

## FLUJO 5 — El productor atiende una escalada

```
PRODUCTOR                         SISTEMA
    |                                 |
    |<-- Notificación urgente ---------|
    |    (WhatsApp o email)            |
    |                                 |
    |--- Entra al dashboard ---------->|
    |                                 |
    |<-- Ve: hilo de conversación -----|
    |        + datos de la cotización  |
    |        + estado actual           |
    |                                 |
    |--- Contacta al prospecto ------->| (por fuera del sistema)
    |    (llama, escribe manualmente)  |
    |                                 |
    |--- Actualiza estado en dashboard>|
    |    · CERRADA_GANADA              |
    |    · CERRADA_PERDIDA             |
    |    · PAUSADA                     |
    |                                 |
```

---

## FLUJO 6 — Agotamiento sin respuesta

```
SISTEMA
    |
    |-- 24h sin respuesta al primer mensaje
    |   Estado: SIN_RESPUESTA_1
    |   Envía segundo mensaje (si configurado)
    |   Estado: CONTACTADA_2
    |
    |-- 24h sin respuesta al segundo mensaje
    |   Estado: AGOTADO
    |   Notifica al productor: resumen semanal o alerta individual
    |
    |-- El productor decide qué hacer manualmente

PRODUCTOR
    |
    |-- Puede: llamar directamente
    |-- Puede: marcar DESCARTADA
    |-- Puede: reiniciar el flujo (si el sistema lo permite)
    |
```

---

## FLUJO 7 — Dashboard del productor (vista diaria)

```
Al entrar al dashboard, el productor ve:

+--------------------------------------------------+
| RESUMEN HOY (28/06/2026)                         |
| Cotizaciones activas: 34                         |
| En seguimiento automático: 12                    |
| Requieren tu atención: 3  ← destacado            |
| Cerradas esta semana: 2 ganadas / 5 perdidas     |
+--------------------------------------------------+
|                                                  |
| REQUIEREN ATENCIÓN                               |
| • Carlos R. — Auto — Respondió: "¿me llamás?"   |
| • María L. — Hogar — Número inválido             |
| • Empresa XYZ — Comercio — Declinó (confirmar)   |
|                                                  |
| EN SEGUIMIENTO (12)                              |
| [lista con estado y tiempo transcurrido]         |
|                                                  |
| AGOTADOS / SIN RESPUESTA (8)                     |
| [lista con opción de archivar o reiniciar]       |
+--------------------------------------------------+
```

---

## FLUJO 8 — Recuperación manual asistida de cotización (MVP piloto)

> Este es el flujo que se implementa primero. A diferencia del Flujo 3 (activación
> automática), aquí el producer aprueba cada mensaje antes de que se envíe.
> Refleja el modo `send_mode = 'manual'` con el que arrancan todos los pilots.
>
> Ver: `docs/04-decisiones/DECISION-005-flujo-seguimiento-whatsapp-mvp.md`

```
SISTEMA                   PRODUCTOR                      PROSPECTO
    |                         |                               |
    | [Cron / revisión periódica]                             |
    | Detecta: quote con umbral vencido                       |
    | status: pending_follow_up → scheduled                   |
    |                         |                               |
    | Prepara texto del M1    |                               |
    | (texto sugerido)        |                               |
    | status: scheduled → pending_approval                    |
    |                         |                               |
    |──── Notificación ───────>|                               |
    |     "Hay un mensaje     |                               |
    |      para revisar"      |                               |
    |                         |                               |
    |                         |── Entra al dashboard ────────>|
    |                         |   Ve: texto sugerido         |
    |                         |   Ve: datos del prospect     |
    |                         |   Puede: editar el texto     |
    |                         |                              |
    |                         |── Aprueba / edita y aprueba  |
    |                         |                              |
    |<─ Guarda approved_message ─────────────────────────────|
    | status: pending_approval → contacted                    |
    |                         |                               |
    | [En el futuro: WABA envía M1]                           |
    |─────────────────────────────────────────────────────────>|
    |   "Hola, te escribo de parte de [Productor]..."        |
    |                         |                               |
    |                         |  ── 48-72h sin respuesta ──> |
    |                         |                               |
    | status: contacted → no_response_1                       |
    | Prepara texto M2 (ángulo diferente)                     |
    | status: no_response_1 → pending_approval                |
    |──── Notificación ───────>|                               |
    |     "Segundo mensaje    |                               |
    |      listo para revisar"|                               |
    |                         |── Aprueba M2 ─────────────────|
    | status → contacted_2    |                               |
    | [En el futuro: WABA envía M2]                           |
    |─────────────────────────────────────────────────────────>|
    |   "Solo quería confirmar si tenés dudas..."            |
    |                         |                               |
    |                         |  ── Sin respuesta ──────────> |
    |                         |                               |
    | status: contacted_2 → no_response                       |
    |──── Notificación ───────>|                               |
    |     "Sin respuesta tras |                               |
    |      2 intentos"        |                               |
    |                         |                               |
    |         DECISION DEL PRODUCTOR (manual):                |
    |                         |                               |
    |                         |── Opción A: Enviar M3 manual ->|
    |                         |   (dispara desde dashboard)  |
    |                         |   "Último mensaje de parte..." |
    |                         |                               |
    |                         |── Opción B: Archivar ─────────|
    |                         |   status → closed_lost       |
    |                         |                               |
    |                         |── Opción C: Llamar directo ───|
    |                         |   (por fuera del sistema)    |
    |                         |   Luego actualiza status     |
    |                         |
```

### Variantes cuando el prospecto responde (en cualquier punto del flujo)

```
PROSPECTO responde
    │
    ├─► "Sí me interesa / ¿podemos hablar?"
    │       status → interested
    │       Sistema notifica al producer: [URGENTE]
    │       Respuesta auto: "¡Perfecto! [Productor] te contacta en breve."
    │       El producer cierra la venta manualmente → status → closed_won
    │
    ├─► "No me interesa / ya lo hice con otro"
    │       status → closed_lost
    │       Respuesta auto: "Entendido, gracias. Cualquier cosa estamos."
    │       Sistema notifica al producer: [INFO]
    │
    ├─► "No me escribas más / STOP / Baja"
    │       prospect.opt_out = true INMEDIATAMENTE
    │       Respuesta auto: confirmación de baja
    │       status → opt_out
    │       Trigger en DB bloquea futuros mensajes (segunda barrera)
    │
    └─► Cualquier otra cosa (pregunta, duda, respuesta ambigua)
            status → human_handoff
            Sistema notifica al producer: [REQUIERE ATENCIÓN]
            Respuesta auto: "Le paso tu mensaje a [Productor] directamente."
            El producer atiende manualmente
```

**Resultado exitoso del flujo:** El producer intervino, actualizó el estado de
la cotización y recuperó la oportunidad (`closed_won`) o la cerró ordenadamente
(`closed_lost`, `opt_out`). El sistema registró cada transición en `quote_events`.

---

## Restricciones de UX para el MVP

- El dashboard es **web** (no app móvil) — acceso desde celular aceptable vía browser.
- La notificación principal al productor llega por **WhatsApp** (canal que ya usa).
- El productor **no puede editar** el texto que el sistema ya envió al prospecto.
- El productor **puede pausar** el sistema para una cotización específica en cualquier momento.
- El sistema **nunca envía más de 2 mensajes** a un mismo número sin intervención humana.

---

## Flujos fuera de alcance del MVP

- Multi-productor / corredora con equipo: un solo usuario por cuenta en el MVP.
- Integración con sistema de cotización: el productor ingresa datos manualmente.
- Historial de cotizaciones previas del mismo prospecto: no se cruza data en MVP.
- Agente conversacional completo: el MVP envía 1–2 mensajes, no mantiene conversaciones largas.
