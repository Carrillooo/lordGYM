# Arquitectura

## Principio rector

El brief lo resume en §99 y §105: nada de maquetas vacías y el histórico jamás
se mezcla con la plantilla. Todo lo demás sale de ahí.

```
Workout (plantilla)  →  Assignment (fecha + jugador)  →  Session (ejecución)  →  Session sets (kg/reps/RPE)
```

Editar una plantilla no reescribe el pasado. Una sesión completada es un
documento cerrado del que salen los récords, la carga y las gráficas.

---

## Capas

```
app/            Rutas. Server Components leen; Server Actions escriben.
  ↓
lib/actions/    Frontera: valida con Zod, aplica un guarda y llama a un servicio.
  ↓
lib/services/   Reglas de negocio. No conocen HTTP ni React.
  ↓
lib/db/         Driver de datos (local JSON | Supabase). No conoce el negocio.
```

`lib/domain/` cruza todas las capas: son funciones puras (1RM de Epley, volumen,
carga de Foster, adherencia, rachas, fechas) sin I/O, y por eso se testean
solas y se pueden usar también en el cliente.

### Por qué Server Actions y no una API REST

Todas las mutaciones son de la propia aplicación; no hay clientes externos. Las
Server Actions eliminan la capa de fetch, el estado de carga manual y la
duplicación de tipos entre cliente y servidor. Cuando haga falta una API
pública, los servicios ya están listos para exponerse por `app/api/`.

Hay una excepción deliberada en `app/api/`: `auth/google/route.ts`, porque el
cliente necesita enviar el token de Supabase y recibir una respuesta JSON.

---

## Modelo de datos

`src/types/db.ts` es la fuente de verdad: 30 tablas con nombres idénticos a los
del esquema PostgreSQL (`supabase/schema.sql`). El driver de Supabase es por eso
una traducción directa, sin capa de mapeo.

Grupos:

| Grupo         | Tablas                                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| Identidad     | `users`, `profiles`, `coaches`, `athletes`, `coach_athletes`, `auth_sessions`  |
| Equipos       | `teams`, `team_members`                                                        |
| Biblioteca    | `exercises`, `tests`                                                           |
| Planificación | `workouts`, `workout_exercises`, `workout_sets`, `programs`, `program_weeks`, `program_workouts` |
| Ejecución     | `assignments`, `workout_sessions`, `session_exercises`, `session_sets`         |
| Seguimiento   | `personal_records`, `wellness_logs`, `pain_logs`, `bodyweight_logs`, `test_results`, `goals` |
| Comunicación  | `messages`, `notifications`, `coach_notes`                                     |
| Interno       | `app_state` (cerrojo de sembrado)                                              |

### Fechas (§106)

- Instantes → UTC en ISO 8601 con `Z` (`started_at`, `completed_at`).
- Días naturales → `YYYY-MM-DD` (`scheduled_date`, check-ins), porque «el
  entrenamiento del martes» es un día, no un instante.
- Toda la aritmética pasa por `lib/domain/datetime.ts`, que trabaja a mediodía
  UTC para no tropezar con los cambios de hora. Hay tests de DST de Madrid.

---

## Driver de datos

`DataDriver` (`lib/db/driver.ts`) es un contrato mínimo: `select`, `insert`,
`insertMany`, `update`, `remove` y `removeWhere`. Nada de negocio.

- **`local-driver`**: base JSON en disco, escritura atómica (temporal +
  `rename`) y cola de escrituras encadenada para que dos mutaciones simultáneas
  no se pisen. Pensado para desarrollo, demo y despliegues de un solo proceso.
- **`postgres-driver`**: conexión directa con `pg` (Neon, Vercel Postgres, RDS,
  servidor propio). Compone SQL parametrizado y valida nombres de tabla y
  columna contra el modelo, de modo que ninguna cláusula pueda inyectarse. Ajusta
  los parsers de tipo de node-postgres para que `numeric` y `bigint` lleguen como
  números y los instantes como ISO en UTC, igual que en el driver local. Aplica
  el esquema (`db/postgres-schema.ts`, todo `IF NOT EXISTS`) en el primer
  arranque, así que conectar una base vacía es suficiente. Sin RLS: con conexión
  directa el único cliente es este servidor y la autorización ya vive en
  `auth/guards.ts`.
- **`supabase-driver`**: traduce la cláusula `Where` a PostgREST (`eq`, `in`,
  `neq`, `gte/lte/gt/lt`, `is null`), para quien prefiera la API y el panel de
  Supabase. Ahí el esquema se aplica a mano y RLS sí es la segunda barrera.

La elección es automática: driver explícito si se define `LORDGYM_DB_DRIVER`;
si no, PostgreSQL cuando hay cadena de conexión en el entorno, y local si no hay
nada. En serverless sin base de datos, LORDGYM falla con un mensaje que dice qué
configurar, en lugar de perder los datos en silencio.

El sembrado inicial se reclama con una fila en `app_state`, cuya clave primaria
garantiza que varias instancias arrancando a la vez no siembren por duplicado.

Consecuencia deliberada: los servicios cargan conjuntos y agregan en memoria en
lugar de delegar en SQL. A la escala de un equipo (decenas de jugadores, miles
de series) es holgado y mantiene una sola implementación de las reglas. Si un
club crece hasta cientos de deportistas, el paso siguiente es mover las
agregaciones a vistas SQL detrás del mismo servicio, sin tocar la UI.

---

## Autenticación y autorización

Ver [`SECURITY.md`](SECURITY.md). En resumen:

- Contraseñas con **scrypt** (incluido en Node, sin dependencias nativas).
- Sesión en cookie `httpOnly` + `SameSite=Lax` con el id firmado por HMAC, y la
  sesión persistida en `auth_sessions` para poder revocarla.
- **Google** por Supabase Auth: el intercambio PKCE ocurre en el navegador y el
  token se valida **en el servidor** antes de abrir sesión.
- `lib/auth/guards.ts` se ejecuta en cada carga y cada mutación. El frontend
  nunca decide qué puede verse.

---

## Modo entrenamiento y offline

`components/player/training/` es la pantalla más cuidada del producto:

1. Al empezar, la plantilla se **copia** a `session_exercises` / `session_sets`.
2. Cada serie completada se escribe primero en `localStorage`
   (`lib/offline/queue.ts`) y después se envía al servidor.
3. Si el envío falla, la serie queda en cola y se reintenta al volver la
   conexión (`window.addEventListener('online')`).
4. La clave de la cola es el id de la serie: reintentar **actualiza**, nunca
   duplica.

El service worker no cachea datos personales a propósito: sólo el esqueleto
estático y la pantalla de «sin conexión». Lo que hace que el gimnasio sin
cobertura funcione es la cola, no la caché.

---

## Frontera cliente / servidor

Los módulos de `lib/services` y `lib/db` importan `server-only`: si alguna vez
acaban en un bundle de cliente, el build falla en lugar de filtrar la clave de
servicio. Por eso las etiquetas de métricas que necesitan los selectores viven
en `lib/domain/exercise-metrics.ts` y no en el servicio.

---

## Componentes

`components/ui/` es el sistema base (Button, Card, Modal, Input, Select,
Textarea, Badge, Stat, ProgressBar, EmptyState, Avatar, Alert, OptionGroup).
Encima, componentes de dominio: `PlayerCard`, `SetRow`, `RestTimer`,
`WorkoutBuilder`, `ChartCard`, `PRBadge`…

Regla práctica: un componente cliente sólo existe si necesita estado,
interacción o API del navegador. Todo lo demás es Server Component y no pesa en
el bundle.
