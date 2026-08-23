# LORDGYM

**Entrena. Progresa. Domina.**

Plataforma de entrenamiento que conecta entrenadores y deportistas: el
entrenador planifica, el jugador entrena desde el móvil, LORDGYM registra y el
entrenador analiza.

> Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Recharts · Supabase/PostgreSQL

---

## Arrancar en 30 segundos

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. No hace falta configurar nada: la base de datos
por defecto es un fichero JSON (`.lordgym-data/db.json`) que se siembra sola.

### Cuentas

El primer arranque crea **la biblioteca de 128 ejercicios, las 13 pruebas físicas
y dos cuentas vinculadas entre sí**. Nada más: ni sesiones inventadas, ni
histórico de mentira, ni jugadores de relleno. El entrenador empieza con su
plantilla y crea el primer entrenamiento él.

| Rol        | Email                | Nombre          |
| ---------- | -------------------- | --------------- |
| Entrenador | `jusa@lordgym.app`   | Josep Sobervia  |
| Jugador    | `adrian@lordgym.app` | Adrián Carrillo |

La contraseña inicial de ambas es `lordgym2026`, o la que fijes en
`LORDGYM_INITIAL_PASSWORD` **antes** del primer arranque. **Cámbiala nada más
entrar**, desde Configuración (entrenador) o Perfil (jugador): no se muestra en
ninguna pantalla pública, pero está escrita en este repositorio.

El código del entrenador es `LORD-A7K29` y su enlace de invitación `/join/A7K29`:
con él se une cualquier jugador nuevo.

Para empezar de cero: `rm -rf .lordgym-data` y recarga.

---

## Qué hay implementado

### Entrenador

- **Dashboard**: jugadores activos, quién entrena hoy, sesiones completadas,
  cumplimiento, carga semanal del equipo y jugadores que requieren atención.
- **Jugadores**: fichas con estado (🟢 activo / 🟡 fatiga / 🔴 atención),
  cumplimiento semanal, filtros y buscador. Solicitudes de vinculación por
  código o enlace, con aceptar/rechazar.
- **Ficha del jugador**: datos deportivos, objetivos con barra de progreso,
  récords, carga, volumen, peso corporal, wellness, mapa de dolor, tests,
  historial de sesiones y notas privadas del entrenador.
- **Constructor de entrenamientos**: arrastrar y soltar, duplicar ejercicios,
  presets 3×12 / 4×8 / 5×5, 12 tipos de serie, superseries, tempo, %1RM, RPE,
  RIR, descanso y notas. **Autoguardado** con indicador «✓ Guardado».
- **Calendario**: vistas día / semana / mes, arrastrar sesiones entre días,
  duplicar semana completa y asignar a uno, varios jugadores o todo el equipo.
- **Programas**: bloques de N semanas que se vuelcan al calendario de los
  jugadores en un clic.
- **Ejercicios**: biblioteca inicial de 48 ejercicios (gimnasio, velocidad,
  agilidad, pliometría, cardio, prevención y rehabilitación) más los propios.
- **Tests**: 13 pruebas físicas de serie, registro de marcas y comparativa del
  equipo con mejora porcentual (invertida cuando menos es mejor).
- **Estadísticas**: adherencia, carga, RPE, récords y comparación entre
  jugadores, exportable a CSV.
- **Mensajes**, **equipos** y **buscador global**.

### Jugador (mobile-first)

- **Inicio**: próxima sesión con un botón enorme, racha, sesiones de la semana,
  carga, insignias y check-in del día.
- **Modo entrenamiento**: pantalla completa sin navegación, cronómetro total,
  progreso, series con teclado numérico y botones grandes, acciones rápidas
  (±2,5 kg, ±1 rep), datos de la última vez con 1RM estimado, temporizador de
  descanso con +30 s / saltar y aviso por vibración, aviso de récord y cierre
  con RPE de sesión, sensaciones, fatiga, dolor y comentario.
- **Reanudar** sesiones a medias y salir sin perder nada.
- **Calendario** con ✓ completado / ● pendiente / ○ descanso.
- **Progreso**: progresión por ejercicio (peso máximo, volumen, 1RM estimado,
  repeticiones, RPE), carga, volumen, peso corporal, récords y tests.
- **Bienestar**: check-in diario y mapa de dolor sobre una silueta.
- **Perfil** y **mensajes** con el entrenador.

### Plataforma

- Autenticación propia (scrypt + cookie de sesión firmada) y **Google** vía
  Supabase Auth.
- **Autorización en servidor** en cada carga y cada mutación, más políticas
  **Row Level Security** en las 30 tablas del esquema PostgreSQL.
- **PWA instalable** en iPhone y Android, con service worker y pantalla de
  «sin conexión».
- **Modo offline**: las series se guardan en el móvil y se sincronizan al
  recuperar cobertura.

---

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm start          # servir el build
npm run lint       # ESLint (reglas de Next 16 + React Compiler)
npm run typecheck  # TypeScript en modo estricto
npm test           # Vitest (52 tests)
npm run check:db   # comprueba conexión, esquema y sembrado de la base de datos
```

Los tests incluyen el ciclo completo del producto sin mocks: alta de entrenador
y jugador → vinculación → creación de la sesión → asignación → ejecución con
kg/reps/RPE → cierre → récords, 1RM estimado y progresión.

---

## Estructura

```
src/
  app/                      # rutas (App Router)
    page.tsx                # pantalla de acceso por rol
    login/ register/        # autenticación
    join/[code]/            # enlace de invitación del entrenador
    coach/                  # panel del entrenador
    player/                 # experiencia del jugador
      workout/[id]/         # modo entrenamiento
    api/auth/google/        # validación del token de Google
  components/
    ui/                     # Button, Card, Modal, Input, Stat, ProgressBar…
    charts/                 # gráficas sobre Recharts
    shell/                  # sidebar del entrenador y menú inferior del jugador
    coach/ player/          # componentes de cada rol
  lib/
    domain/                 # cálculo puro: métricas, fechas, etiquetas
    db/                     # driver de datos intercambiable
    auth/                   # contraseñas, sesión y guardas de autorización
    services/               # reglas de negocio
    actions/                # Server Actions (validadas con Zod)
    seed/                   # biblioteca de ejercicios y contenido inicial
  types/db.ts               # modelo de datos (fuente de verdad)
supabase/schema.sql         # esquema para Supabase (con RLS)
docs/                       # arquitectura, seguridad, decisiones y hoja de ruta
```

Detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Configuración

Todas las variables son opcionales en desarrollo. Copia `.env.example` a
`.env.local` para personalizarlas.

| Variable                        | Por defecto             | Para qué                                          |
| ------------------------------- | ----------------------- | ------------------------------------------------- |
| `LORDGYM_SESSION_SECRET`        | efímera en desarrollo   | Firma las cookies. **Obligatoria en producción.** |
| `DATABASE_URL`                  | —                       | PostgreSQL: Neon, Vercel Postgres, servidor propio |
| `LORDGYM_DB_DRIVER`             | automático              | Forzar `postgres`, `supabase` o `local`           |
| `LORDGYM_DATA_FILE`             | `.lordgym-data/db.json` | Ruta del fichero del driver local                 |
| `LORDGYM_INITIAL_PASSWORD`      | `lordgym2026`           | Contraseña inicial de las dos cuentas             |
| `NEXT_PUBLIC_SUPABASE_URL`      | —                       | Proyecto de Supabase                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | —                | Clave pública (`sb_publishable_…` o la `anon`)    |
| `SUPABASE_SECRET_KEY`           | —                       | Clave secreta, sólo servidor (o `service_role`)   |

Hay tres formas de guardar los datos y **no hace falta elegir a mano**: si existe
una cadena de conexión de PostgreSQL se usa ésa, y si no, el fichero JSON local.

- **PostgreSQL** (recomendado en producción): basta con `DATABASE_URL` — la
  integración de Neon o Vercel Postgres la inyecta sola. LORDGYM **crea el
  esquema y siembra en el primer arranque**, sin ejecutar ningún SQL a mano.
- **Supabase**: `LORDGYM_DB_DRIVER=supabase` más las claves; el esquema se aplica
  ejecutando `supabase/schema.sql`. Ver [`supabase/README.md`](supabase/README.md).
- **Local**: sin configurar nada, para desarrollo.

**Para desplegar en Vercel**, la guía paso a paso está en
[`docs/DEPLOY.md`](docs/DEPLOY.md). Dos avisos importantes: Vercel despliega la
rama por defecto del repositorio, y en serverless **hace falta una base de datos**
(el disco no persiste). Si algo falta, la propia portada lo dice.

---

## Estado y siguientes pasos

El MVP del brief (puntos 1 a 15) está completo y funcionando, junto con la
mayoría de módulos avanzados. Lo que queda pendiente y por qué está en
[`docs/PROGRESS.md`](docs/PROGRESS.md); las decisiones técnicas y sus
alternativas, en [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Créditos

La selección de ejercicios se apoya en el catálogo abierto de
[wger](https://github.com/wger-project/wger), publicado bajo **CC-BY-SA**.
Los textos en español y las ilustraciones de LORDGYM son propios: de wger se ha
tomado qué ejercicios merecía la pena cubrir, no su contenido.
