# Conectar la cuenta de ProteinForge

Guía local del 11 de octubre de 2026. La interfaz, Auth, el cliente de API y la descarga CSV están preparados. Falta comprobar un proyecto Supabase de desarrollo real. Esta guía no aplica migraciones ni crea recursos por su cuenta.

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

El backend lee el entorno del proceso. El comando de Uvicorn actual **no carga `.env` automáticamente**. En otra terminal, desde `backend`, establecer los valores públicos y el origen exacto antes de iniciar:

```powershell
$env:SUPABASE_URL = 'https://TU-PROYECTO.supabase.co'
$env:SUPABASE_ANON_KEY = 'TU-CLAVE-PUBLICA'
$env:ALLOWED_ORIGINS = 'http://127.0.0.1:5173'
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

No pegar claves privadas en el chat ni confirmar `.env` en Git. `localhost` y `127.0.0.1` son orígenes distintos; usar consistentemente la dirección anterior. Si otro programa ocupa esos puertos, actualizar origen, URLs y variables juntos.

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

Para publicar también hará falta permitir el origen concreto de la API en la CSP del frontend; la política actual se conserva hasta conocer esa URL. No hay despliegue ni operación de GitHub en esta configuración local.
