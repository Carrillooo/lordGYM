# Supabase / PostgreSQL

LORDGYM arranca por defecto en **modo local** (`LORDGYM_DB_DRIVER=local`), con
la base de datos en un fichero JSON (`.lordgym-data/db.json`). No hace falta
configurar nada para desarrollar ni para ver la demo.

Para producción multiusuario se usa Supabase.

## 1. Crear el esquema

En el SQL editor del proyecto de Supabase, ejecuta `schema.sql`. Crea:

- las 29 tablas del modelo (`src/types/db.ts`),
- índices para las consultas del dashboard y del histórico,
- funciones auxiliares `lg_current_coach_id()`, `lg_current_athlete_id()`,
  `lg_coach_has_athlete()` y `lg_athlete_has_coach()`,
- **Row Level Security en todas las tablas**, con las reglas del brief §63:
  un jugador sólo accede a sus datos y un entrenador sólo a los jugadores con
  vínculo `active`.

## 2. Configurar la aplicación

```bash
LORDGYM_DB_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service-role>   # sólo servidor
LORDGYM_SESSION_SECRET=<cadena larga y aleatoria>
```

## 3. Sembrar datos

No hay un `seed.sql` duplicado a propósito: la biblioteca de ejercicios, las
pruebas físicas y el equipo demo viven en `src/lib/seed/` y se insertan por el
mismo driver de datos. Arranca la aplicación una vez contra la base vacía y se
siembra sola (`ensureSeeded()` comprueba que `users` esté vacía). Así hay una
sola fuente de verdad y no se desincronizan.

Si prefieres una base limpia sin demo, borra las filas de `users` sembradas
después del primer arranque: la biblioteca de ejercicios (`owner_coach_id is
null`) y las pruebas globales (`coach_id is null`) se conservan.

## 4. Autenticación

LORDGYM gestiona sus propias sesiones (scrypt + cookie firmada HMAC,
`src/lib/auth/`), de modo que el login por email funciona con cualquiera de los
dos drivers.

El inicio de sesión con Google sí usa **Supabase Auth**: activa el proveedor
Google en el panel de Supabase y añade `https://<tu-dominio>/auth/callback` a
las *Redirect URLs*. El flujo está en `src/app/auth/callback/page.tsx` y
`src/app/api/auth/google/route.ts`: el token se valida en el servidor contra
Supabase antes de abrir sesión en LORDGYM.

### Sobre RLS y la service role key

El driver del servidor usa la *service role key*, que **ignora RLS**. Es
deliberado: la autorización de la aplicación se aplica antes, en
`src/lib/auth/guards.ts`, en cada carga de datos y cada mutación. Las políticas
RLS protegen los accesos hechos con la *anon key* (cliente, herramientas
externas, futuras integraciones) y actúan como segunda barrera.

Si prefieres que RLS sea la única barrera, sustituye la service role key por la
anon key y propaga el JWT del usuario en `supabase-driver.ts`; el esquema ya
está preparado para ese modo.
