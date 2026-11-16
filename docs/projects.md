# Proyectos

Un proyecto es una instantánea versionada que la cuenta guarda de forma deliberada: entradas de Analizar, ventana y comparación de Comparar, búsquedas del generador y el laboratorio. Solo se guarda cuando la persona lo pide y el servidor responde; no se anuncian guardados sin respuesta.

El contrato del servidor está en la documentación del backend: [persistencia de proyectos](https://github.com/Jacklb19/Protein_Back/blob/main/docs/project-persistence.md) y [API](https://github.com/Jacklb19/Protein_Back/blob/main/docs/api.md). Las tablas `projects` y `analyses` usan funciones SQL `SECURITY INVOKER` y RLS; la API no usa `service_role`.

## Pantalla `/projects`

- Tarjetas: tres por fila en escritorio, dos en tabletas y una en móvil. Sin sesión, la ruta ofrece entrar o crear cuenta y conserva el retorno a Proyectos.
- Cada tarjeta muestra la evidencia disponible: prefijo de hasta 40 residuos (no una estructura), longitud, masa, pI y GRAVY guardados, procedencia exacta y fecha relativa con fecha absoluta accesible. Si hay comparación, muestra longitudes, prefijos y conteos convertidos a porcentajes, matriz y modo. Un resultado ausente no aparece como cero.
- Los proyectos mixtos ofrecen Analizar y Comparar; una comparación sin secuencia activa abre Comparar. Abrir reemplaza entradas, ventana y comparación tras confirmación y las propiedades se recalculan en un Worker.
- Máximos: 120 caracteres de nombre, 100.000 residuos en un análisis y 5.000 por entrada de comparación.
- Buscar por nombre (subcadena literal, sin distinguir mayúsculas) y ordenar por recientes o nombre operan sobre toda la colección en SQL, antes de paginar. El token de paginación es opaco y está ligado a consulta y orden; una búsqueda nueva reinicia la página. `query_applied` detecta un backend antiguo que ignora esos campos y evita presentar una respuesta sin filtrar como una búsqueda correcta.
- El menú de cada tarjeta permite renombrar, duplicar y eliminar. Los diálogos contienen el foco, Escape cancela y devuelve el foco al origen; al eliminar, el foco inicial es Cancelar. Renombrar verifica la versión antes del PUT. Duplicar crea otro proyecto sin sustituir el borrador, el proyecto activo ni el puntero. Tras una escritura confirmada se reinicia el listado para conservar orden y filtro; si falla solo esa recarga, se conserva el éxito de la escritura y se muestra el fallo de actualización.
- La API consulta únicamente proyecciones JSON concretas y prefijos; no descarga instantáneas completas por tarjeta.

## Persistencia y concurrencia

- El último ID abierto se guarda por propietario en `localStorage`; nunca secuencias ni resultados. Tras recargar se consulta la API con el JWT. Una sesión nueva con un borrador existente no lo reemplaza automáticamente. Cambiar de cuenta cancela las peticiones e ignora las respuestas anteriores.
- Guardar mientras se edita conserva los cambios recientes como pendientes.
- Un 409 no actualiza la versión local: la persona copia o recupera de forma explícita.
- Una creación de resultado incierto no se reintenta automáticamente salvo con `VITE_PROJECT_CREATE_IDEMPOTENCY` (ver [decisiones](decisiones.md)).
- La recuperación automática conserva las ediciones hechas mientras se carga la lista o el proyecto y respeta la ventana y los parámetros de comparación elegidos antes de iniciar sesión. Una apertura manual comprueba que no haya ediciones nuevas desde la acción; una respuesta tardía conserva el borrador, su versión y el puntero, y ofrece un aviso bilingüe para volver a abrir. Los resultados recalculados en segundo plano no cuentan como edición.
- Guardado sin conexión (RF-15): ver [decisiones](decisiones.md#guardado-sin-conexión-rf-15) y [pantallas](pantallas.md).
- Compartir y versiones: el cliente tiene diálogo para compartir un proyecto por enlace de solo lectura (`/shared`), historial de versiones con cambios entre ellas y una lista que se actualiza por el canal en vivo de la API cuando `VITE_PROJECT_LIVE` está activa. Los textos y límites están en `src/features/projects/` y `src/features/live/`.

## Laboratorio guardado en un proyecto

«Guardar en Proyecto» abre el formulario de nombre. Crea un proyecto nuevo cuando el laboratorio no tiene vínculo, aunque el editor de análisis tenga otro proyecto abierto. Cuando se abre desde «Abrir laboratorio» en la colección, guarda sobre esa versión. Ante un conflicto conserva los borradores y ofrece recargar, con confirmación, o guardar una copia. Renombrar conserva el documento completo y duplicar crea otra copia.

- Archivo descargado y proyecto son destinos explícitos; no hay guardado automático de secuencias en `localStorage`. Una importación válida sustituye el conjunto y desvincula su proyecto; un fallo o una cancelación conservan datos y vínculo. La recarga no restaura el laboratorio automáticamente: se abre el archivo o el proyecto guardado.
- La reapertura desde la cuenta comprueba el SHA-256 del documento y vuelve a validar su fuente en un Worker antes de sustituir el conjunto. Una apertura demorada conserva las ediciones hechas mientras esperaba: antes de iniciar la validación se comprueban el conjunto, los borradores y cualquier importación o exportación en curso, y si cambiaron se mantiene el laboratorio actual.
- Antes de iniciar sesión con Google, la pantalla de acceso ofrece descargar el laboratorio para reabrirlo al volver.

**Contrato.** `Workspace.laboratory` es el campo protobuf 6 y contiene `LaboratorySnapshot { schema_version = 1, document_json, document_sha256 }`. El JSON UTF-8 exacto tiene `kind: proteinforge-laboratory`, versión local 1, fuente y estado: la fuente referencia el ejemplo versionado o incorpora el ZIP original en Base64 con su SHA; el estado incluye variante y posición activas y todos los borradores y protecciones, sin historial de deshacer. La ciencia se revalida desde la fuente; el servidor no descomprime ZIP ni ejecuta modelos.

- El documento admite hasta **1.000.000 bytes UTF-8**, tres variantes y 120 residuos. Un archivo local mayor se descarga, pero guardarlo en la cuenta devuelve un error explícito. El cliente mide el mensaje protobuf completo antes de enviarlo, también al actualizar; la lectura RPC permanece en 2.000.000 bytes.
- API y SQL validan sobre, SHA, fuente, borradores y rangos; la API rechaza además claves JSON duplicadas y formas no admitidas. Los hashes comprueban integridad, no autentican la autoría científica de un experimento.
- Con laboratorio, `Workspace.schemaVersion = 2`; sin él se conserva 1, y la API acepta proyectos anteriores. SQL bloquea el proyecto, comprueba la marca de tiempo y rechaza una actualización v1 sobre v2 antes de escribir; el cliente antiguo recibe un conflicto. El historial del generador usa v3 y la predicción guardada v4.
- Se usa el JSONB existente de `analyses` bajo la clave `workspace-v1`; no hay tablas nuevas, Storage ni ejecutor. El listado solo añade `hasLaboratory` y `laboratoryVariants` (0 o 1–3), sin documento, ZIP ni coordenadas.
- `activeSequence` del proyecto sigue siendo la entrada independiente del editor de análisis; el laboratorio actualiza únicamente su sobre y conserva esos resultados al guardar sobre su proyecto.

## Regenerar los clientes

`buf.gen.yaml` toma el contrato del backend en un commit fijo. Tras cambiar un contrato se actualiza `ref` y se ejecuta `npx buf generate`; para trabajar con contratos del backend sin publicar, `npx buf generate ../backend/proto`. CI ejecuta lo mismo y falla si `src/gen/` difiere. El orden de despliegue de un cambio de contrato está en [despliegue](despliegue.md).

## Pruebas

Unitarias de instantánea vigente, desactualizada y validación; microsegundos, 204, 409 y esquema incompatible; reapertura; edición durante un guardado; cambio de cuenta y cancelación. E2E de CRUD, recarga, conflicto y restauración, y de 360 y 1280 px, claro y oscuro, teclado, objetivos de 44 px, AA y movimiento reducido, con Auth y API simuladas. En el backend, las pruebas SQL de RLS y concurrencia se ejecutan contra PostgreSQL en CI.
