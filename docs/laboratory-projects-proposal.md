# Guardar el laboratorio en Proyectos · propuesta

Preparada el 21 oct 2026 después del [recorrido condicionado real](design-lab-constraints.md). Aprobada explícitamente por el propietario el 21 oct 2026: «Sí, implementar esta propuesta». Autoriza implementación y verificación locales de ambos repositorios; excluye publicación y migraciones remotas. Implementación local terminada; [contrato, comprobaciones y activación pendiente](laboratory-projects.md).

## Experiencia propuesta

Conservar A · Mesa de estructura. Junto a descargar archivo, añadir «Guardar en Proyecto». Abrir el formulario existente de nombre, con explicación de que conserva todas las variantes, resultados, borradores y posiciones protegidas. Cancelar/Escape devuelve foco; guardar crea un proyecto nuevo salvo que ese laboratorio se haya abierto desde un proyecto. En ese caso actualiza con su versión leída, y un conflicto ofrece recargar o guardar copia. El guardado local permanece independiente y sin cuenta.

Maqueta interactiva local: `C:/Users/josel/.codex/visualizations/2026/10/19/01a152b8-83cd-7033-bd5f-864e92b56b3f/lab/projects-save.html`. Reutiliza la composición A, fuentes, colores químicos y datos de los tres ensayos originales. Solo propone la acción y formulario; no envía datos ni crea proyectos. Español/inglés y temas existentes. No introduce otra dirección visual.

Sin sesión, usar la invitación de acceso ya existente. Mantener el laboratorio en memoria durante el acceso por rutas internas. Antes de una redirección externa como Google, ofrecer descargar el archivo y explicar su reapertura; no guardar secuencias silenciosamente en almacenamiento local. En Proyectos, mostrar acceso explícito «Abrir laboratorio», conservando los accesos de análisis/alineamiento cuando procedan. El listado lleva una marca y cantidad de variantes, nunca el ZIP o todas las coordenadas.

## Contrato recomendado

- Añadir un mensaje opcional `LaboratorySnapshot` a `Workspace` con un número protobuf nuevo, sin renumerar campos; documento JSON UTF-8 del formato local `proteinforge-laboratory` v1, SHA-256 del documento y versión del sobre. El documento conserva la fuente original, sus hashes y todos los borradores. La app vuelve a validarlo íntegramente en Worker al abrir.
- Usar `Workspace.schema_version = 2` cuando existe laboratorio; aceptar 1 para proyectos anteriores. Un cliente antiguo no debe poder guardar una versión 1 sobre un proyecto 2 y eliminar su laboratorio. El servidor lo rechaza expresamente, sin actualizaciones parciales. REST y gRPC-Web conservan equivalencia.
- Límite inicial propio: **1.000.000 bytes UTF-8** para el documento del laboratorio, hasta tres variantes y 120 residuos. Los casos reales actuales caben holgadamente; archivos locales mayores siguen descargándose, con error explícito al intentar guardarlos en nube. El límite de lectura RPC vigente es 2.000.000 bytes (`backend/app/rpc/router.py`); comprobar también el tamaño del mensaje completo y no aumentar ese límite silenciosamente.
- Validación de API: sobre, versión, tamaño en bytes, SHA, alfabeto/longitudes/rangos de borradores y coherencia de secuencia activa. Nunca ejecutar scripts, descomprimir modelos ni recalcular ciencia en FastAPI. El cliente valida el contenido científico antes de guardar y tras abrir; un hash interno no autentica al autor de un experimento.
- Guardar el sobre dentro del snapshot JSONB existente en `analyses`, asociado a su proyecto. No activar Storage, subir pesos ni crear un ejecutor de inferencia. Reusar creación/actualización transaccional, propietario y concurrencia por timestamp con microsegundos.
- Migración nueva e idempotente para ampliar validación/proyección SQL de snapshot y vista previa del laboratorio. Conservar RLS, grants y funciones de transacción; ninguna aplicación remota automática. La lista solo devuelve `has_laboratory` y cantidad acotada; su apertura obtiene el documento completo del propietario.

La vinculación de proyecto del laboratorio debe ser independiente de la del editor de análisis para no sobrescribir un trabajo al cambiar de herramienta. Importar otro archivo desvincula el proyecto solo después de validación correcta; fallo/cancelación conserva tanto datos como vinculación. Duplicar conserva una copia completa independiente. Renombrar no elimina el laboratorio; borrar sigue exigiendo confirmación y versión.

## Orden y comprobación

Tras aprobación: contratos/Pydantic/protobuf y mapeos, migración y transacciones/RLS locales, generación de clientes, estado/vinculación del laboratorio, formulario y destinos de colección, pruebas de compatibilidad. Probar crear/abrir/editar/renombrar/duplicar/borrar, conflictos y dos propietarios; rechazo de versión antigua, payload sobredimensionado y archivo corrupto sin perder el borrador. Verificar REST/gRPC-Web, Buf, PostgreSQL real local y recorrido con sesión simulada; después la matriz 360/1280, temas, teclado y AA.

Publicación, merge y aplicación de migraciones quedan fuera de esta aprobación local; requieren autorización específica posterior. No se ofrece nueva inferencia desde la web, almacenamiento ilimitado ni forma de novo.
