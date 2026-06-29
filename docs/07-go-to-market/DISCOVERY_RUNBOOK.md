# DISCOVERY_RUNBOOK.md — Runbook de Discovery Comercial

> **Para quién es esto:** La persona del equipo que conduce las entrevistas
> de discovery con productores y brokers reales.
>
> **Qué es esto:** Un runbook paso a paso para ejecutar 3-5 reuniones de discovery,
> registrar feedback de forma ordenada y tomar la decisión de avanzar o no a piloto real.
>
> **Herramientas de apoyo:**
> - Demo: `docs/07-go-to-market/DEMO_SCRIPT_5_MIN.md`
> - Registro por productor: `docs/07-go-to-market/PRODUCER_FEEDBACK_TEMPLATE.md`
> - Mensajes de contacto: `docs/07-go-to-market/OUTREACH_MESSAGES.md`
> - Preguntas de profundidad: `docs/07-go-to-market/DISCOVERY_QUESTIONS.md`
>
> **Última actualización:** 2026-06-29

---

## 1. Objetivo del discovery

No se va a vender nada en estas reuniones. El objetivo es entender si el problema
existe de verdad antes de invertir más tiempo en construir.

Específicamente, queremos validar:

**a) ¿El dolor es real?**
¿El productor realmente pierde cotizaciones por falta de seguimiento?
¿Eso le duele en dinero, en tiempo, o en reputación?
Si el problema no existe o ya lo tiene resuelto, el producto no tiene mercado en él.

**b) ¿El flujo de seguimiento asistido tiene valor?**
Cuando ve la demo, ¿reconoce que eso es lo que le falta?
¿El flujo de aprobación → envío → registro le parece útil, o le parece burocrático?

**c) ¿La aprobación humana es deseable o es una fricción?**
Algunos productores van a querer control total (aprobar cada mensaje).
Otros van a querer automatización total y van a ver la aprobación como un paso extra.
Entender qué prefiere define cómo escalar el producto.

**d) ¿Qué métrica le importa?**
¿Le importa saber cuántos respondieron? ¿Cuántos cerraron? ¿Cuánto tiempo pasó?
La métrica que mencione espontáneamente es la que define el valor percibido.

**e) ¿Aceptaría un piloto? ¿Pagaría por esto?**
No hace falta que pague ahora. Pero si no aceptaría ni un piloto gratuito con
10 cotizaciones, hay alguna barrera que hay que entender antes de seguir.

---

## 2. Perfil de productor ideal para entrevistar

### Perfil buscado

- Productor o broker independiente (no una empresa grande con procesos formales).
- Cotiza seguros por WhatsApp — auto, vida, hogar, salud, combinados.
- Tiene entre 10 y 100 cotizaciones nuevas por mes.
- Reconoce que pierde seguimiento manual de algunas cotizaciones.
- Le interesa mejorar su tasa de cierre.
- No necesita integración con sistemas core de aseguradoras desde el día 1.
- Tiene disposición a probar herramientas nuevas.

### Perfil a evitar para el primer piloto

- Empresas grandes con procesos y CRM establecidos — la fricción de cambio es alta.
- Productores que no usan WhatsApp con sus prospectos.
- Productores que tienen menos de 5 cotizaciones por mes — el volumen no justifica
  el esfuerzo de onboarding.
- Productores que necesitan integración automática con liquidadores, pólizas o ERPs
  desde el día 1 — ese no es el MVP.
- Productores que dicen que nunca pierden seguimiento — puede ser cierto, o puede
  ser que no sean conscientes del problema.

### De dónde sacar candidatos

- Red personal del equipo — referidos de conocidos en el sector.
- LinkedIn: búsqueda "productor de seguros Uruguay" o "agente de seguros".
- Grupos de WhatsApp o Telegram del sector asegurador.
- Cámaras o asociaciones de brokers (CAMOSE, AUSA u otras).
- Productores que ya hayan consultado sobre alguna herramienta similar.

---

## 3. Estructura de la reunión de 30 minutos

### Antes de la reunión (5 minutos de preparación)

- Tener el sistema local corriendo: `npm run dev` en `localhost:3000`.
- Revisar el DEMO_SCRIPT_5_MIN.md.
- Preparar la plantilla PRODUCER_FEEDBACK_TEMPLATE.md para completar durante o después.
- Llevar datos ficticios listos para cargar (nombre, teléfono ficticio, tipo de seguro).
- Silenciar notificaciones durante la demo.

---

### Bloque 1 — Contexto y dolor (5 minutos)

**Objetivo:** Que el productor hable. Escuchar más que hablar.

No abrir el sistema todavía.

Abrir con:

> "Te agradezco el tiempo. Antes de mostrarte nada, me gustaría entender cómo
> trabajás hoy. Tengo algunas preguntas sobre el proceso de cotizaciones y
> seguimiento — son para que yo entienda el contexto, no hay respuestas correctas."

Hacer 2 o 3 preguntas del Bloque de preguntas pre-demo (sección 4).
Dejar que hable. No interrumpir. Tomar nota de lo que dice con sus propias palabras.

**Señal de que vas bien:** El productor menciona espontáneamente casos concretos
de cotizaciones perdidas o de la dificultad de hacer seguimiento.

**Señal de alerta:** Dice que tiene todo bajo control. Profundizar antes de seguir.

---

### Bloque 2 — Proceso actual (5 minutos)

**Objetivo:** Entender el flujo de trabajo real hoy, antes de proponer nada.

Hacer 2 o 3 preguntas del bloque de proceso actual (sección 4).
Preguntar sobre herramientas, frecuencia, quién hace qué, cuánto tiempo lleva.

No mencionar todavía cómo funciona el sistema. Solo escuchar.

**Lo que querés saber al final de este bloque:**
- ¿Cómo registra cotizaciones hoy? (Excel, cuaderno, CRM, nada)
- ¿Cuándo y cómo hace el seguimiento? (manual, WhatsApp, teléfono, email)
- ¿Alguien del equipo lo ayuda? ¿O lo hace solo?
- ¿Tiene algún número de cotizaciones no cerradas?

---

### Bloque 3 — Demo guiada (10 minutos)

**Objetivo:** Mostrar el flujo completo y observar la reacción.

Usar DEMO_SCRIPT_5_MIN.md como guía. No leerlo en voz alta — usarlo como mapa.

Los 8 pasos de la demo en orden:
1. Dashboard — mostrar el flujo completo, aclarar que es demo local.
2. Nueva cotización — cargar con datos ficticios.
3. Scheduler — ejecutar manualmente.
4. Cola de aprobación — mostrar el mensaje sugerido, preguntar si lo cambiaría.
5. Outbox — simular envío.
6. Timeline — mostrar trazabilidad completa.
7. Simular respuesta — elegir un escenario con el productor.
8. Métricas — mostrar conteos y tasas.

**Regla de oro de la demo:** Hacer preguntas de discovery durante la demo,
no solo después. Mientras muestra la cola de aprobación, preguntar:
"¿Cambiarías algo de este mensaje?"
Mientras muestra el outbox: "¿Te sentirías cómodo mandando esto a un cliente tuyo?"

**Qué observar durante la demo:**
- ¿Hace preguntas? ¿Cuáles?
- ¿Se inclina hacia adelante o se recuesta?
- ¿Menciona casos concretos suyos mientras ve el sistema?
- ¿Pregunta espontáneamente sobre precio o sobre piloto?

---

### Bloque 4 — Feedback (5 minutos)

**Objetivo:** Entender qué vio, qué le gustó, qué no, qué cambiaría.

Usar las preguntas post-demo de la sección 5.
Hacer 3 o 4 preguntas, no más. Dejar que desarrolle.

No defender el producto si critica algo. Escuchar y anotar.

**Pregunta más importante de todo el bloque:**
> "¿Qué tendría que pasar para que pruebes esto con 10 cotizaciones reales?"

La respuesta a esa pregunta define si es candidato a piloto y qué barrera hay que resolver.

---

### Bloque 5 — Cierre y posible piloto (5 minutos)

**Objetivo:** Dejar claro el siguiente paso, sea cual sea.

Si hay señales positivas:

> "Me alegra que te haya parecido útil. La propuesta es concreta: hacemos una
> prueba con 10 o 20 cotizaciones que tengas pendientes de seguimiento.
> No te comprometo a nada todavía — queremos entender si el sistema funciona
> para tu caso antes de decidir si conectamos WhatsApp real.
> ¿Cuándo podríamos arrancar?"

Si hay señales mixtas:

> "Entendido — hay cosas que te sirven y cosas que no. ¿Puedo preguntarte
> qué debería cambiar para que esto tuviera más sentido para vos?
> Me ayuda mucho para saber cómo mejorar."

Si no es el perfil adecuado:

> "Tiene mucho sentido lo que me decís. Quizás en este momento el sistema
> no es lo que necesitás. Si en algún momento cambia el contexto, te aviso.
> ¿Hay algún colega tuyo que creas que podría tener este problema más marcado?"

**Siempre cerrar con un próximo paso concreto**, aunque sea "te mando un mensaje
la semana que viene para saber si llegaste a revisar X."

---

## 4. Preguntas antes de mostrar la demo

Elegir 3 o 4. No hacer todas.

### Sobre el contexto general

- "¿Por dónde te llegan las consultas de seguros? ¿WhatsApp, teléfono, web, otro?"
- "¿Tenés idea de cuántas cotizaciones nuevas hacés por mes, aproximadamente?"
- "¿Trabajás solo o tenés equipo?"

### Sobre el proceso de cotización

- "Cuando alguien te pide una cotización, ¿dónde la registrás?"
- "¿Usás alguna herramienta para organizar las cotizaciones — Excel, CRM, algo del celular?"
- "¿Cuánto tiempo pasa desde que mandás la cotización hasta que hacés el primer seguimiento?"

### Sobre el seguimiento

- "¿Cómo hacés hoy el seguimiento de cotizaciones que no cerraron?"
- "¿Quién se encarga de recontactar al prospecto — vos o alguien de tu equipo?"
- "¿Cada cuánto tiempo se te pierde alguna cotización porque nadie hizo seguimiento?"
- "¿Tenés algún número en la cabeza de cotizaciones que enviaste este mes y no sabés qué pasó?"

### Sobre el dolor

- "¿Qué es lo que más te frustra del proceso actual de seguimiento?"
- "Si pudieras cambiar una sola cosa de cómo manejás las cotizaciones hoy, ¿qué sería?"

---

## 5. Preguntas después de la demo

Elegir 4 o 5. No hacer todas seguidas — intercalar y escuchar.

### Sobre el problema

- "¿Esto se parece a un problema real tuyo, o es algo que no ves en tu trabajo diario?"
- "¿Cuál de las pantallas que viste te resonó más con algo que te pase hoy?"

### Sobre el flujo

- "¿Qué parte de lo que viste te resultó más útil?"
- "¿Qué parte te sobró o te pareció innecesaria?"
- "¿Cambiarías el orden de algún paso?"

### Sobre el control y la aprobación

- "¿Te daría confianza revisar el mensaje antes de que salga, o lo verías como un paso extra?"
- "¿Preferirías que el sistema mande el mensaje automático una vez aprobado, o querés confirmar de vuelta antes del envío?"
- "¿Qué mensaje te parecería adecuado mandar a un prospecto que no respondió en 48 horas?"

### Sobre los tiempos

- "¿Cuánto tiempo esperarías vos antes de hacer el primer seguimiento?"
- "¿Y si el prospecto no responde al primer mensaje — cuándo mandarías uno segundo?"

### Sobre las métricas

- "¿Qué métrica te importaría ver en el dashboard — respuestas, interesados, conversiones, otra?"
- "¿Hoy tenés algún número de cuántas cotizaciones se convierten en póliza?"

### Sobre el piloto

- "¿Qué tendría que pasar para que pruebes esto con 10 cotizaciones reales?"
- "¿Hay algo que te impediría probarlo?"
- "Si esto recuperara 2 o 3 cotizaciones por mes que hoy se pierden, ¿cuánto valdría eso para vos?"

---

## 6. Señales positivas

Anotar cuando aparezcan. Son indicadores de que vale la pena avanzar.

**Señales de dolor real:**
- Menciona cotizaciones concretas que se le perdieron ("el mes pasado tuve 5 que no seguí").
- Dice que el seguimiento depende de que se acuerde ("a veces se me pasa").
- Reconoce que no tiene ningún número de cotizaciones no cerradas.
- Menciona que otros meses vendió más cuando tuvo tiempo de seguir mejor.

**Señales de interés en el producto:**
- Se inclina hacia adelante durante la demo o pide ver algo de nuevo.
- Pregunta espontáneamente cuándo puede probarlo.
- Propone casos reales ("esto lo haría con los autos que cotizo los lunes").
- Menciona cotizaciones concretas que tiene ahora mismo para probar.
- Pregunta por precio o por condiciones del piloto.
- Pregunta si puede invitar a un colega a ver la demo.

**Señales de disposición a piloto:**
- Dice que puede cargar cotizaciones sin problema.
- Acepta que empieza con datos ficticios o con cotizaciones viejas para validar.
- Propone una fecha para empezar.
- Pregunta qué necesita de su lado para arrancar.

---

## 7. Señales negativas

Tener en cuenta — no necesariamente descartarlo, pero sí retrasar el piloto.

**Señales de que no es el perfil:**
- Tiene menos de 5-10 cotizaciones por mes — el volumen no justifica el sistema.
- No usa WhatsApp con sus prospectos — el canal no aplica.
- Ya tiene un CRM con seguimiento estructurado y lo usa religiosamente.
- Solo trabaja con renovaciones de cartera existente, no con cotizaciones nuevas.

**Señales de que hay barreras importantes:**
- No quiere cargar datos a mano bajo ningún concepto.
- No quiere aprobar mensajes — solo le interesa automatización total.
- No quiere que sus prospectos reciban mensajes de un sistema (solo de él directamente).
- Solo le interesa el sistema si se conecta con su liquidador o aseguradora.
- No ve ningún valor en medir respuestas o seguimiento.

**Señales de que hay que profundizar antes de avanzar:**
- Dice que nunca pierde cotizaciones (puede ser cierto o puede ser que no lo mida).
- Está interesado pero no tiene tiempo — pedir feedback escrito en vez de piloto.
- Le gusta pero espera funcionalidades que no están en el MVP — anotar para el roadmap.

---

## 8. Criterios de decisión: cuándo avanzar a piloto real

Después de completar las 3-5 entrevistas, revisar los PRODUCER_FEEDBACK_TEMPLATE.md
de cada productor y aplicar estos criterios:

### Criterio mínimo para avanzar a WhatsApp real y cloud

**Al menos 2 de cada 3 productores entrevistados:**
- Confirman que el dolor de seguimiento perdido es real y frecuente (Score dolor ≥ 3/5).
- Reconocen que no tienen el problema resuelto con herramientas actuales.
- Dicen que el flujo de la demo tiene sentido para su trabajo.

**Al menos 1 productor:**
- Acepta explícitamente participar en un piloto controlado (aunque sea gratuito).
- Tiene volumen suficiente (10+ cotizaciones por mes).
- Está dispuesto a cargar cotizaciones (aunque sea manual al principio).
- Tiene relación previa con sus prospectos (base para opt-in).

**Claridad sobre el mensaje:**
- Al menos 1 productor revisó el mensaje M1 sugerido y dijo que lo enviaría
  (con o sin ediciones) a un prospecto real.

**Disposición básica para el proceso:**
- Opt-out y consentimiento pueden manejarse — el productor entiende la restricción
  y acepta que no se contacta a nadie sin relación previa.

### Señales de que hay que ajustar antes de avanzar

- Todos los productores dicen que el mensaje M1 no les representa — hay que
  iterar las plantillas antes de conectar WhatsApp real.
- Nadie acepta cargar datos manualmente — hay que priorizar CSV antes que cloud.
- Todos piden funcionalidades que no están en el MVP — hay que decidir si incorporarlas
  o seguir con el alcance actual.
- La objeción más frecuente no tiene respuesta — hay que resolver esa barrera primero.

### Si no se cumplen los criterios mínimos

No avanzar a piloto real. Revisar:
- ¿El perfil de productor entrevistado es el correcto?
- ¿El dolor no existe o no es suficientemente fuerte?
- ¿Hay que cambiar el producto antes de seguir?
- ¿Hay que cambiar el canal o el mercado?

Documentar las conclusiones y consultar antes de tomar la siguiente decisión.

---

## Referencias

- DEMO_SCRIPT_5_MIN.md → `docs/07-go-to-market/DEMO_SCRIPT_5_MIN.md`
- PRODUCER_FEEDBACK_TEMPLATE.md → `docs/07-go-to-market/PRODUCER_FEEDBACK_TEMPLATE.md`
- OUTREACH_MESSAGES.md → `docs/07-go-to-market/OUTREACH_MESSAGES.md`
- DISCOVERY_QUESTIONS.md → `docs/07-go-to-market/DISCOVERY_QUESTIONS.md`
- PRE_PILOT_CHECKLIST.md → `docs/07-go-to-market/PRE_PILOT_CHECKLIST.md`
