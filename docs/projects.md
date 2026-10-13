# Proyectos personales

12 oct 2026: recorrido implementado localmente en ambos repositorios, pendiente de activar migraciones/publicación remotas. No se anuncian guardados sin respuesta del servidor.

Perfil lista proyectos propios con actualización/paginación, apertura, renombrado y eliminación confirmada. Analizar y Alinear tienen guardado explícito por nombre, actualización, copia, desvinculación y recuperación confirmada. Abrir reemplaza entradas/ventana/comparación y las propiedades se recalculan en Worker. Solo resultados asociados a entradas/parámetros vigentes salen del navegador; resultados pendientes/desactualizados se omiten. Máximos de persistencia: 120 caracteres de nombre, 100.000 residuos en análisis y 5.000 por entrada de comparación.

El último ID se guarda por propietario en localStorage; no se almacenan allí secuencias ni resultados. Tras recargar se consulta la API con JWT. Una sesión nueva con borrador existente no lo reemplaza automáticamente. Cambiar de cuenta cancela peticiones e ignora respuestas anteriores. Guardar mientras se edita conserva los cambios recientes como pendientes. 409 no actualiza la versión local: copiar o recuperar explícitamente. Antes de reintentar una creación tras timeout, actualizar lista, porque el servidor pudo recibirla. No hay sincronización offline ni guardado automático.

Contrato backend: docs/project-persistence.md y docs/api.md. projects/analyses existentes y RPC SECURITY INVOKER; sin service_role. Ambas migraciones preparadas, no aplicadas remotamente. Backend verificado en PostgreSQL 18 temporal con RLS/concurrencia reales y en Python 3.13 con API simulada; JWT/PostgREST/Supabase de una sesión válida y runtime 3.14 no certificados.

Pruebas de cliente: snapshot vigente/desactualizado/validación, microsegundos/204/409/esquema incompatible, reapertura, edición durante guardado, cambio de cuenta y cancelación. E2E de CRUD/recarga/conflicto/restauración y 360/1280, claro/oscuro, teclado, 44 px, AA y movimiento reducido con Auth/API simuladas. No demuestra una sesión o base remota. La prueba móvil detectó y corrigió el chip de cuenta inferior a 44 px.

Privacidad y condiciones describen el guardado deliberado y su disponibilidad condicionada. Siguiente paso externo: revisar/aplicar migraciones por el usuario, publicar commits y comprobar dos cuentas propias antes de considerar persistencia productiva terminada.
