# DECISION-005 — Flujo de Seguimiento WhatsApp para el MVP

- **Fecha:** 2026-06-29
- **Estado:** Aceptada
- **Módulo:** Flujo de seguimiento de cotizaciones — MVP-01 Recuperador de Cotizaciones
- **Depende de:** DECISION-003 (RLS y modelo multi-tenant), DATA_MODEL.md v2.0, MESSAGE_SEQUENCES.md
- **Desbloquea:** Implementación del flujo de seguimiento en el dashboard y eventual integración WABA

---

## Contexto

Una cotización cargada en el sistema no vale nada si no se hace un seguimiento
efectivo. El valor central del MVP-01 es exactamente ese: recordarle al producer
cuándo y cómo hacer contacto, preparar el mensaje, y registrar qué pasó.

Esta decisión define el **flujo mínimo viable** para ese seguimiento:
cuántos mensajes, en qué orden, quién los aprueba, qué estados se recorren,
y qué queda registrado en la base de datos.

**Lo que NO decide este documento:**
- Qué proveedor WABA usar (Twilio, 360dialog, Meta directo — aún no decidido).
- Si la IA generará el texto del mensaje o si será texto fijo (aún no decidido).
- El contenido definitivo de los templates HSM (requiere aprobación de Meta).
- El diseño técnico de la integración del webhook (etapa siguiente).

---

## 1. El flujo que se implementará primero

### Nombre: Recuperación manual asistida

**Descripción:** El producer carga una cotización. Después de un umbral de tiempo
configurable (default: 48 horas), el sistema prepara un mensaje de seguimiento y
se lo presenta al producer para revisión. El producer lo aprueba (o edita) y el
sistema lo envía por WhatsApp. Luego el sistema espera respuesta y clasifica
lo que llega.

**Por qué "manual asistida" y no automática para el piloto:**

1. **Riesgo legal y reputacional.** En el piloto con 1-3 productores reales,
   un mensaje enviado incorrectamente a un prospecto daña la relación del producer
   con su cliente. La revisión humana es la barrera correcta en esta etapa.

2. **Validación del modelo de mensajes.** El producer que revisa cada mensaje
   descubre rápidamente si el tono es adecuado, si le falta o sobra información,
   y si el sistema clasifica bien las respuestas. Este feedback es oro para el
   MVP — más valioso que automatizar pronto.

3. **Confianza del producer en el sistema.** Un producer que aprueba cada mensaje
   siente que el sistema trabaja *con* él, no sin él. Esto facilita el onboarding
   y la adopción. El modo automático puede habilitarse después, cuando el producer
   tenga confianza.

4. **Cumplimiento legal más claro.** El producer firma cada envío. La responsabilidad
   de haber enviado el mensaje es inequívocamente suya. En Argentina y Uruguay, el
   marco legal sobre mensajes comerciales no ha clarificado completamente la
   responsabilidad cuando es una IA quien inicia el contacto sin supervisión.

### Tensión con la regla "máximo 2 mensajes automáticos"

El documento MVP-01 y USER_FLOWS.md establecen: *"el sistema nunca envía más
de 2 mensajes a un mismo número sin intervención humana."*

Esta decisión amplía esa regla de la siguiente manera:

| Modo | Mensajes automáticos sin intervención | Mensaje 3 |
|---|---|---|
| `send_mode = 'automatic'` | Máximo 2 (regla original, sin cambios) | Solo con acción explícita del producer en el dashboard |
| `send_mode = 'manual'` (piloto) | 0 — todos requieren aprobación | Requiere aprobación explícita |

La regla de 2 mensajes automáticos sin intervención **no cambia**. El tercer
mensaje es siempre una acción manual o semi-manual, no un disparo automático.

---

## 2. La secuencia de 3 mensajes del MVP

### Mensaje 1 — Seguimiento inicial

| Campo | Valor |
|---|---|
| Trigger | `quote.status = 'scheduled'` — el umbral `follow_up_hours` venció |
| Estado resultante | `pending_approval` → (tras aprobación) → `contacted` |
| Delay sugerido | 24-48 horas después de la fecha de cotización |
| Objetivo | Recordar la cotización, abrir conversación, no presionar |
| Tono | Humano, breve, cálido, con salida digna |
| Template HSM | `seguimiento_inicial_v1` (requiere aprobación Meta) |
| ¿Requiere aprobación? | **Siempre en el piloto (send_mode = 'manual')** |

**Qué hace el sistema:**
1. Detecta que la quote pasó el umbral y está en `scheduled`.
2. Prepara el texto del mensaje (manual por ahora — sin IA).
3. Cambia estado a `pending_approval`.
4. Notifica al producer: "Hay un mensaje listo para revisar".
5. El producer entra al dashboard, revisa, edita si quiere, aprueba.
6. El sistema guarda el texto aprobado en `quotes.approved_message`.
7. En el futuro: el sistema envía por WABA y cambia estado a `contacted`.

---

### Mensaje 2 — Ayuda / manejo de objeciones

| Campo | Valor |
|---|---|
| Trigger | `quote.status = 'no_response_1'` — sin respuesta 48h después del M1 |
| Estado resultante | `contacted_2` |
| Delay sugerido | 48-72 horas después del Mensaje 1 |
| Objetivo | Preguntar si tiene dudas sobre precio, cobertura o forma de pago |
| Tono | Consultivo, abre posibilidades |
| Template HSM | `seguimiento_dudas_v1` |
| ¿Requiere aprobación? | **Siempre en el piloto** |

**Nota de diseño:** El Mensaje 2 no repite el Mensaje 1. Cambia el ángulo:
en lugar de "te acordás de la cotización", pregunta "¿qué te frenó?".
Esto abre la conversación de una forma diferente y más consultiva.

---

### Mensaje 3 — Último toque (siempre manual)

| Campo | Valor |
|---|---|
| Trigger | Acción explícita del producer desde el dashboard |
| Estado resultante | `contacted` (reutilizamos, no hay estado especial) |
| Delay sugerido | 5-7 días después de la cotización |
| Objetivo | Cerrar el ciclo elegantemente, respetar al prospecto |
| Tono | Respetuoso, sin presión, deja la puerta abierta |
| Template HSM | `cierre_elegante_v1` |
| ¿Requiere aprobación? | **Es en sí mismo una acción manual — el producer lo dispara** |

**Regla crítica:** el sistema **nunca** envía el Mensaje 3 automáticamente.
El producer lo elige desde el dashboard cuando decide hacer un "último intento".
Esto mantiene el control humano sobre el nivel de insistencia y previene spam.

---

## 3. Qué pasa cuando el prospect responde

| Respuesta del prospect | Estado resultante | Acción del sistema |
|---|---|---|
| "Sí, me interesa" / "¿podemos hablar?" | `interested` | Notifica al producer; responde auto: "¡Perfecto! [Producer] te contacta." |
| Pregunta sobre precio / cobertura / vigencia | `responded` | Si tiene respuesta aprobada → responde auto; si no → `human_handoff` |
| "No me interesa" / "ya lo hice con otro" | `closed_lost` | Responde auto con cierre amable; notifica al producer |
| "No me escribas más" / "STOP" / "Baja" | `opt_out` | Envía confirmación de baja; marca `prospect.opt_out = true`; no más mensajes |
| Quiere contratar / pedir póliza | `interested` → `human_handoff` | El producer cierra la venta manualmente; luego marca `closed_won` |
| Respuesta ambigua o fuera de guión | `human_handoff` | Notifica al producer como urgente; responde: "Le paso tu mensaje a [Producer]." |

---

## 4. Cuándo debe pasar a atención humana (human_handoff)

La regla general: **si hay duda, escalar.** Es mejor escalar de más que comprometerse
incorrectamente.

Criterios de escalamiento automático:
- La clasificación de la IA tiene confianza `< 0.80` (cuando se integre IA).
- El prospect pregunta algo que no está cubierto por respuestas aprobadas.
- El prospect expresa una emoción negativa intensa (enojo, frustración, urgencia).
- El prospect pide hablar con una persona o llamar.
- La respuesta contiene términos legales o de reclamo.
- El prospect quiere contratar (la venta la cierra el producer, no el sistema).

Criterios de escalamiento para el piloto manual:
- En el piloto, TODO requiere revisión del producer. El sistema asiste, no actúa.

---

## 5. Cómo se respeta el opt-out

El opt-out es la barrera más crítica del sistema. Tiene **dos niveles independientes**:

**Nivel 1 — Capa de aplicación:**
- Antes de preparar cualquier mensaje, el sistema verifica `prospect.opt_out`.
- Si `opt_out = true`, el sistema no permite crear el mensaje y registra el intento
  bloqueado en `quote_events`.

**Nivel 2 — Trigger en la base de datos:**
- La migración 001 incluye un trigger en `whatsapp_messages`.
- Antes de cada INSERT, el trigger verifica `opt_out` del prospect.
- Si está activo, la inserción falla con una excepción explícita.
- Esto protege contra bugs en la capa de aplicación.

**Tiempo de respuesta al opt-out:**
- El mensaje de confirmación de baja se envía en la misma sesión conversacional.
- `prospect.opt_out` y `prospect.opt_out_at` se actualizan inmediatamente.
- Nunca se puede "deshacer" un opt-out desde la aplicación — requiere acción
  explícita del producer en el dashboard (con confirmación) y solo si el prospecto
  lo solicitó expresamente.

**Soft delete obligatorio:**
- Los prospects con `opt_out = true` no se eliminan de la base de datos.
- Se conserva el registro para cumplir con el deber de no contactar.
- `archived_at` es para archivar visualmente, no para borrar el registro de opt-out.

---

## 6. Cómo se evita parecer spam

Las siguientes reglas se aplican en el diseño del flujo para no comprometer
la reputación del número WABA ni la del producer:

| Regla | Implementación |
|---|---|
| Máximo 3 mensajes por cotización en todo su ciclo | Regla de negocio en el Server Action de envío |
| Mínimo 24 horas entre mensajes | Verificado antes de preparar cada mensaje |
| El Mensaje 3 es siempre manual | No hay estado que lo dispare automáticamente |
| Siempre incluir opción de baja en el Mensaje 1 | Parte del template HSM (`seguimiento_inicial_v1`) |
| No enviar fuera de horario laboral (8h-20h, configurable) | Lógica en el scheduler (a implementar) |
| No más de 1 "seguimiento" simultáneo por prospect | Si el prospect tiene 2 cotizaciones activas con el mismo producer, el sistema lo detecta y lo escala a atención manual |
| No usar urgencia falsa ni escasez artificial | Regla editorial: los templates no pueden incluir frases como "oferta limitada", "última oportunidad" |
| Identificación clara del producer | Cada mensaje menciona al producer por nombre. Cuando se pregunte "¿sos un bot?", el sistema lo declara siempre |

---

## 7. Qué eventos deben registrarse en quote_events

La tabla `quote_events` es **append-only**: nunca se actualiza ni elimina.
Registra la historia completa de cada cotización para auditoría y debugging.

| event_type | Cuándo ocurre | actor |
|---|---|---|
| `quote_ingested` | La cotización fue cargada por el producer | `producer` |
| `follow_up_scheduled` | El sistema detecta que la quote pasó el umbral | `system` |
| `message_prepared` | El texto del mensaje fue generado/preparado | `system` |
| `message_approved` | El producer aprobó el mensaje en el dashboard | `producer` |
| `message_edited` | El producer editó el texto antes de aprobarlo | `producer` |
| `message_sent` | WABA confirmó que el mensaje salió | `system` |
| `message_delivered` | WABA confirmó que llegó al dispositivo del prospect | `system` (vía webhook) |
| `message_read` | WABA confirmó que el prospect lo leyó | `system` (vía webhook) |
| `response_received` | El prospect envió un mensaje inbound | `system` (vía webhook) |
| `response_classified` | La IA clasificó la respuesta | `system` |
| `human_handoff_created` | El sistema escaló al producer | `system` |
| `status_changed` | El estado de la quote cambió | `system` o `producer` |
| `opt_out_received` | El prospect pidió baja | `system` (vía webhook) |
| `opt_out_blocked` | Se intentó enviar un mensaje a un número con opt_out | `system` |
| `follow_up_paused` | El producer pausó el seguimiento | `producer` |
| `follow_up_cancelled` | El producer descartó la cotización | `producer` |

**Regla de auditoría:** cada event_type debe quedar registrado incluso cuando
sea un "evento negativo" (bloqueo por opt-out, error de envío). La tabla es
evidencia del comportamiento del sistema.

---

## 8. Estados de quote utilizados en este flujo

Ver DATA_MODEL.md para la descripción completa de cada estado.
Este diagrama muestra el camino más común (happy path y sus variantes):

```
INGESTA
  |
  └─► pending_follow_up (recién cargada, dentro del umbral)
        |
        │ [umbral vencido — sistema detecta]
        ▼
      scheduled (lista para preparar mensaje)
        |
        │ [sistema prepara mensaje]
        ▼
      pending_approval (esperando que el producer lo revise)
        |
        │ [producer aprueba]                    │ [producer rechaza/pausa]
        ▼                                        ▼
      contacted (M1 enviado)                  paused / cancelled
        |
        ├─► [prospect responde positivo] ──────► interested ──► human_handoff ──► closed_won
        ├─► [prospect declina] ─────────────────► closed_lost
        ├─► [prospect pide baja] ───────────────► opt_out
        ├─► [respuesta ambigua] ────────────────► human_handoff
        │
        │ [sin respuesta, 48h]
        ▼
      no_response_1
        |
        │ [producer aprueba M2]
        ▼
      contacted_2 (M2 enviado)
        |
        ├─► [responde] → (mismos casos que tras M1)
        │
        │ [sin respuesta]
        ▼
      no_response (agotado — pendiente acción manual)
        |
        └─► [producer elige enviar M3 manualmente]
              |
              ▼
            contacted (reutilizamos) ──► (mismos casos que tras M1)

ESTADOS TERMINALES:
  closed_won / closed_lost / opt_out / cancelled / error
```

---

## 9. Alcance del MVP vs. lo que queda fuera

### Se implementará en el MVP

- [ ] Detección de quotes con umbral vencido (cron job o función scheduleable)
- [ ] Cambio de estado de `pending_follow_up` a `scheduled`
- [ ] UI para que el producer vea quotes en `pending_approval` y apruebe el mensaje
- [ ] Guardado de `quotes.approved_message` con el texto aprobado
- [ ] Registro de `quote_events` para cada transición de estado
- [ ] Bloqueo por `opt_out` en capa de aplicación

### Queda fuera del MVP (próximas etapas)

- Integración real con WABA (Twilio, 360dialog o Meta directo) — pendiente DECISION proveedor
- Generación de texto del mensaje con IA — pendiente integración Claude
- Webhook handler para mensajes inbound del prospect
- Clasificación automática de respuestas con IA
- Notificaciones al producer por WhatsApp o email
- Modo `send_mode = 'automatic'`
- Templates HSM aprobados por Meta (proceso tarda 1-7 días hábiles)
- Scheduler de horarios para no enviar fuera de horario laboral
- Dashboard de resumen diario para el producer

---

## 10. Supuestos para validar con productores reales

Estos supuestos guían el diseño del MVP pero no han sido validados con usuarios.
Deben confirmarse o corregirse en las entrevistas de DISCOVERY_QUESTIONS.md.

| Supuesto | Riesgo si es falso |
|---|---|
| El producer prefiere revisar cada mensaje antes de enviarlo | Si prefiere automático, rediseñar el piloto |
| 48 horas es un umbral razonable para el primer mensaje | Si es muy tarde o muy pronto, afecta la efectividad |
| El producer usa WhatsApp para recibir notificaciones del sistema | Si prefiere email u otra vía, cambiar el canal de notificación |
| El prospect no tiene problema con que el primer mensaje venga de un número diferente al que conoce | Si hay fricción de reconocimiento, necesitamos el número del producer o algo famoso |
| Los mensajes en tono informal (+emoji) funcionan en Uruguay | Si el segmento comercial prefiere formalidad, ajustar los templates |
| 3 intentos son suficientes antes de declarar "sin respuesta" | Si el sector necesita más persistencia, ajustar |
| El producer puede distinguir fácilmente entre interés real y cortesía | Si no puede, necesitamos mejor UI de escalamiento |

---

## 11. Consecuencias inmediatas

1. **Documentación actualizada:** MESSAGE_SEQUENCES.md, USER_FLOWS.md y DATA_MODEL.md
   reflejan este flujo como la secuencia MVP de referencia.

2. **Próximo paso en código:** Implementar en el dashboard la vista de quotes en
   `pending_approval` con el texto preparado y el botón "Aprobar" / "Editar y aprobar".

3. **Sin integración WABA todavía:** el flujo completo se puede simular localmente
   con datos ficticios y estados cambiados manualmente, sin enviar un solo mensaje real.

4. **El Mensaje 3 es siempre una acción del producer:** no hay scheduler que lo dispare.
   El producer lo elige. Esto resuelve la tensión con la regla de "máximo 2 mensajes
   automáticos" — el tercer mensaje nunca es automático.

---

*Versión: 1.0 — Fecha: 2026-06-29*
*Mantenido por: el equipo fundador de SeguroFlow AI*
