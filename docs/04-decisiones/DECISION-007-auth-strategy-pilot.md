# DECISION-007 — Email + password como autenticación principal para demo/piloto

- **Fecha:** 2026-06-29
- **Estado:** Aceptada
- **Reemplaza parcialmente:** DECISION-002 (que especificaba magic link para el piloto)
- **Tomada por:** Manuel Benítez — sesión de desarrollo

---

## Contexto

El MVP-01 se construyó inicialmente con magic link (OTP por email) como único mecanismo
de autenticación. La decisión original (DECISION-002) priorizó la velocidad de implementación
sobre la experiencia de usuario.

Durante las primeras pruebas locales del flujo de demo, el magic link generó fricción real:

- Los emails tardaban en llegar o quedaban en Mailpit sin que el usuario los viera.
- El flow PKCE/implicit generó bugs en el flujo de redirección local (`localhost` vs `127.0.0.1`).
- El acceso dependía de tener el cliente de email abierto durante la demo.
- Los links de un solo uso se quemaban al hacer pruebas repetidas.
- La demo comercial no puede depender de que llegue un email para mostrar valor.

El público objetivo (productores y brokers de seguros B2B) espera un acceso más directo.
Para una demo en vivo, la autenticación no puede ser el punto de falla.

---

## Opciones consideradas

### Opción 1 — Mantener magic link, arreglar bugs

**Pros:**
- Sin contraseña que manejar.
- Menos superficie de passwords comprometidos.
- Ya está implementado.

**Contras:**
- Depende del email para cada acceso.
- Puede demorar o fallar en entornos locales.
- Rompe demos en vivo.
- Genera fricción en cada sesión.
- Menos familiar para algunos productores B2B.
- Los bugs PKCE/implicit son workarounds, no una solución estructural.
- La demo comercial se fragiliza si el acceso falla.

### Opción 2 — Email + password como método principal

**Pros:**
- Familiar para usuarios B2B.
- Acceso directo sin depender del email.
- No rompe demos.
- Compatible con MFA futuro (TOTP, SMS).
- Compatible con reset password futuro.
- El productor puede entrar desde cualquier dispositivo sin buscar un email.
- Menor fricción de onboarding para el piloto.

**Contras:**
- Requiere manejar reset password en el futuro.
- Usuarios pueden olvidar contraseña.
- Hay que cuidar UX del error de credenciales.

### Opción 3 — OAuth con Google como principal

**Pros:**
- Sin contraseña propia.
- Familiar.

**Contras:**
- Requiere integración OAuth completa.
- Mezclamos login con Google y la futura integración de Gmail (son cosas distintas).
- No es la prioridad para el piloto.
- Agrega dependencia externa para el acceso a la demo.

---

## Decisión tomada

**Email + password pasa a ser el método principal de autenticación.**

- Magic link se conserva en el código como fallback técnico secundario pero no aparece
  como flujo principal en la UI ni en la documentación operativa.
- MFA queda como evolución futura (no en este piloto).
- Google login queda como evolución futura.
- Gmail integración es un módulo separado y no debe mezclarse con el mecanismo de login.

---

## Pros y contras de esta decisión (resumen ejecutivo)

### Email + password — pros
- Familiar para B2B.
- Directo: no depende del correo para cada acceso.
- Mejor para demos en vivo.
- Compatible con MFA futuro.
- Compatible con reset password futuro.
- Sin puntos de falla externos durante la demo.

### Email + password — contras
- Requiere manejar reset password más adelante.
- Usuarios pueden olvidar contraseña.
- Hay que cuidar UX y seguridad de credenciales.

### Magic link — pros (referencia)
- Sin contraseña.
- Rápido para prototipos.
- Menos superficie de passwords.

### Magic link — contras (por qué dejó de ser principal)
- Depende del email.
- Puede demorar o fallar.
- Rompe demos.
- Genera fricción.
- Menos familiar para algunos productores.
- Mala experiencia si el usuario quiere entrar rápido.

---

## Consecuencias

### Código
- `app/login/page.tsx` actualizado: formulario email + password como principal.
  Magic link movido a opción secundaria discreta o removido de la UI.
- `app/actions/auth.ts` actualizado: se agrega `signInWithPassword()`.
  `sendMagicLink()` se conserva con comentario de "fallback secundario".
- `lib/supabase/server.ts` tiene `flowType: 'pkce'` (agregado en debug de auth).

### Base de datos
- Sin cambios de schema.
- Sin `supabase db push`.
- Sin migraciones nuevas.
- Usuario demo `demo@seguroflow.local` tiene password `Demo123456!` configurado
  via Admin API local.

### Documentación
- `README.md` actualizado: login local con email + password.
- `CURRENT_STATE.md` actualizado: auth strategy cambiada.
- `DEMO_SCRIPT_5_MIN.md` actualizado: demo entra con credenciales, no magic link.
- `PRE_PILOT_CHECKLIST.md` actualizado: auth section con email + password para piloto.

### Decisiones futuras habilitadas
- **Reset password** — implementar antes del piloto real con productores externos.
- **Invitación controlada** — crear usuarios piloto de forma controlada, sin registro público.
- **MFA opcional** — para owners/admins en producción.
- **Google login** — como alternativa OAuth futura, independiente de Gmail integración.
- **Gmail integración** — módulo separado de negocio, sin relación con el login.

### Restricciones que NO cambian
- `supabase db push` sigue prohibido sin autorización humana explícita.
- TuHoroscopoCosmico.com sigue prohibido desde este repositorio.
- No se usan datos reales.
- Service role key solo en servidor, nunca en frontend.
- RLS no se toca.
- Modelo multi-tenant no cambia: `auth.users → profiles → producer_members → producers`.
- Registro público sigue cerrado — no se puede crear cuenta sin acceso controlado.

---

## Estrategia de auth por fase

### Ahora — Demo local / Piloto inicial
- Email + password como login principal.
- Usuario demo: `demo@seguroflow.local` / `Demo123456!` (solo entorno local).
- Registro público cerrado: solo usuarios creados manualmente por el equipo.
- Magic link disponible como fallback técnico, no visible en la UI principal.

### Futuro cercano (pre-piloto real con productores)
- Reset password para usuarios existentes.
- Invitación controlada: crear usuarios piloto sin abrir el registro público.
- Gestión básica de usuarios por producer.
- MFA opcional para owners/admins.

### Futuro (post-piloto, escala)
- MFA recomendado u obligatorio según sensibilidad del productor.
- Google login como alternativa OAuth.
- Gmail como módulo de integración separado — NO parte del login.

---

*Ver: DECISION-002 (stack original con magic link) — parcialmente reemplazado en lo que respecta a auth.*
*Ver: DECISION-003 (modelo multi-tenant y RLS) — sin cambios.*
