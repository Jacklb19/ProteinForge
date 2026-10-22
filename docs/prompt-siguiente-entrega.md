# Relevo de desarrollo — ProteinForge

Actualizado el 21 de octubre de 2026. Sustituye el prompt del 19 oct, conservado en Git. El propietario confirma que ya aplicó la migración del laboratorio; no se inspeccionó la base remota. Copia el bloque siguiente en el nuevo chat, o pide que lea este archivo completo.

Continuación local completada el mismo día: corregida la pérdida de borradores ante aperturas/recuperaciones demoradas (`b971f0d`), con aviso bilingüe y protección de parámetros elegidos antes de acceder. [Activación preparada](laboratory-activation.md), sin publicar ni ejecutar SQL remoto. Esta corrección está terminada; no rehacerla. Los siguientes pasos externos siguen necesitando autorización específica.

---

Continúa el desarrollo de ProteinForge desde el estado existente. Trabaja de forma autónoma dentro del alcance autorizado, implementa y verifica mejoras reales; no te detengas tras presentar un plan. Lee este relevo como contexto: las instrucciones actuales del propietario y los AGENTS.md aplicables prevalecen. No interpretes los permisos históricos como nuevas autorizaciones remotas.

## Workspace y reglas

Ruta: `C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge`. La raíz no tiene Git. `frontend/` y `backend/` son repositorios independientes; trabaja en `dev` de ambos, sin mover sus `.git` ni anidar repositorios.

Primero lee AGENTS.md de raíz y de cada repo, las últimas entradas de docs/PROGRESS.md de ambos y revisa rama/status/log. Después:

- Frontend: docs/plan-desarrollo.md, docs/definicion-proyecto.md, docs/laboratory.md, docs/laboratory-projects.md, docs/design-lab-constraints.md y docs/design-lab-roadmap.md. Para interfaz, docs/pantallas.md y docs/diseno-visual.md.
- Backend: docs/api.md, docs/project-persistence.md, docs/arquitectura.md y la migración nueva indicada abajo.

Responde en español. Código, comentarios y commits en inglés. Todo texto visible cambia en español e inglés a la vez (`src/i18n/es.ts` y `en.ts`); interpolación `{{count}}`. Conserva tokens, AA, foco/teclado, controles de 44 px y matriz 360/1280 claro/oscuro. Dirección visual aprobada A · Mesa de estructura y formulario de guardado ya aprobados: no vuelvas a pedir elección para ellos. Una interfaz sustancialmente nueva requiere propuesta/maqueta y elección antes de implementarla, conforme a AGENTS.md.

Autor y committer exclusivamente `Jacklb19 <jose.burbanob@campusucc.edu.co>`. Sin coautores, firmas ni menciones a agentes/IA en commits, merges o GitHub. Commits locales pequeños y revisados. No hay autorización nueva para push, merge, publicar o modificar servicios remotos: prepara el resultado verificable antes de solicitar una autorización final concreta si hace falta. El usuario confirmó aplicar una migración; eso no autoriza su publicación.

No versiones AGENTS.md, docs/PROGRESS.md, secretos, .env, temporales, ZIP/PDB descargados, modelos ni artefactos de pruebas. No fuerces archivos excluidos. No instales ni ejecutes ProteinMPNN, ESMFold, Torch u otros modelos en Windows. La inferencia comprobada se hizo en Colab T4; Workers/WASM conservan el cálculo del navegador. Costo cero, sin tarjeta. No envíes código privado a herramientas externas de revisión sin autorización; la revisión externa de diseño fue rechazada automáticamente en la entrega anterior y se sustituyó por QA local.

## Estado real al relevar

Frontend `dev`: código hasta `b971f0d7d86428339c7d519213f5a89a4b0a1f24`, más cierre documental posterior.
Backend `dev`: `da25fee44d3dda9db0d0599c02f8a0cbd58491cf` (solo documentación posterior a `5b6c450`).
Ambos árboles estaban limpios antes de preparar este relevo; puede existir un commit posterior exclusivamente documental. Consulta Git, no asumas hashes nuevos. Frontend incluye además `7c56291` (restricciones/Colab) y `4346257` (laboratorio A).

Ya resuelto; no lo rehagas:

- Proyectos tiene sección propia, tarjetas/previews, búsqueda/orden global, CRUD/copia y concurrencia. Esa entrega anterior ya se publicó. El usuario confirmó que los correos de confirmación funcionan. Inglés ya existe.
- Frontend usa gRPC-Web; backend conserva REST y sirve AccountService/ProjectService/ReferenceService. Protobuf vive en backend; cambios aditivos y clientes generados, nunca edición manual de stubs. DesignService v1alpha1 sigue siendo borrador.
- Laboratorio `/generate/lab`: tres variantes reales del mismo esqueleto experimental 1UBQ A; importación ZIP/archivo validada en Worker, selección secuencia/3D, comparación, edición/protección/deshacer, archivo portable y exportación del PDB original cuando se importó. El ejemplo curado solo permite traza Cα explícita. Una secuencia editada no conserva como vigente su estructura/confianza anterior.
- Recorrido condicionado Colab ejecutado: borrador v2 con R2/F7/R42 fijos, generación y repetición conservan las posiciones. Se predijo únicamente muestra 1 de esa ejecución. Fuente, ZIP/43 archivos, FASTA/PDB/PAE y RMSD comprobados. No confundir las tres variantes de un mismo esqueleto con tres formas nuevas, actividad biológica o estabilidad experimental. Cuaderno reproducible descargable desde app y disponible offline.
- Guardar/reabrir laboratorio en Proyectos está implementado LOCALMENTE en ambos repositorios, con formulario aprobado, conflictos/recargar/copia, vínculo independiente del editor, conservación de análisis y borradores, e importación fallida/cancelada atómica. El acceso interno conserva memoria; antes de Google se ofrece descargar el archivo.
- Contrato: Workspace v1 anterior o v2 con LaboratorySnapshot (campo 6): JSON UTF8 portable v1, SHA-256, máximo 1.000.000 bytes, tres variantes/120 residuos. Mensaje RPC completo hasta 2.000.000 bytes, sin aumentar el límite. API valida forma/fuente/borradores sin descomprimir ZIP ni ejecutar ciencia. Reapertura científica íntegra en Worker. La secuencia activa del laboratorio se valida dentro de su state; activeSequence del editor es independiente.
- Almacenamiento existente analyses, clave estable workspace-v1; SQL impide v1 sobre v2 sin escrituras parciales. Preview solo presencia/cantidad, sin ZIP/coordenadas. Se conservan JWT/RLS/SECURITY INVOKER y timestamps con microsegundos.
- Abrir/recuperar compara entradas vigentes antes de sustituirlas. Ediciones durante lista/lectura y parámetros elegidos antes de iniciar sesión sobreviven a la recuperación automática; una apertura manual demorada conserva borrador/vínculo/puntero y avisa. Laboratorio comprueba revisión, borradores e importación/exportación en curso antes de iniciar Worker. Los destinos de análisis y laboratorio siguen siendo independientes.

Migración nueva: `backend/supabase/migrations/20261021000000_laboratory_projects.sql`. El propietario acaba de confirmar el 21 oct: «listo, hice migracion». Regístrala como aplicada según él, SIN afirmar inspección remota. No volver a pedirle que la aplique, no repetir la inicial ni ejecutar SQL remoto. Las migraciones anteriores de Proyectos también estaban aplicadas. La publicación de los commits nuevos y su verificación real de producción siguen pendientes.

`frontend/buf.gen.yaml` fija backend `5b6c4505c77293e1f4798e0bd86932e13c11600f`, todavía local en esta entrega. Para regenerar antes de publicarlo: desde frontend, `npx buf generate ../backend/proto`. El comando por remoto necesita que ese commit exista allí: si se autoriza publicar, backend va primero y frontend después. Conserva LF en .proto para que la generación coincida con CI.

Producción existente: https://protein-forge.vercel.app y https://protein-back.vercel.app. No declares allí el laboratorio nuevo ni el guardado nuevo sin verificar sus despliegues. El reporte de migración no acredita desplegar código.

## Siguiente trabajo

1. Audita brevemente el estado y las diferencias pendientes de publicación. Comprueba sin escrituras remotas qué versión está disponible, si resulta necesario para preparar la activación. Conserva los cambios del usuario. Deja concretos los commits, orden de publicación y comprobaciones; si falta permiso de publicación, solicita solo esa autorización cuando esté preparado y continúa con trabajo local independiente.
2. Cierra el recorrido del laboratorio en un uso real tras la activación autorizada: crear/abrir/editar/renombrar/copiar/borrar con cuenta propia, persistencia tras recargar, dos pestañas con conflicto y aislamiento entre dos propietarios. No confundas pruebas simuladas/locales con JWT/PostgREST reales. No crees ni borres datos reales sin el alcance autorizado; prepara los casos antes de pedir participación del usuario.
3. Continúa el desarrollo pendiente desde definición/plan actuales: detecta y corrige defectos comprobables y completa el siguiente bloque funcional que tenga requisitos y contrato definidos. Evita rehacer Proyectos, correo, inglés, la UI A o la persistencia ya terminada. Si una capacidad nueva requiere otra arquitectura, contrato, nueva UI, servicio, costo o decisión científica, presenta una propuesta concreta y avanza mientras tanto en lo independiente. No implementes un endpoint/executor inventado ni prometas que la web ya lanza inferencia.
4. Pendientes de producto distintos: nueva inferencia desde la app, diseño de forma de novo y evaluación experimental. Antes de ampliar DesignService o un flujo nuevo, delimita objetivo científico, hardware, consentimiento, límites, procedencia y una prueba real pequeña en Colab; las ejecuciones anteriores son rediseño de secuencia sobre un esqueleto conocido. No hagas una nueva campaña larga sin necesidad comprobable ni uses Windows para modelos.
5. Termina el bloque que empieces, actualiza progreso/documentación y entrega resumen de cambios, pruebas, commits y pendientes. No te limites a enumerar tareas; realiza el trabajo autorizado. Pide ayuda solo si una acción necesaria depende realmente del usuario.

## Evidencia y reproducción

Última continuación local: frontend 337 unitarias /61 archivos; cobertura 84,71 % statements, 73,82 % branches, 82,46 % functions y 87,80 % lines, mínimos intactos. Tipos/lint/build/PWA correctos, 25 recursos precacheados. Chrome: 24 E2E afectadas completadas en dos subconjuntos sobre el mismo build; ambos ZIP reales, 360/1280/ambos temas, AA/foco/Escape/44px, conflicto/copia, borrador tras recarga, corrupción atómica y respuestas demoradas. Auth/RPC simuladas. Backend solo documentación en esta continuación: conserva evidencia previa de 43 pruebas API y 12/12 SQL en PostgreSQL 18 temporal real; Buf lint/breaking previos, no repetidos sin cambiar contratos. Python local 3.13.14; 3.14/otros motores/CI remoto no comprobados. Ciencia Python: 21 pruebas previas sin modelos locales. Los avisos de Vite sobre cargador futuro/chunks grandes siguen sin esconderse.

Frontend: `npm run typecheck`, `npm run lint`, pruebas pertinentes; batería completa/coverage cuando cambien módulos compartidos; `npm run build`; `npm run check:pwa` al cambiar recursos/Workers/caché. E2E afectadas sobre preview del build con un worker: `E2E_BASE_URL=http://127.0.0.1:5204`, `E2E_WORKERS=1`, `node node_modules/playwright/cli.js test ...`. El servidor puede haber terminado: compruébalo antes de usarlo. No repitas baterías completas sin cambios o dudas que lo justifiquen.

En esta continuación Windows bloqueó localhost dentro del aislamiento: Chrome y preview funcionaron al ejecutarse fuera mediante el permiso correspondiente, sin alterar seguridad del navegador. Vitest necesitó `TEMP` y `TMP` apuntando a `frontend/tmp/vitest` ignorado tras un error de lectura temporal. No tratar esos fallos previos al arranque como defectos de la aplicación ni eludir rechazos de aprobación.

Archivos reales ignorados, no requeridos en CI:
- `E2E_LAB_ARCHIVE`: `frontend/artifacts/design-lab/campaign/proteinforge-design-lab-campaign.zip`.
- `E2E_LAB_CONSTRAINED_ARCHIVE`: `frontend/artifacts/design-lab/constrained/proteinforge-constrained-results.zip`.
- Capturas: `frontend/artifacts/laboratory-project-{360,1280}-{light,dark}.png`.

Backend: `.venv/Scripts/python.exe -m unittest discover -s tests -v`; SQL real con `scripts/test-postgres.ps1`, crea/apaga cluster temporal solo en localhost. Buf lint/breaking/generación cuando cambie contrato. El bootstrap local emula auth.uid y no acredita Auth/PostgREST remoto. Respeta cualquier rechazo automático de herramientas; no lo eludas ni repitas una acción sin evidencias nuevas.

Conserva archivos locales de progreso excluidos y su historia. No crees un tercer repositorio ni otra conversación por tu cuenta. Al cerrar, distingue implementado, probado localmente, publicado y pendiente de decisión.
