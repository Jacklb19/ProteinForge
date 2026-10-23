# Activación del laboratorio en Proyectos

Preparación local del 21 de octubre de 2026. Publicación y recorrido con cuentas reales **pendientes**, sin escrituras remotas realizadas en esta continuación. La migración `20261021000000_laboratory_projects.sql` ya fue aplicada según el propietario; no volver a ejecutarla ni repetir las anteriores. No se inspeccionó la base remota.

Actualización del 22 oct 2026: la entrega ya está publicada y el recorrido real se ejecutó en producción; el resultado de cada caso está en la columna «Estado real» de la tabla. Las secciones siguientes conservan la preparación original.

## Resultado preparado

Backend `dev`: `da25fee44d3dda9db0d0599c02f8a0cbd58491cf`. Incluye persistencia `5b6c4505c77293e1f4798e0bd86932e13c11600f` y documentación posterior. Frontend incluye laboratorio/Colab/persistencia `1e954ef` a `cdfb917` y corrección de apertura demorada `b971f0d7d86428339c7d519213f5a89a4b0a1f24`; consultar el HEAD de `dev` al autorizar para incluir este cierre documental.

El frontend sigue fijando el contrato backend **5b6c4505c77293e1f4798e0bd86932e13c11600f** en `buf.gen.yaml`. Los commits posteriores del backend solo cambian documentación y no necesitan regeneración de clientes. Mientras no se publique ese contrato, generar con `npx buf generate ../backend/proto` desde frontend. CI por remoto necesita que el commit ya exista allí.

Auditoría sin red: al iniciar, las referencias locales `origin/main` eran frontend `1b735fcc34f2dd1da0421c2fe7b82948c3f197da` y backend `333b3ea53943b9e6e80b8bc9cc350132cf42ba62`. Son referencias almacenadas, **no una comprobación actual de GitHub o Vercel**. No se hizo fetch ni se certifica una nueva versión de producción.

## Orden tras autorización

1. Confirmar el alcance: push de `dev` de ambos repositorios; para producción, autorizar además merge `dev` → `main` y push de `main`. Una autorización solo de `dev` no cubre producción. Revisar otra vez árboles, diferencias remotas y autor/committer Jacklb19, sin coautores ni trailers.
2. Publicar backend primero. Su contrato debe existir en remoto antes de iniciar CI frontend. Si se autoriza producción, esperar y verificar su despliegue antes de publicar el frontend de producción.
3. Comprobar health, Connect y gRPC-Web públicos/sin token, CORS/preflight desde el frontend y REST existente. No confundir esos casos con una sesión válida. Mantener CSP, secretos y configuración existentes.
4. Publicar frontend después; comprobar sus checks, despliegue, ruta `/generate/lab`, recursos del Worker/cuaderno y versión servida tras recarga de PWA. No declarar desplegado un commit solo por haberlo enviado a GitHub.
5. Ejecutar los casos siguientes únicamente con el alcance de datos de prueba autorizado. Registrar resultado, fecha, commit desplegado y límites. La migración aplicada no acredita que estos casos hayan pasado.

## Recorrido real preparado

Usar el ejemplo público de tres variantes de 1UBQ, sin inferencia nueva. Requiere dos cuentas propias confirmadas A/B, dos pestañas de A y autorización para crear/editar/renombrar/copiar/borrar **solo** proyectos de prueba identificados `PF Lab verificación 20261021`. Iniciar sesión mediante los formularios; no pedir ni guardar contraseñas/tokens en archivos o informes. El propietario puede realizar esas entradas directamente.

| Caso | Acción y resultado esperado | Estado real |
|---|---|---|
| Crear y recargar | A cambia un residuo, protege dos posiciones y guarda. Tras recarga, abre laboratorio desde Proyectos: mismas tres variantes, borradores, protecciones y selección; fuente revalidada en Worker | **Correcto** 22 oct. V1 E6K, protegidas 10 y 20, guardado nuevo. Tras recargar y «Abrir laboratorio»: tres variantes, V1 borrador 43/76, V2/V3 resultados, protegidas 10/20 y selección V1·A20. La revalidación en Worker no se observó aparte |
| Actualizar | A edita otra variante y guarda sobre la versión abierta. Reabrir conserva todas las variantes, no solo la activa | **Correcto** 22 oct. V2 I30V guardada sobre la versión abierta; al reabrir, V1 (K6, 10/20) y V2 (V30) en borrador, V3 intacta, selección V2·A30 |
| Análisis independiente | Guardar entradas/ventana/comparación en ese proyecto, abrir laboratorio y actualizarlo; reabrir análisis conserva sus entradas y resultados asociados | **Correcto** 22 oct, sin comparación. Análisis guardado con ventana 19; tras guardarlo el laboratorio seguía intacto; tras actualizar el laboratorio (V3 K2T) el análisis conservaba ventana 19, secuencia y 8.445,71 Da. No había comparación guardada en ese análisis |
| Renombrar y copiar | Renombrar no cambia el sobre del laboratorio. Duplicar crea otro ID con contenido equivalente, sin sustituir el borrador ni el vínculo activos | **Correcto** 22 oct. Renombrado sin cambios en el laboratorio. Copia «(copia)» con contenido equivalente; con un borrador sin guardar (V3 I3L) se conservaron borrador y vínculo al proyecto renombrado («Copia creada. Tu borrador sigue abierto») |
| Dos pestañas | Ambas abren la misma versión. Primera guarda; segunda edita e intenta guardar: `ABORTED`/409, conserva borrador. Guardar copia crea otro ID; recuperar versión pide confirmación | **Correcto** 22 oct. Segunda pestaña: aviso «Este proyecto cambió en otra pestaña» con referencia y borrador conservado; «Guardar una copia» creó otro proyecto con ese borrador; «Recuperar versión guardada» pidió confirmación y cargó la versión de la primera. Defecto de texto en la confirmación, corregido en local (89696dd) |
| Dos propietarios | B no ve proyectos de A. Lectura/actualización/borrado del ID de prueba de A con JWT de B devuelve `NOT_FOUND`/404 y no cambia la versión de A; anónimo recibe `UNAUTHENTICATED`/401 | **Correcto en parte** 22 oct. B (cuenta principal, en el Chrome del propietario) ve solo sus tres proyectos y la búsqueda «Prueba» devuelve 0. **Pendiente**: lectura/actualización/borrado por ID con la sesión de B (requiere autorización aparte) y anónimo 401 en este recorrido |
| Respuesta tardía | Demorar una lectura, editar antes de recibirla: recuperación automática no reemplaza el borrador; apertura manual avisa y conserva datos/vínculo. Reintento deliberado puede abrir | **No forzada en producción** por indicación del propietario; cubierta por pruebas automáticas locales |
| Borrado de prueba | Borrar únicamente la copia o proyecto de prueba elegido mediante confirmación. Desaparece del listado y no reaparece tras recargar; no borra el borrador local en memoria | **Correcto** 22 oct. Tres proyectos de prueba borrados con confirmación; listado vacío también tras recargar. No había laboratorio abierto, así que no se comprobó la conservación del borrador en memoria. Defecto: cada confirmación mostraba el aviso de éxito anterior, corregido en local (6334fc7) |

Ejecución real del 22 oct 2026 sobre producción frontend `main` d589480 y backend `main` 9d5528d, con el ejemplo público 1UBQ y sin inferencia nueva. El propietario inició sesión en cada cuenta; no se usaron contraseñas, tokens ni almacenamiento de sesión. Cuenta A: una cuenta secundaria del propietario sin proyectos; B: su cuenta principal, que no se modificó. Por indicación del propietario, los proyectos de prueba se nombraron «Prueba laboratorio A…» en vez de `PF Lab verificación 20261021`; los tres se borraron y no queda ninguno en A ni en B. Las comprobaciones de estado se leyeron de la interfaz (secuencias, protecciones, selección y tabla de variantes); no se descargó el JSON portable antes y después.

Comparar el JSON portable descargado antes/después y sus borradores, sin publicar secuencias privadas. Para dos propietarios comprobar identidad real y respuestas de Auth/PostgREST; los transportes simulados y `auth.uid` emulado no acreditan ese aislamiento.

## Evidencia local de esta continuación

- 337 unitarias en 61 archivos. Cobertura: 84,71 % statements, 73,82 % branches, 82,46 % functions y 87,80 % lines, sin cambiar mínimos.
- Tipos, lint, build y PWA. Precache de 25 recursos; laboratorio/Worker/edición/archivo, cuaderno byte por byte, fuentes, WASM y PDF comprobados offline. Permanecen avisos previos de Vite sobre su cargador futuro y tamaño de chunks.
- Chrome: 24 E2E afectadas completadas en dos subconjuntos sobre el mismo build, con cuentas/RPC simuladas y ambos ZIP reales ignorados. Incluye reapertura/corrupción atómica/conflicto/copia y nuevas respuestas demoradas. Matriz 360/1280, claro/oscuro, AA, foco/Escape y controles existentes. Capturas nuevas `artifacts/laboratory-race-{360,1280}-{light,dark}.png`, revisadas localmente.
- Backend solo cambia documentación en esta continuación; se conserva la evidencia anterior de 43 pruebas API y 12 PostgreSQL 18 locales. No se repiten ni se anuncian como verificaciones nuevas.

En el entorno Windows actual, Chrome y el servidor preview se ejecutaron fuera del aislamiento para permitir localhost; no se cambiaron flags de seguridad del navegador. Vitest usó `TEMP`/`TMP` dentro de `frontend/tmp/vitest`, ignorado, después de un fallo de lectura temporal del aislamiento. No se enviaron fuentes privadas a revisión externa.

Sigue pendiente nueva inferencia desde la app, forma de novo y evaluación experimental; no forman parte de esta activación. [Uso/contrato del laboratorio](laboratory-projects.md) · [persistencia backend](../../backend/docs/project-persistence.md).
