# DEMO_SCRIPT_5_MIN.md — Guion Comercial de Demo (5 minutos)

> **Para quién es este guion:** La persona del equipo que muestra SeguroFlow AI
> a un productor o broker real por primera vez.
>
> **Qué es esto:** Un guion de conversación, no un script word-for-word.
> Adaptarlo al contexto del productor. Las frases son sugerencias, no texto
> a leer en voz alta.
>
> **Estado del sistema en la demo:** Demo local simulada. No envía WhatsApp real.
> No usa IA real. No usa datos reales de prospectos.
>
> **Última actualización:** 2026-06-29

---

## 1. Objetivo de la demo

Antes de entrar al sistema, tener claro qué querés validar con este productor:

- **¿Pierde cotizaciones por falta de seguimiento?**
  Si la respuesta es no, el producto no resuelve un dolor real para él.

- **¿Una cola de seguimiento asistido le resulta útil?**
  Que vea el flujo y diga si se parece a cómo trabaja o si le sacaría fricción.

- **¿Aprobar mensajes antes de enviarlos le da confianza?**
  Este es el diferenciador del piloto: el humano siempre aprueba. ¿Eso lo tranquiliza
  o le parece un paso extra innecesario?

- **¿Ver métricas simples le aporta valor?**
  ¿Hoy mide algo del seguimiento? ¿Le importaría saber cuántos prospectos respondieron?

Si después de la demo no podés responder estas cuatro preguntas, la demo no sirvió.

---

## 2. Pitch inicial — 30 segundos

Decirlo antes de abrir el sistema. Tiene que sonar como una conversación,
no como una presentación de empresa.

> "Te cuento en 30 segundos de qué se trata. Básicamente, SeguroFlow AI sirve
> para recuperar cotizaciones que quedan sin cerrar porque nadie las sigue a tiempo.
>
> El flujo es simple: cargás una cotización, el sistema la pone en cola de seguimiento,
> prepara un mensaje de WhatsApp con los datos de esa cotización, vos lo revisás y
> lo aprobás, y después el sistema lo manda. Después medimos qué pasó: quién respondió,
> quién está interesado, quién dijo que no.
>
> Hoy lo que te voy a mostrar es la demo local. Todo funciona, pero los mensajes
> no salen de verdad todavía. La idea es que veas el flujo completo y me digas
> si esto tiene sentido para tu trabajo."

---

## 3. El dolor del productor

Antes o durante la demo, preguntar alguna de estas para entender el contexto real.
No hacer las 5 juntas — elegir 2 o 3 según el momento de la conversación.

- "¿Cuántas cotizaciones te quedan sin respuesta en un mes típico?"
- "¿Cuántas se pierden porque nadie hizo seguimiento al día siguiente?"
- "¿Cómo hacés hoy el seguimiento — te acordás vos, tenés un Excel, usás el WhatsApp del celular?"
- "¿Tenés forma de medir qué pasó con cada cotización que enviaste?"
- "¿Sabés cuántos clientes respondieron, pidieron más info o simplemente nunca contestaron?"
- "Si hicieras seguimiento a todas las cotizaciones que quedan sin cerrar, ¿cuánto tiempo te llevaría?"

Si el productor dice que no pierde cotizaciones o que ya tiene el proceso resuelto,
preguntar más antes de seguir. Puede no ser el perfil ideal para el piloto.

---

## 4. Guion paso a paso de la demo

**Tiempo total objetivo: 5 minutos de demo + 5-10 minutos de conversación.**

---

### Paso 1 — Dashboard (30 segundos)

**Qué mostrar:** `/dashboard`

Señalar: el nombre del producto, el producer demo, el flujo visual de 6 pasos,
los badges que dicen "MVP Local" y "Flujo completo activo".

**Qué decir:**

> "Esto es el panel principal del productor. Ves el flujo completo arriba:
> cargás una cotización, la ponés en seguimiento, aprobás el mensaje, lo mandás,
> el cliente responde, lo medimos.
>
> **Aviso importante:** lo que estás viendo hoy es la demo local. No envía
> WhatsApp real, no usa IA real, no tiene datos reales de clientes.
> Todo esto es para que veas el flujo antes de decidir si querés hacer un piloto real."

---

### Paso 2 — Nueva cotización (45 segundos)

**Qué mostrar:** `/dashboard/quotes/new`

Cargar una cotización de ejemplo con datos ficticios: nombre inventado,
teléfono de formato válido (+598...), tipo de seguro, monto.

**Qué decir:**

> "Acá cargás una cotización nueva. En el MVP empezamos con carga manual, campo
> por campo, para validar qué datos necesitás realmente antes de construir un
> importador de CSV o una integración.
>
> Los campos son básicos: nombre del prospecto, teléfono, tipo de seguro y monto.
> ¿Esto alcanza para mandar un mensaje de seguimiento con sentido? ¿Falta algo?"

**Escuchar la respuesta.** Si el productor menciona campos que no están, anotarlo.

---

### Paso 3 — Scheduler (30 segundos)

**Qué mostrar:** `/dashboard/scheduler`

Mostrar la cotización que aparece como candidata al seguimiento.
Ejecutar el scheduler local.

**Qué decir:**

> "El sistema detecta qué cotizaciones están listas para recibir un seguimiento.
> En producción esto sería automático: un job que corre cada cierta cantidad de horas
> y agarra las cotizaciones que ya pasaron el tiempo de espera configurado.
>
> En la demo lo ejecuto yo manualmente. ¿Ves? La cotización pasó a 'lista para seguimiento'."

---

### Paso 4 — Cola de aprobación (60 segundos)

**Qué mostrar:** `/dashboard/approvals`

Mostrar la tarjeta con el mensaje sugerido ya generado con los datos de la cotización.
Editarlo en vivo si el productor quiere cambiar algo.

**Qué decir:**

> "Acá está la clave del sistema: el mensaje que el sistema prepara para esa cotización,
> con el nombre del prospecto, el tipo de seguro y el monto. Nada sale sin que vos
> lo apruebes primero.
>
> Podés editarlo acá mismo si querés cambiar la redacción. Y cuando estás conforme,
> aprobás. Recién ahí pasa al outbox.
>
> La idea es que el sistema prepare el borrador, pero vos tenés la última palabra
> sobre cada mensaje. Eso evita que salga algo que no querés, y te da control total."

**Pregunta para el productor:**

> "¿Este mensaje te parece adecuado para mandarle a un prospecto tuyo?
> ¿Cambiarías algo?"

---

### Paso 5 — Outbox (30 segundos)

**Qué mostrar:** `/dashboard/outbox`

Mostrar el mensaje aprobado listo para enviar. Hacer clic en "Simular envío".

**Qué decir:**

> "El outbox es la bandeja de salida. Los mensajes aprobados esperan acá.
> Cuando hacés clic en 'Simular envío', en la demo se registra que el mensaje
> habría salido — pero no llega a ningún lado todavía.
>
> En M2, que es la siguiente versión, esto se conectaría a WhatsApp real.
> El botón mandaría el mensaje de verdad al teléfono del prospecto."

---

### Paso 6 — Timeline de la cotización (45 segundos)

**Qué mostrar:** `/dashboard/quotes/[id]`

Navegar al detalle de la cotización. Mostrar el timeline de eventos.

**Qué decir:**

> "Esto es el historial completo de esa cotización: cuándo se creó, cuándo se
> agendó el seguimiento, qué mensaje se aprobó, cuándo se simuló el envío.
>
> Cada acción queda registrada con fecha, hora y quién la hizo — vos, el sistema,
> o el prospecto cuando responde. Eso te da trazabilidad completa de cada caso."

**Qué señalar:**
El badge de estado en la parte superior. Que cambió de `pending_follow_up`
a `scheduled` a `contacted` a medida que avanzó el flujo.

---

### Paso 7 — Simular respuesta (45 segundos)

**Qué mostrar:** Panel de simulación en `/dashboard/quotes/[id]`

Mostrar los 4 botones: Interesado, Con dudas, No interesado, Opt-out.
Hacer clic en uno, mostrar cómo cambia el estado.

**Qué decir:**

> "Acá simulamos lo que pasaría si el prospecto responde.
>
> En el piloto real esto llegaría automáticamente vía webhook cuando el prospecto
> te escriba por WhatsApp. En la demo lo simulamos manual.
>
> Los escenarios son: interesado, con dudas, no interesado, y opt-out.
> Hacemos uno — por ejemplo, 'Interesado'. Ves cómo el estado cambia y queda
> registrado en el timeline.
>
> El opt-out es importante: si el prospecto dice que no quiere que le escriban más,
> el sistema lo bloquea de inmediato. No le sale ningún mensaje más, sin excepción."

---

### Paso 8 — Métricas (30 segundos)

**Qué mostrar:** `/dashboard/metrics`

Señalar los conteos de volumen, el embudo de contacto, y las tasas.

**Qué decir:**

> "Por último, las métricas. Conteos básicos: cuántas cotizaciones tenés, cuántas
> en seguimiento, cuántos mensajes salieron, cuántos prospectos respondieron,
> cuántos están interesados.
>
> En el piloto real esto reflejaría tus datos reales. La pregunta es:
> ¿hoy tenés esta información disponible en algún lado?"

**Pregunta para el productor:**

> "¿Qué número de estos te importaría ver todos los lunes a las 9 de la mañana?"

---

## 5. Preguntas de discovery durante la demo

Intercalar estas durante los pasos, no hacerlas todas juntas al final.
El objetivo es entender cómo trabaja el productor hoy, no interrogarlo.

**Sobre el flujo actual:**
1. "¿Este flujo se parece a cómo trabajás hoy con el seguimiento de cotizaciones?"
2. "¿En qué paso se te pierden más cotizaciones — en el primer seguimiento, en el segundo, o más tarde?"
3. "¿Cuánto tiempo pasa normalmente entre que enviás una cotización y que hacés el primer seguimiento?"

**Sobre el mensaje:**
4. "¿Quién debería aprobar los mensajes en tu caso — vos solo, o también alguien de tu equipo?"
5. "¿Qué mensaje te daría confianza enviar a un cliente que cotizó hace 2 días y no respondió?"
6. "¿Preferís que el sistema sugiera el mensaje y vos lo editás, o preferís escribirlo vos desde cero?"

**Sobre el control:**
7. "¿Te incomoda que el sistema proponga el texto? ¿Por qué sí o por qué no?"
8. "¿Preferís que el envío sea automático una vez que aprobás, o querés un paso más de confirmación?"

**Sobre las métricas:**
9. "¿Hoy medís algo del seguimiento? ¿Tenés algún número que te diga cuántas cotizaciones se convierten en póliza?"
10. "¿Qué métrica sería la más útil para vos — respuestas, interesados, o conversiones reales?"

**Sobre el piloto:**
11. "¿Tenés cotizaciones pendientes ahora mismo que no seguiste todavía?"
12. "¿Qué te impediría usar esto en un piloto de 30 días con 10-20 cotizaciones?"
13. "¿Qué datos mínimos necesitás cargar para que el mensaje tenga sentido?"

**Señal de alerta:** Si el productor dice que ya hace seguimiento perfecto de todas sus
cotizaciones y que nada se le pierde, profundizar antes de continuar. Puede no ser
el perfil correcto para el piloto.

---

## 6. Objeciones probables y respuestas honestas

### "No quiero que parezca spam."

> "Entiendo la preocupación — nadie quiere quemar la relación con sus clientes.
> Por eso el sistema tiene aprobación humana obligatoria: vos revisás el mensaje
> antes de que salga. Nada se manda solo.
>
> Además, si el prospecto dice que no quiere más mensajes, el sistema lo bloquea
> de inmediato — y no le vuelve a escribir nunca más, sin necesidad de que vos
> lo hagas manualmente."

---

### "Mis clientes ya me escriben por WhatsApp."

> "Exactamente, y eso es lo que hace que tenga sentido. La idea no es reemplazar
> esa relación — es ayudarte a que el seguimiento llegue más rápido y de manera
> más consistente. Vos seguís siendo el que aprueba cada mensaje.
>
> Si el cliente ya te conoce por WhatsApp, el mensaje va a llegar de tu número
> con tu voz — solo que preparado más rápido."

---

### "No quiero cargar datos a mano."

> "Tiene sentido. El formulario manual es para validar qué campos hacen falta
> antes de construir el importador. Una vez que tengamos claro eso con el piloto,
> el siguiente paso es CSV o integración directa.
>
> Para arrancar con 10-20 cotizaciones la carga manual tarda minutos. Después
> lo automatizamos."

---

### "No quiero perder control."

> "El control es exactamente lo que el sistema te da. Sin aprobación tuya,
> no sale ningún mensaje. El sistema prepara el borrador; vos decidís si sale o no.
>
> Si en algún momento no querés que salga nada, simplemente no aprobás."

---

### "¿Esto reemplaza al productor?"

> "No. El sistema hace el trabajo de recordar y preparar el mensaje — lo que hoy
> depende de que vos te acuerdes. Vos seguís siendo el que conoce al cliente,
> el que aprueba lo que se dice, y el que cierra la póliza.
>
> La idea es que dediques menos tiempo a acordarte de hacer seguimiento
> y más tiempo a hablar con los que responden."

---

### "¿Qué pasa si el cliente pide que no le escriban más?"

> "Opt-out inmediato. El sistema lo bloquea en el momento en que llega esa respuesta.
> No le vuelve a escribir nada, y queda registrado. Eso también te protege a vos
> como productor."

---

### "¿Esto ya manda WhatsApp real?"

> "Todavía no. Lo que estás viendo hoy es la demo local: el flujo completo funciona,
> pero los mensajes no salen de verdad.
>
> La integración con WhatsApp real es el siguiente paso — lo que llamamos M2.
> La idea de esta demo es validar que el flujo tiene sentido para vos antes de
> invertir tiempo en conectar el WhatsApp real."

---

### "¿Y si el prospecto responde algo que el sistema no entiende?"

> "En el piloto, vos clasificás la respuesta manualmente: si el prospecto respondió
> algo ambiguo, vos elegís si marcarlo como 'interesado', 'con dudas' o 'no interesado'.
>
> La clasificación automática con IA es una fase posterior. En el piloto real,
> el control sigue siendo tuyo."

---

## 7. Cierre de la demo

Después de los 8 pasos, hacer este cierre antes de las preguntas finales.

**Qué decir:**

> "Eso es el flujo completo. En 5 minutos viste cómo una cotización pasa de
> 'sin seguimiento' a 'mensaje enviado y respuesta registrada'.
>
> La propuesta para el siguiente paso es concreta: hacemos una prueba con 10 o 20
> cotizaciones tuyas que hoy no estés siguiendo — nada sensible, podemos empezar
> con cotizaciones viejas o con datos simplificados.
>
> Validamos los mensajes, medimos cuántos responden, y con eso decidimos si
> vale la pena conectar el WhatsApp real para el piloto formal.
>
> ¿Tiene sentido? ¿Hay algo que te gustaría ver diferente antes de dar ese paso?"

**Escuchar sin interrumpir.** Lo que diga en este momento es el insumo más valioso
de toda la conversación.

---

## 8. Qué NO prometer

Esta sección es para la persona que da la demo — no para el productor.

**No prometer:**

- Que la integración con WhatsApp ya está lista o que va a estar en una fecha específica.
- Que el sistema cumple con la ley uruguaya de protección de datos — eso lo valida un asesor.
- Que la IA va a redactar mensajes perfectos de forma autónoma.
- Que el sistema se conecta con las plataformas core de las aseguradoras.
- Que va a recuperar un porcentaje específico de cotizaciones.
- Que el piloto no va a tener bugs o fricciones.
- Que se van a cargar datos reales de prospectos antes de completar el checklist pre-piloto.

**Si el productor pregunta por fechas o integraciones:**

> "Todavía no tengo una fecha comprometida para eso. Lo que sí puedo decirte
> es cuál es el siguiente paso y cuándo podríamos tener eso listo una vez que
> decidamos avanzar juntos."

---

## 9. Versión corta — 60 segundos

Para explicar SeguroFlow AI en una llamada, un mensaje de WhatsApp, o una
conversación casual sin mostrar el sistema.

---

**Versión para WhatsApp / mensaje de texto:**

> "SeguroFlow AI ayuda a productores de seguros a recuperar cotizaciones que quedan
> sin seguimiento. El sistema prepara el mensaje de WhatsApp, el productor lo aprueba,
> y se mide quién responde. El productor siempre revisa antes de que salga algo.
> Hoy tenemos la demo lista para mostrarte cómo funciona — ¿cuándo tenés 15 minutos?"

---

**Versión para llamada o café:**

> "Básicamente resuelve un problema que tienen casi todos los productores: cotizaciones
> que enviaron, el cliente no respondió, y nadie tuvo tiempo de hacer el seguimiento.
>
> Con SeguroFlow AI, la cotización entra al sistema, el sistema prepara el mensaje
> de WhatsApp con los datos de esa cotización, el productor lo aprueba, y sale.
> Después medimos qué pasó: quién respondió, quién está interesado, quién dijo que no.
>
> Hoy estamos en demo local — no manda WhatsApp real todavía. Pero el flujo completo
> funciona y se puede ver. ¿Te muestro en 5 minutos?"

---

## Referencias

- PRE_PILOT_CHECKLIST.md: requisitos antes del primer piloto real → `docs/07-go-to-market/PRE_PILOT_CHECKLIST.md`
- DISCOVERY_QUESTIONS.md: 32 preguntas para discovery profundo → `docs/07-go-to-market/DISCOVERY_QUESTIONS.md`
- PILOT_PLAN.md: plan de 30 días → `docs/07-go-to-market/PILOT_PLAN.md`
- WHATSAPP_REAL_PLAN.md: qué viene después del piloto → `docs/06-integrations/WHATSAPP_REAL_PLAN.md`
