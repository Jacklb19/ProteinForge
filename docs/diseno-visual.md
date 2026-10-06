# Mesa de residuos — sistema visual

## Identidad y alcance

ProteinForge sirve a estudiantes e investigadores que escriben, revisan y comparan secuencias de proteínas. El tema claro es la referencia de diseño: fondo mineral, superficie de lectura cálida y acento cobre. El oscuro usa grafito verdoso, superficies diferenciadas y cobre luminoso. La preferencia Sistema se conserva.

La firma funcional es el registro de residuos: posiciones separadas del dato, cifras tabulares y columnas numéricas alineadas. Los bloques de conservación conservarán los símbolos y posiciones existentes. No se añade numeración artificial al editor ni métricas ficticias. La primera propuesta descartada fue un dashboard oscuro con acento turquesa y tarjetas repetidas: no daba protagonismo a la secuencia ni identidad al dominio.

Solo existen `/`, `/alignment` y `/settings`. La navegación lateral pasa a una fila visible en móvil. Las pantallas futuras se incorporan según `pantallas.md`; no se muestran enlaces ni acciones sin implementar.

## Tokens y contraste

`src/design-tokens.css` es la fuente de valores visuales. Los temas explícitos usan `data-theme`; Sistema usa `prefers-color-scheme`. No añadir colores ni medidas visuales a componentes.

| Token de color | Claro | Oscuro | Contraste claro / oscuro |
|---|---|---|---|
| page | #f4f3ed | #141715 | Texto 13,57 / 15,78 |
| surface | #fffef9 | #1c211e | Texto 14,94 / 14,28 |
| surface-elevated | #ffffff | #242b26 | Texto 15,09 / 12,67 |
| text | #252722 | #edf1e9 | Contra surface 14,94 / 14,28 |
| muted-text | #62665c | #b2bcad | Contra surface 5,82 / 8,31 |
| border | #818579 | #899787 | Contra surface 3,74 / 5,32 |
| focus, link, accent | #9a3e16 | #f2a76f | Contra surface 6,76 / 8,19 |
| on-accent | #fffef9 | #141715 | Contra accent 6,76 / 9,06 |
| selected-surface, selection | #eee6d8 | #343a29 | Texto 12,17 / 10,30 |
| invalid-surface | #fff0ef | #3c2026 | Fondo de error |
| invalid-text | #ac2638 | #ffadb6 | Contra invalid-surface 6,14 / 8,34 |
| border-subtle | #dcded4 | #39423b | Separador decorativo; nunca delimitar un control |

Los nombres de esta tabla llevan el prefijo `--color-`. Cada valor oscuro tiene una fuente `--dark-color-`. La curva de hidropatía consume `--color-focus`; ambas referencias (0 y 1,6) consumen `--color-border`. Las etiquetas usan `--color-text` y el fondo `--color-surface`. Los contrastes se calcularon con luminancia relativa WCAG y se verifican con los mismos umbrales que antes: texto 4,5:1, gráficos y controles 3:1.

## Tipografía y recursos

IBM Plex Sans 400 para lectura, 600 para títulos y acciones, 700 para etiquetas. IBM Plex Mono 400 para secuencias y valores. Los residuos inválidos se subrayan y reciben un fondo; no necesitan negrita. `font-synthesis: none` evita pesos artificiales. Los datos usan `font-variant-numeric: tabular-nums`; los tres pesos Sans se verifican en E2E.

Familias, tamaños, pesos e interlineados son tokens. Escala 12/14/16/20/28 px expresada en rem, lectura con interlineado 1,5 y títulos con 1,2. Los valores del resumen se mantienen en 20 px para conservar cinco columnas legibles a 1280 px.

Procedencia inmutable, tamaño, SHA-256 y mediciones de respaldo: [font-provenance.md](font-provenance.md). Licencia OFL completa junto a las fuentes en `public/fonts/OFL.txt`. Los descriptores de `@font-face` requieren constantes; no admiten los tokens del documento. Las familias que usa la interfaz sí se centralizan como tokens.

Se precargan solo Sans 400 y Mono 400, con `font-display: swap`. El respaldo Sans usa Arial ajustada; Mono usa Consolas o Courier New ajustadas. Si esas fuentes locales no existen, la familia genérica se usa durante la carga; el aspecto final usa los WOFF2 comunes. No se promete identidad del suavizado entre sistemas operativos ni ausencia absoluta de cambios de anchura proporcional durante el intercambio.

## Espaciado, superficies y movimiento

- Escala 4/8/12/16/24/32/48 px; radios 4 px para controles, 8 px para la superficie de entrada y perfil, cero para la franja científica y registros.
- Fondo de página, superficie de trabajo y controles elevados tienen responsabilidades distintas. Evitar tarjetas anidadas y sombras extensas. La sombra fina se reserva para controles elevados.
- Foco de 3 px y separación de 2 px. Objetivos de al menos 44×44 px. Hover conserva contraste; la selección suma una marca de borde.
- Feedback de borde en 120 ms, `ease-out`; no animar el fondo al cambiar tema. Movimiento reducido resuelve la duración a cero.
- Las condiciones CSS no aceptan variables: 48 rem para navegación móvil y 64 rem para apilar el área de entrada y métricas. Los tamaños de las columnas sí están tokenizados.

## Componentes y uso

| Base | Usar | Evitar |
|---|---|---|
| Marco común y PageHeading | Navegación real, título e introducción por pantalla | Cabeceras de marketing y rutas futuras |
| panel | Área de entrada y perfil como agrupaciones de trabajo | Una tarjeta por dato o párrafo |
| section-heading | Título compacto con icono propio decorativo | Icono sin etiqueta accesible |
| button / button-primary | Secundaria y acción principal | Acciones principales repetidas |
| button-tertiary / button-danger | Acción menor / cancelación real | Botones sin controlador |
| Campos con ayuda | Etiqueta visible y descripción asociada | Placeholder como única etiqueta |
| status-message | Estado vacío, cálculo, error o desactualización real | Progreso o disponibilidad simulados |
| notice | Límite y advertencia científica | Ocultar el error o sustituir su anuncio |
| Registro de tabla | Posición separada y cifras alineadas a la derecha | Recortar datos o desplazar el cuerpo |

Las acciones de carga y error conservan sus anuncios `role=status`. Los datos desactualizados permanecen visibles con aviso explícito. No se añaden indicadores asíncronos en ajustes, que no tiene esa operación. Alineamiento usa entradas emparejadas, barra nativa con la fracción real del Worker, acciones principal/peligro y resumen de puntuación/identidad/similitud. Ajustes agrupa idioma y tema en filas, con ayuda asociada y aviso de inglés pendiente.

## Mecanismos sensibles a estilos

- **Editor:** textarea y resaltado comparten fuente, peso 400, tamaño, relleno, borde, altura, espaciado e interlineado. No hay cálculos JS basados en anchura de glifos. E2E compara ambas capas y su desplazamiento con Plex y con descargas bloqueadas.
- **FASTA:** filas de 44 px y altura de viewport fija, con respaldo positivo y finito. La medición de DOM espera `document.fonts.ready`, y su resultado se descarta si el componente ya no está activo. La edición y el cálculo no esperan fuentes.
- **Alineamiento:** altura de bloque de 112 px y virtualización existente. No modificar un interlineado aislado ni usar Mono en negrita sin incorporar el peso correspondiente.
- **Gráfica:** estilos resueltos en el hilo principal y enviados al Worker. No mover cálculo o trazado al hilo principal ni alterar contratos. OffscreenCanvas no hereda las fuentes cargadas en el documento: por autorización expresa, la inicialización registra Sans 400 en el conjunto de fuentes del Worker y redibuja los datos existentes al cargarla, sin publicar resultados adicionales ni recalcular. Si la carga falla, conserva el cálculo y registra un aviso explícito. Colores y contraste son independientes de esa limitación.
- **PWA:** cambios de configuración: añadir `woff2` a `workbox.globPatterns` y usar el acento claro como `manifest.theme_color`. El manifiesto conserva su fondo, icono en la misma ruta y restantes campos. Registro y resto de opciones conservados. `check:pwa` comprueba las cuatro fuentes en la precaché y sus bytes después de recargar sin red, además del cálculo y aislamiento originales.

## Textos

Español descriptivo: acción, estado y consecuencia. Conservar límites, unidades, residuos excluidos y advertencias de Chou–Fasman. Todo texto visible va en `src/i18n/es.ts`; las claves nuevas son `visual.tools`, `errors.chartFontLoad`, `visual.alignmentInputs`, `visual.alignmentProgress`, `visual.alignmentEmpty`, `visual.settingsIntroduction`, `visual.preferences`, `visual.languageHelp` y `visual.themeHelp`. Todo el catálogo inglés sigue marcado `[EN pending]` hasta S7, incluidas esas claves. No presentar cálculo local como guardado ni estimación clásica como predicción de estructura.

## Checklist de pantalla nueva

- [ ] Confirmar ubicación, ruta y estado en `pantallas.md`.
- [ ] Usar el marco común, PageHeading y las primitivas existentes.
- [ ] Centralizar textos y conservar el aviso de inglés pendiente.
- [ ] Usar tokens y evitar valores visuales duplicados.
- [ ] Cubrir estados reales: vacío, carga, error, cancelación y datos desactualizados cuando procedan.
- [ ] Probar foco, teclado, objetivos 44×44, contraste y movimiento reducido.
- [ ] Revisar 360/1280 px en claro/oscuro con capturas y E2E.
- [ ] Comprobar fuente cargada y respaldo, incluyendo medidas y desbordamiento.
- [ ] Ejecutar lint, typecheck, cobertura, build y recorridos afectados.

## Añadir un token

Buscar primero un token semántico existente. Si falta, declarar nombre en inglés y responsabilidad en `design-tokens.css`; para colores añadir tema claro, fuente oscura y ambos mecanismos de sustitución. Documentar consumidores, fondo y contraste. Ampliar los pares pertinentes en `chartStyle.test.ts` sin reducir umbrales. Revisar editor superpuesto, virtualización y Workers antes de cambiar un token compartido.

## Pruebas modificadas y añadidas

- `chartStyle.test.ts`, prueba parametrizada `keeps AA contrast for palette`: añade página, superficie elevada, selección y botón principal. Conserva texto ≥4,5 y gráficos ≥3.
- `FastaLoader.test.tsx`: añade `waits for pending fonts before measuring virtualized rows`; verifica espera y selección de la entrada después de resolver las fuentes. Las pruebas anteriores no cambian.
- `profile.worker.test.ts`: añade carga y redibujado después de resolver la fuente sin resultados adicionales, y conservación del cálculo con aviso explícito ante fallo de descarga.
- `fonts.test.ts`: cinco pruebas nuevas de cabecera WOFF2, tamaños, SHA-256, licencia y patrón de precaché.
- `editor-design.spec.ts`: cuatro combinaciones Plex/respaldo × 360/1280 con ambos temas, geometría, desplazamiento, invalidación, datos desactualizados, dígitos tabulares en los tres pesos Sans y registro efectivo de Plex en el Worker, FASTA por teclado y errores; un recorrido de vacío, secuencia corta, residuos excluidos y movimiento reducido.
- `scripts/check-pwa.mjs`: amplía la comprobación existente con recarga sin red, caché y carga real de los cuatro WOFF2. Conserva navegación, Worker e aislamiento.
- `scripts/run-e2e.mjs`: precompila Zod en el servidor de pruebas para evitar que la primera carga FASTA provoque una recarga de Vite. No cambia el servidor de producción ni los umbrales de pruebas.

Los recorridos originales y sus umbrales se conservan; solo alineamiento añade aserciones y capturas. Se exige ausencia de infracciones axe y ausencia de desbordamiento del cuerpo. Capturas en `artifacts/`, sin versionarlas. No se verificaron teléfono físico, Mac, Android, lectores de pantalla, otras familias de navegador, rendimiento externo ni despliegue.


## Icono y metadatos

El símbolo propio de residuos reemplaza el icono anterior. La fuente `src/shared/app-icon.svg` tiene geometría de la misma familia que BrandMark; Vite sustituye colores y grosor desde `--color-surface`, `--color-focus` y `--stroke-icon`, lo sirve en desarrollo y lo emite como `app-icon.svg` durante el build. Ese SVG generado no se versiona. Sus coordenadas y radio forman la geometría vectorial, no la distribución de componentes.

El favicon y la PWA usan la misma ruta. Título, descripción inicial y color de navegador salen del catálogo y los tokens mediante el plugin `application-identity`; el proveedor de preferencias existente sigue actualizando el título y el color al cambiar idioma, tema o apariencia de Sistema. No se modifica esa lógica. `manifest.theme_color` usa el cobre claro; el fondo se conserva como superficie.

## Verificaciones finales añadidas

- `AlignmentPage.test.tsx`: la prueba parametrizada de parámetros global/local ahora comprueba la fracción 0,5 en la barra y su retirada al terminar; conserva todos los parámetros y métricas existentes.
- `alignment.spec.ts`: el recorrido de progreso/cancelación añade barra visible y botón principal deshabilitado; el recorrido responsive/axe genera capturas; un caso nuevo verifica vacío, caracteres inválidos y límite de 5.000 en ambos tamaños y temas. No se cambia ningún umbral ni aserción previa.
- `preferences-design.spec.ts`: dos casos nuevos verifican controles de 44 px, ausencia de desbordamiento y axe en 360/1280 claro/oscuro, Sistema, foco por teclado y catálogo inglés pendiente.
- `identity.spec.ts`: comprueba favicon resuelto, título/descripcion y color de navegador para claro/oscuro/Sistema.
- `check:pwa`: además de fuentes, Worker y cálculo, comprueba que el icono generado siga disponible después de recargar sin red.

Comandos: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`, `npm run test:e2e`, `npm run check:pwa`. Si el lanzador npm del equipo falla, ejecutar cada script con Node y la CLI instalada de npm. Las capturas de las tres pantallas se regeneran en `artifacts/` con prefijos `editor-v2-`, `alignment-v2-` y `settings-v2-`; permanecen fuera de Git. La verificación local no certifica teléfonos físicos, Mac/Android, otros navegadores, lector de pantalla, métricas de rendimiento externas ni despliegue.
