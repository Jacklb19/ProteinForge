# Despliegue y configuración de servicios

ProteinForge se publica como dos proyectos de Vercel independientes, uno por repositorio, y usa un proyecto de Supabase para la identidad y la base de datos.

| Pieza | Repositorio | Producción |
|---|---|---|
| Frontend (Vite) | [Jacklb19/ProteinForge](https://github.com/Jacklb19/ProteinForge) | https://protein-forge.vercel.app |
| API (FastAPI) | [Jacklb19/Protein_Back](https://github.com/Jacklb19/Protein_Back) | https://protein-back.vercel.app |
| Identidad y PostgreSQL | Supabase | Configurado en las variables de ambos proyectos |

Ambos proyectos publican desde la rama `main`. Cuando un cambio afecta al contrato entre los dos (archivos `proto/` o migraciones), el orden es: migración en Supabase → API → regenerar los clientes del frontend (`buf.gen.yaml` apunta a un commit publicado del backend) → frontend.

## Frontend en Vercel

| Ajuste | Valor |
|---|---|
| Framework Preset | Vite |
| Root Directory | `.` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 24.x (igual que `.nvmrc`) |

El paquete WebAssembly del alineamiento está versionado en `rust/alignment/pkg/`, así que el build no necesita Rust.

Las variables `VITE_*` se fijan durante el build: tras cambiarlas hay que volver a desplegar. Nunca deben contener claves secretas, `service_role`, contraseñas SMTP ni secretos OAuth, porque su valor llega al navegador. La lista completa y su efecto están en el [README](../README.md#variables-de-entorno) y en `.env.example`.

`vercel.json` define la reescritura a `index.html` para las rutas de la SPA y las cabeceras de seguridad:

- `Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy`, necesarias para los Workers paralelos del alineamiento;
- `Content-Security-Policy` sin `unsafe-eval` (solo `wasm-unsafe-eval`), con `connect-src` limitado a Supabase, RCSB, AlphaFold y el origen exacto de la API (`https` y `wss`);
- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY` y `Referrer-Policy`.

Si la API cambia de dirección, se añade su origen exacto a `connect-src`; no se usan comodines de Vercel.

## API en Vercel

| Ajuste | Valor |
|---|---|
| Framework Preset | FastAPI |
| Root Directory | `.` |
| Build, Output e Install | Valores del framework, sin cambios |

Vercel detecta `app/main.py:app`, instala `requirements.txt` y usa la versión de `.python-version` (3.14). El repositorio no tiene `pyproject.toml` a propósito: Vercel lo tomaría como manifiesto de dependencias en lugar de `requirements.txt`.

Variables mínimas en Production:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave pública (`sb_publishable_…` o `anon`) |
| `ALLOWED_ORIGINS` | `https://protein-forge.vercel.app` (sin ruta ni barra final) |

El resto de variables (asistente, predicción, canal en vivo, presupuestos compartidos) están documentadas en el README del backend y en su `.env.example`. La API nunca usa la clave `service_role`.

### Comprobación

```bash
curl -s https://protein-back.vercel.app/v1/health
curl -s -X POST -H "Content-Type: application/json" -d "{}" \
  https://protein-back.vercel.app/proteinforge.account.v1.AccountService/GetStatus
```

La primera devuelve `status`, `version`, `identity` y `live`. La segunda comprueba los servicios RPC por el protocolo Connect. `identity: true` solo indica que la configuración existe, no que una cuenta concreta funcione. El workflow `deployment-check.yml` del backend repite una comprobación equivalente cada seis horas.

## Supabase

### Claves

El frontend y la API usan la misma URL y la misma clave **publishable** (o la `anon` heredada). La clave viaja en la cabecera `apikey`; `Authorization: Bearer` lleva el token de sesión del usuario, y RLS decide qué filas puede leer o escribir. Las migraciones están en `supabase/migrations/` del repositorio backend y se aplican en orden de nombre.

### URL de retorno de Auth

En **Authentication → URL Configuration**:

| Ajuste | Producción | Desarrollo local |
|---|---|---|
| Site URL | `https://protein-forge.vercel.app/app` | `http://127.0.0.1:5173/app` |
| Redirect URL (Google) | `https://protein-forge.vercel.app/app` | `http://127.0.0.1:5173/app` |
| Redirect URL (recuperación) | `https://protein-forge.vercel.app/recover` | `http://127.0.0.1:5173/recover` |

`/app` es la dirección de retorno OAuth registrada y redirige a la página pedida. `localhost` y `127.0.0.1` son orígenes distintos: hay que usar el mismo en Supabase, en `ALLOWED_ORIGINS` y en el navegador.

### Correo y Google

- La confirmación de registro admite el enlace del correo o un código de seis cifras que se introduce en `/confirm`. La plantilla «Confirm signup» de Supabase debe incluir ambos.
- El SMTP incluido en Supabase tiene límites estrictos; para usuarios reales se configura un SMTP propio (por ejemplo Gmail con contraseña de aplicación, puertos 465 o 587). Sus credenciales solo se guardan en Supabase.
- Para Google: en Google Cloud, origen autorizado `https://protein-forge.vercel.app` y URI de redirección igual al *Callback URL* del proveedor Google en Supabase (no es una ruta de la API). Client ID y Secret se guardan en Supabase. La información pública que exige Google está en [Información pública para Google OAuth](google-oauth-publicacion.md).

Si no llega un correo, el primer paso es **Supabase → Logs → Auth** a la hora del intento: un `535` indica credenciales SMTP rechazadas; un `429`, límite de envío; si el proveedor aceptó el mensaje, hay que revisar spam o cuarentena del destinatario.

## Desarrollo local contra servicios reales

1. Frontend: copiar `.env.example` a `.env` y rellenar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_BASE_URL=http://127.0.0.1:8000`. Arrancar con `npm run dev -- --host 127.0.0.1`.
2. API: copiar su `.env.example` a `.env` con `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `ALLOWED_ORIGINS=http://127.0.0.1:5173`, y arrancar `uvicorn app.main:app --host 127.0.0.1 --port 8000`. La API lee automáticamente el `.env` de su raíz; las variables del proceso tienen prioridad.
3. En Supabase, admitir los retornos locales de la tabla anterior.

## Referencias

- [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi) y [versión de Python](https://vercel.com/docs/functions/runtimes/python/python-version)
- [Variables de entorno de Vercel](https://vercel.com/docs/environment-variables)
- [Claves de API de Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [URL de retorno de Supabase](https://supabase.com/docs/guides/auth/redirect-urls) y [Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [SMTP propio en Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
