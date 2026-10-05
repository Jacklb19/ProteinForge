# Mapa de pantallas — ProteinForge

Este mapa fija la ubicación funcional de las pantallas y paneles. Las rutas marcadas como **previstas** aún no están implementadas; no describen puntos de acceso de la API. La aplicación usa rutas de cliente para `/` y `/settings`.

| Pantalla o panel | Ruta | Estado y sprint | Propósito | HU y RF | Sesión | Lleva a |
|---|---|---|---|---|---|---|
| Editor de secuencias | `/` | Existente; S1–S2, ampliación S5–S6 | Escribir, pegar o cargar FASTA; ver validación, descriptores y perfil. En S5 incorpora el ensamblado desde catálogo. | HU-01, HU-02, HU-03, HU-04; RF-01, RF-02, RF-03, RF-04, RF-05 | No para análisis local; sí para guardar | Alineamiento, búsqueda UniProt, proyectos, informe y privacidad |
| Selector FASTA, descriptores y perfil | `/` (paneles del editor) | Existentes; S1–S2 | Elegir la entrada cargada y consultar resultados calculados, gráfica y tabla accesible. | HU-02, HU-03; RF-01, RF-03, RF-04, RF-05 | No | Editor; desde el editor, alineamiento e informe |
| Catálogo y ensamblado | `/` (panel del editor) | Previsto; S5 | Buscar en el JSON estático de dominios y péptidos, ordenar fragmentos y conservar su origen. | HU-04; RF-01, RF-16 | No para componer; sí para guardar | Editor y proyecto activo |
| Alineamiento | `/alignment` | Prevista; S3–S4 | Seleccionar referencia y parámetros; iniciar, seguir y cancelar el alineamiento; consultar identidad y regiones conservadas. | HU-05; RF-06, RF-07, RF-16 | No para cálculo local; sí para guardar | Editor, búsqueda UniProt y proyecto activo |
| Búsqueda UniProt | `/uniprot` | Prevista; S5 | Buscar entradas y consultar su anotación para usar una referencia o abrir su estructura. | HU-05, HU-06; RF-08 | Sí, según la API vigente en la definición | Editor, alineamiento y visor de estructura |
| Visor de estructura | `/structures/:id` | Prevista; S5 | Mostrar BinaryCIF con Mol* y sincronizar la selección de residuos con la secuencia. | HU-06; RF-09, RF-10 | No para visualización local; consultar anotaciones puede requerir sesión | Editor, búsqueda UniProt y proyecto activo |
| Acceso, registro y recuperación | `/sign-in`, `/sign-up`, `/recover` | Previstas; S6 | Iniciar sesión, crear cuenta, confirmar correo y recuperar acceso. El desafío TOTP se resuelve en el flujo de acceso. | HU-08; RF-12 | No | Proyectos, editor y privacidad |
| Lista de proyectos | `/projects` | Prevista; S6 | Crear, listar, abrir, renombrar y eliminar proyectos propios. | HU-08; RF-12, RF-13 | Sí | Proyecto, editor y acceso |
| Proyecto activo | `/projects/:id` | Prevista; S6 | Restaurar secuencia, parámetros, descriptores y alineamientos; gestionar conflictos de guardado. | HU-08, HU-09; RF-13, RF-16 | Sí | Editor, alineamiento, visor e informe |
| Informe e interpretación | `/projects/:id/report` | Prevista; S6 | Pedir consentimiento antes de enviar contexto al asistente; revisar interpretación, exportar PDF y datos CSV. | HU-07, HU-10; RF-11, RF-14 | Sí | Proyecto, editor y privacidad |
| Privacidad | `/privacy` | Prevista; S6 | Explicar procesamiento local, datos enviados a terceros y consentimiento. | HU-07, HU-08; RNF-07 | No | Editor, acceso e informe |
| Ajustes | `/settings` | Existente; base de interfaz previa a S3 | Elegir idioma español o inglés y tema de sistema, claro u oscuro; conservar preferencias locales. En S6 se sincronizarán con `profiles.preferences`. | RNF-08, RNF-09 | No | Editor y alineamiento |

La PWA de S3/S7 y los avisos de conexión o sincronización son capacidades de estas pantallas, no una ruta adicional. Los recorridos E2E de S3/S7 recorren las rutas anteriores.

## Diagnóstico

La página de diagnóstico fue una pantalla temporal de S0 y se sustituyó en S1. Hoy no existe `src/features/diagnostico/`, ruta de diagnóstico ni enlace hacia ella. Si se recupera para desarrollo, deberá quedar fuera de la navegación y de la compilación pública; no es una pantalla de usuario prevista.
