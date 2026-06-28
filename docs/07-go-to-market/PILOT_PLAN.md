# PILOT_PLAN.md
# Plan de Piloto — MVP SeguroFlow AI

> **Versión:** 1.0 — 2026-06-28
> **Alcance:** 30 días de piloto con 1–3 productores en Uruguay.
> **Objetivo:** Validar el producto con datos reales antes de iterar o escalar.

---

## 1. Objetivo del piloto

Validar que el Recuperador de Cotizaciones genera valor real para productores
uruguayos: más cotizaciones recuperadas, menos tiempo dedicado al seguimiento
manual, sin fricción operativa ni riesgo reputacional para el productor.

**No es objetivo del piloto:** tener el producto perfecto. Es aprender qué funciona,
qué no y qué debemos cambiar antes de vender.

---

## 2. Perfil del productor piloto ideal

**Criterios de inclusión:**
- Productor individual o corredor pequeño (<5 personas) en Uruguay.
- Genera al menos 15–20 cotizaciones por mes.
- Tiene número de WhatsApp activo (personal o de negocio) que usa con clientes.
- Está abierto a probar herramientas nuevas y dar feedback honesto.
- Tiene sus cotizaciones en algún formato recuperable (Excel, lista, sistema propio).

**Criterios de exclusión (para el MVP):**
- Productores con sistema de CRM complejo que esperan integración automática.
- Corredoras grandes con flujos de aprobación interna complejos.
- Productores que solo manejan seguros de vida (regulación adicional, flujos distintos).

**Número objetivo:** 2–3 productores piloto para tener comparación y suficiente volumen.

---

## 3. Condiciones del piloto

- **Duración:** 30 días calendario desde la activación de su cuenta.
- **Costo:** Gratuito para el productor piloto.
- **A cambio:** Disponibilidad para 2 llamadas de feedback (inicio y cierre del piloto)
  y acceso a métricas de uso.
- **Modo de inicio:** modo manual (el productor aprueba cada mensaje antes de que salga).
  Puede pasar a automático si lo solicita tras la primera semana.
- **Soporte:** Canal directo de WhatsApp con el equipo de SeguroFlow AI.

---

## 4. Onboarding del productor piloto

### Semana 0 (antes del lanzamiento):
- [ ] Entrevista de discovery con DISCOVERY_QUESTIONS.md.
- [ ] Configurar su cuenta: nombre, número WABA, umbral, firma.
- [ ] Definir sus respuestas aprobadas (FAQ mínimo de 5 preguntas).
- [ ] Cargar sus primeras 20–30 cotizaciones históricas no cerradas.
- [ ] Explicar claramente qué hará el sistema y qué NO hará.
- [ ] Obtener confirmación escrita de que conoce y acepta los límites del sistema.

### Día 1:
- [ ] Primer mensaje saliente supervisado juntos en tiempo real.
- [ ] Ajuste de tono si el productor no lo siente como "su voz".

### Semana 1:
- [ ] Check-in de 15 minutos: ¿cómo se siente? ¿qué falta? ¿qué sobra?
- [ ] Ajustar umbrales y mensajes según feedback.

### Semana 4 (cierre):
- [ ] Llamada de cierre con métricas completas.
- [ ] Encuesta NPS.
- [ ] Decisión: ¿continúa? ¿se convierte en cliente pago? ¿nos da referidos?

---

## 5. Métricas del piloto

### Métricas de producto (qué mide el sistema):

| Métrica | Descripción | Objetivo mínimo |
|---|---|---|
| **Tasa de entrega** | % de mensajes que llegan correctamente (no fallan) | >95% |
| **Tasa de apertura** | % de mensajes leídos (si el proveedor WABA lo reporta) | Medir, no target |
| **Tasa de respuesta** | % de prospectos contactados que respondieron algo | >15% |
| **Tasa de interés positivo** | De los que respondieron, % con interés activo | >40% |
| **Tasa de conversión** | % de cotizaciones en seguimiento que terminaron en póliza | >5% |
| **Tasa de opt-out** | % que pidió no recibir más mensajes | <3% |
| **Tasa de escalamiento** | % de respuestas que el sistema tuvo que escalar al productor | Medir, calibrar |
| **Tiempo hasta escalamiento** | Cuánto tarda el sistema en notificar al productor | <5 minutos |

### Métricas de experiencia del productor:

| Métrica | Cómo medirla | Objetivo |
|---|---|---|
| **Tiempo ahorrado/semana** | Pregunta directa en entrevista | >3 horas |
| **NPS del productor** | Encuesta al cierre del piloto (0–10) | ≥8 |
| **Satisfacción con mensajes** | ¿Los mensajes suenan como él/ella? (1–5) | ≥4 |
| **Intención de continuar** | ¿Pagarías por esto? ¿Cuánto? | Validar pricing |

### Métricas de negocio (hipótesis a validar):

- ¿Cuál es el ticket de prima promedio de una cotización recuperada?
- ¿Cuántas cotizaciones por mes tiene un productor piloto típico?
- ¿Cuántas cotizaciones recupera el sistema que sin él se habrían perdido?
- ¿Cuánto estaría dispuesto a pagar el productor por eso?

---

## 6. Definición de éxito del piloto

El piloto es exitoso si al final de los 30 días se cumple **al menos** esto:

1. Al menos 1 póliza emitida que el productor atribuye al seguimiento del sistema.
2. NPS del productor ≥8.
3. El productor dice que continuaría usando el sistema si fuera de pago.
4. Cero incidentes de mensajes incorrectos enviados o compromisos no autorizados.

---

## 7. Plan de contingencia

### Si el proveedor de WhatsApp falla:
- Tener un número de backup o proveedor alternativo identificado antes del piloto.
- SLA de resolución: 4 horas en horario hábil.

### Si el productor no carga datos:
- El equipo de SeguroFlow AI hace el ingreso manualmente la primera semana como servicio.
- Objetivo: quitar esa fricción lo antes posible.

### Si el sistema envía un mensaje inadecuado:
- Protocolo inmediato: suspender envíos automáticos, notificar al productor, evaluar daño.
- El productor puede pausar el sistema con un mensaje al soporte.

### Si el prospecto reacciona mal:
- El productor responde personalmente y el sistema queda fuera de esa conversación.
- Registrar el caso para mejorar los mensajes.

---

## 8. Cronograma tentativo

```
Semana -2:  Selección y entrevistas con candidatos a piloto.
Semana -1:  Configuración de cuentas, WABA sandbox, carga de datos.
Semana  1:  Lanzamiento modo manual. Supervisión diaria.
Semana  2:  Check-in. Ajustes de mensajes y configuración.
Semana  3:  Análisis de respuestas recibidas. Calibración de clasificación IA.
Semana  4:  Cierre. Entrevistas. Métricas. Decisión de próximo paso.
```

---

## 9. Precio hipotético a validar en el piloto

No ofrecer precio hasta tener datos del piloto. Las hipótesis de pricing a testear:

- **Modelo A — SaaS fijo:** USD 49–99/mes por productor. Simple, predecible.
- **Modelo B — Por cotización procesada:** USD 1–2 por cotización en seguimiento.
- **Modelo C — Por éxito:** % de la prima de la póliza recuperada (alinea incentivos pero complejo de medir).

Preguntar en la entrevista de cierre: "Si el sistema te recuperó X pólizas
que valían $Y en primas anuales, ¿cuánto pagarías por mes?"

---

## 10. Próximo paso post-piloto

Si el piloto es exitoso:
1. Definir precio y modelo de negocio.
2. Construir el onboarding self-service (sin intervención manual).
3. Resolver aprobación de templates HSM con Meta para mensajes en producción.
4. Expandir a 10–20 productores en Uruguay.
5. Evaluar entrada a Argentina o Paraguay.
