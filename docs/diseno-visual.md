# Diseño visual vigente

El sistema implementado usa superficies minerales y acento cobre en claro, y grafito verdoso/cobre luminoso en oscuro. Se conserva mientras se acuerda una nueva dirección visual con el usuario. Cumplir accesibilidad y tokens no demuestra por sí solo que una composición sea atractiva; la revisión estética será una tarea específica.

## Fuentes de verdad

- `src/design-tokens.css`: colores, dimensiones, tipografía, espaciado y movimiento.
- `src/index.css`: marco y primitivas de panel, campo, botón, aviso y estado.
- `src/shared/PageHeading.tsx`: encabezado común.
- [Pantallas](pantallas.md): rutas y estados existentes/previstos.
- [Procedencia de fuentes](font-provenance.md): licencias, tamaños y hashes de IBM Plex. No modificar los archivos de licencia ni fuentes originales.

No repetir paletas o medidas en componentes. Los temas claro/oscuro y Sistema comparten tokens. IBM Plex Sans 400/600/700 es lectura/acciones; Mono 400 es secuencia/datos. Usar cifras tabulares, no negrita artificial en Mono.

## Presentación y accesibilidad

- Secuencia y resultados científicos como contenido principal; posiciones separadas, columnas numéricas alineadas y estados explícitos.
- Reutilizar marco, PageHeading y primitivas. No añadir rutas futuras, datos ficticios ni controles sin operación.
- Contraste de texto mínimo 4,5:1 y gráficos/controles 3:1; foco visible, teclado, controles de 44 px y movimiento reducido.
- Datos desactualizados conservados con aviso. Invalidación marcada y anunciada, sin depender solo del color.
- `#root` ocupa el viewport; navegación izquierda anclada al borde. El máximo de ancho se aplica al contenido, no al marco.

## Contratos visuales que requieren cuidado

| Mecanismo | Mantener y verificar si se modifica |
|---|---|
| Editor superpuesto | Fuente, peso, tamaños, relleno, borde, interlineado y scroll iguales entre textarea y resaltado; sin cálculos de ancho de glifo en JS |
| FASTA virtualizado | Filas efectivas de 44 px, medidas tras `document.fonts.ready`, respaldo positivo y finito; descartar medidas tras desmontaje |
| Bloques de alineamiento | Altura de 112 px y virtualización; no cambiar interlineado aislado |
| Canvas de hidropatía | Colores y estilos desde hilo principal; dibujo/cálculo en Worker. Carga de Sans 400 en Worker redibuja datos existentes sin recalcular |
| Fuentes | Precargar solo Sans 400 y Mono 400; swap y respaldos ajustados. Preservar hashes/licencia y prueba offline si cambian recursos |
| PWA e identidad | Mismo icono `/app-icon.svg`, generado desde SVG/tokens; WOFF2 y WASM en precaché. Actualizaciones sin recargar durante edición |

## Comprobación de cambios visuales

Revisar la pantalla afectada a 360/1280 px en claro/oscuro y sus estados pertinentes: vacío, cálculo, resultado, inválido, desactualizado, cancelado/error. Comprobar foco, teclado, contraste y desbordamiento. E2E del recorrido afectado con capturas; evitar repetir pantallas ajenas al cambio. Comprobar fuentes/canvas/virtualización/PWA solo cuando se toquen esos contratos.

Evidencias históricas y pruebas existentes: [S3](archive/sprint-3-verificacion.md) y [S4](archive/sprint-4-verificacion.md). Los E2E actuales y `src/test/fonts.test.ts` conservan comprobaciones de geometría, accesibilidad e integridad; no reducir sus umbrales.
