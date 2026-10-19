# Conectar la cuenta de ProteinForge

Para las URLs públicas y variables de ambos proyectos, seguir [el tutorial de despliegue Vercel](despliegue-vercel.md). El frontend existente está en https://protein-forge.vercel.app/; Google se configura después de obtener la URL del backend y conectar ambos despliegues.

Guía revisada el 19 de octubre de 2026. El propietario aplicó las tres migraciones y publicó ambos repositorios; el relevo informa de CRUD y UniProt con cuenta real en producción. La comprobación de tablas de cero filas del 12 oct queda como evidencia histórica. Durante esta entrega el propietario confirmó que los correos de confirmación sí funcionan con su SMTP propio. No se inspeccionaron sus logs ni se atribuye una causa al problema previo. Esta guía no aplica migraciones ni crea recursos.

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
3. En Ajustes aparece «Tu cuenta está conectada y su identidad ha sido verificada», después de comprobar la identidad con `AccountService/GetMe` (gRPC-Web) y el mismo ID de usuario.
4. Cierre de sesión, recuperación y nuevo acceso conservan sus estados correctos; se comprueba Google cuando esté configurado.

Los cálculos y CSV continúan funcionando sin cuenta. Proyectos ya tiene CRUD por gRPC-Web y persistencia publicada. La evidencia local de RLS no sustituye una prueba entre dos cuentas reales. La entrega de confirmación está comprobada por el propietario; recuperación y recorrido Google completo no quedan certificados por esa prueba.

La comprobación del 12 de octubre pidió cero filas a la API de datos con la clave pública: las cinco tablas previstas respondieron `PGRST205` (no encontradas en el esquema expuesto). Esto no inspecciona esquemas privados, demuestra políticas RLS ni autoriza aplicar la migración. Se debe revisar el esquema y preparar la persistencia antes de cambiar la base remota.

La publicación del 19 oct ya comprobó gRPC-Web entre ambos orígenes con CSP/CORS. Esta entrega de documentación no repite esa prueba ni realiza cambios remotos.

## Correo de confirmación — resuelto por comprobación del propietario

Estado al 19 oct: el propietario confirma «sí funciona los correos de confirmación». Pendiente cerrado; no hace falta cambiar SMTP ni consultar logs para esta entrega. Las siguientes comprobaciones quedan como referencia únicamente si vuelve a fallar. El primer paso sería Supabase → Logs → Auth en el proyecto correcto y hora del intento; si el proveedor aceptó el correo, revisar después spam/cuarentena y registros del proveedor. [Diagnóstico oficial de Supabase](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).

| Señal del log | Comprobación siguiente |
|---|---|
| `535` / credenciales rechazadas | Usuario SMTP completo y contraseña de aplicación válida, introducida únicamente por el propietario en Supabase |
| Timeout, conexión o TLS | Host/puerto compatibles y disponibilidad del proveedor; no desactivar TLS |
| `429` / límite de correo | Revisar límites efectivos de Auth y del proveedor; esperar el intervalo indicado antes de reintentar |
| Proveedor acepta el mensaje | Revisar spam/cuarentena/rechazos del destinatario y registros de entrega |
| No aparece intento | Comprobar proyecto y hora; una respuesta de registro por sí sola no demuestra envío ni una cuenta pendiente de confirmación |

Para Gmail, comprobar en la configuración ya existente: `smtp.gmail.com`, puerto **465 o 587**, usuario como dirección completa y remitente igual a esa cuenta como punto de partida. Son los puertos descritos en la [guía de Google SMTP de Supabase](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y). La contraseña de aplicación exige verificación en dos pasos y puede estar restringida por la organización; Google la revoca si cambia la contraseña de la cuenta. El propietario gestiona ese secreto directamente, sin pegarlo en chat, terminal ni Git. [Contraseñas de aplicación de Google](https://support.google.com/accounts/answer/185833).

Revisar la configuración efectiva de [límites de Auth](https://supabase.com/docs/guides/auth/rate-limits) y la cuota del proveedor. No trasladar automáticamente los límites del SMTP incluido al SMTP propio. No desactivar la confirmación para ocultar el fallo ni enviar reintentos repetidos desde herramientas.

Si el mensaje llega y falla el enlace, revisar Site URL y Redirect URLs como un problema separado. Para producción, conservar el retorno `https://protein-forge.vercel.app/app` y recuperación `https://protein-forge.vercel.app/recover` admitidos por Auth; `/app` redirige a Analizar. Las URLs locales solo corresponden a desarrollo. [Redirecciones oficiales](https://supabase.com/docs/guides/auth/redirect-urls).

Si reaparece el problema, bastaría el código SMTP o categoría del error y hora aproximada. Antes de compartir un extracto, retirar correo, identificadores, tokens y enlaces de confirmación. No se han solicitado ni manejado contraseñas, enviado mensajes ni modificado Supabase.
