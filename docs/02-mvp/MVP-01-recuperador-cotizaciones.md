# MVP-01 — Recuperador Automático de Cotizaciones No Cerradas

> **Versión:** 1.1 — 2026-06-28
> **Estado:** Definición funcional completa. Sin código todavía.
> **Mercado:** Uruguay (diseñado para escalar a la región).

---

## Qué es

El primer módulo de SeguroFlow AI. Detecta cotizaciones de seguro que no
recibieron respuesta del prospecto, genera un mensaje de seguimiento personalizado
y lo envía por WhatsApp Business en nombre del productor.

El objetivo es recuperar cotizaciones que hoy se pierden simplemente porque el
productor no tiene tiempo de hacer seguimiento manual.

---

## Problema que resuelve

Los productores de seguros generan cotizaciones todos los días. Entre el 50 y 70%
no se convierten en póliza. El motivo principal no es el precio ni la competencia:
es que el prospecto "se enfría" y nadie lo contactó en el momento justo.

El productor no tiene capacidad operativa de hacer seguimiento a todas sus
cotizaciones. SeguroFlow AI hace ese trabajo por él.

---

## Actores del sistema

| Actor | Rol |
|---|---|
| **Productor** | Carga cotizaciones, configura el sistema, recibe notificaciones, cierra ventas. |
| **Prospecto** | Recibe mensajes de seguimiento, responde, es derivado al productor si hay interés. |
| **Sistema (IA)** | Detecta oportunidades, genera mensajes, los envía, clasifica respuestas, escala cuando corresponde. |

---

## Flujo resumido

```
1. El productor carga una cotización al sistema (CSV o formulario).
2. El sistema espera el umbral configurado (default: 48 horas).
3. Si no hay cierre manual en ese tiempo, activa el seguimiento.
4. Genera un mensaje personalizado con los datos de la cotización.
5. Lo envía por WhatsApp Business en nombre del productor.
6. Si el prospecto responde:
   · Interés → notifica al productor.
   · Pregunta aprobada → responde y notifica.
   · Declinación → cierra la cotización y notifica.
   · Cualquier otra cosa → escala al productor de inmediato.
7. Si no hay respuesta en 24h → envía un segundo mensaje (si está configurado).
8. Si no hay respuesta tras ambos intentos → estado AGOTADO → notifica al productor.
```

---

## Alcance del MVP — Lo que SÍ incluye

- Carga de cotizaciones vía CSV o formulario web simple.
- Detección automática de cotizaciones vencidas sin cierre.
- Generación de mensaje personalizado por IA (tipo de seguro, nombre, monto).
- Envío por WhatsApp Business API con soporte de plantillas HSM.
- Clasificación automática de respuestas del prospecto.
- Escalamiento al productor con contexto completo cuando aplica.
- Notificación al productor (WhatsApp y/o email) ante respuestas relevantes.
- Registro de estado de cada cotización con historial de eventos.
- Dashboard web básico: lista de cotizaciones con estado y acciones.
- Resumen diario automático al productor.

## Alcance del MVP — Lo que NO incluye

- Integración automática con sistemas de cotización del productor.
- Agente conversacional completo (el MVP solo hace el primer seguimiento).
- App móvil.
- Multi-usuario por cuenta (el piloto es un productor por cuenta).
- Onboarding self-service (el piloto requiere configuración asistida).

---

## Límites duros de la IA (no negociables)

La IA del MVP puede enviar mensajes de seguimiento, responder preguntas
aprobadas por el productor y escalar conversaciones. Nunca puede:

- Confirmar emisión de póliza.
- Prometer o detallar coberturas específicas.
- Negociar precio o condiciones.
- Interpretar cláusulas de póliza.
- Aceptar o rechazar un riesgo.
- Comprometer fechas de vigencia.
- Mentir sobre ser un sistema automatizado cuando el prospecto lo pregunta.

Si algo no calza en el guión aprobado → escala al productor siempre.

---

## Estados posibles de una cotización

```
NUEVA → EN_SEGUIMIENTO → CONTACTADA → RESPONDIO → INTERESADO → CERRADA_GANADA
                      ↘ SIN_RESPUESTA_1 → CONTACTADA_2 → AGOTADO
                                        ↘ RESPONDIO → CERRADA_PERDIDA
                                                    ↘ REQUIERE_ATENCION_HUMANA
```

Estados terminales: `CERRADA_GANADA`, `CERRADA_PERDIDA`, `DESCARTADA`.
El productor puede pausar o descartar una cotización en cualquier momento.

---

## Datos mínimos para operar

Por cotización: nombre del prospecto, teléfono (E.164), tipo de seguro,
fecha de cotización.

Por productor: nombre para mensajes, número de WhatsApp Business, umbral de
espera en horas, modo de envío (manual o automático), firma de mensajes.

---

## Métricas de éxito del MVP

| Métrica | Objetivo mínimo |
|---|---|
| Tasa de respuesta de prospectos contactados | >15% |
| Tasa de conversión (cotizaciones a pólizas) | >5% |
| Tasa de opt-out | <3% |
| NPS del productor piloto tras 30 días | ≥8 |
| Cero incidentes de compromisos no autorizados | 0 |

---

## Documentación de referencia

| Documento | Contenido |
|---|---|
| [RECUPERADOR_COTIZACIONES.md](../02-product/RECUPERADOR_COTIZACIONES.md) | Especificación funcional detallada: flujo completo, estados, riesgos, decisiones. |
| [USER_FLOWS.md](../02-product/USER_FLOWS.md) | Flujos de usuario paso a paso para todos los actores. |
| [MESSAGE_SEQUENCES.md](../02-product/MESSAGE_SEQUENCES.md) | Textos de mensajes, variantes y respuestas automáticas. |
| [DATA_MODEL.md](../05-architecture/DATA_MODEL.md) | Modelo de datos: tablas, campos, estados y relaciones. |
| [PILOT_PLAN.md](../07-go-to-market/PILOT_PLAN.md) | Plan del piloto con productores reales: métricas, onboarding, contingencias. |
| [DISCOVERY_QUESTIONS.md](../07-go-to-market/DISCOVERY_QUESTIONS.md) | Preguntas para entrevistar productores antes de programar. |
