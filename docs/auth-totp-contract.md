# Segundo factor TOTP — contrato de Supabase Auth

Comprobado el **29 oct 2026** para la capa de cliente de `src/features/auth/`, que habla con la API REST de Supabase Auth (GoTrue) sin SDK. Nada de esto se ha probado contra un proyecto remoto: las respuestas citadas salen del código fuente y de la especificación oficiales, y las pruebas unitarias las simulan. Lo que no se pudo confirmar está marcado como **sin confirmar**.

## Fuentes

| Fuente | Qué aporta |
|---|---|
| [Guía MFA](https://supabase.com/docs/guides/auth/auth-mfa) | Definición de aal1/aal2, claims `aal` y `amr`, aplicación con RLS restrictivas, bajada de nivel tras quitar un factor |
| [Guía TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) | Flujo inscribir → desafiar → verificar, QR en SVG, intervalo de 30 s con un intervalo de margen, «gratuito y activado por defecto en todos los proyectos» |
| [Referencia JS de MFA](https://supabase.com/docs/reference/javascript/auth-mfa-api) | «Recovery codes are not supported», hasta 10 factores |
| [Referencia JS de códigos de recuperación](https://supabase.com/docs/reference/javascript/auth-mfa-recovery-codes-generate) | Exige `auth.experimental.recoveryCodes: true` |
| Código de [supabase/auth `v2.197.0`](https://github.com/supabase/auth/tree/v2.197.0) (9 sep 2026, última versión estable al consultar; después solo hay candidatas `rc2.198.0-rc.*`) | `internal/api/mfa.go`, `api.go`, `token.go`, `apilimiter/apilimiter.go`, `internal/conf/configuration.go`, `internal/models/{factor,sessions}.go`, `apierrors/errorcode.go` |
| [`openapi.yaml` de `master`](https://github.com/supabase/auth/blob/master/openapi.yaml) | Esquemas de respuesta (`TOTPPhoneChallengeResponse`, `AccessTokenResponseSchema`, `MFAFactorSchema`) y rutas de códigos de recuperación, documentadas el 21 sep 2026 |
| `supabase-js`, `packages/core/auth-js/src/GoTrueClient.ts` (`master`) | Cómo lo usa el SDK oficial: prefijo del QR, lista de factores desde `GET /user`, cálculo de `currentLevel`/`nextLevel` |

## Rutas

Todas bajo `{VITE_SUPABASE_URL}/auth/v1`, con la cabecera `apikey` y `Authorization: Bearer <access_token>` del usuario. Los usuarios anónimos no pueden usarlas (`requireNotAnonymous`).

### Inscribir — `POST /factors`

Cuerpo: `{"factor_type": "totp", "friendly_name"?: string, "issuer"?: string}`.

Respuesta 200 (`EnrollFactorResponse`):

```json
{ "id": "<uuid>", "type": "totp", "friendly_name": "…",
  "totp": { "qr_code": "<svg …>", "secret": "<base32>", "uri": "otpauth://totp/…" } }
```

- `qr_code` es el **texto SVG**, no un URI de datos. supabase-js le antepone `data:image/svg+xml;utf-8,`. La CSP de `vercel.json` ya permite `img-src data:`, así que se puede mostrar en un `<img>`, donde el SVG no ejecuta nada.
- Sin `issuer`, el servidor usa el host de la Site URL del proyecto (en producción, `protein-forge.vercel.app`). La especificación lo declara `format: uri`; el código lo trata como texto libre. El cliente **no lo envía** para no depender de esa diferencia.
- El factor nace `unverified`. El servidor borra los no verificados con más de `factor_expiry_duration` (300 s por defecto) al inscribir otro, y al verificar uno borra los demás no verificados del mismo tipo.
- Antes de crear: `mfa_factor_name_conflict` si otro factor del usuario tiene el mismo `friendly_name` (también vacío), `too_many_enrolled_mfa_factors` al llegar a 10 factores o 10 verificados, `insufficient_aal` (403) si ya hay un factor verificado y la sesión es aal1, `mfa_totp_enroll_not_enabled` (422) si el proyecto desactivó la inscripción.

### Desafiar — `POST /factors/{factorId}/challenge`

Sin cuerpo para TOTP (`channel` solo es para teléfono). Respuesta 200: `{"id": "<uuid>", "type": "totp", "expires_at": <segundos Unix>}`. El desafío caduca a los `challenge_expiry_duration` segundos (300 por defecto; el servidor no acepta menos). Guarda la IP de quien lo pide.

### Verificar — `POST /factors/{factorId}/verify`

Cuerpo: `{"challenge_id": "<uuid>", "code": "123456"}`. El servidor valida TOTP de **6 dígitos, SHA-1, periodo 30 s y margen de un periodo**; un código vacío es `validation_failed`.

Respuesta 200: una sesión completa (`AccessTokenResponseSchema`: `access_token`, `token_type`, `expires_in`, `expires_at`, `refresh_token`, `user`), igual que `/token`. La especificación dice que el cliente debe **sustituir los tokens guardados**: el `refresh_token` anterior queda inservible para obtener aal2 porque el contador de la sesión avanza dos posiciones.

Efectos en el servidor, leídos en `verifyTOTPFactor`:

1. Si el factor estaba `unverified`, pasa a `verified` (así se termina la inscripción).
2. La sesión actual sube a **aal2** y su `amr` gana una entrada `totp`.
3. **Se invalidan las demás sesiones del usuario con nivel inferior a aal2**: otros dispositivos con sesión abierta pierden su refresco y tendrán que volver a entrar.
4. Se borran los demás factores TOTP no verificados.

Errores: `mfa_verification_failed` (422, código incorrecto), `mfa_challenge_expired` (422), `mfa_factor_not_found` (422, desafío que no existe), `mfa_ip_address_mismatch` (422, el desafío se pidió desde otra IP), `mfa_verification_rejected` (403, un hook del proyecto lo rechazó y **cerró todas las sesiones**), `mfa_totp_verify_not_enabled` (422).

### Quitar — `DELETE /factors/{factorId}`

Respuesta 200: `{"id": "<uuid>"}`. Un factor verificado solo se puede quitar desde una sesión **aal2** (`insufficient_aal`, 422); uno sin verificar se puede quitar desde aal1. Las sesiones que subieron de nivel con ese factor bajan a aal1 en la base de datos, pero el JWT en uso conserva `aal2` hasta que se refresca: la especificación pide llamar a `POST /token?grant_type=refresh_token` justo después.

### Listar — `GET /user`

El usuario trae `factors` (se omite si no hay ninguno), cada uno con `id`, `friendly_name`, `factor_type`, `status` (`verified` o `unverified`), `created_at`, `updated_at` y `last_challenged_at`. Es la misma llamada que hace `supabase.auth.mfa.listFactors()`, que además solo considera los verificados.

## Nivel de garantía y refresco

- El nivel va en el claim `aal` del JWT de acceso. Un JWT sin `aal` cuenta como **aal1**. `amr` es una lista `{method, timestamp}` ordenada de más reciente a más antigua (`password`, `oauth`, `otp`, `totp`…).
- supabase-js calcula `currentLevel` con ese claim y `nextLevel = aal2` si el usuario tiene al menos un factor verificado. La combinación aal1 → aal2 significa «hay que pedir el código».
- Iniciar sesión con contraseña o con Google **siempre** devuelve una sesión aal1, tenga o no el usuario un segundo factor. El segundo factor se pide después, con la sesión aal1 ya abierta.
- **Refresco**: el nivel se guarda en la sesión del servidor, no en el token. `grant_type=refresh_token` emite un JWT con el nivel actual de esa sesión: una sesión aal2 sigue en aal2 al refrescar, y una que bajó por quitar el factor sale en aal1.
- Si el proyecto limita la duración de las sesiones de nivel bajo (`sessions.allow_low_aal`), el refresco de una sesión aal1 de un usuario con factor verificado falla con `session_expired`. Por defecto no está activo.
- **Lo que el cliente no puede imponer**: una sesión aal1 con un factor inscrito sigue siendo una sesión válida para PostgREST y para la API de ProteinForge. Exigir aal2 es tarea del servidor —políticas RLS `as restrictive` sobre `auth.jwt()->>'aal'` y la misma comprobación en FastAPI—, y es una decisión entre repositorios que **no se toma aquí**.

## Límites del servidor (valores por defecto de `v2.197.0`)

| Límite | Valor | Variable |
|---|---|---|
| Desafíos y verificaciones | 15 por minuto y por IP, ráfaga de 30 (cada ruta por separado) | `GOTRUE_MFA_RATE_LIMIT_CHALLENGE_AND_VERIFY` |
| Caducidad del desafío | 300 s (mínimo) | `GOTRUE_MFA_CHALLENGE_EXPIRY_DURATION` |
| Caducidad de un factor sin verificar | 300 s (mínimo) | `GOTRUE_MFA_FACTOR_EXPIRY_DURATION` |
| Factores por usuario | 10 inscritos, 10 verificados | `GOTRUE_MFA_MAX_ENROLLED_FACTORS`, `…_MAX_VERIFIED_FACTORS` |
| TOTP | Inscripción y verificación activas | `GOTRUE_MFA_TOTP_ENROLL_ENABLED`, `…_VERIFY_ENABLED` |

Superar el límite de frecuencia devuelve 429 con `over_request_rate_limit`, que ya se traduce como «Demasiados intentos seguidos».

## Códigos de recuperación

La documentación pública se contradice y no hay una vía estable:

- La referencia de MFA de supabase-js dice textualmente que **no hay códigos de recuperación** y que la alternativa es inscribir más de un factor.
- El código de `v2.197.0` ya tiene las rutas (`GET/POST/DELETE /factors/recovery-codes`, `/verify`, `/regenerate`), pero su configuración las deja **desactivadas por defecto** (`GOTRUE_MFA_RECOVERY_CODES_ENROLL_ENABLED=false`, `…_VERIFY_ENABLED=false`). La especificación las documentó en `master` el 21 sep 2026, después de esa versión estable.
- supabase-js las ofrece como **experimentales**, detrás de `auth.experimental.recoveryCodes: true`.
- Según esa especificación, generar exige aal2 y otro factor verificado, devuelve los códigos una sola vez (10 de 16 caracteres por defecto), y el canje bloquea al usuario tras 5 fallos seguidos durante 15 minutos.

**Sin confirmar**: si el panel de Supabase alojado permite activarlas en el plan gratuito y qué versión de Auth ejecuta el proyecto del propietario. Activarlas sería un cambio de configuración en Supabase, que esta entrega no tiene autorizado.

Decisión técnica de esta capa: **no se implementan los códigos de recuperación**. La vía estable y documentada para no quedarse fuera es una segunda aplicación de autenticación inscrita como factor aparte; la capa de cliente lo permite porque admite varios factores con nombres distintos. La [propuesta de interfaz](auth-totp-ui-proposal-2026-10-29.md) presenta las dos opciones para que decida el propietario.

## Qué hace la capa de cliente

Implementado en `src/features/auth/mfaApi.ts`, `assurance.ts` y el proveedor de sesión; sin pantallas.

- `createMfaApi` con `listFactors`, `enrollTotp`, `challenge`, `verify`, `verifyCode` (desafío y verificación seguidos, como `challengeAndVerify` del SDK) y `unenroll`. Cada respuesta se valida con zod; una respuesta inesperada es `unknown`.
- Entradas validadas antes de enviar nada: el código se normaliza quitando espacios y debe tener seis cifras; el nombre del factor se recorta y tiene un máximo propio de 64 caracteres (el servidor no fija uno); los identificadores deben ser UUID, porque forman parte de la ruta.
- `readAssurance` lee `aal` y `amr` del JWT sin validarlo (solo para decidir qué mostrar; la autorización real la hace el servidor) y `assuranceStep` resume el estado: sin segundo factor, código pendiente o completado.
- El proveedor sustituye la sesión con la que devuelve la verificación, refresca tras quitar un factor para bajar a aal1 y **descarta un refresco que llegue después de que la sesión haya cambiado** (verificación, cierre de sesión u otro refresco), para que un token aal1 antiguo no pise uno aal2 nuevo ni reabra una sesión cerrada.
- El cliente de segundo factor usa zod, así que el proveedor lo descarga con la primera operación de segundo factor y nunca antes del primer pintado; si la descarga falla, se informa como error de red y se reintenta en la siguiente. `assurance.ts` no usa zod.
- Errores del servidor con mensaje propio en español e inglés.

## Límites de esta comprobación

- Sin proyecto Supabase real: ninguna respuesta se ha observado en la red. La forma de cada una procede del código y de la especificación citados.
- **Sin confirmar** la versión de Auth del proyecto alojado y si sus límites coinciden con los valores por defecto.
- **Sin confirmar** que la sesión de `/token` traiga `user.factors`; el cliente no depende de ello y lista los factores con `GET /user`.
- La imposición de aal2 en datos (RLS) y en la API (FastAPI) queda pendiente de decisión y fuera de este repositorio.
