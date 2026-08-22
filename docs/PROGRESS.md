# Estado del proyecto

Última actualización: primera entrega completa.

## Verificación

Todo lo que sigue está comprobado en esta misma entrega:

```
npm run lint       ✓ sin errores ni avisos
npm run typecheck  ✓ TypeScript estricto
npm test           ✓ 52 tests (incluye el ciclo completo, en local y en PostgreSQL)
npm run build      ✓ 32 rutas, sin avisos
```

Además se ha recorrido la aplicación con un navegador real (Chromium, iPhone 390
px y escritorio 1440 px), incluido el ciclo completo del brief §109:

1. El entrenador edita una serie en el constructor → **se autoguarda y persiste
   tras recargar**.
2. Asigna la sesión y el jugador la ve en su inicio.
3. El jugador entrena: 24 series registradas, descanso automático entre ellas y
   comentario para el entrenador.
4. Cierra con RPE y sensaciones → **pantalla de resumen** con tiempo, volumen,
   carga, récord conseguido y desglose por ejercicio.
5. El entrenador ve el resultado y el comentario en la ficha del jugador.

**Cero errores de consola y cero respuestas 5xx.**

Dos defectos se detectaron así y están corregidos, con test de regresión el
primero:

- La validación Zod rechazaba `null` en los campos de texto opcionales, de modo
  que el autoguardado del constructor fallaba en silencio.
- El resumen final se perdía porque, al revalidar la ruta, la sesión completada
  redirigía al inicio. Ahora una sesión cerrada **es** su pantalla de resumen y
  se puede volver a consultar desde el calendario.

---

## MVP del brief (§97)

| #   | Requisito                        | Estado |
| --- | -------------------------------- | ------ |
| 1   | Login / registro                 | ✅     |
| 2   | Entrenador / jugador             | ✅     |
| 3   | Vincular jugador con entrenador  | ✅ código + enlace `/join/CODE` |
| 4   | Crear ejercicios                 | ✅ biblioteca de 48 + propios |
| 5   | Crear entrenamiento              | ✅ constructor con autoguardado |
| 6   | Asignar entrenamiento            | ✅ uno, varios o todo el equipo |
| 7   | Jugador ve el entrenamiento      | ✅ inicio y página «Hoy» |
| 8   | Registrar series, reps y kg      | ✅ modo entrenamiento |
| 9   | Temporizador de descanso         | ✅ +30 s, saltar, vibración |
| 10  | Entrenamiento completado         | ✅ resumen con volumen, carga y PR |
| 11  | Historial                        | ✅ sesiones, series y última vez |
| 12  | Gráficas de progresión           | ✅ 5 métricas por ejercicio |
| 13  | RPE                              | ✅ por serie y de sesión |
| 14  | Calendario                       | ✅ entrenador (día/semana/mes) y jugador |
| 15  | Perfil del jugador               | ✅ ficha deportiva editable |

---

## Módulos avanzados

Implementados y en uso: programas (§30), plantillas (§31), duplicar sesión,
semana y programa (§33), superseries (§18), tipos de serie (§17), tests y
comparación (§39–§41), wellness y mapa de dolor (§24–§25), carga de
entrenamiento y ACWR (§26), récords y 1RM estimado (§28–§29), objetivos con
barra de progreso (§74), notas privadas (§42), mensajes con adjuntos (§43),
notificaciones en la aplicación (§44), alertas automáticas (§52), buscador
(§53), equipos (§54), filtros (§57), exportación CSV (§58), PWA (§64), modo
offline (§65), acciones rápidas (§67), autocompletar desde la última sesión
(§68), sugerencia de progresión (§69–§70), historial y comparación por
ejercicio (§71–§72), peso corporal (§73), comentarios y vídeo del jugador por
ejercicio (§75, §77), vídeo de técnica (§76), drag & drop (§80), autoguardado
(§81) y gamificación ligera (§50).

---

## Pendiente, y por qué

Nada de esto bloquea el uso del producto. Está ordenado por valor.

### 1. Subida de ficheros

Hoy las fotos de perfil, los vídeos de técnica y los vídeos del jugador se
añaden **por URL**. Falta subida real con almacenamiento (Supabase Storage),
validación de tipo y tamaño y URLs firmadas.

*Por qué no está:* requiere infraestructura de almacenamiento configurada; con
URL el flujo completo ya es funcional y verificable.

### 2. Exportación a PDF (§58)

El CSV funciona y se genera en el navegador. El PDF necesita una librería de
maquetación (o generación en servidor) y una plantilla de informe.

### 3. Notificaciones push (§44)

Las notificaciones existen dentro de la aplicación (campana, badges y bandeja).
Las push del sistema necesitan claves VAPID, permiso del usuario y un endpoint
de suscripción.

### 4. Frecuencia cardíaca y zonas de FC (§38)

Los ejercicios de cardio registran tiempo y distancia. Faltan pulsaciones y
zonas, que en la práctica quieren integrarse con pulsómetro (Garmin, Polar,
Apple Health) más que teclearse a mano.

### 5. Modo claro (§94)

El sistema visual está construido sobre variables CSS y `color-scheme`, así que
añadirlo es definir el segundo juego de tokens. No se ha hecho porque el brief
pide modo oscuro «principalmente» y ninguna pantalla está diseñada aún en claro.

### 6. Roles de staff adicionales (§55)

`coaches.staff_role` ya distingue entrenador principal, preparador físico y
fisioterapeuta, y el esquema lo soporta. Sólo se activa «entrenador principal»,
como pide el propio brief.

### 7. Endurecimiento para producción

Limitación de intentos de login, verificación de email, recuperación de
contraseña y cabeceras de seguridad. Detalle en [`SECURITY.md`](SECURITY.md).

---

## Requiere acción del usuario

Nada para probar la aplicación en local. Para producción:

1. **`LORDGYM_SESSION_SECRET`**: generar una cadena larga y aleatoria
   (`openssl rand -hex 32`). Sin ella el arranque falla a propósito.
2. **Base de datos** (obligatoria en Vercel, el disco no persiste): conectar un
   PostgreSQL — Neon o Vercel Postgres desde **Storage → Create Database** — y
   dejar que la integración inyecte `DATABASE_URL`. LORDGYM crea el esquema y
   siembra en el primer arranque, sin ejecutar ningún SQL a mano. La alternativa
   es Supabase (`supabase/schema.sql` + claves). Guía en
   [`DEPLOY.md`](DEPLOY.md); comprobación con `npm run check:db`.
3. **Google Sign-In** (opcional, requiere Supabase): activar el proveedor y añadir
   `https://<dominio>/auth/callback` a las *Redirect URLs*. Sin esto, el botón
   explica que falta configuración en lugar de fallar.

---

## Próxima sesión

Por orden sugerido:

1. Subida de ficheros (desbloquea vídeos y fotos reales): Vercel Blob si la base
   es PostgreSQL, o Supabase Storage si se usa Supabase.
2. Informe PDF del jugador reutilizando lo que ya calcula `services/progress`.
3. Notificaciones push y recordatorio de sesión.
4. Modo claro: segundo juego de tokens en `globals.css` y conmutador en ajustes.
5. Si el club crece: mover las agregaciones más pesadas
   (`getRoster`, `coachDashboardStats`) a vistas SQL detrás del mismo servicio.
