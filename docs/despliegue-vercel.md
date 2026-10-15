# Despliegue de ProteinForge en Vercel

Actualizado el 12 de octubre de 2026. Frontend existente: https://protein-forge.vercel.app/. Backend publicado por el usuario: https://protein-back.vercel.app/. Son dos repositorios y dos proyectos independientes. Health del backend y preflight CORS responden 200 para el frontend; me sin sesión responde 401. El frontend incluye la URL correcta de API y conserva COOP/COEP, pero la CSP publicada aún no permite el backend. El vercel.json local ya está corregido y requiere publicar ese commit. Esta guía no ejecuta pushes ni despliegues.

## 1. Publicar el código que se desplegará

Vercel importa el código de GitHub, no los cambios sin confirmar de tu equipo. El usuario publica los cambios en la rama elegida. Backend incluye `.python-version` con `3.14`, `requirements.txt` y `app/main.py` que exporta `app`; no necesita un comando de Uvicorn en Vercel. Python 3.14 está soportado por Vercel, aunque las pruebas locales existentes se ejecutaron con 3.13.

Comandos opcionales desde `backend/` para los cambios actuales, después de revisar `git diff`:

```powershell
git status --short
git diff
git add .python-version app/config.py requirements.txt tests/test_config.py README.md docs/arquitectura.md
git commit -m "fix(config): load local environment and pin deployment runtime"
git push origin dev
```

Si se usa otra rama como fuente de producción, el despliegue debe contener estos cambios. Un Redeploy de un commit anterior no añade los cambios de `dev`. Las reglas locales mantienen `main` para versiones verificadas; esta guía no hace merge ni modifica ramas.

## 2. Crear el proyecto del backend

En Vercel: **Add New → Project → Import Git Repository**, selecciona `Jacklb19/Protein_Back`.

| Ajuste | Valor |
|---|---|
| Nombre | Elige un nombre disponible para el backend |
| Framework Preset | FastAPI |
| Root Directory | Raíz del repositorio (`.`); no `backend` |
| Build Command | Valor predeterminado del framework, sin override |
| Output Directory | Valor predeterminado del framework, sin override |
| Install Command | Valor predeterminado del framework, sin override |

Vercel detecta `app/main.py` y sus dependencias. Si no detecta FastAPI, verifica que se importó el repositorio correcto y que ese archivo está en el commit publicado.

Antes de Deploy, añade estas variables al entorno **Production**:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | La misma URL Supabase del `.env` local |
| `SUPABASE_ANON_KEY` | La misma clave pública anon o publishable del `.env` local |
| `ALLOWED_ORIGINS` | `https://protein-forge.vercel.app` |

No añadas comillas alrededor de los valores en los campos de Vercel. El origen CORS no incluye `/app`, otras rutas ni una barra final. Opcionalmente puedes añadir `,http://127.0.0.1:5173` para probar el frontend local contra la API publicada. Para Preview, configura las variables en ese entorno si vas a usarlo; CORS solo admite los orígenes enumerados.

`FRONTEND_ORIGIN` es una alternativa para un solo origen y no hace falta cuando existe `ALLOWED_ORIGINS`. `IDENTITY_TIMEOUT_SECONDS` es opcional; el valor actual por defecto es 5 segundos. `SUPABASE_SERVICE_ROLE_KEY` y `GROQ_API_KEY` no son consumidas por la implementación actual de health/me; se configurarán solo en backend cuando se implementen sus capacidades. No necesitas contraseña de PostgreSQL para este despliegue de identidad.

El dominio estable asignado al backend es `https://protein-back.vercel.app`. En el resto de la guía, `URL_BACKEND` significa esa URL HTTPS real, sin `/v1` ni barra final.

## 3. Comprobar la API publicada

Abre https://protein-back.vercel.app/v1/health. La respuesta esperada es:

```json
{"status":"ok","version":"0.1.0","identity":true}
```

`identity: true` solo confirma presencia de configuración. No demuestra acceso de una cuenta válida. `/v1/me` sin sesión responde 401; la raíz `/` puede responder 404 porque no hay ruta de inicio en la API. Si aparece un acceso a Vercel en vez de JSON, revisa la protección del despliegue: la API debe ser accesible a los usuarios de la web. Si hay un error de función, revisa Build Logs/Runtime Logs antes de cambiar variables o dependencias.

La web usa la API por gRPC-Web. Para comprobar los servicios RPC sin navegador, la misma llamada de estado por el protocolo Connect (JSON):

```bash
curl -s -X POST -H "Content-Type: application/json" -d "{}" https://protein-back.vercel.app/proteinforge.account.v1.AccountService/GetStatus
```

Respuesta esperada: `{"status":"ok","version":"0.1.0","identityConfigured":true}`. Si responde 404, el despliegue aún no incluye los servicios gRPC.

## 4. Actualizar el frontend existente

No crees otro proyecto para el frontend. En el proyecto que publica https://protein-forge.vercel.app/, abre **Settings → Environment Variables** y configura **Production**:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | La misma URL usada por el backend |
| `VITE_SUPABASE_ANON_KEY` | La misma clave pública anon o publishable |
| `VITE_API_BASE_URL` | `https://protein-back.vercel.app` |

Nunca uses claves secretas/service_role, contraseña SMTP ni OAuth Client Secret en variables `VITE_`: sus valores se incluyen en el código entregado al navegador. El `.env` local no configura automáticamente el proyecto Vercel.

En **Build and Deployment**, conserva Vite, `npm run build`, salida `dist` y Node 24.x. La raíz del repositorio frontend es `.`. El WASM generado ya está versionado; este build no requiere reconstruirlo con Rust.

## 5. Permitir el backend en la CSP

Edita `frontend/vercel.json`, en el valor de `Content-Security-Policy`. Añade únicamente el origen real del backend a `connect-src`, conservando el resto de directivas:

```text
connect-src 'self' https://*.supabase.co https://models.rcsb.org https://protein-back.vercel.app;
```

El archivo local ya contiene ese origen exacto. No uses un comodín para todos los dominios Vercel. Si la URL de API incluye una ruta base, aquí se usa solo su origen.

Publica tú el cambio de `vercel.json` en GitHub y despliega ese commit en el proyecto frontend existente. Después de cambiar variables, inicia un nuevo despliegue: los valores `VITE_` quedan fijados durante el build. Verifica que el despliegue actualizado tenga asignado protein-forge.vercel.app.

## 6. Supabase y Google después del despliegue

En **Authentication → URL Configuration**:

| Ajuste | Valor |
|---|---|
| Site URL | `https://protein-forge.vercel.app/app` |
| Redirect URL | `https://protein-forge.vercel.app/app` |
| Redirect URL | `https://protein-forge.vercel.app/recover` |

Conserva los retornos locales exactos si vas a seguir probando en tu equipo. Configura Gmail SMTP por separado; sus credenciales quedan en Supabase. En Google Cloud el origen será `https://protein-forge.vercel.app` y la URI OAuth de redirección será el Callback URL del proveedor Google en Supabase. El callback no es una ruta del backend FastAPI. Client ID y Secret se guardan en el proveedor Google de Supabase.

## 7. Verificación final

Para completar los campos de Branding sin logo y publicar las páginas legales, seguir [Información pública para Google OAuth](google-oauth-publicacion.md).

Visita https://protein-forge.vercel.app/settings: el servicio debe responder. Cuando SMTP y Google estén configurados, prueba una cuenta y comprueba la identidad mediante me. Después prueba cierre, recuperación y retorno. Health y el despliegue no habilitan CRUD: proyectos/RLS y migraciones siguen pendientes.

## Referencias

- [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi).
- [Versión Python en Vercel](https://vercel.com/docs/functions/runtimes/python/python-version).
- [Variables de entorno Vercel](https://vercel.com/docs/environment-variables).
- [Redirecciones Supabase](https://supabase.com/docs/guides/auth/redirect-urls).
- [Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).
