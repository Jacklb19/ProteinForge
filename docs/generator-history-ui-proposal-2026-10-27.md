# Historial del generador en Proyectos · maqueta y plan por pantallas

Preparada el **27 oct 2026**. **Aprobada por el propietario el 27 oct 2026** («Sí, apruebo la maqueta del historial del generador y su plan por pantallas. Impleméntala en la misma sesión, sin publicar»). Interfaz implementada en `dev` (`214e606`, `b01e52e`, `b0913bd`), oculta salvo con `VITE_GENERATOR_HISTORY=enabled`; sin publicar. Los contratos del cliente ya están implementados en `dev` sin ruta visible; esta propuesta decide cómo se presentan. Contrato y decisiones: [propuesta del contrato](../../backend/docs/generator-history-contract-proposal.md).

## Maqueta

Servida en local por la configuración `generator-history-mockup` de `.claude/launch.json` (puerto 5361):

- Índice de estados: `http://127.0.0.1:5361/artifacts/generator-history-2026-10-27/index.html` (en inglés: `?lang=en`).
- Cada estado: `index.html?state=<estado>&lang=es|en`, con `save`, `save-dialog`, `history`, `reproduce-running`, `reproduce-identical`, `reproduce-different`, `remove`, `full`, `old-client`, `signed-out` y `projects`.

Usa el marco real del laboratorio (`WorkspaceFrame`: barra lateral, Preferencias y Cuenta en su sitio), los textos y componentes del producto (`PageHeading`, tabla de comparación, `CandidateRows`, leyenda química) y el contrato real (`createGeneratorRun`, `addGeneratorRun`). Las búsquedas son reales: dos exportaciones del generador incluidas en las pruebas y otras calculadas en la página con el mismo código y las mismas condiciones. En el estado `history`, «Comprobar reproducibilidad» ejecuta de verdad la repetición en un Worker. El estado `reproduce-different` altera a propósito una copia para mostrar una discrepancia y lo dice en pantalla. Nada se guarda ni sale del navegador. Archivos en `artifacts/generator-history-2026-10-27/`, fuera de Git, build y PWA.

## Plan por pantallas

### Diseñar secuencias (con sesión)

- **Guardar junto a su herramienta.** En la fila de acciones de los resultados: «Descargar búsqueda JSON», «Guardar en proyecto» y «Alinear mejores candidatos». Debajo, una línea dice a qué proyecto va («Se guarda en …») con «Cambiar».
- **Proyecto vinculado.** Por omisión es el proyecto abierto en Analizar. El diálogo permite elegir otro proyecto o crear uno nuevo con su nombre. El generador no tiene vínculo propio: así no aparece un tercer proyecto activo además del de Analizar y el del Laboratorio.
- **Diálogo de guardado** (modal nativo, foco inicial en Cancelar y retorno al botón): proyecto, candidato elegido (ninguno o uno de cada brazo, con los nombres del producto «Mutación guiada» y «Referencia aleatoria»), resumen de lo que se guarda (semilla, longitud, presupuesto, método y tamaño) y ocupación tras guardar («4 de 10 búsquedas · 23,9 KB de 100 KB»). Aclara que es el mismo archivo que la descarga y que el análisis, la comparación y el laboratorio del proyecto se conservan.
- **Búsquedas guardadas en este proyecto.** Sección bajo los resultados con la ocupación a la derecha. Cada búsqueda muestra semilla y longitud, presupuesto y rango, método, formato del archivo, versión de ProteinForge (commit, o «Sin identificar»), fecha marcada como hora del dispositivo, huella SHA-256 abreviada (completa para lectores de pantalla) y candidato elegido. Un candidato de más de 60 residuos muestra sus primeros 60 con la longitud total; las cifras describen la secuencia completa.
- **Acciones por búsqueda:** «Abrir en Diseñar» (carga condiciones y resultado sin repetir la búsqueda), «Descargar JSON» (los bytes guardados), «Comprobar reproducibilidad» y «Quitar del proyecto».
- **Comprobar reproducibilidad:** solo bajo demanda. Muestra el progreso con cancelación, y después «Coincide byte a byte», «Mismos valores con otro formato» o «No coincide: N valores difieren», con la lista desplegable de valores. Nunca modifica lo guardado. Una nota previa avisa de que repite la búsqueda en el dispositivo y puede tardar hasta un minuto.
- **Quitar:** confirmación en la propia búsqueda, con foco inicial en «Conservar»; explica que el resto del proyecto no cambia y sugiere descargarla antes.
- **Rechazo por tamaño:** si guardar superaría 10 búsquedas o 100 KB, aviso de error con el texto ya existente `generator.historySize`, más «Elegir búsquedas para quitar» y «Descargar esta búsqueda». No se guarda nada ni se descarta ninguna búsqueda.
- **Proyecto guardado con una versión más reciente:** aviso con `projects.requiresCurrentClient` y «Recargar la página». No se guardan los cambios.

### Diseñar secuencias (sin sesión)

No aparece «Guardar en proyecto» ni el historial. Una nota explica que guardar en un proyecto requiere cuenta y que la búsqueda y su descarga funcionan sin ella, con «Iniciar sesión» y «Crear cuenta», como en las demás acciones que requieren sesión.

### Proyectos

La fila del proyecto añade «N búsquedas del generador» (recuento `generatorRuns` de la lista, sin documentos) y la acción «Ver búsquedas ↗», que abre Diseñar secuencias con ese proyecto vinculado. No hay lista de búsquedas en Proyectos.

## Comprobación de la maqueta

`npx playwright test --config artifacts/generator-history-2026-10-27/playwright.check.config.ts` con el servidor en 5361: **26/26 correctas**. Índice en es/en; 11 estados × es/en × 360/1280 px × claro/oscuro = 88 configuraciones sin desbordamiento horizontal, sin objetivos menores de 44 px y sin infracciones axe WCAG 2.1 AA; sin errores de página. Dos recorridos (es/en): comprobación real coincidente byte a byte, cancelación de la búsqueda de 300 residuos, confirmación de quitar con foco y teclado, y diálogo con foco inicial y retorno al cerrar con Escape. Capturas revisadas: historial completo, discrepancia ilustrativa, diálogo, Proyectos en oscuro y móvil.

Corrección encontrada al montar la maqueta: `createGeneratorRun` esparcía campos ajenos del llamador en un objeto estricto y rechazaba la ejecución; ahora toma solo los tres campos de la ejecución, con prueba de regresión (`222dc05`).

## Fuera de esta propuesta

Publicar el backend, actualizar el pin y regenerar (orden backend → pin/regeneración → frontend), migración en Supabase, enlazar la secuencia de Analizar con su búsqueda (decisión 10: no en esta fase) y cualquier cambio del algoritmo del generador.

## Implementación

- **Oculta en producción hasta publicar.** La interfaz solo aparece con `VITE_GENERATOR_HISTORY=enabled` en el entorno del build (`src/features/generator/historyFeature.ts`, documentada en `.env.example`), además de identidad y API configuradas. Vacía por omisión: los builds de Vercel no ofrecen un guardado que la API publicada rechazaría. Activarla requiere publicar migración y backend y actualizar el pin, con autorización expresa. Las pruebas E2E la activan porque su API simulada acepta la versión 3.
- **Diseñar secuencias:** `ResultActions` pone «Guardar en proyecto» entre «Descargar búsqueda JSON» y «Alinear mejores candidatos»; `useGeneratorSave` añade el destino, el aviso y el diálogo; `SavedRuns` muestra las búsquedas del proyecto abierto en Analizar. «Abrir en Diseñar» restaura condiciones y resultado sin repetir la búsqueda (`GeneratorProvider.restore`). La comprobación usa el Worker de reproducción.
- **Proyectos:** recuento con `generatorRuns` y «Ver búsquedas» (destino `generator`): abre el proyecto en Analizar con la confirmación de siempre y lleva a Diseñar.
- **Escritura:** `saveGeneratorRun` (proyecto abierto, otro proyecto o uno nuevo) y `removeGeneratorRun` en `ProjectProvider` escriben el proyecto guardado más el historial, nunca los borradores sin guardar del editor; comprueban topes antes de enviar y verifican el hash devuelto.
- **Diferencias con la maqueta:** textos definitivos en `es.ts`/`en.ts`; sin proyecto abierto en Analizar, el destino invita a elegir uno y la sección lo explica; «Elegir búsquedas para quitar» lleva a la sección de búsquedas guardadas.
- **Verificación:** 502 unitarias en 85 archivos (cobertura 89,17 % líneas, 76,87 % ramas), tipos, lint, build y check:pwa correctos. E2E con 1 worker y API simulada (la API local exige Supabase Auth): recorrido nuevo 9/9; generador, Proyectos, colección y laboratorio 35 correctas y 2 omitidas por diseño; repetición final 12/12. Cubren 360/1280 px, es/en, ambos temas, axe AA, 44 px y foco.

## Pregunta respondida

Aprobada el 27 oct 2026. La aprobación llegó primero transmitida por el coordinador de sesiones y el propietario la confirmó después directamente: «Confirmo yo, el propietario, que aprobé la maqueta del historial del generador y su plan por pantallas.» Texto original de la pregunta:

¿Apruebas implementar esta composición: «Guardar en proyecto» junto a la descarga, vinculado al proyecto abierto en Analizar con opción de cambiarlo, la sección «Búsquedas guardadas en este proyecto» con sus cuatro acciones y la comprobación bajo demanda, y el recuento con «Ver búsquedas» en Proyectos?
