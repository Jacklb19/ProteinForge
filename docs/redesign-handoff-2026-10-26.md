# Continuación del rediseño de ProteinForge

Continúa la implementación del rediseño aprobado. No te detengas en otra auditoría o maqueta: integra la propuesta real, verifica y documenta el resultado.

## Workspace e instrucciones

Raíz: C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge. Hay dos repositorios independientes, frontend y backend; la raíz no tiene Git. Este trabajo afecta al frontend. Trabaja en frontend/dev. Lee los AGENTS aplicables, docs/PROGRESS.md, docs/definicion-proyecto.md, docs/diseno-visual.md y docs/public-laboratory-proposal-2026-10-26.md.

El usuario aprobó la nueva propuesta con «Me gusta», añadiendo que cada sección debe estar bien delimitada y estructurada y que controles como el tema no pueden quedar en mitad de una herramienta. Esto autoriza implementar la maqueta y el plan con esa corrección. No vuelvas a pedir aprobación visual de esa propuesta. Iconos y animaciones están solicitados expresamente y actualizan las restricciones antiguas que los limitaban.

Sin push, merge, despliegue, gastos, migraciones ni cambios remotos. Conserva autor y committer exclusivos Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas/coautores. No fuerces archivos locales excluidos al índice. No delegues salvo que nuevas instrucciones lo autoricen.

## Resultado que debes terminar

- Sitio público de una sola página, sin sidebar: qué es ProteinForge, herramientas con ejemplos reales, recorrido de uso, procedencia/límites, dudas y CTA estratégicos de crear cuenta/entrar. Animaciones cuidadas con movimiento reducido. Apariencia e idioma dentro de Preferencias, también en público.
- Acceso, registro, recuperación y legales con marco público. Tras sesión válida, abrir el laboratorio o conservar el destino solicitado. Respetar confirmación de correo, OAuth y las protecciones ya existentes.
- Entorno de trabajo distinto: sidebar agrupada con iconos, estado activo, desplazamiento independiente y modo compacto; etiquetas accesibles y ayuda al pasar/enfocar. Investigar: Analizar, Comparar, Biblioteca. Diseñar: Diseñar secuencias, Laboratorio 3D. Organizar: Proyectos cuando corresponda a la sesión. No dejar grupos vacíos. Abajo: guía/métodos, Preferencias y Cuenta. Menú móvil accesible.
- Retirar la franja redundante «Espacio de trabajo / Analizar». Cada herramienta abre directamente con su título, propósito y acciones.
- MUY IMPORTANTE: no copiar los botones de tema de la maqueta a las cabeceras científicas. Tema/idioma pertenecen a Preferencias; identidad y sesión a Cuenta; guardar/exportar/importar a su contexto. Revisar esta coherencia en todas las secciones.
- Mantener el ejemplo sin cuenta como acceso secundario claramente identificado, sin simular una sesión o proyectos privados. No imponer una nueva barrera de identidad a todos los cálculos locales. Proyectos/UniProt/lecturas mantienen sus requisitos reales.
- Mejorar estructura y explicaciones de Analizar, Comparar, Diseñar, Laboratorio, Biblioteca, Proyectos, guía, Cuenta y páginas públicas. Conservar todas las capacidades y cifras; la maqueta simplifica algunos controles, no autoriza retirarlos.

## Maqueta aprobada y referencias

Archivos locales excluidos: frontend/artifacts/public-laboratory-2026-10-26/{index.html,preview.tsx,preview.css,copy.ts,preview.check.ts}.

Vista pública: http://127.0.0.1:5341/artifacts/public-laboratory-2026-10-26/index.html?screen=home
Laboratorio: misma URL con ?screen=workspace&page=lab. La pestaña visible del propietario quedó en Biblioteca de esa maqueta; NO es el producto integrado.

El servidor propio5341 estaba activo, sesión96901. Si ya no funciona, vuelve a iniciarlo. Los números de sesión no son una garantía de proceso vivo. Los archivos en artifacts se ignoran por el observador Vite: para refrescar cambios de la maqueta puede hacer falta reiniciar su servidor. No añadas la maqueta a public/build/PWA.

Capturas y verificación: delivery.log, delivery-results, es-home-analyze-1280-light.png, es-workspace-lab-1280-light.png y es-compact-1280.png en esa carpeta. 26/26 comprobaciones de maqueta correctas; 88 configuraciones es/en × claro/oscuro ×360/1280 en11composiciones, más recorridos. No atribuyas esas pruebas al nuevo producto aún sin integrar.

Skills ya usadas: frontend-design y21st-ui-build. Referencias21st ya consultadas: Sidebar Nav Group24865 (recuperado), Settings Sidebar Accordion24875 y Scroll Reveal Content A19203. No hace falta repetir exploración de estilos. Generación alojada deshabilitada, sin gasto ni dependencias. Una revisión externa de fuentes fue bloqueada previamente por no garantizar que el código permaneciera local: no la eludas; usa revisión local, pruebas y axe.

## Estado exacto al interrumpirse

Base confirmada frontend/dev: a7e244a (propuesta). Precedentes:908a2bc corrección del asistente;659b79f documentación de Mesa clara;9464ae7 recorridos; b23f386 interfaz Mesa clara. Verifica HEAD antes de actuar porque hay otro trabajo de autenticación en paralelo.

La implementación nueva solo dejó DOS archivos de producto modificados, sin confirmar:

1. src/shared/Icon.tsx: añadidos iconos de análisis, comparación, diseño, laboratorio, biblioteca, proyectos, ayuda, ajustes, contraer/expandir, flecha, cuenta y sitio público.
2. src/shared/navigation.ts: nav sin Inicio público, agrupación research/design/organize e iconos; ruta /guide; helper isWorkspaceRoute; PUBLIC_SECTIONS y SIDEBAR_STORAGE_KEY. Son preparativos y pueden requerir ajustes al integrar.

No se han implementado todavía el nuevo marco, la landing, la sidebar plegable ni la guía. src/App.tsx sigue con el marco Mesa clara anterior; LandingPage.tsx sigue siendo la versión anterior, que inicia ejemplos/candidatos. No se corrieron tipos/lint/pruebas tras esos dos cambios preparatorios. NAVIGATION_ITEMS ya no contiene Inicio: no confundas tests antiguos incompatibles con una regresión científica.

Había otros DOS archivos modificados AJENOS al rediseño: src/features/auth/AuthProvider.tsx y AuthPages.test.tsx. No los reviertas, sobrescribas ni incluyas en un commit como propios. No necesitabas editar AuthProvider para separar composiciones; mantén su lógica actual. Otros cambios ajenos que aparezcan también deben conservarse.

## Próximo trabajo concreto

1. Revisar el diff y preservar cambios ajenos. Registrar la aprobación y el ajuste en contexto visual/progreso.
2. Extraer el marco público y el de trabajo de App.tsx en componentes propios. Mantener Auth/SequenceDraft/AlignmentDraft/Lab/Projects/Generator estables por encima del cambio de marco para no perder borradores. Conservar rutas, /app, /settings y retorno OAuth.
3. Construir la landing en React con catálogos es/en, tokens y componentes científicos del proyecto; no importar archivos de artifacts en producción. Usar BackboneView/StructureStage, SequenceRibbon, ProfileSketch y AlignmentMap con referencias reales. La página pública no debe iniciar una búsqueda de candidatos o todos los cálculos pesados al llegar; cargar lo necesario cuando se use.
4. Implementar sidebar, menú móvil, Preferencias y Cuenta en su ubicación coherente. Persistir solo la preferencia visual del ancho, sin guardar secuencias nuevas en localStorage. Reutilizar las protecciones de sesión y borradores.
5. Revisar cada herramienta siguiendo el plan aprobado. Cinco descriptores, tendencias, FASTA, tablas, selección SIFTS, métodos, archivos e informes completos deben seguir disponibles. La guía debe reutilizar métodos/criterios reales, sin inventar ciencia.
6. Adaptar tests a los recorridos nuevos abriendo las pestañas/menús que correspondan, sin relajar cifras, accesibilidad, conflictos o cancelación. Comprobar conservación del trabajo al cambiar de marco y después de acceso.
7. Tipos/lint, pruebas de módulos compartidos y recorridos afectados, build y PWA. Revisar360/1280, ambos idiomas/temas, foco/teclado, controles44px, contraste, fuentes y canvas. Mantener mínimo de cobertura70%. Inspeccionar capturas reales antes de cerrar.
8. Actualizar diseño, mapa de pantallas, decisiones, progreso y relevo; commits locales pequeños y autoría exclusiva del propietario. Entregar resultado verificable y límites reales, sin publicar.

Todo texto de producto nuevo va en src/i18n/es.ts y en.ts en el mismo cambio. Cálculo pesado en Workers/WASM. No cambiar algoritmos, contratos, inferencia o servicios por este rediseño. Editar una variante debe seguir retirando coordenadas/confianza de la predicción incompatible; preservar procedencia/hash/versiones/cadena/numeración, conflictos y aislamiento.

Si la ejecución restringida falla por caché temporal o loopback, usa la autorización local apropiada; no cambies aserciones para ocultarlo. Vite ya excluye artifacts/coverage/test-results/tmp del observador y limita optimizeDeps a fuentes. No vuelvas a provocar recargas con trazas HTML ni a escanearlas como aplicación.

## Estado de la segunda sesión (26 oct 2026): implementación completada

Commits locales en `dev`, autoría exclusiva Jacklb19, sin trailers: `66132b1 feat(ui)` (marcos `src/shell/`, presentación, `/guide`, `src/frames.css`, catálogos es/en), `34012f7 fix(ui)` (foco del menú, estilos del panel, ejemplo 3D, orden móvil, guía, movimiento reducido), `327436a test(ui)` (E2E adaptados y nuevos) y el commit de documentación de esta sesión. `df4301b fix(auth)` es de la sesión paralela y no se tocó.

Verificación real al cerrar: tipos y lint limpios; unitarias 455/455 en 79 archivos con cobertura 85,36 % líneas, 76,66 % ramas, 82,65 % funciones; build correcto; `check:pwa` correcto (precache 51 entradas, recarga sin conexión, Workers, fuentes, laboratorio). E2E completo en el puerto 5345 con un worker: 112 correctas, 2 omitidas por diseño (evidencia local de Colab) y las 2 pruebas nuevas de la guía corregidas y repetidas en verde (2/2). Capturas revisadas del producto: presentación 1280 claro, 360 claro, panel móvil oscuro, barra compacta, guía 360 oscuro y en inglés.

Límites: la revisión es automática (axe AA, geometría, recorridos) y visual del autor, no un estudio con usuarios. OAuth real con Google y confirmación de correo no se ejercitaron contra servicios externos; los recorridos de sesión usan Auth/API simulados. Sin push, merge ni despliegue.
