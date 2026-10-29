# Verificación en dos pasos — propuesta de interfaz

Preparada el **29 oct 2026**. **Pendiente de aprobación del propietario: no hay ninguna pantalla programada.** La capa de cliente sí está hecha y probada en `parallel/auth-totp`, sin interfaz; el contrato de Supabase en el que se apoya está en [auth-totp-contract.md](auth-totp-contract.md).

## Maqueta

`artifacts/auth-totp-2026-10-29/mockup.mjs` abre la aplicación real en el servidor de desarrollo local (puerto 5350, Supabase apuntando a un proyecto inexistente y todas sus peticiones respondidas en local) e inserta el marcado propuesto en Cuenta e Iniciar sesión. Usa **solo clases que ya existen** (`profile-row`, `setting-row`, `project-confirm`, `project-dialog`, `field`, `text-input`, `field-help`, `field-error`, `notice`, `status-message`, `numeric`, `auth-form`, `auth-actions`, `auth-footer`, `button-*`, `inline-link`, `link-danger`); no añade hojas de estilo, tokens ni atributos `style`. Por eso hereda la barra lateral, la tipografía, los temas y los anchos reales.

Capturas en `artifacts/auth-totp-2026-10-29/capturas/`: nueve pantallas a 1280 y 360 px, claro y oscuro, español e inglés (72 PNG). Nombre: `<pantalla>-<idioma>-<tema>-<ancho>.png`.

| Archivo | Pantalla |
|---|---|
| `01-cuenta-desactivada` | Cuenta, sin segundo factor |
| `02-cuenta-activar` | Cuenta, añadiendo la aplicación |
| `03-cuenta-activar-error` | El mismo paso con un código incorrecto |
| `04-cuenta-activada-respaldo` | Cuenta, activada; opción A (aplicación de respaldo) |
| `05-cuenta-codigos-recuperacion` | Cuenta, activada; opción B (códigos de recuperación) |
| `06-cuenta-quitar` | Confirmación para quitar la aplicación |
| `07-entrar-codigo` | Iniciar sesión, paso del código |
| `08-entrar-sin-telefono` | Entrar sin el teléfono; opción A |
| `09-entrar-codigo-recuperacion` | Entrar con un código de recuperación; opción B |

## Decisiones que se piden

1. **Aprobar las pantallas 01–04, 06, 07 y 08** (opción A). Es lo que la capa de cliente ya permite con la API estable de Supabase, sin cambiar nada en el proyecto remoto.
2. **Opción B, códigos de recuperación (05 y 09): recomiendo no hacerla ahora.** Supabase la ofrece como experimental, desactivada por defecto, y la documentación pública todavía dice que no existe. Exigiría activarla en la configuración de Auth del proyecto (operación remota que solo tú puedes autorizar) y comprobar antes que la versión del proyecto alojado la incluye. Si la quieres, dímelo y la preparo como cambio aparte.
3. **Imponer el segundo factor en los datos: decisión aparte, y necesaria para que esto proteja de verdad.** Iniciar sesión con la contraseña (o con Google) siempre da una sesión aal1. Si los datos solo exigen una sesión válida, alguien con tu contraseña puede leer tus proyectos llamando directamente a la API aunque la app le pida el código. Cerrarlo requiere una migración con políticas RLS restrictivas sobre `aal` y la misma comprobación en FastAPI: dos repositorios, migración remota y autorización tuya. Las pantallas no dependen de ello, pero sin ello la verificación en dos pasos solo protege la entrada desde la app.
4. **Recuperación por soporte (pantalla 08).** Quien pierda el teléfono y no tenga aplicación de respaldo escribe al correo de soporte que ya usa «Eliminar mi cuenta». Quitarle el factor es una acción manual tuya en el panel de Supabase (Authentication → Users → el usuario → quitar el factor), después de comprobar su identidad. ¿Aceptas ese procedimiento?

## Plan por pantallas

Todo vive en **Cuenta**, dentro de la sección «Cuenta» de `/profile`, debajo de Contraseña, como pide la regla de «Mesa clara»: identidad y sesión en Cuenta, nunca un control suelto. No se añade ruta, entrada en la barra lateral ni elemento en el sitio público. El paso del código vive en la pantalla de Iniciar sesión.

### 01 · Cuenta, desactivada

- Nueva fila «Verificación en dos pasos» con el estado en una frase y la acción «Activar», con la misma jerarquía que «Cambiar contraseña».
- Solo se muestra si el servicio de identidad está configurado; si Supabase responde que la inscripción está desactivada, la fila lo dice con `auth.errorSecondFactorUnavailable` y no ofrece la acción.

### 02 · Añadir la aplicación

- «Activar» crea el factor y despliega un recuadro (`project-confirm`) bajo la fila, sin cambiar de pantalla. La fila pasa a «Añadiendo una aplicación…».
- Contenido, en este orden: título, instrucción, imagen QR que devuelve Supabase, la clave para escribirla a mano en la tipografía de secuencia con «Copiar clave», nombre de la aplicación (por defecto «Mi teléfono») y el campo del código.
- El campo del código: `inputmode="numeric"`, `autocomplete="one-time-code"`, admite el espacio intermedio, se valida antes de enviar (`auth.errorTotpCodeRequired`, `auth.errorTotpCodeDigits`).
- Aviso permanente antes de confirmar: activar cierra las sesiones de otros dispositivos. Lo hace el servidor al verificar, así que hay que decirlo antes.
- «Activar verificación» confirma; «Cancelar» quita el factor sin verificar (no exige código) y cierra el recuadro. Si se abandona la página, Supabase lo borra solo a los cinco minutos.
- El nombre del factor se guarda en Supabase; si choca con otro, `auth.errorFactorNameTaken`.
- La imagen QR de Supabase es negro sobre blanco en ambos temas; es lo correcto para que la lean las cámaras y no se invierte en el tema oscuro. En la maqueta es una imagen ilustrativa.

### 03 · Código incorrecto

- El error va bajo el campo con `role="alert"` y `aria-invalid` (`auth.errorTotpRejected`); el recuadro sigue abierto y el foco vuelve al campo. Caducidad del desafío o cambio de red: `auth.errorTotpExpired`. Demasiados intentos: el mensaje existente `auth.errorRateLimited`.

### 04 · Activada (opción A)

- La fila pasa a «Activada» con un aviso de éxito en `status-message` que se anuncia una vez.
- Una fila por aplicación con su nombre, fecha y «Quitar» en color de peligro (`link-danger`, como «Eliminar mi cuenta»).
- Fila «Aplicación de respaldo» con «Añadir otra»: repite el paso 02 con otro nombre. Supabase admite hasta diez aplicaciones verificadas; al llegar, `auth.errorTooManyFactors`.

### 05 · Códigos de recuperación (opción B, solo si se aprueba)

- Tras activar la primera aplicación, se muestran una sola vez los diez códigos en la tipografía de secuencia, con «Descargar», «Copiar» y «Ya los guardé», que cierra el recuadro. La fila «Códigos de recuperación» muestra cuántos quedan sin usar y ofrece «Generar otros».

### 06 · Quitar una aplicación

- `<dialog class="project-dialog">` modal con el nombre de la aplicación y la consecuencia: si es la última, la cuenta vuelve a pedir solo la contraseña. Botón de peligro «Quitar» y «Cancelar»; Escape cancela y el foco vuelve a «Quitar» de la fila.
- Supabase solo deja quitar una aplicación verificada desde una sesión que ya confirmó un código, y en este diseño eso siempre es así porque el código se pide al entrar. Si aun así responde `insufficient_aal`, se muestra `auth.errorSecondFactorRequired` y se lleva al paso del código. Tras quitarla, el proveedor refresca la sesión para bajar a aal1 (ya implementado).

### 07 · Iniciar sesión: el código

- Después de la contraseña o de volver de Google, si la cuenta tiene una aplicación verificada y la sesión es aal1 (`assuranceStep === 'pending'`), la pantalla de Iniciar sesión cambia a «Confirma que eres tú» en el mismo marco y con el mismo contexto a la izquierda.
- Un solo campo, «Confirmar», «¿No tienes el teléfono?», y al pie «Usar otra aplicación» (solo si hay más de una; abre una lista de sus nombres) y «Cerrar sesión».
- Hasta confirmar el código, la app trata la sesión como pendiente: no abre el laboratorio con sesión, no muestra Proyectos ni llama a la API con ese token, y cualquier ruta que pida sesión lleva a este paso. Al confirmar, continúa al destino que se pidió, como hoy.
- Si Supabase rechaza la verificación con su hook de seguridad, cierra todas las sesiones; la pantalla vuelve a Iniciar sesión con `auth.errorTotpBlocked` (ya implementado en el proveedor).
- En la maqueta la cabecera pública aparece como si no hubiera sesión, porque la página real no deja verla con una; en la implementación muestra lo mismo que hoy durante el acceso.

### 08 · Entrar sin el teléfono (opción A)

- «Usar mi aplicación de respaldo» vuelve al paso 07 con la lista de aplicaciones. Debajo, el procedimiento de soporte de la decisión 4 y el enlace al correo de soporte ya configurado (`SUPPORT_EMAIL_URL`).

### 09 · Código de recuperación (opción B, solo si se aprueba)

- Campo que acepta el código con o sin guiones y avisa de que se gasta al usarlo.

## Implementación prevista tras la aprobación

- **Textos**: todos los visibles de la maqueta pasan a `src/i18n/es.ts` y `en.ts` en el mismo cambio; los mensajes de error ya están en los catálogos.
- **Código**: una sección `TwoStepSection` en `features/profile`, el paso del código en `features/auth` reutilizando `AuthFrame` y `TextField`, y el estado «pendiente de código» en el proveedor de sesión a partir de `assurance` y `listFactors`. Ningún valor nuevo en componentes: longitudes y límites salen de `features/auth/config.ts`.
- **Estilos**: ninguno nuevo. Si al programar algo no encaja con las clases existentes, se para y se consulta.
- **Pruebas**: unitarias de cada estado con la API simulada; la matriz de accesibilidad existente cubre Cuenta e Iniciar sesión a 360/1280, es/en y ambos temas. Sin recorridos E2E nuevos, según la decisión del 28 oct, salvo que aparezca un fallo real.
- **Sin publicar** y sin tocar la configuración de Supabase.

## Límites

- Nada se ha probado contra un proyecto Supabase real; el comportamiento descrito procede del código de Supabase Auth `v2.197.0` y de su especificación ([contrato](auth-totp-contract.md)).
- La imagen QR de la maqueta es ilustrativa; la real llega en cada inscripción.
- Las capturas son de la app en local con la maqueta insertada; no se revisó el foco con teclado sobre el marcado insertado, que se comprobará al programarlo.
