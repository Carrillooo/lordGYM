# Decisiones técnicas

Cada entrada dice qué se eligió, por qué, y qué se pierde. Están para poder
revertirlas con conocimiento de causa.

---

## 1. Driver de datos intercambiable en vez de Supabase directo

**Decisión.** Toda la persistencia pasa por `DataDriver`, con dos
implementaciones: JSON en disco (por defecto) y Supabase.

**Por qué.** El brief pide Supabase (§59) pero también que todo funcione desde
el primer minuto (§84, §109). Sin credenciales, un proyecto atado a Supabase es
una pantalla de error. Con el driver local, `npm run dev` da una aplicación
completa con datos reales.

**Qué se pierde.** Las agregaciones se hacen en memoria en lugar de en SQL. A
escala de club es irrelevante; a escala de federación habría que mover las
consultas pesadas a vistas SQL. El contrato del driver ya lo permite sin tocar
la UI.

**Alternativa descartada.** SQLite con `better-sqlite3`: mejor rendimiento, pero
compilación nativa y un tercer dialecto que mantener.

---

## 2. Autenticación propia en vez de Supabase Auth para email/contraseña

**Decisión.** LORDGYM gestiona sus sesiones (scrypt + cookie firmada). Supabase
Auth se usa sólo para Google.

**Por qué.** Si el login dependiera de Supabase, el modo local no tendría
autenticación y habría que simularla. Con sesiones propias, el mismo código
funciona con los dos drivers y el flujo demo es idéntico al real.

**Qué se pierde.** Verificación de email, recuperación de contraseña y MFA, que
Supabase Auth trae de serie. Están en la lista de pendientes de `SECURITY.md`.

---

## 3. Server Actions en vez de una API REST

**Decisión.** Mutaciones por Server Actions; `app/api/` sólo para lo que
necesita responder JSON a una petición del navegador.

**Por qué.** No hay clientes externos. Se ahorra la capa de fetch, los estados
de carga manuales y la duplicación de tipos.

**Qué se pierde.** Una API pública inmediata. Como la lógica vive en
`lib/services`, exponerla es envolverla, no reescribirla.

---

## 4. La plantilla se copia a la sesión al empezar

**Decisión.** `startSession` clona `workout_exercises` y `workout_sets` en
`session_exercises` y `session_sets`.

**Por qué.** Es lo que pide §105 y es lo correcto: si el entrenador cambia el
press banca de 4×6 a 5×5 el martes, la sesión del lunes debe seguir contando lo
que realmente se hizo.

**Qué se pierde.** Duplicación de filas. A cambio, el histórico es inmutable y
las gráficas no mienten nunca.

---

## 5. Récords calculados al cerrar la sesión, no al vuelo

**Decisión.** `finishSession` detecta los récords y los persiste en
`personal_records`, con una fila por (jugador, ejercicio, tipo).

**Por qué.** Consultar «¿cuál es tu mejor press banca?» debe ser una lectura,
no un recorrido de todo el histórico. Además permite fechar el récord.

**Qué se pierde.** Si se corrige una sesión antigua a mano, la tabla puede
quedar desfasada. Por eso existe `recomputeRecordsForAthlete()`, que la
reconstruye desde cero y se usa también al sembrar la demo.

**Detalle.** Durante el entrenamiento se muestra un aviso *optimista* de récord
comparando con la mejor marca previa; el récord real se confirma al cerrar. Se
avisa de récords de peso y repeticiones, no del 1RM estimado, porque es un
derivado y anunciarlo dos veces confunde.

---

## 6. Fórmula de Epley para el 1RM estimado

**Decisión.** `1RM = peso × (1 + reps / 30)`, como pide §29.

**Por qué.** Es la que especifica el brief, es la más extendida y con 1
repetición devuelve el propio peso.

**Qué se pierde.** Precisión con series largas: por encima de 10–12
repeticiones, Epley sobreestima. Brzycki o Lombardi corrigen ese tramo. Cambiarla
es tocar una función pura con tests.

---

## 7. Carga de entrenamiento por el método de Foster

**Decisión.** `carga = RPE de sesión × minutos`, en unidades arbitrarias (§26).
Se añade el ratio agudo:crónico (últimos 7 días ÷ media semanal de 28).

**Por qué.** Es el estándar de campo: una sola pregunta al deportista y una
métrica comparable entre sesiones de fuerza, velocidad y cardio.

**Qué se pierde.** No distingue tipo de esfuerzo. El ratio agudo:crónico es una
señal de seguimiento, no una predicción de lesión, y así se presenta.

---

## 8. Alertas automáticas explícitas, sin «recomendaciones» automáticas

**Decisión.** Se calculan alertas (RPE sostenido ≥ 8,5, 3 sesiones sin
completar, dolor ≥ 7/10, fatiga alta, pico de carga, caída de volumen) y se
muestran como señales con su motivo. La progresión automática (§69) existe como
función pura y se presenta siempre como sugerencia.

**Por qué.** §70 lo pide explícitamente: nada de convertir automatismos en
indicaciones médicas. El entrenador decide.

---

## 9. Sin drag & drop por librería

**Decisión.** Reordenar usa la API nativa de arrastre en escritorio y botones
de flecha en móvil. El calendario mueve sesiones con la misma técnica.

**Por qué.** `@dnd-kit` u otras librerías añaden peso y complejidad para una
interacción que el navegador ya resuelve. Y el arrastre nativo no funciona en
táctil, así que las flechas no son un parche: son la vía principal en móvil,
que es donde está el jugador.

**Qué se pierde.** Animaciones de reordenación más finas y arrastre táctil en
tablet. Si el entrenador acaba planificando desde iPad, ahí sí entraría
`@dnd-kit`.

---

## 10. Las series no se pintan como tabla en el modo entrenamiento

**Decisión.** Cada serie es una tarjeta de dos líneas (objetivo arriba, campos y
✓ abajo) en lugar de una fila de tabla con scroll horizontal.

**Por qué.** En un iPhone de 390 px, una tabla con serie, objetivo, kg, reps,
RPE y botón obliga a desplazarse en horizontal para llegar al ✓, que es la
acción más repetida de toda la aplicación (§66, §98). Se probó con navegador
real y no era usable.

**Qué se pierde.** La lectura en columnas que sí conserva el constructor del
entrenador, donde la pantalla es ancha y el uso es de escritorio.

---

## 11. Tipografía del sistema en vez de fuente web

**Decisión.** Pila `-apple-system, BlinkMacSystemFont, Segoe UI, Inter,
system-ui`.

**Por qué.** El brief pide que se vea especialmente bien en iPhone (§2): ahí la
pila del sistema es San Francisco, diseñada exactamente para eso. Además evita
descargar 100–200 kB de fuentes y elimina el parpadeo de carga (§95).

**Qué se pierde.** Identidad tipográfica idéntica en todas las plataformas. Se
compensa con el tratamiento del logotipo, el tracking negativo de los titulares
y las cifras tabulares en las métricas.

---

## 12. El seed vive en TypeScript, no en `seed.sql`

**Decisión.** La biblioteca de ejercicios, las pruebas y la demo están en
`src/lib/seed/` y se insertan por el mismo driver de datos.

**Por qué.** Un `seed.sql` paralelo se desincroniza con el modelo a la primera
migración. Así hay una sola fuente de verdad y funciona igual en local y en
Supabase.

**Qué se pierde.** No se puede sembrar desde `psql` sin arrancar la aplicación.

---

## 13. PostgreSQL directo como camino recomendado, con el esquema autoaplicado

**Decisión.** Añadir un tercer driver (`postgres-driver`) que habla SQL con `pg`
contra Neon, Vercel Postgres o un servidor propio, y elegirlo automáticamente
cuando el entorno trae una cadena de conexión. El esquema se aplica solo en el
primer arranque desde `db/postgres-schema.ts` (todo `IF NOT EXISTS`).

**Por qué.** Con Supabase quedaban tres pasos manuales antes de que la aplicación
funcionase: crear el proyecto, ejecutar `schema.sql` en el SQL Editor y copiar
cuatro variables. Conectando una base PostgreSQL desde el propio panel de Vercel,
la integración inyecta `DATABASE_URL` sola y no queda ningún SQL que ejecutar:
sólo hay que añadir `LORDGYM_SESSION_SECRET`. Menos pasos es menos sitios donde
un despliegue se queda a medias. Además se ahorra el salto por PostgREST, que
añadía una llamada HTTP a cada lectura.

**Seguridad.** El esquema de PostgreSQL directo no lleva RLS, a diferencia del de
Supabase. No es un descuido: RLS protege de clientes que hablan con la base con
la clave pública, y aquí el único cliente es este servidor. La autorización
sigue donde siempre, en `auth/guards.ts`, comprobada en cada lectura y cada
mutación. Los nombres de tabla y columna se validan contra el modelo y todos los
valores van parametrizados, así que la cláusula `Where` no puede inyectar SQL.

**Qué se pierde.** El panel de Supabase, su Storage y su Google Sign-In. Por eso
el driver de Supabase se mantiene entero y sigue siendo una opción soportada:
`LORDGYM_DB_DRIVER=supabase` la elige.


---

## 14. Ilustraciones propias en SVG, no fotos de terceros

**Decisión.** Dibujar cada ejercicio con un motor de posturas propio en SVG en
lugar de usar fotos o vídeos de bancos de imágenes o de otras webs de fitness.

**Por qué.** Las imágenes de un catálogo ajeno son de su autor: copiarlas expone
a quien publica la aplicación, no a quien las copió. Y aun con licencia, un
catálogo de fotos ajenas trae 48 estilos distintos, pesa megas, exige una CDN y
se rompe el día que el origen cambia de URL. Un sistema propio se ve coherente,
no pide una sola petición de red, funciona sin conexión y cubre también los
ejercicios que invente el entrenador.

**Qué se pierde.** El realismo de una foto o de un vídeo. Se compensa en parte
con el campo `video_url` de cada ejercicio, donde el entrenador puede enlazar su
propia demostración, y con `image_url` para una foto sobre la que tenga derechos.

---

## 15. Sin datos de demostración

**Decisión.** El sembrado inicial carga la biblioteca de ejercicios y de pruebas
—que es contenido del producto— y **dos cuentas reales vinculadas**: nada más.
Ni sesiones inventadas, ni histórico simulado, ni jugadores de relleno.

**Por qué.** Los datos falsos son estupendos para enseñar un producto y pésimos
para usarlo: el entrenador tiene que borrarlos uno a uno antes de empezar, y
mientras tanto las gráficas, los récords y las estadísticas mienten. Un club que
abre la aplicación quiere su plantilla, no la de un ejemplo.

**Qué se pierde.** La portada ya no se puede enseñar con las gráficas llenas.
A cambio, todo lo que aparece en pantalla ha ocurrido de verdad, que es la
primera regla del proyecto.


---

## 16. El PDF se genera en el servidor, no se imprime desde el navegador

**Decisión.** Componer el documento con `pdf-lib` y servirlo como descarga, en
lugar de una hoja de estilos de impresión y `window.print()`.

**Por qué.** En el iPhone, imprimir desde el navegador abre la hoja del sistema y
obliga a buscar «Guardar en Archivos»; y el resultado depende de los márgenes del
navegador. Un PDF servido se descarga de una vez, sale idéntico en cualquier
dispositivo y puede llevar las ilustraciones dibujadas como vectores, que era el
punto: la hoja que te llevas al gimnasio enseña lo mismo que la pantalla.

**Qué se pierde.** Una dependencia más y unos 100 kB en el servidor. A cambio no
hay que mantener un segundo juego de estilos sólo para el papel.
