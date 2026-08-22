# Desplegar LORDGYM en Vercel

Dos cosas que hay que entender antes de empezar:

1. **Vercel despliega la rama por defecto del repositorio (`main`).** Si el
   código está en otra rama, verás un `404: NOT_FOUND`, que no es un fallo de la
   aplicación: es que en `main` no hay aplicación.
2. **En Vercel hace falta Supabase.** El modo local guarda los datos en un
   fichero, y en Vercel el disco es de sólo lectura y se borra entre peticiones.
   Sin Supabase la aplicación arranca pero avisa en la portada de que le falta
   la base de datos.

---

## 1. Crear el proyecto en Supabase

1. Entra en <https://supabase.com> → **New project**.
2. Elige región europea (menos latencia desde España) y guarda la contraseña de
   la base de datos.
3. Cuando termine de crearse, abre **SQL Editor** → **New query**, pega el
   contenido de `supabase/schema.sql` y pulsa **Run**.

Eso crea las 30 tablas, los índices y las políticas de seguridad (RLS).

## 2. Copiar las claves

En Supabase: **Project Settings** (el engranaje) → **API**.

| En Supabase se llama                     | Variable de LORDGYM             |
| ---------------------------------------- | ------------------------------- |
| Project URL                              | `NEXT_PUBLIC_SUPABASE_URL`      |
| Project API keys → `anon` `public`       | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Project API keys → `service_role` secret | `SUPABASE_SERVICE_ROLE_KEY`     |

> La `service_role` salta todas las reglas de seguridad. Va **sólo** en las
> variables de entorno del servidor: nunca en el código, nunca en el navegador,
> nunca en un repositorio público.

## 3. Generar la clave de sesión

Es la que firma las cookies de inicio de sesión. En una terminal:

```bash
openssl rand -hex 32
```

Copia el resultado (64 caracteres). Si no tienes terminal a mano, vale cualquier
cadena aleatoria larga; lo importante es que sea secreta y que no cambie después
(si la cambias, se cierran todas las sesiones abiertas).

## 4. Variables en Vercel

Proyecto → **Settings** → **Environment Variables**. Añade estas cinco y
márcalas para *Production*, *Preview* y *Development*:

```
LORDGYM_DB_DRIVER          supabase
NEXT_PUBLIC_SUPABASE_URL   https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   eyJhbGciOi... (la anon)
SUPABASE_SERVICE_ROLE_KEY  eyJhbGciOi... (la service_role)
LORDGYM_SESSION_SECRET     (los 64 caracteres del paso 3)
```

Opcional:

```
LORDGYM_SEED_DEMO          false
```

Por defecto LORDGYM siembra el equipo de demostración (Carlos, Adrián y compañía)
la primera vez que arranca, muy útil para enseñar el producto. Con `false` sólo
carga la biblioteca de 48 ejercicios y las 13 pruebas físicas, y empiezas con la
base limpia para tu club.

Después de añadir variables hay que **volver a desplegar**: Deployments → el
último → `···` → **Redeploy**. Vercel no las aplica al despliegue anterior.

## 5. Sembrado

La primera petición carga la biblioteca de ejercicios y las pruebas. El proceso
se reclama con una fila en `app_state`, de modo que aunque Vercel arranque varias
instancias a la vez sólo una siembra y no se duplica nada.

Para volver a empezar de cero: borra la fila `seed` de `app_state` y las tablas
que quieras vaciar; en el siguiente arranque se siembra otra vez.

## 6. Google Sign-In (opcional)

1. Supabase → **Authentication** → **Providers** → **Google** → activar y pegar
   el Client ID y el Client Secret de Google Cloud.
2. En **Authentication** → **URL Configuration** → *Redirect URLs*, añade:
   `https://TU-DOMINIO.vercel.app/auth/callback`.

Sin esto, el botón de Google explica que falta configuración en lugar de fallar.
El inicio de sesión con email y contraseña funciona igualmente.

---

## Comprobación rápida

Con todo bien configurado, al abrir el dominio deberías ver la pantalla de acceso
**sin ningún aviso amarillo**. Si aparece el aviso, dice exactamente qué variable
falta.

| Síntoma                             | Causa                                                    |
| ----------------------------------- | -------------------------------------------------------- |
| `404: NOT_FOUND`                    | Vercel despliega una rama sin código (normalmente `main`) |
| Aviso «Falta configurar la base…»   | `LORDGYM_DB_DRIVER` no es `supabase`                      |
| Aviso «Faltan las claves…»          | Falta la URL o la service_role                            |
| Aviso «Falta la clave de sesión»    | Falta `LORDGYM_SESSION_SECRET`                            |
| Error al entrar, portada bien       | El esquema SQL no se ha ejecutado en Supabase             |
