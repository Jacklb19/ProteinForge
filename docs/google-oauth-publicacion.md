# Información pública para Google OAuth

Valores para completar la pantalla de consentimiento de Google Cloud de forma manual. La guía no publica el consentimiento ni modifica servicios remotos.

## Campos de Branding

Con las páginas legales desplegadas, usar:

| Campo | Valor |
|---|---|
| Nombre de la aplicación | ProteinForge |
| Correo de asistencia | El correo de contacto publicado en `/privacy` y `/terms` |
| Logo | Opcional; se deja vacío |
| Página principal | https://protein-forge.vercel.app/ |
| Política de privacidad | https://protein-forge.vercel.app/privacy |
| Condiciones del servicio | https://protein-forge.vercel.app/terms |
| Contacto del desarrollador | El mismo correo de contacto |

Las páginas `/privacy` y `/terms` son públicas, sin cuenta, y están enlazadas desde el pie del inicio. La política describe autenticación, datos de Google, almacenamiento local, proveedores, conservación, solicitudes de eliminación y funciones futuras separadas de las actuales. El correo de contacto aparece en ambas páginas.

## Dominios en la lista de Google

Registrar los hosts, sin esquema ni ruta, antes de guardar las URLs:

```text
protein-forge.vercel.app
<referencia-del-proyecto>.supabase.co
```

El primero corresponde a la web; el segundo al callback de autenticación del proyecto de Supabase. `vercel.app` y `supabase.co` son sufijos públicos en la Public Suffix List, por lo que el dominio privado pertinente es el host del proyecto. Esta interpretación sigue la regla de Google sobre Top Private Domain y la lista actual; guardar un host no demuestra propiedad ni garantiza que Google apruebe la marca. El backend FastAPI no aparece en los orígenes ni callbacks del cliente OAuth, así que su host no hace falta para esta configuración.

## Cliente web y retorno

- Origen JavaScript: `https://protein-forge.vercel.app`.
- Redirección OAuth: `https://<referencia-del-proyecto>.supabase.co/auth/v1/callback`, comprobada contra el Callback URL que muestra Supabase.
- Supabase Site URL y redirect admitido: `https://protein-forge.vercel.app/app`.
- Recuperación admitida: `https://protein-forge.vercel.app/recover`.
- Permisos de identidad: openid, userinfo.email y userinfo.profile; sin permisos de Gmail/Drive.
- Client ID y Secret quedan en el proveedor Google de Supabase, nunca en `VITE_` ni en Git.

## Guardar, probar y publicar

Primero desplegar las páginas en Vercel y comprobar que las URLs muestran su documento. Guardar Branding con los valores anteriores y probar con una cuenta de prueba. Que la web esté desplegada en Vercel no cambia el estado «Prueba» del cliente de Google.

El formulario indica que actualmente no necesita verificación por estar en Prueba. Cambiar a producción o publicar la marca puede activar controles adicionales de Google. Su guía de remediación de dominio exige verificar una propiedad de dominio mediante DNS con una cuenta propietaria del proyecto. No es posible crear registros DNS de `vercel.app` ni `supabase.co`, así que no se puede acreditar propiedad de esos dominios. Si Google exige ese control para la marca, se mantiene el estado de prueba mientras se resuelve con un dominio propio o con el procedimiento que indique Google.

## Referencias revisadas

- [Branding y dominios de Google](https://support.google.com/cloud/answer/15549049?hl=en).
- [Verificación de dominio](https://support.google.com/cloud/answer/13804266?hl=en).
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat).
- [Google con Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [Seguridad de contraseñas Supabase](https://supabase.com/docs/guides/auth/password-security).
