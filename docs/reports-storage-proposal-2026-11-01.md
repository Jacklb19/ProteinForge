# Propuesta: guardar informes en Supabase Storage (RF-14) — 1 nov 2026

Estado: contrato propuesto e implementado **solo en local** en `backend/dev` (migración, REST, Connect/gRPC, pruebas). Sin interfaz, sin migración remota, sin publicación ni cambios en Supabase o Vercel. El control «guardar informe» necesita maquetas PNG y aprobación del propietario antes de escribir código de UI.

## Punto de partida

RF-14 está parcial. El Worker de [informes](reports.md) genera PDF, JSON, CSV de perfil y CSV de alineamiento, pero solo se descargan: nada se sube por URL firmada ni la API registra informes. La [definición](definicion-proyecto.md) prevé «PDF se genera en cliente, se sube mediante URL firmada y la API registra el informe». Esta propuesta concreta ese contrato sin mover la generación fuera del navegador.

## Decisiones

1. **El servidor nunca recibe los bytes.** La API reserva un registro y firma una URL; el navegador sube directamente a Storage. Así no se atraviesa el límite de 4,5 MB por petición de las funciones de Vercel ni se gasta CPU de la función.
2. **Bucket privado `reports`, una carpeta por propietario.** Ruta `{owner_id}/{report_id}.{pdf|json|csv}`, calculada por PostgreSQL; el cliente no elige rutas.
3. **RLS en ambos lados con el JWT del usuario.** PostgREST y Storage reciben el token del usuario (como proyectos), nunca la clave de servicio. `public.reports` y `storage.objects` aplican la propiedad.
4. **Reserva → subida → confirmación.** Un registro nace `pending`; pasa a `ready` solo si Storage tiene un objeto con el tamaño y el tipo reservados.
5. **Límites en un único módulo y repetidos en SQL.** `backend/app/report_config.py` es la fuente; la migración repite los valores para que también valgan ante llamadas directas a PostgREST/Storage, y una prueba comprueba que coinciden.
6. **Hash declarado, no certificado.** El navegador calcula el SHA-256 de los bytes exactos; Storage verifica tamaño y tipo. El hash sirve para comprobar la descarga en el navegador, igual que los hashes actuales del informe «identifican contenido; no certifican la fuente».
7. **Borrar un proyecto no borra sus informes**: quedan sin vínculo (`project_id` nulo), porque SQL no puede eliminar objetos de Storage (la documentación de Supabase pide tratar sus tablas como de solo lectura y borrar por la API).

## Esquema

### Bucket

| Propiedad | Valor | Origen |
|---|---|---|
| `id`/`name` | `reports` | `REPORT_BUCKET` |
| `public` | `false` | privado; descarga solo con URL firmada |
| `file_size_limit` | 5.000.000 bytes | `MAX_REPORT_BYTES` |
| `allowed_mime_types` | `application/pdf`, `application/json`, `text/csv` | `REPORT_KINDS` |

### Tabla `public.reports`

| Columna | Tipo y regla |
|---|---|
| `id` | uuid v7, fijado por disparador |
| `owner_id` | uuid → `profiles`, `on delete cascade`; siempre `auth.uid()`, nunca lo envía el cliente |
| `project_id` | uuid opcional → `projects`, `on delete set null`; debe ser del mismo propietario |
| `kind` | `pdf`, `json`, `profile-csv`, `alignment-csv` |
| `size_bytes` | 1–5.000.000 |
| `sha256` | 64 hexadecimales en minúscula |
| `object_path` | único, calculado; no sale en las respuestas |
| `status` | `pending` o `ready` |
| `created_at`, `completed_at` | `completed_at` existe si y solo si `ready` |

Disparadores `SECURITY INVOKER`: el de inserción fija las columnas del servidor, valida entradas y proyecto y aplica la cuota con un bloqueo consultivo por propietario (dos reservas simultáneas no pueden superar la cuota). El de actualización impide cambiar cualquier campo salvo el paso `pending → ready`, que exige el objeto en Storage, y la desvinculación al borrar un proyecto.

### Políticas

- `public.reports`: select/insert/update/delete solo del propietario; el insert comprueba además el proyecto. `anon` sin permisos.
- `storage.objects` (bucket `reports`): leer y borrar solo en la carpeta propia; **crear** solo en la ruta de una reserva propia `pending` de menos de dos horas. Sin política de update, de modo que no hay sobrescritura.

Permisos que pide Supabase por operación (referencia oficial): URL firmada de subida necesita `insert` en `objects`; URL firmada de descarga, `select`; borrar, `delete` y `select`.

### Cuotas por propietario

| Límite | Valor | Motivo |
|---|---|---|
| Tamaño por archivo | 5.000.000 bytes | muy por debajo de los 50 MB del plan Free; los informes mayores siguen siendo descarga local |
| Informes por propietario | 20 | incluye reservas pendientes |
| Bytes por propietario | 25.000.000 | 40 propietarios en el límite llenan 1 GB de Storage Free |
| Ventana de subida | 7.200 s | la URL firmada de subida de Supabase dura dos horas y no se puede acortar |
| URL de descarga | 300 s | `DOWNLOAD_URL_SECONDS` |

Una reserva caducada sin objeto se libera en la siguiente reserva del mismo propietario. Si el objeto llegó a subirse, la reserva sigue contando hasta completarla o borrarla, porque solo la API de Storage puede eliminar el objeto. El CSV de perfil repite el SHA-256 de la secuencia en cada fila y crece linealmente; secuencias muy largas pueden superar 5 MB. Conviene medir los tamaños reales por formato antes de cerrar la interfaz (no medido aquí).

## Flujo y contrato de la API

REST bajo `/v1/reports` y `proteinforge.report.v1.ReportService` (Connect, gRPC-Web y gRPC), mismas funciones de dominio, contrato en `backend/proto/proteinforge/report/v1/report_service.proto`, generado con buf 1.73.0.

| Paso | REST | RPC | Qué hace |
|---|---|---|---|
| 1 | `POST /v1/reports` → 201 | `CreateReportUpload` | Recibe `projectId?`, `kind`, `sizeBytes`, `sha256`. SQL reserva y calcula la ruta; Storage firma la subida con el JWT del usuario. Devuelve el registro, `uploadUrl` absoluta, `contentType` exacto y `expiresAt`. Si la firma falla, borra la reserva |
| 2 | — | — | El navegador hace `PUT` del Blob a `uploadUrl` con ese `contentType` (equivale a `uploadToSignedUrl` de supabase-js) |
| 3 | `POST /v1/reports/{id}/complete` | `CompleteReport` | Pasa a `ready` si Storage tiene el objeto con tamaño y tipo reservados; idempotente |
| — | `GET /v1/reports?limit&offset&projectId` | `ListReports` | Propios, más recientes primero, pendientes incluidos; página 1–50 (20 por defecto); el token RPC queda ligado al filtro |
| — | `POST /v1/reports/{id}/download` | `CreateReportDownload` | Solo `ready`: URL firmada de 300 s con `download=<nombre>`; el navegador verifica el SHA-256 al recibir |
| — | `DELETE /v1/reports/{id}` → 204 | `DeleteReport` | Borra primero el objeto en Storage y después el registro; un reintento tras fallo parcial termina |

Errores estables (REST `type` / RPC):

| Código | REST | RPC |
|---|---|---|
| `validation` | 422 | `INVALID_ARGUMENT` |
| `report-not-found`, `project-not-found` | 404 | `NOT_FOUND` |
| `report-quota-exceeded` | 413 | `RESOURCE_EXHAUSTED` |
| `report-upload-missing`, `report-not-ready` | 409 | `FAILED_PRECONDITION` |
| `report-object-missing` | 404 | `NOT_FOUND` |
| `report-forbidden` | 403 | `PERMISSION_DENIED` |
| `reports-schema-unavailable`, `reports-storage-unavailable` | 503 | `FAILED_PRECONDITION` |
| `reports-storage-error`, `reports-provider-error`, `reports-invalid-response` | 502 | `UNAVAILABLE` |
| `reports-timeout`, `reports-storage-timeout` | 504 | `DEADLINE_EXCEEDED` |

Ningún mensaje reproduce rutas, hashes ni textos del proveedor. La API rechaza además una ruta de objeto que no esté en la carpeta del llamante.

## Cuotas gratuitas comprobadas (1 nov 2026)

| Servicio | Límite oficial | Fuente |
|---|---|---|
| Supabase Free | 1 GB de almacenamiento de archivos, 5 GB de egress más 5 GB de egress en caché, 500 MB de base de datos, 50.000 MAU, pausa tras una semana sin actividad, 2 proyectos activos | [Precios de Supabase](https://supabase.com/pricing) |
| Supabase Storage | Tamaño máximo por archivo en Free: 50 MB; el límite por bucket no puede superar el global | [Límites de archivos](https://supabase.com/docs/guides/storage/uploads/file-limits) |
| URL firmada de subida | Válida dos horas; permiso `insert` en `objects` | [createSignedUploadUrl (JS)](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [permisos (Kotlin)](https://supabase.com/docs/reference/kotlin/v1/storage-from-createsigneduploadurl) |
| URL firmada de descarga y borrado | `select`; `delete` y `select` | [createSignedUrl](https://supabase.com/docs/reference/kotlin/v1/storage-from-createsignedurl), [remove](https://supabase.com/docs/reference/kotlin/v1/storage-from-remove) |
| Esquema de Storage | Tablas de solo lectura para SQL; borrar metadatos no borra el objeto y se sigue facturando | [Diseño del esquema](https://supabase.com/docs/guides/storage/schema/design) |
| Control de acceso | Subir requiere `insert`; sobrescribir además `select` y `update`; la clave de servicio salta RLS | [Access control](https://supabase.com/docs/guides/storage/security/access-control) |
| Vercel Functions | Cuerpo de petición o respuesta máximo de 4,5 MB; Hobby hasta 300 s | [Límites de funciones](https://vercel.com/docs/functions/limitations) |

La comprobación de tamaño y tipo lee las claves `size` y `mimetype` de `storage.objects.metadata`. La documentación oficial no las detalla; constan en el tipo `ObjectMetadata` del [código de Supabase Storage](https://github.com/supabase/storage/blob/master/src/storage/backend/adapter.ts). Si cambiaran, la confirmación fallaría de forma explícita (`report-upload-missing`), sin marcar como listo un informe inexistente. Los límites pueden cambiar; se registran como consulta fechada, no como garantía.

## Qué datos salen del navegador

- **A Supabase Storage, directamente:** el archivo completo. El PDF y el JSON incluyen la secuencia exacta, el nombre del proyecto, la procedencia conocida, descriptores, perfil, propensiones y, si hay comparación vigente, las dos secuencias alineadas. Los CSV incluyen residuos por posición o columnas del alineamiento.
- **A la API y de ella a PostgREST:** tipo, tamaño, SHA-256, identificador de proyecto opcional y el JWT. La API no recibe ni registra el contenido; los registros no guardan la secuencia.
- **Nada a terceros:** ni Groq ni ESM Atlas participan. El token del usuario solo viaja a Supabase.
- Hoy el informe nunca sale del dispositivo; con esta función sale solo tras una acción explícita de guardar y con sesión. La interfaz debe decirlo antes del primer guardado, en español y en inglés.
- Borrar la cuenta en Supabase elimina los registros por cascada, pero no los objetos de Storage: el flujo de eliminación de cuenta (hoy por correo) debe borrar la carpeta del propietario por la API. Pendiente.

## Pantallas que tocaría (sin implementar)

| Pantalla | Cambio previsto | Estados que la maqueta debe resolver |
|---|---|---|
| Analizar (`/analyze`), menú Exportar | «Guardar en mi cuenta» junto a PDF/JSON/CSV, con destino (proyecto abierto o sin proyecto) | sin sesión, subiendo con progreso y cancelación, cuota agotada, archivo demasiado grande, error de red, guardado |
| Alinear (`/alignment`), menú Exportar | Igual que Analizar para PDF/JSON/CSV de alineamiento | además: sin comparación vigente |
| Proyectos (`/projects`) | Recuento de informes guardados por proyecto y acceso a la lista | proyecto sin informes; informes sin proyecto |
| Lista de informes guardados (vista nueva o panel en Proyectos) | Descargar con verificación SHA-256 y quitar con confirmación; pendientes con opción de quitar | pendiente, listo, hash no coincide, objeto ausente |
| Cuenta y preferencias (`/profile`) | Uso de la cuota (n de 20, bytes de 25 MB) y aviso de privacidad | cuota casi llena |

Textos nuevos en `src/i18n/es.ts` y `src/i18n/en.ts` en el mismo cambio. Producción no debe ofrecer el control hasta aplicar la migración y publicar el backend.

## Implementación local y verificación

Backend `dev`:

- Migración `supabase/migrations/20261101000000_report_storage.sql` (idempotente). **No aplicada en Supabase.**
- `app/report_config.py`, `app/reports.py`, servicio RPC en `app/rpc/services.py`, conversión, errores y código generado en `app/rpc/gen/proteinforge/report/`.
- `tests/postgres_bootstrap.sql` emula el mínimo del esquema `storage` (buckets, objects, `storage.foldername`) para el PostgreSQL desechable; no emula la API de Storage.
- `tests/test_reports.py`: 13 pruebas con Auth, PostgREST y Storage simulados: identidad previa, propiedad sin `ownerId`, validación sin tocar datos, liberación de reserva si falla la firma, ruta fuera de carpeta, códigos estables sin texto del proveedor, paginación, descarga solo `ready`, borrado en orden, fallos de red y RPC equivalente. Incluye la coincidencia entre configuración y SQL.
- `tests/test_postgres.py`: 4 pruebas nuevas en PostgreSQL 18 real con `auth.uid()` emulado: aislamiento entre propietarios en tabla y objetos, columnas no falsificables e inmutables, proyecto ajeno, desvinculación al borrar proyecto, límites, cuota por número y bytes, concurrencia con un ganador, caducidad de reservas e idempotencia de la migración.

Resultados del 1 nov 2026: `scripts/test-postgres.ps1` 23 pruebas SQL correctas; batería completa 183 ejecutadas, 23 SQL omitidas sin base; `ruff check` limpio; `buf lint` limpio y `buf generate` sin diferencias; cobertura total 92 % (`app/reports.py` 96 %).

No comprobado: Storage real (firmas, subida `PUT`, `allowed_mime_types` con parámetros como `charset`, metadatos reales), JWT real, PostgREST real y CI remoto.

## Para activar (requiere autorización)

1. Aprobación del propietario de maquetas y plan por pantallas.
2. Aplicar la migración en Supabase (el bucket se crea con ella) y publicar el backend.
3. Repin y regeneración del cliente en el frontend, cliente de subida en Worker o hilo principal sin bloquear, y la interfaz aprobada.
4. Recorrido real con dos cuentas: subir, completar, listar, descargar con verificación, borrar e intento cruzado por ID.
