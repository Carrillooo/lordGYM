# Desplegar LORDGYM en Vercel

Dos cosas que hay que entender antes de empezar:

1. **Vercel despliega la rama por defecto del repositorio (`main`).** Si el
   código está en otra rama, verás un `404: NOT_FOUND`, que no es un fallo de la
   aplicación: es que en `main` no hay aplicación.
2. **En Vercel hace falta una base de datos.** El modo local guarda los datos en
   un fichero, y en Vercel el disco es de sólo lectura y se borra entre
   peticiones. Sin base de datos la aplicación arranca pero avisa en la portada.

Hay dos caminos. El primero es el recomendado y el más corto.

---

# Camino A · PostgreSQL (Neon o Vercel Postgres) — recomendado

LORDGYM habla SQL directamente y **crea el esquema solo** en el primer arranque.
No hay que ejecutar ningún fichero `.sql` a mano.

## A1. Conectar la base de datos

En el proyecto de Vercel: **Storage** → **Create Database** → **Neon**
(*Serverless Postgres*). Elige región europea (menos latencia desde España) y
conéctala al proyecto.

Vercel inyecta entonces `DATABASE_URL`, `POSTGRES_URL` y compañía en las tres
entornos (Production, Preview, Development). **No hay que copiar nada a mano.**

Si ya tienes la base creada en <https://neon.tech> por tu cuenta, copia su cadena
de conexión (la que acaba en `?sslmode=require`) y añádela como `DATABASE_URL`
en **Settings** → **Environment Variables**. Usa la variante *pooled* (con
`-pooler` en el host): es la adecuada para serverless.

## A2. Generar la clave de sesión

Es lo único que hay que añadir a mano. Firma las cookies de inicio de sesión:

```bash
openssl rand -hex 32
```

Copia el resultado (64 caracteres) y añádelo en **Settings** → **Environment
Variables**, marcado para *Production*, *Preview* y *Development*:

```
LORDGYM_SESSION_SECRET    (los 64 caracteres)
```

Si no tienes terminal a mano vale cualquier cadena aleatoria larga; lo importante
es que sea secreta y que no cambie después (si la cambias, se cierran todas las
sesiones abiertas).

## A3. Volver a desplegar

Deployments → el último → `···` → **Redeploy**. Vercel no aplica las variables
nuevas a un despliegue anterior.

Con eso ya está: en la primera petición LORDGYM crea las 30 tablas, los índices y
siembra la biblioteca de 48 ejercicios y las 13 pruebas físicas.

## A4. Resumen de variables

| Variable                    | Quién la pone            |
| --------------------------- | ------------------------ |
| `DATABASE_URL`              | Vercel, al conectar Neon |
| `LORDGYM_SESSION_SECRET`    | Tú (paso A2)             |
| `LORDGYM_INITIAL_PASSWORD`  | Opcional (ver abajo)     |
| `BLOB_READ_WRITE_TOKEN`     | Vercel, al crear el Blob |

En el primer arranque LORDGYM carga la biblioteca de 932 ejercicios, las 13
pruebas físicas y **dos cuentas vinculadas**: `jusa@lordgym.app` (Josep Sobervia,
entrenador) y `adrian@lordgym.app` (Adrián Carrillo, jugador). No siembra ningún
dato de mentira: ni sesiones, ni histórico, ni jugadores de relleno.

La contraseña inicial de ambas es `lordgym2026`. **Ponla en
`LORDGYM_INITIAL_PASSWORD` antes del primer despliegue**, o cámbiala nada más
entrar desde Configuración (entrenador) o Perfil (jugador): la de por defecto
está escrita en el repositorio, así que cualquiera que lo lea la conoce.

### Vídeos

Para que el entrenador pueda subir vídeos de técnica y el jugador grabar sus
series, hace falta un almacén de ficheros: en Vercel, pestaña **Storage → Blob**.
Al crearlo se define `BLOB_READ_WRITE_TOKEN` sola y la subida se activa en el
siguiente despliegue.

Sin ese token no se rompe nada: los campos de vídeo siguen admitiendo un enlace
pegado a mano, que es como funcionaban antes. Simplemente no aparece el botón de
subir.

El vídeo va del móvil al almacén sin pasar por el servidor. Tiene que ser así:
una función serverless de Vercel rechaza cuerpos de más de 4,5 MB y un vídeo
grabado con el iPhone pesa mucho más. El límite queda en 200 MB por fichero.

En local no hace falta configurar nada: los ficheros se guardan en
`.lordgym-media/` (se puede cambiar con `LORDGYM_MEDIA_DIR`) y se sirven por
`/api/media/…`, que exige sesión. Con `LORDGYM_MEDIA_DRIVER` se fuerza el modo:
`blob`, `local` u `off`.

También se aceptan `POSTGRES_URL`, `POSTGRES_PRISMA_URL` y
`LORDGYM_DATABASE_URL`. Y hay dos ajustes opcionales:
`LORDGYM_PG_POOL_MAX` (3 conexiones por instancia por defecto) y
`LORDGYM_PG_SSL_NO_VERIFY=1` para bases con certificado autofirmado — no hace
falta con Neon ni con Vercel Postgres, que usan certificados de una CA pública.

---

# Camino B · Supabase

Sólo si prefieres su API REST, su panel o su Google Sign-In. Aquí el esquema **sí
hay que ejecutarlo a mano**.

## B1. Crear el proyecto y el esquema

1. Entra en <https://supabase.com> → **New project**, región europea.
2. Cuando termine, abre **SQL Editor** → **New query**, pega el contenido de
   `supabase/schema.sql` y pulsa **Run**.

Eso crea las 30 tablas, los índices y las políticas de seguridad (RLS).

## B2. Copiar las claves

En Supabase: **Project Settings** (el engranaje) → **API Keys**.

Supabase convive con dos formatos de clave. **LORDGYM acepta los dos**, así que
puedes pegar tal cual lo que te dé el panel:

| Lo que ves en Supabase                          | Variable de LORDGYM                    |
| ----------------------------------------------- | -------------------------------------- |
| Project URL                                     | `NEXT_PUBLIC_SUPABASE_URL`             |
| **Formato nuevo** · `sb_publishable_…`          | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Formato nuevo** · `sb_secret_…`               | `SUPABASE_SECRET_KEY`                  |
| *Formato clásico* · `anon` `public` (`eyJ…`)    | `NEXT_PUBLIC_SUPABASE_ANON_KEY`        |
| *Formato clásico* · `service_role` (`eyJ…`)     | `SUPABASE_SERVICE_ROLE_KEY`            |

Necesitas **la URL, una pública y una secreta**. No hace falta poner las cuatro
claves: con el par de tu formato basta.

> La clave secreta (`sb_secret_…` o `service_role`) salta todas las reglas de
> seguridad. Va **sólo** en las variables de entorno del servidor: nunca en el
> código, nunca en el navegador, nunca en un repositorio ni en un chat. Si se
> expone, revócala en Supabase y genera otra.

**La contraseña de la base de datos no se usa** en este camino: ésa sólo sirve
para conectarte a Postgres directamente (psql, DBeaver). Aquí se habla por la API.

## B3. Variables en Vercel

Proyecto → **Settings** → **Environment Variables**, marcadas para *Production*,
*Preview* y *Development*:

```
LORDGYM_DB_DRIVER                      supabase
NEXT_PUBLIC_SUPABASE_URL               https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   sb_publishable_...
SUPABASE_SECRET_KEY                    sb_secret_...
LORDGYM_SESSION_SECRET                 (openssl rand -hex 32)
LORDGYM_INITIAL_PASSWORD               (opcional)
```

Con el formato clásico, cambia las dos del medio por
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

Después de añadir variables hay que **volver a desplegar**.

## B4. Google Sign-In (opcional, sólo con Supabase)

1. Supabase → **Authentication** → **Providers** → **Google** → activar y pegar
   el Client ID y el Client Secret de Google Cloud.
2. En **Authentication** → **URL Configuration** → *Redirect URLs*, añade:
   `https://TU-DOMINIO.vercel.app/auth/callback`.

Sin esto, el botón de Google explica que falta configuración en lugar de fallar.
El inicio de sesión con email y contraseña funciona igualmente.

---

## Comprobar la configuración desde tu ordenador

Copia las variables a un fichero `.env.local` en la raíz del proyecto y ejecuta:

```bash
npm run check:db
```

Detecta solo si has configurado PostgreSQL o Supabase, y te dice si conecta, si
están las 30 tablas y si ya se ha sembrado. No escribe nada: sólo lee.

## Sembrado

La primera petición carga la biblioteca de ejercicios y las pruebas. El proceso
se reclama con una fila en `app_state`, de modo que aunque Vercel arranque varias
instancias a la vez sólo una siembra y no se duplica nada.

Para volver a empezar de cero: borra la fila `seed` de `app_state` y las tablas
que quieras vaciar; en el siguiente arranque se siembra otra vez.

---

## Comprobación rápida

Con todo bien configurado, al abrir el dominio deberías ver la pantalla de acceso
**sin ningún aviso amarillo**. Si aparece el aviso, dice exactamente qué falta.

| Síntoma                             | Causa                                                     |
| ----------------------------------- | --------------------------------------------------------- |
| `404: NOT_FOUND`                    | Vercel despliega una rama sin código (normalmente `main`), |
|                                     | o el proyecto no tiene *Framework Preset* Next.js          |
| Aviso «Falta conectar una base…»    | No hay `DATABASE_URL` ni Supabase configurado              |
| Aviso «Faltan las claves…»          | Con Supabase: falta la URL o la clave secreta              |
| Aviso «Falta la clave de sesión»    | Falta `LORDGYM_SESSION_SECRET`                             |
| Error al entrar, portada bien       | Con Supabase: no se ha ejecutado `supabase/schema.sql`     |

### Si el `404` no se va

El `404: NOT_FOUND` lo sirve Vercel antes de llegar a la aplicación, así que
nunca es un fallo del código. El código del error distingue dos casos muy
distintos:

- **`DEPLOYMENT_NOT_FOUND`**: no hay ningún despliegue asignado al dominio.
- **`NOT_FOUND`** (a secas): sí hay un despliegue sirviendo, pero no encuentra
  nada en esa ruta. Es la firma de un proyecto construido como sitio estático,
  sin `index.html`, es decir con el *Framework Preset* equivocado.

Repasa, por este orden:

1. **Settings → Git**: que el repositorio conectado sea el correcto y que
   *Production Branch* sea `main`.
2. **Settings → General → Framework Preset**: debe poner **Next.js**. Si el
   proyecto se creó cuando el repositorio sólo tenía un README, Vercel lo detectó
   como *Other* y publica un sitio estático vacío. El `vercel.json` de la raíz ya
   fuerza `"framework": "nextjs"` (lo de `vercel.json` manda sobre lo del panel),
   pero sólo se lee si el *Root Directory* es correcto.
3. **Root Directory**: `./` (vacío). La aplicación está en la raíz del repo.
4. **Deployments**: que haya un despliegue posterior al último push y que esté en
   *Ready*, no en *Error*. Si no hay ninguno, pulsa **Redeploy**.
