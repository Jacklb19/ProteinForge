# Propuesta de sección Proyectos

19 oct 2026. El propietario eligió **A · Colección de secuencias** y autorizó continuar el desarrollo. Plan por pantallas aplicado en `dev`; [funcionamiento y activación](projects.md). Las secciones de auditoría y comparación siguientes conservan el estado previo como justificación. B no se integra en la aplicación. Contrato/migración preparados localmente, sin cambios remotos.

## Auditoría

- `ProjectLibrary.tsx` está dentro de Perfil y recibe únicamente nombre, estado y fechas. `open()` siempre navega a Analizar. No hay búsqueda, orden configurable ni duplicación desde la lista.
- `ProjectProvider` conserva separación por propietario, cancelación, versión con microsegundos y protección de borradores. Reutilizar estos mecanismos; no implementar otro almacén de proyectos.
- `ProjectSummary` del contrato solo contiene cinco campos. `fetch_projects` selecciona `id,name,status,created_at,updated_at`; no dispone de resultados para dibujar las tarjetas.
- El snapshot ya distingue resultados vigentes y valida secuencia, exclusiones y parámetros. La vista previa debe conservar esa coherencia y la ausencia de resultados; un cero no representa un valor desconocido.
- `.21st/design.json` conserva valores antiguos de color. La fuente visual vigente es `docs/diseno-visual.md` y `src/design-tokens.css`; las maquetas leen estos tokens directamente.

## Dos direcciones

| | A · Colección de secuencias (recomendada) | B · Cuaderno de trabajo |
|---|---|---|
| Composición | Tres tarjetas iguales en escritorio, una columna móvil | Fichas horizontales en escritorio, una columna móvil |
| Jerarquía | Título, cinta y propiedades; acciones al pie | Nombre/origen a la izquierda, evidencia al centro, apertura a la derecha |
| Densidad | Más proyectos visibles de un vistazo | Más espacio por proyecto y nombre largo |
| Uso preferente | Colecciones que van creciendo | Lectura detenida de pocas comparaciones |
| Riesgo responsive | Nombres largos requieren ajuste y altura flexible | La ficha horizontal debe apilarse pronto, sin comprimir cifras |

Ambas mantienen la marca, las tres fuentes locales, tinta sobre papel frío, navegación plana y color solo por química. Abrir es una acción explícita; el menú adicional propone Renombrar, Duplicar y Eliminar. Las acciones de escritura son representaciones visuales, no operaciones conectadas. Buscar, ordenar y desplegar el menú sí funcionan dentro de la maqueta.

Referencias consultadas en 21st: [Project Card](https://21st.dev/@ravikatiyar162/components/project-card) (separación entre evidencia y acceso; código consultado sin instalarlo) y [File Card Collections](https://21st.dev/@urmauur/components/file-card-collections) (colección de elementos; solo metadatos). Se descartan imágenes decorativas y zoom de cartera. El sistema propio, `ProjectLibrary`, `SequenceRibbon` y `chemistry/config.ts` definen el resultado. No se añadieron dependencias ni se utilizó generación alojada.

## Datos y evidencias de las maquetas

La carpeta de salida local se encuentra en `C:/Users/josel/.codex/visualizations/2026/10/19/01a152b8-83cd-7033-bd5f-864e92b56b3f/`. `index.html` reúne ambas propuestas y los PNG `{a,b}-{360,1280}-{light,dark}.png`. Son capturas reales de iframes de esos anchos en el navegador integrado, no imágenes generadas. Los HTML, CSS y scripts de maqueta quedan fuera de ambos repositorios.

Ejemplos de catálogo, sin acceder a la cuenta: P01308 (110 residuos), P01317 (105) y P00698 (147). `build-data.mjs` usa los módulos científicos existentes para calcular descriptores y Gotoh. Comparación humana/bovina: 88 identidades y 90 similitudes de 110 columnas (80,0 % y 81,8 %), BLOSUM62/global. La cinta muestra los primeros 40 residuos, así rotulados. No representa estructura tridimensional. Las fechas de actualización y nombres de proyecto son ilustrativos.

La revisión comprueba ambos temas, fuentes locales cargadas, ausencia de desbordamiento horizontal a 360/1280 y geometría de objetivos de 44 px. Se revisan búsqueda vacía, menú, teclado e inglés dentro de la maqueta. No equivale a pruebas E2E, CRUD real ni auditoría completa de accesibilidad de una pantalla de producción. La matriz local y las capturas registran la evidencia concreta.

## Datos propuestos para implementación

Recomendación (a): resumen ligero, sin `GetProject` por cada tarjeta. Añadir `ProjectPreview` opcional a `ProjectSummary` con número nuevo, conservando los cinco campos y REST. Incluir longitud, prefijo acotado, descriptores guardados si están asociados a la secuencia vigente, conteos/columnas y parámetros de comparación, y procedencia. Incluir longitud de cada entrada cuando haya comparación. Un proyecto mixto debe poder mostrar análisis y comparación y ofrecer ambos destinos; no asumir que todos contienen un solo tipo.

Una función SQL de listado `SECURITY INVOKER` puede proyectar longitud/prefijo de `projects.active_sequence` y campos concretos de `analyses.results` para `workspace-v1`. Supabase devuelve solo la proyección; la API no descarga el JSON completo ni recalcula ciencia. Longitudes/prefijos provienen del texto guardado, nunca de coordenadas inventadas. Resultados o fuentes inconsistentes se omiten. No mostrar ceros sustitutivos ni tratar descriptores como evidencia de función.

Buscar y ordenar deben cubrir toda la colección. Proponer campos compatibles de consulta y orden en `ListProjectsRequest`, enum con valor predeterminado de recientes, y token opaco ligado a consulta/orden. No ordenar solo la página cargada ni anunciar búsqueda completa sobre ella. Validación/límites en configuración. Mantener orden total por fecha/id o nombre/id, documentar comportamiento si la colección cambia durante paginación.

Esta propuesta requiere acordar y probar el cambio compatible del contrato y una migración idempotente. No se escribieron todavía. Conservar RLS y revocar ejecución a `public`/`anon`; pruebas PostgreSQL de propietarios, ausencia/ajeno, valores nulos, límites y concurrencia. `buf lint`, `buf breaking` contra `main` y ambas generaciones. La migración remota la aplicaría el usuario tras recibir el SQL comprobado. La referencia fija de generación frontend se actualiza solo cuando exista un commit backend correspondiente.

## Plan por pantallas tras la elección

1. Proyectos: ruta/configuración, carga, error tipado, invitación de acceso, vacío real, búsqueda, orden y paginación global. Tarjetas con datos opcionales y fallback honesto para proyectos antiguos.
2. Navegación: destino en barra y menú móvil. Perfil: enlace a Proyectos; conserva cuenta, preferencias y privacidad.
3. Abrir: Analizar/Alinear según contenido, elección explícita en proyectos mixtos y confirmación de reemplazo del borrador. Mantener ID y timestamp exacto.
4. Menú: renombrar con versión; duplicar snapshot obtenido sin sustituir el borrador activo; eliminar con confirmación que nombre el proyecto. `ABORTED` conserva estado y exige recuperar/copiar explícitamente; no reintentar una creación incierta a ciegas.
5. Verificación: contratos/RLS local, pruebas unitarias pertinentes, lint/tipos/build/PWA y E2E gRPC-Web afectadas. Capturas reales 360/1280, ambos temas, teclado, foco y contraste. Actualizar mapa, guía y progreso. Sin push, merge, despliegue ni migración remota por esta petición general de continuar.
