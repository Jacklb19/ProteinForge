# Conectar la cuenta de ProteinForge

Para las URLs públicas y variables de ambos proyectos, seguir [el tutorial de despliegue Vercel](despliegue-vercel.md). El frontend existente está en https://protein-forge.vercel.app/; Google se configura después de obtener la URL del backend y conectar ambos despliegues.

Guía actualizada el 12 de octubre de 2026. Lectura pública expresamente autorizada a las 18:20 UTC: Google y correo/contraseña habilitados, registro permitido con confirmación requerida. Las cinco tablas previstas responden 404/PGRST205 en la API pública; revisar historial y migraciones antes de activarlas. Settings no verifica SMTP ni acceso Google/JWT completo. Esta guía no aplica migraciones ni crea recursos por su cuenta.

## Lo que necesitamos del proyecto

La URL del proyecto y una clave **publishable** pública (`sb_publishable_…`) o una clave `anon` existente. El nombre de variable actual sigue siendo `ANON_KEY` por compatibilidad. Se envía en `apikey`; `Authorization: Bearer` se reserva al token de sesión del usuario. No usar claves secretas ni `service_role` en el frontend. Ver la [documentación oficial de claves](https://supabase.com/docs/guides/getting-started/api-keys).

Si el proyecto todavía no existe, crearlo como proyecto de desarrollo y conservar sus credenciales de base de datos en tu gestor de contraseñas. Para esta primera comprobación de identidad no necesitamos la contraseña de PostgreSQL ni una clave de administrador. Si ya existe, confirmar cuál es y si contiene datos que debamos conservar antes de trabajar con migraciones.

## Frontend

Desde `frontend`, copiar la plantilla solo si no hay configuración local:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Editar `.env` en tu equipo con valores del mismo proyecto:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Reiniciar Vite; se usará este origen en el resto de la guía:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

## Backend

El backend carga automáticamente el `.env` de su propio repositorio, con prioridad para las variables del proceso. No hace falta volver a escribir las claves en la terminal. En otra terminal, desde `backend`, instalar las dependencias e iniciar:

```powershell
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

En `.env`, conservar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `ALLOWED_ORIGINS=http://127.0.0.1:5173`. No pegar claves privadas en el chat ni confirmar `.env` en Git. `localhost` y `127.0.0.1` son orígenes distintos; usar consistentemente la dirección anterior. Si otro programa ocupa esos puertos, actualizar origen, URLs y variables juntos.

## Retorno desde Supabase Auth

En la configuración de URLs de Auth, usar para esta prueba:

| Ajuste | Valor local |
|---|---|
| Site URL | `http://127.0.0.1:5173/app` |
| Redirect URL para Google | `http://127.0.0.1:5173/app` |
| Redirect URL para recuperación | `http://127.0.0.1:5173/recover` |

La URL de retorno solicitada debe estar admitida; Site URL define el retorno por defecto para confirmación. En producción se configurarán las URLs finales. Ver [redirecciones oficiales](https://supabase.com/docs/guides/auth/redirect-urls).

Correo/contraseña puede probarse primero; Google requiere configuración de proveedor independiente. Mantener la confirmación de correo y decidir una entrega de correo de prueba válida antes de registrar usuarios. El SMTP incluido no debe suponerse disponible para cualquier destinatario; consultar [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp). No activar servicios de pago para esta prueba.

## Cómo sabremos que funciona

1. Health del backend responde con identidad configurada.
2. Registro, confirmación y entrada permiten llegar a `/app`.
3. En Ajustes aparece «Tu cuenta está conectada y su identidad ha sido verificada», después de comprobar `/v1/me` y el mismo ID de usuario.
4. Cierre de sesión, recuperación y nuevo acceso conservan sus estados correctos; se comprueba Google cuando esté configurado.

Los cálculos y CSV continúan funcionando sin cuenta. Identidad verificada todavía no equivale a guardar proyectos. El siguiente bloque es concretar e implementar CRUD sobre el esquema existente y comprobar RLS en PostgreSQL antes de aplicar migraciones remotas.

La comprobación del 12 de octubre pidió cero filas a la API de datos con la clave pública: las cinco tablas previstas respondieron `PGRST205` (no encontradas en el esquema expuesto). Esto no inspecciona esquemas privados, demuestra políticas RLS ni autoriza aplicar la migración. Se debe revisar el esquema y preparar la persistencia antes de cambiar la base remota.

La CSP local ya permite https://protein-back.vercel.app. La última lectura de la cabecera publicada todavía no incluía ese origen; el usuario publicó el commit después y se debe comprobar el despliegue vigente. Frontend y backend están publicados por el usuario. Esta guía no realiza operaciones remotas.
