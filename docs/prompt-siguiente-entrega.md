# Relevo de desarrollo — ProteinForge

Actualizado el **22 de octubre de 2026**, después de publicar el laboratorio y comprobar una alineación real del propietario. Sustituye el relevo anterior, conservado en Git. Las instrucciones actuales del propietario y los AGENTS.md aplicables prevalecen; este contexto no amplía autorizaciones remotas.

---

Continúa el desarrollo desde el estado existente. Implementa y verifica el siguiente bloque local autorizado con requisitos definidos; no te quedes solo en un plan, no rehagas lo terminado y no detengas todo por un pendiente externo.

## Workspace y lectura

Ruta: C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge. Raíz sin Git; frontend/ y backend/ tienen repositorios independientes. Trabaja en dev de cada uno, conserva cambios del propietario, no muevas .git ni añadas repositorios anidados.

Lee completo este archivo, AGENTS.md de raíz y de ambos repositorios, las últimas entradas de **docs/PROGRESS.md de ambos** y revisa rama/status/log. Después:

- Frontend: docs/definicion-proyecto.md, docs/plan-desarrollo.md, docs/laboratory.md, docs/laboratory-projects.md, docs/design-lab-constraints.md y docs/design-lab-roadmap.md. Para interfaz: docs/pantallas.md y docs/diseno-visual.md.
- Backend: docs/api.md, docs/project-persistence.md y docs/arquitectura.md.

Algunos documentos conservan párrafos históricos «local», «sin publicar» o «migración pendiente». El progreso más reciente y este relevo corrigen esos estados; no reabras entregas completadas por leer una captura antigua.

## Reglas vigentes

Responde en español; código/comentarios/commits en inglés. Autor y committer exclusivamente **Jacklb19 <jose.burbanob@campusucc.edu.co>**, sin coautores, firmas ni menciones a agentes/IA en commits, merges o GitHub. Commits locales pequeños y revisados; comprueba identidades/trailers antes de publicar.

La publicación anterior fue expresamente autorizada y completada. No pedir otra vez publicar esos mismos commits ni extender el permiso a futuras entregas. Nuevos push/merge/despliegues, SQL remoto, servicios o gastos necesitan el alcance correspondiente; prepara primero el resultado local revisable.

No versiones AGENTS.md, docs/PROGRESS.md, secretos, .env, temporales, artefactos, ZIP/PDB descargados ni modelos. No fuerces excluidos; conserva la historia local de progreso. Costo cero, sin tarjeta. No instales ni ejecutes Torch, ProteinMPNN, ESMFold u otros modelos en Windows; las inferencias comprobadas fueron en Colab T4.

Interfaz bilingüe: español e inglés juntos en src/i18n/es.ts y en.ts, interpolación {{count}}. Conserva tokens, AA, foco/teclado, 44 px y matriz 360/1280 claro/oscuro. A · Mesa de estructura, Proyectos y formulario de guardado ya aprobados: no pedir elegirlos de nuevo. Una interfaz sustancialmente nueva necesita propuesta/maqueta y elección conforme a AGENTS.md. No enviar código privado a revisiones externas sin autorización.

## Git, publicación y CI

Estado antes del posible commit documental de este relevo:

| Repositorio | dev | main publicado |
|---|---|---|
| Frontend | 6498a73dc6316cfd7b23a388bda40a14a8b395fb | cc8990d81b9d119d013de9d22b8e2614753078c8 |
| Backend | da25fee44d3dda9db0d0599c02f8a0cbd58491cf | cc64b4e3093bb30779062f00ce8894e4805fca9c |

Ambos checkouts estaban limpios y sincronizados con origin/dev. Los merges main tienen el mismo árbol que dev; dev no incluye necesariamente los commits históricos de merge --no-ff de main. No confundir esa diferencia de ancestros con contenido pendiente. Consulta Git para identificar el cierre documental posterior.

Publicación realizada **backend → frontend**, autoría exclusiva y sin conflictos. Vercel Ready y alias comprobados:

- Frontend: https://protein-forge.vercel.app; laboratorio /generate/lab, colección /projects. Despliegue dpl_6YCSRkME6qicBpCrEq3gC7grN4tV.
- Backend: https://protein-back.vercel.app. Despliegue dpl_48MWtaYrYu5QhxTdrtVUtCY7dEan.

Checks de producción success: backend 39721634980; frontend CI 39721934077 y WASM 39721934092. Backend dev 39721630446 también success. Son verificaciones de esa publicación, no una consulta nueva que debas inventar.

La ejecución separada frontend **dev 39721928591 falló en Run critical browser flows**; main con árbol idéntico pasó después. Causa pendiente por falta de log. No declarar dev completamente verde, atribuirlo a infraestructura sin evidencia ni reejecutar para ocultarlo. No impide el desarrollo del producto publicado.

La revisión automática rechazó extraer/reutilizar una credencial mediante git credential fill para leer ese log; no se ejecutó. API sin credenciales devuelve 403 y GitHub pide iniciar sesión. No eludir el rechazo ni extraer tokens por otra vía. Si el diagnóstico necesita ese log, pedir solo el error del paso al propietario o usar una vía normal autorizada sin exponer credenciales. No hacer de ello el único trabajo siguiente.

frontend/buf.gen.yaml fija backend **5b6c4505c77293e1f4798e0bd86932e13c11600f**, que YA está publicado. npx buf generate desde la referencia remota se ejecutó sin diferencias en src/gen. Alternativa local: npx buf generate ../backend/proto. Mantén LF en .proto; no edites stubs a mano.

## Terminado: conservar, no rehacer

- Proyectos tiene sección propia /projects, enlace con sesión en barra/menú móvil, tarjetas/previews, búsqueda/orden global, CRUD/copia y concurrencia. Perfil enlaza a la colección. Correo de confirmación e inglés resueltos.
- Frontend gRPC-Web; backend conserva REST y sirve AccountService/ProjectService/ReferenceService. DesignService v1alpha1 es borrador, sin ejecutor de inferencia.
- Laboratorio A: tres variantes reales del mismo esqueleto experimental 1UBQ A, ZIP/archivo validado en Worker, selección secuencia/3D, comparación, edición/protección/deshacer y archivo portable. PDB original al importar; ejemplo curado exporta solo traza Cα explícita. Editar invalida estructura/confianza anteriores hasta nueva predicción.
- Colab condicionado comprobado: borrador v2 R2/F7/R42, tres muestras y repetición conservan posiciones; solo se predijo la muestra 1. Fuente, ZIP de 43 archivos, FASTA/PDB/PAE/RMSD verificados. Cuaderno descargable en la app y offline. No son tres formas nuevas ni pruebas de actividad/estabilidad experimental.
- Laboratorio en Proyectos IMPLEMENTADO Y PUBLICADO: formulario, conflictos/recargar/copia, vínculo independiente del editor, conservación de análisis/borradores e importación fallida/cancelada atómica. Acceso interno conserva memoria; antes de Google ofrece descargar archivo.
- Workspace v1 o v2 con LaboratorySnapshot campo 6: JSON UTF8 portable v1, SHA256, máximo 1.000.000 bytes, tres variantes/120 residuos; mensaje RPC completo máximo 2.000.000 bytes, sin ampliarlo. API valida sobre/fuente/borradores sin descomprimir ZIP ni ejecutar ciencia; Worker revalida íntegramente. activeSequence de análisis es independiente del estado activo del laboratorio.
- Almacenamiento analyses, clave estable workspace-v1; SQL impide v1 sobre v2 sin escrituras parciales. Preview solo presencia/cantidad. JWT/RLS/SECURITY INVOKER y microsegundos conservados.
- Corrección b971f0d: respuestas demoradas de apertura/recuperación conservan ediciones recientes y parámetros elegidos antes de iniciar sesión; aviso bilingüe y reintento deliberado, destinos independientes.

Migraciones YA aplicadas según el propietario, incluida **backend/supabase/migrations/20261021000000_laboratory_projects.sql**, confirmada el 21 oct. No repetirla, no pedir otra vez su aplicación ni ejecutar la inicial. Evidencia declarada por él, sin inspección de SQL remoto.

## Alineación y Proyectos: aclaración real del 22 oct

El propietario informó que una alineación humana/bovina se abría en Analizar y que no veía Proyectos; dijo abrirla desde Perfil u otro lugar. En la pestaña actual sí se observó Proyectos en la barra y /projects mostró la alineación guardada con ambas secuencias y su resultado.

Se abrió **«Abrir comparación»**, confirmando sustitución, sin editar/guardar datos remotos: navegación efectiva a /alignment, humana 110/bovina 105 residuos, **Global/BLOSUM80**, 88/110 posiciones idénticas, identidad 80 %, similitud 81,8 %, puntuación 733. La alineación no se perdió. El proyecto mixto conserva también la secuencia de análisis y ofrece «Abrir análisis» y «Abrir comparación»; el primero lleva deliberadamente a Analizar.

Después el propietario confirmó: **«Ya apareció proyectos, creo que vercel no se había actualizado»**. Considerar resuelta la ausencia de la sección; no rehacerla. No se verificó la causa exacta de la vista anterior: no afirmar caché/PWA o fallo de Vercel como hechos. No se reprodujo un fallo de ruta en la versión actual. La primera lectura dio timeout y funcionó al actualizar una vez; no se alteraron proyectos.

Esto acredita **lectura/apertura autenticada real de una alineación**, no todavía CRUD completo del laboratorio, aislamiento de dos propietarios ni conflictos reales de dos pestañas. No se crearon/renombraron/borraron datos reales para probar.

## Siguiente desarrollo

1. Audita brevemente el estado y completa un bloque local pendiente con requisitos definidos. No dedicar otra conversación entera a planificar, volver a publicar lo mismo o rehacer Proyectos/laboratorio/correo/inglés.
2. Corrige defectos REPRODUCIDOS y verifica recorridos afectados. Si revisas alineamientos, parte de la apertura autenticada correcta anterior; añade cobertura útil si se justifica y distingue análisis/comparación. No cambies contrato o semántica de guardado por un fallo no reproducido.
3. Siguen preparados los casos reales del laboratorio en docs/laboratory-activation.md: crear/abrir/editar/renombrar/copiar/borrar, recarga, dos pestañas y dos propietarios. Sus pendientes de publicación/migración están superados; los casos de prueba siguen vigentes. Crear/borrar datos reales requiere alcance específico de proyectos de prueba y sesión del propietario. No pedir contraseñas ni copiar tokens. Avanza localmente si esa participación no está disponible.
4. Próximo avance científico recomendado, **aún sin campaña nueva ni implementación autorizadas**: propuesta acotada de forma de novo en Colab, objetivo/tamaño, método/versión/licencias, hardware gratuito, presupuesto finito, archivos y criterios verificables. Después de acordarlo, ensayar un caso pequeño esqueleto nuevo → secuencia → predicción/comparación antes de ampliar UI o automatizar. Las ejecuciones anteriores son rediseño sobre esqueleto conocido.
5. Inferencia desde la app, forma de novo y evaluación experimental son capacidades distintas. Antes de ampliar DesignService/añadir ejecutor, delimita arquitectura, consentimiento, límites, procedencia y prueba real. No inventes endpoints/colas/servicios ni conviertas Colab gratuito en servidor permanente. Una propuesta necesaria no bloquea correcciones locales independientes.
6. Termina el bloque iniciado, actualiza progreso/documentación y entrega cambios, pruebas, commits y límites. Pide ayuda solo para lo que realmente dependa del propietario.

## Evidencia y reproducción

Frontend: 337 unitarias/61 archivos, cobertura 84,71 % statements /73,82 % branches /82,46 % functions /87,80 % lines, mínimos intactos. Tipos/lint/build/PWA correctos, 25 recursos. Chrome local: 24 E2E afectadas, ambos ZIP reales, 360/1280/ambos temas, AA/foco/Escape/44 px, conflicto/copia/corrupción atómica/respuestas demoradas; Auth/RPC simuladas. CI main posterior pasó su batería completa; no inventar su número de casos.

Producción: REST health 200 identity=true, OpenAPI LaboratorySnapshot, Connect JSON correcto, gRPC-Web GetStatus 0/GetMe sin token 16, CORS/preflight reales. Chrome sin mocks/sin sesión verificó laboratorio/tres variantes/Worker/edición/protección/descarga/diálogo anónimo/idiomas y COOP/COEP/CSP, cero pageerror. Cuaderno servido 68.318 bytes igual al blob Git, SHA256 d5d141d6ebbde81a921bf33c3097cf01815d6e5c48af10f8cccc0a8a97b7454d. Checkout Windows CRLF y servido Linux LF. Añadir la apertura autenticada del 22 oct descrita arriba; no confundirla con CRUD del laboratorio.

Backend: 43 pruebas API y 12/12 PostgreSQL 18 temporal reales previas, Buf lint/breaking correctos; no repetir por documentación sola. Python local 3.13.14, objetivo 3.14, CI de publicación success. Ciencia Python: 21 pruebas previas sin modelos locales. Otros navegadores/validación experimental no certificados. Avisos previos de Vite sobre cargador futuro/chunks grandes conservados.

Frontend: npm run typecheck, npm run lint, pruebas pertinentes y npm run build; coverage completa al afectar módulos compartidos, PWA si cambian recursos/Workers/caché. E2E sobre preview: E2E_BASE_URL=http://127.0.0.1:5204, E2E_WORKERS=1, node node_modules/playwright/cli.js test ... . Comprueba servidor antes de usarlo; no repitas baterías sin cambios o dudas que lo justifiquen.

Windows: Chrome y preview necesitaron ejecutarse fuera del aislamiento para localhost, con permiso y sin cambiar flags de seguridad. Vitest necesitó TEMP/TMP bajo frontend/tmp/vitest ignorado tras error de lectura temporal. Cliente Python de humo tuvo problema del emisor TLS; verificación efectiva por HTTPS Windows, sin desactivar certificados.

Artefactos ignorados: E2E_LAB_ARCHIVE=frontend/artifacts/design-lab/campaign/proteinforge-design-lab-campaign.zip; E2E_LAB_CONSTRAINED_ARCHIVE=frontend/artifacts/design-lab/constrained/proteinforge-constrained-results.zip. Capturas laboratory-project-*, laboratory-race-* y deployed-laboratory.png; no requeridos descargables en CI.

Backend: .venv/Scripts/python.exe -m unittest discover -s tests -v; SQL real con scripts/test-postgres.ps1 crea/apaga PostgreSQL temporal solo localhost. Bootstrap emula auth.uid, no certifica Supabase/PostgREST remoto. Respeta rechazos automáticos de herramientas y conserva secretos.

No crear otro repositorio ni conversación por cuenta propia. Al cerrar distingue implementado, probado localmente, comprobado en producción y pendiente de decisión.
