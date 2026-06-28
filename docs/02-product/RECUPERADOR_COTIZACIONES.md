# RECUPERADOR_COTIZACIONES.md
# Definición Funcional del MVP — Recuperador de Cotizaciones No Cerradas

> **Versión:** 1.0 — 2026-06-28
> **Estado:** Diseño funcional. Sin código todavía.
> **Scope:** Uruguay como mercado inicial. Diseñado para escalar a la región.

---

## 1. Qué es y qué problema resuelve

### El problema

Un productor de seguros uruguayo genera entre 20 y 100 cotizaciones por mes.
Entre el 50 y el 70 % no se convierten en pólizas por una razón simple: el
prospecto "se enfría" y el productor no tiene capacidad operativa de hacer
seguimiento manual a todos.

El momento crítico es la ventana de 24 a 96 horas después de enviar la
cotización. Si no hay contacto en ese período, la probabilidad de cierre cae
drásticamente.

### La solución

SeguroFlow AI detecta cotizaciones que entraron en esa ventana sin respuesta y
lanza automáticamente un flujo de seguimiento por WhatsApp en nombre del
productor: un mensaje personalizado generado por IA, en el momento justo.

No reemplaza al productor. Es el sistema que hace el seguimiento que el
productor no tiene tiempo de hacer.

---

## 2. Límites del sistema — Qué la IA hace y qué NO hace

### La IA PUEDE:

- Enviar un mensaje de seguimiento recordando la cotización.
- Responder preguntas genéricas ya aprobadas por el productor (ej.: "¿La cotización tiene vigencia?").
- Pedir confirmación de interés o disponibilidad para hablar.
- Registrar la respuesta del prospecto y notificar al productor.
- Mantener una conversación básica de 2–3 turnos para calificar si el interés sigue activo.

### La IA NO PUEDE (límites duros, no configurables):

- **Confirmar emisión de póliza.** Solo el productor o la aseguradora emiten.
- **Prometer coberturas específicas.** Eso requiere leer y firmar la póliza.
- **Negociar precio o condiciones.** El productor decide si ajusta la cotización.
- **Interpretar legalmente una póliza o cláusula.** Requiere habilitación profesional.
- **Aceptar o rechazar un riesgo.** Es potestad exclusiva de la aseguradora.
- **Comprometer fechas de vigencia.** Solo el productor puede confirmarlas.
- **Actuar si el prospecto pregunta algo fuera del guión aprobado.** Escalar siempre.

> **Regla de oro:** ante la duda, la IA dice "te comunico con [nombre del productor]"
> y registra la interacción para seguimiento manual.

---

## 3. Flujo completo del lead

```
PASO 0 — INGRESO DE COTIZACIÓN
  El productor sube la cotización al sistema.
  Fuente en MVP: carga manual via CSV o formulario web.
  Datos mínimos: nombre, teléfono, tipo de seguro, monto cotizado, fecha.

PASO 1 — ESPERA CONFIGURABLE
  El sistema espera el umbral configurado por el productor.
  Default: 48 horas desde la fecha de cotización.
  Si en ese tiempo el productor marca "cerrada" manualmente → flujo termina.

PASO 2 — ACTIVACIÓN DEL SEGUIMIENTO
  La cotización pasa a estado EN_SEGUIMIENTO.
  El sistema genera el primer mensaje personalizado.
  El productor puede revisar y aprobar antes del envío (modo manual)
  o el sistema envía directamente (modo automático).

PASO 3 — PRIMER CONTACTO
  Mensaje enviado por WhatsApp Business en nombre del productor.
  Estado → CONTACTADA (primer intento).

PASO 4 — MONITOREO DE RESPUESTA
  El sistema espera respuesta por 24 horas.

  Si el prospecto responde:
    → Estado: RESPONDIO
    → El sistema analiza la respuesta.
    → Si es positiva o hay pregunta: notifica al productor inmediatamente.
    → Si la respuesta es clara ("no me interesa"): estado → CERRADA_PERDIDA.
    → Si la respuesta requiere criterio: estado → REQUIERE_ATENCION_HUMANA.

  Si no hay respuesta en 24 horas:
    → Estado: SIN_RESPUESTA_1
    → Segundo mensaje (si el productor lo tiene configurado).

PASO 5 — SEGUNDO INTENTO (opcional)
  Mensaje diferente, tono distinto. Máximo 2 mensajes automáticos en el MVP.
  Sin respuesta tras segundo intento → estado: AGOTADO.

PASO 6 — RESOLUCIÓN FINAL
  El productor revisa las cotizaciones en estado AGOTADO o REQUIERE_ATENCION_HUMANA
  y decide: contacto telefónico, archivar, o reiniciar flujo.
```

---

## 4. Estados posibles de una cotización

| Estado | Descripción | Quién lo asigna |
|---|---|---|
| `NUEVA` | Ingresada al sistema, dentro de la ventana de espera | Sistema automático |
| `EN_SEGUIMIENTO` | Venció el umbral, el flujo automático está activo | Sistema automático |
| `CONTACTADA` | Primer mensaje enviado por WhatsApp | Sistema automático |
| `SIN_RESPUESTA_1` | 24h sin respuesta al primer mensaje | Sistema automático |
| `CONTACTADA_2` | Segundo mensaje enviado | Sistema automático |
| `RESPONDIO` | El prospecto respondió algo | Sistema automático |
| `REQUIERE_ATENCION_HUMANA` | La respuesta requiere criterio del productor | Sistema automático |
| `INTERESADO` | El prospecto confirmó interés activo | Productor o sistema |
| `CERRADA_GANADA` | Se emitió la póliza | Productor (manual) |
| `CERRADA_PERDIDA` | El prospecto declinó explícitamente | Productor o sistema |
| `AGOTADO` | Se agotaron los intentos automáticos sin respuesta | Sistema automático |
| `PAUSADA` | El productor pausó el seguimiento manual | Productor (manual) |
| `DESCARTADA` | El productor decidió no continuar | Productor (manual) |

**Transiciones no permitidas:**
- De `CERRADA_GANADA` o `CERRADA_PERDIDA` → cualquier otro estado (son terminales).
- De `DESCARTADA` → automático (requiere acción manual del productor).

---

## 5. Cuándo debe intervenir un humano (escalamiento)

El sistema escala al productor inmediatamente en cualquiera de estos casos:

1. **El prospecto responde algo que no matchea ninguna respuesta aprobada.**
2. **El prospecto hace una pregunta sobre cobertura, precio, o condiciones.**
3. **El prospecto dice "llamame", "quiero hablar", "tengo una duda".**
4. **El prospecto menciona un siniestro previo o una situación de riesgo.**
5. **El prospecto responde en tono negativo o de queja.**
6. **El prospecto pregunta si es un bot.**
   → El sistema NUNCA miente. Responde: "Soy un asistente de [nombre productor].
      Te comunico con él/ella ahora." y escala.
7. **El mensaje de WhatsApp falla en la entrega (número inválido, bloqueado, etc.).**
8. **Han pasado más de 2 intentos sin respuesta** (estado AGOTADO).

---

## 6. Datos mínimos necesarios

### Por cotización (ingreso obligatorio):
- `nombre_prospecto` — nombre completo o como el productor lo conoce.
- `telefono` — número celular en formato uruguayo (+598 9X XXX XXX).
- `tipo_seguro` — categoría: Auto / Hogar / Vida / Comercio / Otro.
- `fecha_cotizacion` — fecha en que se emitió la cotización.
- `monto_cotizado` — prima mensual o anual estimada (en USD o UYU).

### Opcionales (mejoran personalización del mensaje):
- `descripcion_riesgo` — ej.: "Toyota Hilux 2021", "apartamento Pocitos".
- `aseguradora` — con quién cotizó el productor.
- `notas_internas` — notas del productor para contexto de la IA.
- `canal_origen` — ¿cómo llegó el lead? (referido, web, llamada, etc.)

### Por productor (configuración):
- `nombre_productor` — cómo debe presentarse la IA.
- `numero_whatsapp_negocio` — número de WABA desde el que se envía.
- `umbral_espera_horas` — cuándo activar el seguimiento (default: 48h).
- `modo_envio` — manual (requiere aprobación) o automático.
- `respuestas_aprobadas` — listado de preguntas frecuentes con respuestas validadas.
- `firma_mensaje` — nombre y datos de contacto para el cierre del mensaje.

---

## 7. Riesgos funcionales, legales y comerciales

### Riesgos funcionales

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Número de teléfono incorrecto o desactualizado | Alta | Medio | Validación de formato E.164 en ingreso; notificar al productor si falla entrega |
| El prospecto recibe el mensaje y lo toma como spam | Media | Alto | Mensaje de primer contacto no intrusivo, personalizado con su nombre y datos reales de la cotización |
| La IA responde algo inadecuado fuera del guión | Baja (con límites duros) | Muy alto | Modo guión estricto en MVP; escalar todo lo que no matchea |
| El productor no revisa las notificaciones a tiempo | Media | Medio | Notificación también por email + resumen diario |

### Riesgos legales (Uruguay)

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Ley 18.331 (Protección de Datos Personales) | Los datos de contacto de prospectos son datos personales. Requieren consentimiento para su uso. | El productor declara que tiene relación previa con el prospecto (recibió su cotización) |
| Regulación SSF/BCU | Los intermediarios de seguros en Uruguay están regulados. Comunicaciones comerciales deben ser verídicas. | Los mensajes presentan la cotización ya emitida, no prometen cobertura |
| WhatsApp Business Policy | WABA exige que los mensajes fuera de la ventana de 24h (mensajes iniciados por empresa) usen plantillas pre-aprobadas por Meta. | Diseñar los mensajes como plantillas HSM desde el inicio |
| Spam o comunicaciones no solicitadas | Si el prospecto nunca dio su número explícitamente para este fin | El productor asume la responsabilidad. Incluir opción de opt-out clara en cada mensaje |

### Riesgos comerciales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| El productor piloto no carga datos consistentemente | Sin datos limpios, el sistema no puede funcionar | Proceso de onboarding simple; CSV de ejemplo; formulario web fácil |
| El productor esperaba un CRM completo | Expectativas mal calibradas | Comunicar claramente: esto NO es un CRM, es un recuperador de cotizaciones |
| El prospecto se molesta y el productor pierde la relación | Mensaje mal timed o impersonal | Permitir al productor revisar antes de enviar en modo manual del piloto |

---

## 8. Preguntas abiertas (decisiones pendientes)

- [ ] **¿WhatsApp Business API vía quién?** Twilio, 360dialog, Infobip, o acceso directo Meta.
       Condicionante: acceso en Uruguay, costo por mensaje, soporte de plantillas HSM.
- [ ] **¿LLM para generación de mensajes?** Claude (Anthropic) es la opción preferida.
       ¿Se usa también para clasificar respuestas del prospecto? ¿Con qué prompt?
- [ ] **¿Stack tecnológico?** Ver DECISION-LOG.md para opciones.
- [ ] **¿Modo de aprobación en piloto?** ¿El productor aprueba cada mensaje o confía en el automático?
- [ ] **¿Cuántos mensajes máximo por cotización?** El MVP plantea 2. ¿Es suficiente?
- [ ] **¿Qué pasa si el prospecto responde en inglés o portugués?** (Uruguay fronterizo con Brasil).

---

## 9. Próximos pasos antes de programar

1. **Entrevistar 3–5 productores** usando DISCOVERY_QUESTIONS.md para validar flujo y umbral.
2. **Definir stack tecnológico** y registrar en DECISION-LOG.md.
3. **Seleccionar proveedor de WhatsApp Business API** y crear cuenta sandbox.
4. **Diseñar y pre-aprobar los templates HSM** de los mensajes con Meta.
5. **Modelar la base de datos** — ver DATA_MODEL.md.
6. **Definir el LLM** que clasificará respuestas y generará mensajes.
7. **Establecer las respuestas aprobadas** mínimas con al menos un productor piloto.
8. **Iniciar programación** siguiendo CODING_RULES.md.
