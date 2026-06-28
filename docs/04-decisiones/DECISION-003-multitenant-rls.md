# DECISION-003 — Modelo Multi-Tenant, Usuarios y RLS

- **Fecha:** 2026-06-28
- **Estado:** Aceptada
- **Módulo:** Transversal — aplica a todo el MVP y a la arquitectura futura
- **Depende de:** DECISION-002 (Supabase + PostgreSQL)

---

## Contexto

El MVP opera con 1–3 productores piloto: parecería suficiente con `producer_id = auth.uid()`.
Ese atajo crea una deuda de arquitectura crítica: cuando una corredora pida agregar
a su asistente o a un vendedor del equipo, toda la capa de datos y RLS hay que
reescribirla.

Esta decisión define el modelo correcto desde el día uno, con la complejidad mínima
necesaria para el MVP pero sin cerrar puertas.

---

## 1. Qué representa `producer_id`

**`producer_id` NO es `auth.uid()`.**

Son dos entidades distintas:

- `auth.uid()` identifica a una **persona física** que inició sesión.
- `producer_id` identifica a una **organización comercial**: el productor individual,
  la corredora, el broker. Es el "tenant" del sistema.

Un productor (organización) puede tener varios usuarios en el futuro.
Un usuario puede, potencialmente, pertenecer a más de un productor.

El MVP tiene solo 1 usuario por productor. Pero el modelo no lo impone.

---

## 2. Las tres tablas de identidad

```
auth.users          → persona que inició sesión (manejada por Supabase)
     ↓  1:1
profiles            → datos personales extendidos del usuario
     ↓  N:M
producer_members    → qué usuarios pertenecen a qué productores y con qué rol
     ↓  N:1
producers           → la organización comercial (el tenant)
```

### `profiles`

Extiende `auth.users`. Se crea automáticamente vía trigger al registrar un usuario.

```
profiles
├── id              UUID, PK — igual a auth.uid() (mismo valor, FK a auth.users.id)
├── full_name       TEXT
├── display_name    TEXT      — cómo aparece en el sistema ("Gonzalo Ruiz")
├── phone           TEXT [PII] — teléfono personal, para recibir notificaciones
├── avatar_url      TEXT NULLABLE
├── created_at      TIMESTAMPTZ DEFAULT now()
└── updated_at      TIMESTAMPTZ DEFAULT now()
```

**RLS en `profiles`:** cada usuario solo lee y edita su propio perfil.

```sql
CREATE POLICY "users_own_profile" ON profiles
  USING (id = auth.uid());
```

---

### `producers`

La organización comercial. El "tenant". Tiene su propio UUID, independiente de
cualquier usuario.

```
producers
├── id                    UUID, PK — el producer_id que viaja en todas las tablas
├── name                  TEXT     — nombre comercial ("Seguros Rodríguez", "Gómez & Asociados")
├── contact_name          TEXT     — persona principal de contacto
├── waba_number           TEXT     — número de WhatsApp Business en E.164
├── waba_provider         TEXT     — 'twilio' | '360dialog' | 'meta_direct'
├── waba_config_ref       TEXT     — referencia al secreto en vault (NUNCA la key real)
├── follow_up_hours       INTEGER DEFAULT 48
├── send_mode             TEXT DEFAULT 'manual'  — 'manual' | 'automatic'
├── message_signature     TEXT     — texto de cierre en mensajes
├── plan                  TEXT DEFAULT 'pilot'   — 'pilot' | 'starter' | 'pro' | 'enterprise'
├── status                TEXT DEFAULT 'active'  — 'active' | 'inactive' | 'suspended'
├── created_at            TIMESTAMPTZ DEFAULT now()
└── updated_at            TIMESTAMPTZ DEFAULT now()
```

**RLS en `producers`:** un usuario puede leer los productores a los que pertenece.
Solo el sistema (service role) puede insertar nuevos productores.

```sql
CREATE POLICY "members_read_own_producer" ON producers
  FOR SELECT
  USING (id IN (SELECT producer_id FROM producer_members
                WHERE user_id = auth.uid() AND is_active = true));
```

---

### `producer_members`

La tabla puente. Vincula usuarios con productores y define el rol.

```
producer_members
├── id            UUID, PK
├── producer_id   UUID, FK → producers.id
├── user_id       UUID, FK → auth.users.id
├── role          TEXT DEFAULT 'owner'  — 'owner' | 'admin' | 'agent' | 'viewer'
├── is_active     BOOLEAN DEFAULT true
├── invited_at    TIMESTAMPTZ DEFAULT now()
├── accepted_at   TIMESTAMPTZ NULLABLE  — null si la invitación está pendiente
└── created_at    TIMESTAMPTZ DEFAULT now()

UNIQUE (producer_id, user_id)
```

**En el MVP:** cada productor tiene exactamente una fila aquí con `role = 'owner'`.
El proceso de invitación de nuevos miembros no existe en el MVP — se inserta
manualmente desde el backend.

**RLS en `producer_members`:** un usuario puede ver sus propias membresías.

```sql
CREATE POLICY "users_own_memberships" ON producer_members
  FOR SELECT
  USING (user_id = auth.uid());
```

---

## 3. Función helper de RLS

Para evitar repetir la lógica de membresía en cada política, se define
una función SQL reutilizable con `SECURITY DEFINER`:

```sql
-- INTENCIÓN: devuelve todos los producer_id a los que pertenece el usuario actual.
-- Se marca SECURITY DEFINER para poder leer producer_members incluso si el usuario
-- no tiene acceso directo a esa tabla completa.
-- Se marca STABLE porque no modifica datos y su resultado es constante por transacción.
CREATE OR REPLACE FUNCTION public.get_my_producer_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT producer_id
  FROM producer_members
  WHERE user_id = auth.uid()
    AND is_active = true
$$;
```

Esta función es el único lugar donde vive la lógica de membresía.
Todas las políticas la llaman en lugar de repetir el subquery.

---

## 4. Tablas de negocio y su `producer_id`

**Regla:** todas las tablas de negocio llevan `producer_id` explícito como columna.

No basta con derivarlo via JOIN (`quotes → prospects → producer_id`).
El `producer_id` denormalizado en cada tabla sirve para dos cosas:
1. **Rendimiento de RLS:** la política no necesita JOIN, solo `producer_id IN (...)`.
2. **Auditoría:** cualquier fila puede identificar su tenant sin navegar relaciones.

| Tabla | Lleva `producer_id` | Nota |
|---|---|---|
| `profiles` | No | Es del usuario, no del productor |
| `producers` | Es la entidad misma | — |
| `producer_members` | Sí | Es la clave de toda la jerarquía |
| `prospects` | Sí | Un prospecto pertenece a un productor |
| `quotes` | Sí | — |
| `whatsapp_messages` | Sí | Aunque deriva de `quotes`, lo lleva directo |
| `ai_classifications` | Sí | Ídem |
| `human_handoffs` | Sí | Ídem |
| `quote_events` | Sí | Audit log — necesita producer_id para aislamiento |
| `approved_responses` | Sí | Configuración por productor |

---

## 5. Políticas RLS por tabla

Patrón estándar para todas las tablas de negocio:

```sql
-- SELECT: el productor solo ve sus propios datos
CREATE POLICY "{tabla}_select" ON {tabla}
  FOR SELECT
  USING (producer_id IN (SELECT get_my_producer_ids()));

-- INSERT: el productor solo puede insertar en su propio productor
CREATE POLICY "{tabla}_insert" ON {tabla}
  FOR INSERT
  WITH CHECK (producer_id IN (SELECT get_my_producer_ids()));

-- UPDATE: el productor solo puede actualizar sus propios datos
CREATE POLICY "{tabla}_update" ON {tabla}
  FOR UPDATE
  USING (producer_id IN (SELECT get_my_producer_ids()));

-- DELETE: generalmente NO existe (ver excepciones abajo)
```

### Tablas con políticas especiales

**`quote_events` — solo INSERT, nunca DELETE ni UPDATE:**

```sql
-- Es el audit log inmutable. Una vez registrado un evento, no se modifica ni borra.
CREATE POLICY "quote_events_select" ON quote_events
  FOR SELECT USING (producer_id IN (SELECT get_my_producer_ids()));

CREATE POLICY "quote_events_insert" ON quote_events
  FOR INSERT WITH CHECK (producer_id IN (SELECT get_my_producer_ids()));

-- Sin política UPDATE ni DELETE: Postgres las deniega por defecto con RLS habilitado.
```

**`prospects` — soft delete, nunca hard delete:**

No se borran prospectos. Si el productor quiere "eliminar" uno, se marca con
un campo `archived_at`. Esto preserva el historial de opt-out: si el prospecto
pidió baja, ese registro debe sobrevivir para no volver a contactarlo.

**`approved_responses` — UPDATE sí permitido (el productor edita su FAQ):**

Política de UPDATE estándar aplica.

---

## 6. El webhook de WhatsApp y el service role

Los webhooks de WhatsApp llegan desde el exterior sin ningún usuario autenticado.
Necesitan:
- Leer una cotización por `waba_message_id` o por número de teléfono.
- Insertar mensajes entrantes.
- Actualizar estados de cotizaciones.
- Insertar eventos en el audit log.

**Estos procesos usan el service role key de Supabase, que bypasea RLS.**

Esto es correcto e intencional. El service role se usa exclusivamente para:
- El handler del webhook de WhatsApp.
- El proceso de detección de cotizaciones vencidas (cron/worker).
- Scripts de migración y mantenimiento.

**Cuidados de seguridad obligatorios para procesos con service role:**
1. Verificar la firma HMAC del webhook antes de procesar cualquier dato.
2. Nunca exponer la service role key al cliente (Next.js server-side only).
3. Loguear todas las operaciones del service role con `actor = 'SISTEMA'` en `quote_events`.
4. Tratar el service role key con la misma reserva que una contraseña de producción.

---

## 7. Opt-out — doble barrera

El opt-out del prospecto se respeta en dos capas independientes:

**Capa 1 — Aplicación:** antes de generar o enviar cualquier mensaje, el código
verifica `prospect.opt_out = true` y aborta. Registra el intento en `quote_events`.

**Capa 2 — Base de datos:** una función o trigger que rechaza el INSERT en
`whatsapp_messages` si el `prospect_id` correspondiente tiene `opt_out = true`.

```sql
-- INTENCIÓN: impedir a nivel de base de datos que se inserte un mensaje
-- para un prospecto que pidió baja. Es una segunda línea de defensa
-- en caso de bug en la capa de aplicación.
CREATE OR REPLACE FUNCTION check_prospect_opt_out()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM prospects
    WHERE id = NEW.prospect_id AND opt_out = true
  ) THEN
    RAISE EXCEPTION 'Cannot send message to opted-out prospect: %', NEW.prospect_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_opt_out
  BEFORE INSERT ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION check_prospect_opt_out();
```

---

## 8. MVP vs futuro — qué se implementa y qué no

### SÍ implementar en el MVP

- Las tres tablas: `profiles`, `producers`, `producer_members`.
- `producer_id` en todas las tablas de negocio.
- Función `get_my_producer_ids()`.
- Políticas RLS estándar en todas las tablas.
- `quote_events` sin DELETE ni UPDATE.
- Trigger de opt-out en `whatsapp_messages`.
- 1 usuario por productor, rol `owner`.

### NO implementar en el MVP (diseño preparado, código no)

| Feature | Por qué esperar |
|---|---|
| Invitación de nuevos miembros al equipo | El piloto es 1 usuario. Agregar el flujo es complejidad innecesaria ahora. |
| Permisos por rol (`agent` solo ve sus cotizaciones) | Requiere definir exactamente qué puede hacer cada rol. Mejor con feedback real. |
| Un usuario en múltiples productores | Caso edge que no existe en el piloto. |
| Panel de administración de SeguroFlow AI (ver todos los tenants) | Requiere un rol `super_admin` separado. Fuera de scope del MVP. |
| Auditoría de cambios en configuración del productor | Útil, no crítico para el piloto. |

**Regla de diseño:** aunque no se implementen estas features, el esquema de
base de datos NO debe hacer suposiciones que las imposibiliten. La columna `role`
en `producer_members` existe aunque en el MVP siempre sea `'owner'`.

---

## 9. Datos PII — reglas aplicadas en este modelo

| Columna | Tabla | Tratamiento |
|---|---|---|
| `phone` | `profiles` | PII del usuario del sistema. RLS lo protege. |
| `full_name` | `prospects` | PII del prospecto. No loguear en texto plano. |
| `phone` | `prospects` | PII crítico. No loguear completo. Máscara en logs. |
| `email` | `prospects` | PII. Opcional en MVP. |
| `text` (body) | `whatsapp_messages` | Contiene mensajes reales. Tratar como PII. No loguear. |
| `waba_config_ref` | `producers` | NO es la key: es solo una referencia al vault. |

**Qué nunca se almacena en la base de datos:**
- Claves de API de WhatsApp, LLM o cualquier proveedor (solo referencias).
- Tokens de sesión de Supabase Auth (los maneja Supabase internamente).
- Contraseñas en ninguna forma.
- Datos de la póliza emitida (no es dominio de SeguroFlow AI).

---

## 10. Nota sobre nomenclatura

El DATA_MODEL.md original usa nombres en español (`productores`, `prospectos`,
`cotizaciones`). Esta decisión usa inglés (`producers`, `prospects`, `quotes`).

**Decisión de nomenclatura:** las tablas de base de datos usarán **inglés** en
`snake_case`. Razones:
- Consistencia con Supabase, PostgreSQL y el ecosistema de herramientas.
- Evitar caracteres especiales o problemas de encoding con nombres en español.
- Convención estándar en equipos técnicos internacionales.

El DATA_MODEL.md debe actualizarse para reflejar esto antes de escribir migraciones.

---

## 11. Decisión final — modelo elegido

```
auth.users (Supabase)
  → profiles (1:1, trigger automático)
  → producer_members (N:M con role)
      → producers (el tenant)
          → prospects     [producer_id, RLS]
          → quotes        [producer_id, RLS]
          → whatsapp_messages  [producer_id, RLS]
          → ai_classifications [producer_id, RLS]
          → human_handoffs     [producer_id, RLS]
          → quote_events       [producer_id, RLS, append-only]
          → approved_responses [producer_id, RLS]
```

**Función clave:** `get_my_producer_ids()` — única fuente de verdad de acceso.

**Regla operativa para todo el sistema:**
> Ningún proceso del sistema ejecuta una query de negocio sin que haya
> `producer_id IN (SELECT get_my_producer_ids())` en la política RLS,
> O sea un proceso de service role con auditoría en `quote_events`.

---

## 12. Qué desbloquea esta decisión

- Se puede escribir la primera migración de Supabase con el esquema correcto.
- Se puede implementar el trigger de creación automática de `profiles`.
- Se puede implementar el signup/login inicial del productor piloto.
- Se puede definir el proceso de alta manual de un productor nuevo en el sistema.
- El DATA_MODEL.md puede actualizarse con el esquema definitivo en inglés.

## Qué queda pendiente

- [ ] Actualizar DATA_MODEL.md con nombres en inglés y el modelo de tres tablas.
- [ ] Definir la política de retención de datos (cuánto tiempo viven mensajes y eventos).
- [ ] Definir el proceso de alta de un nuevo productor (¿autoservicio o manual en piloto?).
- [ ] Decidir si `waba_config_ref` apunta a una variable de entorno por productor
      o a un servicio de secrets (ej: Supabase Vault). Crítico antes de onboardear
      el segundo productor piloto.
