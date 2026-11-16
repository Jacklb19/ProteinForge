# Decisiones técnicas

Registro resumido de las decisiones que dan forma a ProteinForge, con su motivo y su consecuencia. Los requisitos están en la [definición](definicion-proyecto.md); lo que hace cada pantalla, en [pantallas](pantallas.md).

## Arquitectura y proceso

| Decisión | Motivo y consecuencia |
|---|---|
| Dos repositorios: frontend React/Vite y backend FastAPI | Despliegues y ciclos independientes. El frontend se clona, prueba y construye sin el backend; el contrato entre ambos es `proto/`, que el frontend fija en `buf.gen.yaml` |
| Ramas `main` y `dev` | El desarrollo ocurre en `dev`; `main` contiene las versiones verificadas y es la fuente de producción en Vercel |
| Costo cero | Vercel y Supabase en plan gratuito; el cómputo estructural pesado se hace en Colab interactivo o en un equipo local, sin GPU permanente |
| Cálculo en el navegador | Descriptores, alineamiento, candidatos e informes corren en Workers; el backend coordina identidad, servicios externos y persistencia |
| Gotoh con BLOSUM45/62/80 y huecos afines | Núcleo en Rust/WASM con apertura 10, extensión 0,5 y extremos globales gratuitos; límite de 5.000 residuos |
| Paquete WASM versionado | `rust/alignment/pkg/` se genera sin edición manual, se construye en Linux como en CI y CI reconstruye y compara. El build de Vercel no necesita Rust |
| Alfabeto ampliado y antirrebote de 45 ms | U, O, B, Z y X se aceptan con aviso y un tratamiento definido en la especificación |
| BinaryCIF directo y Mol* bajo demanda | Mol* 5.13.1 fijo; se muestra el primer modelo y su unidad asimétrica. El motor (≈1,2 MB, ≈330 KB comprimido) entra en la precaché: cada versión guarda todos sus archivos de código, de modo que una pestaña abierta durante un despliegue sigue cargando el 3D. Sin service worker, la página recarga una vez si falta un archivo (`src/shell/staleCode.ts`), y `vercel.json` responde 404 a un recurso inexistente de `/assets/` en lugar de devolver el documento. Ver [referencias](references.md) |
| Catálogo de fragmentos y dominios | Tres secuencias completas más una pestaña «Dominios» de 48 piezas verificadas contra sus fuentes. El ensamblado se analiza, se descarga en FASTA o se guarda en Analizar como texto sin fuente, sin cambiar ningún contrato persistido. El catálogo se carga solo al abrir la pestaña |
| Configuración sin valores fijos | Opciones y límites en módulos `config` por característica, textos en i18n (español e inglés en el mismo cambio), estilos en tokens y fuentes en un manifiesto |
| UUIDv7 | Migración que sustituye el ayudante provisional por una función SQL con marca de tiempo y `gen_random_uuid`; `profiles.id` sigue siendo el de Auth |
| Concurrencia optimista | PUT/DELETE con la fecha completa de actualización, bloqueo SQL y respuesta 409. Las instantáneas son transaccionales, con funciones `SECURITY INVOKER` y RLS |
| Persistencia | Proyectos y laboratorio se guardan como instantáneas versionadas (workspace v1 a v4). Las secuencias no se guardan en el navegador |

## Cuentas

**Cuenta obligatoria.** ProteinForge no se usa sin cuenta. El sitio público contiene la portada informativa, la Guía, Privacidad, Términos y las páginas de acceso (entrar, registrarse, recuperar, confirmar). Analizar, Comparar, Diseñar, Biblioteca, Laboratorio, Proyectos y Perfil exigen sesión: sin ella llevan a «Iniciar sesión», que dice adónde volverá y vuelve allí al entrar.

- La página pedida viaja en el estado de la ruta, nunca en la URL. La vuelta solo admite rutas propias (rechaza `//`, `/\` y las páginas de acceso) y cruza el retorno de Google guardando únicamente la ruta en `sessionStorage`.
- La confirmación del correo admite el enlace o un código de 6 cifras en `/confirm` (`POST /auth/v1/verify` de tipo `email`, reenvío con `POST /auth/v1/resend` de tipo `signup` y espera de 60 s). Para que el correo traiga el código, la plantilla «Confirm signup» de Supabase debe incluir `{{ .Token }}`.
- Turnstile se descartó; la confirmación usa SMTP propio.
- Auth habla con la API REST de Supabase Auth sin SDK. La sesión vive en `localStorage` con refresco previo a la caducidad. Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; sin ellos las pantallas lo dicen.
- El segundo factor TOTP está descrito en [su contrato](auth-totp-contract.md). No hay códigos de recuperación (son experimentales y están desactivados en Supabase). Exigir aal2 en RLS y en la API es una decisión entre repositorios.

**Preferencias.** Idioma (ES / EN) y tema (botón luna/sol) están a la vista en la cabecera pública y su menú de teléfono. La cuenta es un enlace a `/profile` sin menú; «Sistema», el idioma y «Cerrar sesión» están en el perfil. Ver [diseño visual](diseno-visual.md).

## Guardado sin conexión (RF-15)

Los guardados de Analizar, Comparar, el laboratorio y las búsquedas del generador que no pueden enviarse (`network`, `timeout`, `unavailable`, `rate-limit`) quedan en una cola **solo en la memoria de la pestaña** (`src/features/projects/syncQueue.ts`), con una entrada por proyecto.

- Se envían uno a uno al volver la red, al volver la pestaña visible o tras cualquier respuesta correcta, con esperas de 2 s, 8 s y 30 s; después aparece «No se pudo guardar» con Reintentar y Descartar (`SYNC_*` en `src/features/projects/config.ts`).
- Conflicto: se lee la versión de la cuenta y se elige en la fila (conservar las dos, la mía o la de la cuenta). Si la versión de la cuenta coincide con lo enviado, la respuesta se había perdido y cuenta como guardado.
- Privacidad no cambia: no se guardan secuencias en el navegador. Cerrar o recargar con algo pendiente usa el aviso propio del navegador.
- `AuthProvider` conserva la sesión ante un error de red en la renovación y la repite al volver la red, al volver la pestaña o tras 5 s, 15 s y 60 s (`SESSION_RETRY_DELAYS_MS`). Solo un rechazo explícito (HTTP 400/401, `invalid_grant` o códigos de sesión inexistente, `SESSION_REJECTED_*`) cierra la sesión; nunca un 5xx, un 429, una página de pasarela ni un cuerpo cortado.
- Lo pendiente de una sesión terminada solo se envía con la misma cuenta. Cerrar sesión con cambios pendientes pide confirmación y los descarta.

**Reintento de `CreateProject`.** El cliente manda un `request_id` y repite por su cuenta una creación de resultado incierto con `VITE_PROJECT_CREATE_IDEMPOTENCY=enabled`, que queda vacía por omisión hasta que el backend lleva el `request_id` y la migración `20261102000000_project_create_idempotency.sql`. Sin la bandera, un proyecto nuevo guardado sin red conocida se envía una vez al volver; si su primer intento pudo llegar, queda como «No se pudo guardar» y solo la persona lo reintenta. Las actualizaciones siempre se reintentan, porque `expected_update_time` impide escribir dos veces. Con la bandera activa contra una base sin la migración, la API responde `projects.schema` y la creación queda como «No se pudo guardar» sin reintentos automáticos.

## Historial del generador en Proyectos

Workspace v3 con el historial dentro de la instantánea: texto exportado exacto más SHA-256, hasta 10 búsquedas, 100.000/10.000 bytes, guardia monótona, `project-requires-current-client`, `appBuild` y reproducción bajo demanda. La interfaz está oculta salvo `VITE_GENERATOR_HISTORY=enabled`, que es una variable de build. Contrato en la [documentación del backend](https://github.com/Jacklb19/Protein_Back/blob/main/docs/generator-history.md).

## Diseño y predicción (RF-18)

- El cuaderno de Colab es la vía de respaldo documentada del [laboratorio de diseño](laboratorio-diseno.md).
- La predicción desde el laboratorio usa el servidor público de ESM Atlas a través de la API, con consentimiento por solicitud, métricas ausentes explícitas y límites conservadores, detrás de `VITE_STRUCTURE_PREDICTION`. Ver [predicción](prediccion.md).
- La forma de novo queda fuera del alcance de la asignatura, porque depende de un ejecutor con GPU que no encaja en un plan gratuito.
- Consentimiento, validación y procedencia son obligatorios en cualquier integración de predicción.

## Rendimiento

Las decisiones y las mediciones están en [calidad y rendimiento](calidad-y-rendimiento.md). Resumen:

- Se adopta el subconjunto de IBM Plex Mono con procedencia (−34.540 bytes por carga en frío).
- Zod sale del camino de arranque: los esquemas pasan a archivos propios y `storedSession`, escrita a mano y con paridad probada, cubre el único punto que corre antes del primer render.
- `BackboneView` pinta una vez al montarse en lugar de tres.
- Se descartan la separación de código por rutas (empeoró el LCP de Inicio y Analizar), la memorización de `HydropathyProfile` (sin efecto medible), `content-visibility` en secciones públicas (riesgo de recortar anillos de foco) y el INP de campo (exige telemetría con consentimiento).
- El giro de la portada se limita a 30 fotogramas por segundo (`IDLE_FRAMES_PER_SECOND` e `IDLE_FRAME_TOLERANCE_MS` en `src/features/structure/config.ts`); el ángulo avanza en cada fotograma a la misma velocidad y solo se repinta cuando han pasado 1000/30 − 4 ms.

## Alcance de la verificación

Se mantienen tipos, lint, pruebas unitarias con cobertura, build, `check:pwa` en Chromium y la batería E2E completa con un trabajador, además de la matriz de accesibilidad a 360 y 1280 px, en es/en y en ambos temas. Safari en dispositivo real, lectores de pantalla e INP de campo son límites conocidos, no tareas pendientes. No se añaden recorridos E2E salvo como regresión de un fallo real.

## Interfaz

- **Mesa clara.** Navegación lateral, resumen y vistas de análisis, variantes accesibles, detalles científicos progresivos y marca, fuentes y color químico conservados. Ver [diseño visual](diseno-visual.md).
- **Sitio público y laboratorio separados.** Dos marcos por familia de rutas, con proveedores de borradores por encima; `/` es presentación aunque haya sesión. La barra lateral es agrupada y plegable (solo su ancho se guarda en `localStorage`) y se convierte en menú modal en pantallas estrechas. La presentación no inicia cálculos al llegar: cada figura carga su Worker al acercarse a la pantalla y Diseñar no ejecuta búsquedas.
- **Asistente.** Interpreta datos ya calculados; no calcula ni genera secuencias. Groq con `openai/gpt-oss-120b`; el cliente no tiene ningún campo para enviar la secuencia. Ver [asistente](assistant.md).
- **Carga de pantallas.** Cada pantalla distinta de la presentación, Analizar y Alinear llega en su propio archivo; si no llega (sin conexión o tras reemplazar la versión desplegada), la pantalla lo dice y ofrece recargar en lugar de quedarse en blanco.
