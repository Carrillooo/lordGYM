# Seguridad

El brief lo pone como prioridad (§63): *un jugador sólo puede ver sus datos; un
entrenador sólo los jugadores vinculados a él; nunca confiar únicamente en el
frontend.*

## Modelo de amenazas

Los datos de LORDGYM son personales y algunos de salud (dolor, fatiga, sueño,
lesiones). El riesgo real no es un atacante sofisticado: es que un jugador vea
la ficha de otro o que un entrenador acceda a deportistas que no entrena.

## Cuatro barreras

### 1. Sesión

- Contraseñas con **scrypt** (`node:crypto`), sal de 16 bytes por usuario y
  comparación en tiempo constante (`timingSafeEqual`).
- El login ejecuta la verificación aunque el email no exista, para no filtrar
  qué cuentas están dadas de alta por el tiempo de respuesta.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, 30 días.
- La cookie contiene `<id de sesión>.<HMAC-SHA256>`: sin el secreto no se puede
  falsificar un id. El id además se comprueba contra `auth_sessions`, así que
  cerrar sesión revoca de verdad.
- `LORDGYM_SESSION_SECRET` es **obligatoria en producción**: sin ella el
  arranque falla en lugar de usar una clave débil.

### 2. Autorización en el servidor

`src/lib/auth/guards.ts` se ejecuta en **cada** carga de datos y **cada**
mutación:

| Guarda                        | Comprueba                                        |
| ----------------------------- | ------------------------------------------------ |
| `requireCoach` / `requireAthlete` | Hay sesión y el rol es el correcto            |
| `assertCoachLinkedToAthlete`  | Existe vínculo `active` entre ambos              |
| `assertCoachOwnsWorkout`      | El entrenamiento es del entrenador               |
| `assertCoachOwnsProgram`      | El programa es del entrenador                    |
| `assertCoachCanEditExercise`  | El ejercicio no es de la biblioteca global        |
| `assertAthleteOwnsSession`    | La sesión pertenece al jugador                   |

Los servicios que reciben listas (asignar a varios jugadores, montar un equipo)
**filtran** contra los jugadores realmente vinculados en lugar de confiar en los
ids que llegan del formulario.

### 3. Validación de entrada

Todas las Server Actions parsean con **Zod** (`src/lib/validation/schemas.ts`)
antes de tocar nada: rangos de RPE 1–10, fatiga 1–10, wellness 1–5, fechas
`YYYY-MM-DD`, longitudes máximas y URLs bien formadas. Lo que no valida, no
pasa.

### 4. Row Level Security

`supabase/schema.sql` activa RLS en las 30 tablas con políticas equivalentes a
los guardas. Es la red de seguridad para cualquier acceso que no venga de la
aplicación (anon key, herramientas externas, futuras integraciones).

> **Nota honesta**: el driver de servidor usa la *service role key*, que ignora
> RLS. La autorización efectiva de la aplicación son los guardas de la capa 2.
> RLS protege lo demás. `supabase/README.md` explica cómo invertir esa decisión
> si se prefiere que RLS sea la única barrera.

## Datos sensibles

- Las **notas del entrenador** son privadas salvo que él marque `visible_to_athlete`.
  La política de RLS lo refleja: el jugador sólo lee las visibles.
- Las **comparativas entre jugadores** viven en el panel del entrenador. No hay
  ranking público (§41).
- El **mapa de dolor** y el wellness los ve el jugador y su entrenador, nadie más.
- Las **alertas automáticas** son señales de seguimiento, no diagnósticos.
  El texto de la interfaz lo dice explícitamente (§70).

## Qué NO hace LORDGYM

- No cachea respuestas de navegación ni de API en el service worker.
- No guarda datos personales en `localStorage` más allá de la cola de series de
  la sesión en curso, que se borra al terminar.
- No envía datos a terceros. La exportación a CSV se genera en el navegador.
- No incluye el email del usuario en URLs ni en logs.

## Pendiente antes de producción

1. **Limitación de intentos de login**. Hoy no hay rate limiting; con Supabase
   conviene ponerlo en el borde (middleware o WAF).
2. **Verificación de email** y recuperación de contraseña.
3. **Cabeceras de seguridad** (CSP, HSTS, `X-Content-Type-Options`) en el
   despliegue.
4. **Subida de ficheros**: hoy los vídeos y las imágenes son URLs que introduce
   el usuario. Con Supabase Storage habría que validar tipo y tamaño y firmar
   las URLs.
5. **Auditoría**: registrar quién cambia la ficha de un deportista.
