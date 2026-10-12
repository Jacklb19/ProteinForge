# Información pública para Google OAuth

Preparación del 12 de octubre de 2026. El usuario completa Google Cloud manualmente y pide preparar todos los campos excepto el logo. Esta guía no publica el consentimiento, no acepta términos por el usuario y no modifica servicios remotos.

## Campos de Branding

Después de publicar el commit que incorpora las páginas legales, usar:

| Campo | Valor |
|---|---|
| Nombre de la aplicación | ProteinForge |
| Correo de asistencia | joseluisburbano19105@gmail.com |
| Logo | Dejar vacío, por petición del usuario |
| Página principal | https://protein-forge.vercel.app/ |
| Política de privacidad | https://protein-forge.vercel.app/privacy |
| Condiciones del servicio | https://protein-forge.vercel.app/terms |
| Contacto del desarrollador | joseluisburbano19105@gmail.com |

Las páginas `/privacy` y `/terms` son públicas, sin cuenta, y están enlazadas desde el pie del inicio. La política describe autenticación, datos de Google, almacenamiento local, proveedores, conservación, solicitudes de eliminación y funciones futuras separadas de las actuales. El correo indicado aparece como contacto de ambas páginas. No se crean capacidades de guardado ni borrado automático de cuentas por añadir estos documentos.

## Dominios autorizados

Registrar los hosts, sin esquema ni ruta, antes de guardar las URLs:

```text
protein-forge.vercel.app
ycskfgimxrnhozmmqnze.supabase.co
```

El primero corresponde a la web; el segundo al callback de autenticación del proyecto Supabase actualmente configurado. `vercel.app` y `supabase.co` son sufijos públicos en la Public Suffix List, por lo que el dominio privado pertinente es el host de tu proyecto. Esta interpretación sigue la regla de Google sobre Top Private Domain y la lista actual; guardar un host no demuestra propiedad ni garantiza que Google apruebe la marca. El backend FastAPI no aparece en los orígenes ni callbacks del cliente OAuth, así que su host no hace falta para esta configuración.

## Cliente web y retorno

- Origen JavaScript: `https://protein-forge.vercel.app`.
- Redirección OAuth: `https://ycskfgimxrnhozmmqnze.supabase.co/auth/v1/callback`, comprobada contra el Callback URL que muestra Supabase.
- Supabase Site URL y redirect admitido: `https://protein-forge.vercel.app/app`.
- Recuperación admitida: `https://protein-forge.vercel.app/recover`.
- Permisos de identidad: openid, userinfo.email y userinfo.profile; sin permisos de Gmail/Drive.
- Client ID y Secret quedan en el proveedor Google de Supabase, nunca en `VITE_` ni en Git.

## Guardar, probar y publicar

Primero publicar las páginas en Vercel y comprobar que las URLs muestran su documento, no una pantalla de página inexistente. Guardar Branding con los valores anteriores y probar con una cuenta autorizada. Que la web esté publicada en Vercel no cambia el estado Prueba del cliente Google.

El formulario indica que actualmente no necesita verificación por estar en Prueba. Cambiar a producción o publicar la marca puede activar controles adicionales de Google. Su guía de remediación de dominio exige verificar una propiedad de dominio mediante DNS con una cuenta propietaria del proyecto. No podemos crear registros DNS de `vercel.app` ni `supabase.co`; no se debe afirmar propiedad de esos dominios del proveedor. Si Google exige ese control para tu marca, conservar la prueba mientras se resuelve con un dominio controlado o con el procedimiento que indique Google. No se compra ni cambia dominio sin una decisión del usuario.

## Referencias revisadas

- [Branding y dominios de Google](https://support.google.com/cloud/answer/15549049?hl=en).
- [Verificación de dominio](https://support.google.com/cloud/answer/13804266?hl=en).
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat).
- [Google con Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [Seguridad de contraseñas Supabase](https://supabase.com/docs/guides/auth/password-security).
