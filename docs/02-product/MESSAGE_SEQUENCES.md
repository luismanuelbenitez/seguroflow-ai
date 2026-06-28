# MESSAGE_SEQUENCES.md
# Secuencias de Mensajes — WhatsApp Business

> **Versión:** 1.0 — 2026-06-28
> **Contexto:** Todos los mensajes iniciados por el sistema (fuera de la ventana de 24h
> de WhatsApp) deben ser **plantillas HSM aprobadas por Meta** antes de su uso en
> producción. Las variables entre `{{doble llave}}` son los campos dinámicos.
>
> **Importante:** La IA no promete cobertura, no confirma emisión, no interpreta pólizas.

---

## Principios de tono y estilo

- **Cálido pero profesional.** El productor uruguayo tiene una relación personal con su cliente.
- **Concreto.** Mencionar el tipo de seguro y el número aproximado siempre que se pueda.
- **Breve.** Máximo 3 párrafos por mensaje. En WhatsApp, los textos largos no se leen.
- **Sin presión.** Nunca urgencia falsa, nunca "oferta limitada". El prospecto ya cotizó, conoce al productor.
- **Con salida digna.** Siempre incluir opción de decir que no sin drama.
- **Identificación clara.** El mensaje debe dejar claro que viene del productor (persona),
  no de una empresa anónima.

---

## Mensaje 1 — Primer contacto (48h después de la cotización)

### Variante A — Seguro de auto (template HSM: `seguimiento_auto_v1`)

```
Hola {{nombre_prospecto}} 👋

Te escribo de parte de {{nombre_productor}}. Hace unos días te preparamos
una cotización de seguro para tu {{descripcion_riesgo}} por {{monto_cotizado}}/mes.

¿Tuviste oportunidad de revisarla? Si tenés alguna duda o querés ajustar algo,
con gusto lo vemos.

Si ya lo resolviste, también está bien — avisame y te saco de la lista 😊
```

### Variante B — Sin descripción del riesgo (template HSM: `seguimiento_generico_v1`)

```
Hola {{nombre_prospecto}} 👋

Te escribo de parte de {{nombre_productor}}. Hace unos días preparamos una
cotización de {{tipo_seguro}} para vos.

¿Llegaste a revisarla? Si tenés consultas o querés que ajustemos algo, avisame.

Y si ya lo resolviste por otro lado, no hay problema — solo decime para no
molestarte más.
```

### Variante C — Tono más formal (para seguros comerciales/empresas)

```
Estimado/a {{nombre_prospecto}},

Le escribo de parte de {{nombre_productor}} en referencia a la cotización de
{{tipo_seguro}} que preparamos recientemente por {{monto_cotizado}}.

¿Tuvo oportunidad de revisarla? Quedamos a su disposición para cualquier
consulta o ajuste que necesite.

Muchas gracias.
```

---

## Mensaje 2 — Segundo intento (si no hay respuesta en 24h al primer mensaje)

> Solo se envía si el productor tiene habilitado el segundo intento.
> Diferente ángulo: no repetir lo mismo, agregar un hook de valor.

### Variante A — Recordatorio con gancho (template HSM: `segundo_intento_v1`)

```
Hola {{nombre_prospecto}}, te escribo nuevamente de parte de {{nombre_productor}}.

Solo quería confirmar que recibiste la cotización de {{tipo_seguro}}. A veces
estos mensajes se pierden entre tantas conversaciones.

Si querés la revisamos juntos en 5 minutos por llamada — decime cuándo te queda
cómodo y lo coordinamos.
```

### Variante B — Último intento (template HSM: `ultimo_intento_v1`)

```
Hola {{nombre_prospecto}} 👋, último mensaje de parte de {{nombre_productor}}.

Entendemos que estás ocupado/a. Si en algún momento querés retomar la
cotización de {{tipo_seguro}}, estamos disponibles.

¡Que tengas un buen día!
```

> **Nota de diseño:** El "último mensaje" funciona comercialmente porque elimina
> la presión. Muchos prospectos responden a esta variante precisamente porque
> saben que no va a haber más mensajes.

---

## Respuestas automáticas del sistema (dentro de ventana de 24h)

Estas respuestas no son plantillas HSM — son respuestas a mensajes entrantes
del prospecto, que ocurren dentro de la ventana de conversación activa.

### Cuando el prospecto dice "sí me interesa" / "sí, seguimos" / equivalentes:

```
¡Perfecto, {{nombre_prospecto}}! Le aviso a {{nombre_productor}} ahora mismo
para que se comunique con vos.

Normalmente responde dentro de las próximas horas. Si preferís, también podés
escribirle directamente al {{telefono_productor}}.
```

### Cuando el prospecto pregunta "¿cuánto tiempo tiene validez la cotización?"

> Esta respuesta requiere que el productor haya configurado la vigencia real.

```
La cotización tiene vigencia hasta {{fecha_vencimiento_cotizacion}}. Si necesitás
una actualización de precio después de esa fecha, lo pedimos sin problema.

¿Hay algo más en lo que te pueda ayudar?
```

### Cuando el prospecto dice "no me interesa" / "ya lo hice con otro" / equivalentes:

```
Entendido, {{nombre_prospecto}}. Gracias por avisarnos.

Si en algún momento necesitás revisar tu seguro o cotizar algo diferente,
{{nombre_productor}} queda a tu disposición.

¡Buena suerte!
```

### Cuando el prospecto pregunta algo fuera del guión o algo que requiere criterio:

```
Gracias por tu mensaje, {{nombre_prospecto}}. Le paso tu consulta a
{{nombre_productor}} directamente para que te dé la mejor respuesta.

Te contacta en breve.
```

> **Regla de escalamiento:** si el sistema no puede clasificar la respuesta con
> alta confianza (>80%) en una de las categorías anteriores, escala siempre.
> Es mejor escalar de más que comprometerse mal.

### Cuando el prospecto pregunta "¿sos un bot?"

> **Esta respuesta es obligatoria e inalterable. No puede ser modificada por el productor.**

```
Soy un asistente que ayuda a {{nombre_productor}} a gestionar el seguimiento
de cotizaciones. Soy automatizado, no soy {{nombre_productor}} en persona.

Si preferís hablar directamente con él/ella, podés escribirle a
{{telefono_productor}} o te pongo en contacto ahora.
```

---

## Opt-out — Baja de comunicaciones

Todo mensaje inicial (primer contacto) debe incluir o tener disponible
la posibilidad de baja. El sistema debe respetar el opt-out inmediatamente.

### Mensaje de confirmación de opt-out:

```
Listo {{nombre_prospecto}}, no te vamos a escribir más por este medio.

Si en algún momento querés retomar contacto, podés escribirle directamente
a {{nombre_productor}}.

¡Hasta pronto!
```

> **Acción del sistema:** marcar número como OPT_OUT. Nunca volver a enviar
> mensajes automáticos a ese número desde ese productor.

---

## Notificaciones al productor (internas al sistema)

Estas notificaciones van al productor por WhatsApp (número personal) o email.

### Notificación: prospecto respondió con interés

```
🟢 [SeguroFlow] {{nombre_prospecto}} respondió a la cotización de {{tipo_seguro}}.

Mensaje: "{{texto_respuesta_prospecto}}"

→ Ver en dashboard: {{link_cotizacion}}
```

### Notificación: escalamiento urgente

```
🔴 [SeguroFlow] Atención requerida — {{nombre_prospecto}}

El prospecto respondió algo que necesita tu criterio:
"{{texto_respuesta_prospecto}}"

Cotización: {{tipo_seguro}} — {{monto_cotizado}}
→ Ver hilo: {{link_cotizacion}}
```

### Notificación: cotización agotada (sin respuesta)

```
⚪ [SeguroFlow] Sin respuesta — {{nombre_prospecto}}

Enviamos 2 mensajes sin obtener respuesta sobre la cotización de {{tipo_seguro}}.

Podés contactarlo manualmente o archivar la cotización:
→ {{link_cotizacion}}
```

### Resumen diario (enviado a las 8:00 AM)

```
📊 [SeguroFlow] Resumen {{fecha}}

✅ Respondieron hoy: {{n}}
🔴 Requieren atención: {{n}}
⚪ Agotadas sin respuesta: {{n}}
📋 Cotizaciones activas: {{n}}

→ Ver dashboard: {{link_dashboard}}
```

---

## Consideraciones técnicas para los templates HSM

- Todos los mensajes de primera iniciativa deben ser aprobados por Meta como
  "High Struct Messages" (HSM) antes del lanzamiento.
- El proceso de aprobación tarda 1–7 días hábiles por template.
- Las variables `{{doble_llave}}` deben mapearse a campos exactos del modelo de datos.
- Si una variable está vacía (ej.: no hay `descripcion_riesgo`), el sistema debe
  usar la variante de template sin esa variable — nunca enviar "Tu {{descripcion_riesgo}}".
- Clasificar cada template por categoría Meta: `UTILITY` (seguimiento de servicio)
  o `MARKETING`. Los mensajes de cotización clasifican como UTILITY en la mayoría
  de los casos — verificar con el proveedor de WABA elegido.

---

## Versiones pendientes (fuera del MVP)

- Mensajes de felicitación por cierre de póliza (cross-sell futuro).
- Mensajes de renovación (cuando la póliza está próxima a vencer).
- Variantes en portugués para expansión a frontera con Brasil.
- Versión de voz (WhatsApp audio generado por TTS) — investigación futura.
