# Laboratorio en Proyectos

Implementado localmente el 21 oct 2026 tras la [aprobación del contrato y formulario](laboratory-projects-proposal.md). La interfaz conserva A · Mesa de estructura. Guardar es explícito: un archivo portable sin cuenta o un Proyecto de la cuenta autenticada. Esta entrega no está publicada ni aplica SQL remoto.

## Uso y conservación

«Guardar en Proyecto» abre el formulario de nombre. Crea un proyecto nuevo cuando el laboratorio no tiene vínculo, aunque el editor de análisis tenga otro proyecto abierto. Cuando se abre desde «Abrir laboratorio» en la colección, guarda sobre esa versión con microsegundos. Ante conflicto conserva los borradores y ofrece recargar, con confirmación, o guardar copia. Renombrar conserva el documento completo; duplicar crea otra copia. Eliminar sigue el diálogo deliberado y la versión existentes.

Archivo descargado y proyecto son destinos explícitos. No hay guardado automático de secuencias en localStorage. Una importación válida sustituye el conjunto y desvincula su proyecto; un fallo o cancelación conserva datos y vínculo. La reapertura de nube comprueba el SHA del documento y vuelve a validar su fuente en Worker antes de sustituir el conjunto. La recarga no restaura el laboratorio automáticamente: se abre el archivo o el proyecto guardado desde la colección.

El acceso interno conserva el laboratorio en memoria. Antes de Google, la pantalla de acceso ofrece descargarlo y explica cómo reabrirlo al regresar. No se transmite una secuencia al proveedor de inferencia desde este formulario. La carga manual en Colab sigue siendo otro recorrido explícito.

## Contrato y límites

`Workspace.laboratory` es el campo protobuf 6; contiene `LaboratorySnapshot {schema_version=1, document_json, document_sha256}`. El JSON exacto UTF-8 tiene `kind: proteinforge-laboratory`, versión local 1, fuente y estado. La fuente referencia el ejemplo versionado o incorpora el ZIP original Base64 con SHA. El estado incluye variante/posición activas y todos los borradores/protecciones, sin historial de deshacer. La ciencia se revalida desde la fuente; el servidor no descomprime ZIP ni ejecuta modelos.

Documento de hasta **1.000.000 bytes UTF-8**, tres variantes y 120 residuos. Un archivo local mayor sigue descargándose, pero guardar en cuenta devuelve un error explícito. El cliente mide el mensaje protobuf completo, también al actualizar, antes de enviarlo; la lectura RPC permanece en 2.000.000 bytes. No se aumentó el límite global. API y SQL validan sobre/SHA/fuente/borradores/rangos; la API rechaza además duplicados JSON y formas no admitidas. Estos hashes no autentican la autoría científica de un experimento.

Con laboratorio, `Workspace.schemaVersion=2`; sin él se conserva 1. La API acepta proyectos anteriores. SQL bloquea el proyecto, comprueba timestamp y rechaza una actualización v1 sobre v2 antes de escribir nombre o snapshot; el cliente antiguo recibe conflicto. El cliente actual conserva el laboratorio al guardar desde análisis. La coherencia de secuencia activa se valida **dentro del laboratorio**: `activeSequence` del proyecto sigue siendo la entrada independiente del editor de análisis, que puede tener otros resultados. El laboratorio actualiza únicamente su sobre y conserva esos resultados al guardar sobre su proyecto.

Se usa el snapshot JSONB existente de `analyses` bajo su clave estable `workspace-v1`; no hay tablas nuevas, Storage ni ejecutor. RLS, JWT del propietario, SECURITY INVOKER y concurrencia se conservan. El listado solo añade `hasLaboratory` y `laboratoryVariants` (0 o 1–3), sin documento, ZIP ni coordenadas. Mantiene los destinos de análisis y alineamiento.

## Verificación y activación

Frontend: 326 unitarias en 61 archivos, cobertura 84,67 % statements /73,67 % branches /82,44 % functions /87,76 % lines, mínimos intactos. Tipos/lint/build correctos; PWA comprueba laboratorio, Worker, archivo, cuaderno offline byte por byte, fuentes/WASM y PDF. Chrome local: recorridos de Proyectos/laboratorio/acceso/perfil, matriz 360/1280 claro/oscuro con AA, foco/Escape y controles 44 px; conflicto/copia, borrador editado tras recarga, corrupción atómica y ZIP reales de Colab. Capturas `artifacts/laboratory-project-{360,1280}-{light,dark}.png`. No se certifican otros motores ni CI remoto.

Backend: 43 pruebas API y 12 SQL ejecutadas aparte en PostgreSQL 18 temporal localhost; aislamiento de dos propietarios/anónimo, creación/reapertura/rename/copia/borrado, guardia antigua sin escrituras parciales, tamaño/hash, idempotencia y concurrencia. REST y gRPC-Web binario conservan exactamente el sobre; Buf lint/breaking contra main correctos. Python local 3.13.14; objetivo de despliegue 3.14 no repetido. No equivale a JWT/PostgREST remoto.

Nueva migración: `backend/supabase/migrations/20261021000000_laboratory_projects.sql` del repositorio backend. Está preparada y probada localmente. Tras autorización específica futura: aplicar **solo esa migración**, publicar backend antes de frontend y comprobar sesión real/dos propietarios/dos pestañas. Las migraciones anteriores ya estaban aplicadas según el propietario; no repetir la inicial. `buf.gen.yaml` fija el commit backend local nuevo; para regenerar sin publicarlo usar `npx buf generate ../backend/proto`. El comando por remoto requiere que ese commit se publique primero.

Siguen pendientes la activación remota de este bloque, inferencia nueva desde la app, diseño de forma de novo y validación experimental. No se activaron recursos de pago ni se ejecutaron modelos en Windows.
