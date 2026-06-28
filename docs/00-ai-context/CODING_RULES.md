# CODING_RULES.md — Reglas de Codificación para SeguroFlow AI

> **ARCHIVO OBLIGATORIO — LEER ANTES DE ESCRIBIR CUALQUIER LÍNEA DE CÓDIGO**
>
> Este archivo aplica a cualquier desarrollador humano o instancia de IA que trabaje
> en este proyecto. Estas reglas no son opcionales ni negociables.

---

## 1. Principio fundamental: Código legible por IA futura

Todo el código producido en este proyecto debe ser comprensible por una instancia de IA
que lo vea por primera vez, sin contexto previo de conversación. Esto significa:

- Comentarios que explican **por qué**, no solo qué hace el código.
- Documentación de cada función/módulo con: intención, entradas, salidas, errores posibles.
- Señales claras sobre decisiones técnicas y sus alternativas descartadas.
- Advertencias explícitas sobre zonas de riesgo (seguridad, privacidad, estado compartido).

---

## 2. Estructura obligatoria de comentarios por función

Cada función o método debe incluir un bloque de documentación con este esquema:

```
/**
 * INTENCIÓN: ¿Para qué existe esta función? ¿Qué problema resuelve?
 *
 * FLUJO:
 *   1. Paso A
 *   2. Paso B
 *   3. Paso C
 *
 * ENTRADAS:
 *   @param nombreParam {Tipo} — Descripción. Restricciones o validaciones esperadas.
 *
 * SALIDAS:
 *   @returns {Tipo} — Qué devuelve y en qué condiciones.
 *
 * ERRORES POSIBLES:
 *   - Si X ocurre → lanza ErrorTipoY con mensaje Z
 *   - Si la API externa falla → ver manejo en catch()
 *
 * DECISIONES TÉCNICAS:
 *   - Se eligió enfoque A sobre B porque [razón concreta].
 *
 * SEGURIDAD / PRIVACIDAD:
 *   - [Indicar si maneja datos sensibles: PII, tokens, contraseñas, etc.]
 *   - [Qué NO debe loguear o exponer esta función]
 */
```

---

## 3. Comentarios inline

Usar comentarios `//` para explicar lógica no obvia dentro del cuerpo de funciones.

Ejemplo correcto:
```js
// Normalizamos el número antes de buscar en WhatsApp porque la API de
// WABA exige formato E.164 sin espacios ni guiones (+5989XXXXXXX)
const phone = normalizePhone(rawInput);
```

**Regla:** Si eliminar el comentario podría confundir a alguien que lee el código
por primera vez, el comentario DEBE existir.

---

## 4. Nombrado de variables y funciones

- Nombres descriptivos. Español o inglés consistente por módulo, sin mezclar.
- Evitar abreviaturas ambiguas: usar `cotizacion` en vez de `cot`, `message` en vez de `msg`.
- Constantes en UPPER_SNAKE_CASE con comentario de propósito.
- Booleanos con prefijo: `isExpired`, `hasSentReminder`, `canRetry`, `shouldEscalate`.

---

## 5. Manejo de datos sensibles (CRÍTICO)

Este proyecto maneja datos de contacto de asegurados: nombre, teléfono, email,
historial de cotizaciones. Son datos PII sujetos a regulación.

Reglas estrictas:
- **Nunca** loguear números de teléfono completos, emails ni nombres en logs de producción.
  Usar máscaras: `+598 9XX XXX X89`.
- Los tokens de acceso a APIs (WhatsApp Business, LLMs, CRM) viven **exclusivamente**
  en variables de entorno. Nunca hardcodeados. Nunca en comentarios. Nunca en logs.
- Todo acceso a datos de contacto debe ir acompañado de un comentario que indique
  la base legal o de negocio que justifica ese acceso.
- Los datos de cotizaciones no cerradas son información comercialmente sensible
  del cliente (productor/corredor). Tratar con la misma reserva que datos PII.

---

## 6. Gestión de errores

- Nunca silenciar errores con `catch(() => {})` vacío.
- Cada bloque `catch` debe:
  1. Loguear el error con contexto suficiente para reproducir (sin datos sensibles).
  2. Decidir si el error es recuperable o fatal.
  3. Devolver un estado claro al llamador, nunca undefined silencioso.
- Errores de APIs externas (WhatsApp, LLM, CRM) deben tener retry logic documentado
  o una nota explícita de por qué no aplica en ese caso.

---

## 7. Variables de entorno

Cada variable de entorno referenciada en el código debe estar:
1. Declarada en `.env.example` con descripción de qué es y dónde obtenerla.
2. Validada al inicio del proceso (startup validation) — el sistema no debe arrancar
   con configuración incompleta.
3. Documentada con qué comportamiento se rompe si falta.

---

## 8. Pruebas

- Todo módulo crítico de negocio (envío de mensajes, detección de cotizaciones vencidas,
  lógica de seguimiento, generación de textos por IA) debe tener tests unitarios.
- Los tests deben documentar el caso que cubren con una descripción en lenguaje natural.
- Mockear todas las APIs externas en tests; nunca llamar servicios reales en la test suite.

---

## 9. Contexto de IA para nuevas sesiones

Al iniciar una sesión de desarrollo con una instancia de IA, proveer siempre:
1. Este archivo (`CODING_RULES.md`).
2. El archivo `/docs/01-vision/VISION.md`.
3. El archivo del módulo en curso desde `/docs/02-mvp/`.
4. El árbol de directorios actual del proyecto (`tree /F` o equivalente).

Sin este contexto, la IA puede tomar decisiones de diseño inconsistentes con el proyecto.

---

*Versión: 1.0 — Fecha: 2026-06-28*
*Mantenido por: el equipo fundador de SeguroFlow AI*
