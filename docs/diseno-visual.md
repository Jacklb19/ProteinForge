# Diseño visual vigente

Actualizado el 7 de octubre de 2026. La dirección es una **ficha de laboratorio**: el contenido es la secuencia y sus cifras. La interfaz se aparta y no recurre a tarjetas decorativas. Las secciones se separan con espacio y líneas finas.

## Referencias del dominio

| Herramienta | Patrón adoptado |
|---|---|
| [ProtParam y ProtScale](https://web.expasy.org/protparam/protparam-doc.html) (Expasy) | Un solo paso de entrada; cada cifra con su método. Perfil por ventana centrada (9 para superficie y 19 para transmembrana) |
| [UniProt, componente `Sequence`](https://github.com/ebi-uniprot/franklin-sites) | Secuencia en bloques de 10 con la numeración de cada bloque, en monoespaciada |
| [Nightingale y ProtVista](https://github.com/ebi-webcomponents/nightingale) (EBI) y [RCSB Saguaro](https://www.rcsb.org/docs/sequence-viewers/sequence-annotations-viewer) | Pistas por residuo con resaltado sincronizado entre vistas |
| [EMBOSS Needle y Water](https://emboss.sourceforge.net/docs/themes/AlignFormats.html) | Resumen de identidad, similitud, huecos y puntuación como n/longitud (%); marcas `\|` y `:` |
| [Jalview](https://www.jalview.org/help/html/menus/alwformat.html) | Regla y posiciones junto a las filas alineadas |

## Decisiones

- **Color.**
  - Fondo neutro: blanco en claro, `#121316` en oscuro.
  - Texto casi negro: `#17191e` en claro, `#eceef2` en oscuro.
  - Un único color de marca para acciones y selección: azul Coomassie, `#2f3c96` en claro y `#aab4ff` en oscuro. Es el tinte que revela las proteínas en un gel.
  - Un solo color funcional, el error: `#b3261e` en claro y `#ff8f86` en oscuro.
  - La curva del perfil va en tinta.
- **Tipografía.**
  - [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) (400 y 600) para la interfaz. Es humanista, distingue I/l/1 y O/0, algo relevante porque I, L y O son códigos de aminoácido, y tiene cifras tabulares.
  - IBM Plex Mono 400 solo para residuos en columna.
  - Escala: 12, 14, 16, 20 y 28 px; 24 px para el título en móvil.
- **Navegación.**
  - Escritorio: barra superior flotante con *Analizar · Alinear · Ajustes*.
  - Móvil: el mismo `nav` se convierte en barra inferior con icono y texto.
  - No hay indicador de proceso en curso: el alineamiento termina en menos de 1 s con el límite público medido.
- **Elemento propio: el lector de residuos.**
  - Muestra la secuencia en bloques de 10 numerados.
  - Al elegir un residuo (clic, gráfica o teclado) se resaltan la ventana promediada en su hidropatía y su posición en la gráfica, y se leen sus valores.
  - En los extremos sin ventana completa no se resalta ninguna ventana.
- **Lenguaje.** Los estados se dicen con palabras ("desactualizados", "Leyendo archivo FASTA…"). La tabla por residuo y los métodos quedan plegados.
- **Movimiento.** Solo se desplazan la ventana y el cursor de la gráfica, y duran 0 ms con movimiento reducido.
- **Imágenes.** No se usan. El contenido del dominio son datos. Una estructura de insulina madura junto a la secuencia del precursor de ejemplo mezclaría dos objetos distintos.

## Fuentes de verdad

- `src/design-tokens.css` contiene los tokens semánticos (`--bg-*`, `--text-*`, `--accent-brand`, `--status-error`, espaciado, radios y medidas). Cada color tiene una pareja `--dark-`.
- `src/index.css` contiene el marco, los controles y las pantallas. Ningún componente define colores ni medidas.
- Las opciones y los valores ajustables están en la configuración de cada característica:
  - `features/*/config.ts`
  - `preferences/config.ts`
  - `i18n/config.ts`
  - `shared/navigation.ts`
- `public/fonts/provenance.json` es el manifiesto único de fuentes. Lo usan los Workers, la precarga de `index.html`, las pruebas y `check:pwa`. Ver [procedencia](font-provenance.md).
- Componentes base:
  - `PageHeading`
  - `SegmentedControl`
  - `Icon`
  - `BrandMark`
  - `ResidueReader`

## Contratos visuales que requieren cuidado

| Mecanismo | Mantener y verificar si se modifica |
|---|---|
| Editor superpuesto | Misma fuente, tamaño, relleno, borde, interlineado y scroll en el textarea y el resaltado. El resaltado sigue el alto del textarea si se redimensiona |
| FASTA virtualizado | Filas de 44 px medidas tras `document.fonts.ready` |
| Lector de residuos | Bloques por línea medidos con `ResizeObserver`. Solo se pintan las líneas cercanas al viewport |
| Bloques de alineamiento | Altura de 112 px y virtualización. El visor se ajusta al contenido hasta su máximo |
| Canvas de hidropatía | Colores desde tokens en el hilo principal; dibujo en Worker con la fuente del manifiesto. Los extremos del eje Y y las posiciones inicial y final van rotulados |
| Estados desactualizados | El canvas pasa a escala de grises y el texto a color secundario. Nunca opacidad que rompa AA |

## Comprobación de cambios visuales

Revisar cada pantalla afectada a 360 y 1280 px, en claro y oscuro, con estados reales:
- vacío;
- cálculo;
- resultado;
- inválido;
- desactualizado;
- error.

Comprobar también foco, teclado, contraste y desbordamiento. La evidencia del rediseño está en `docs/PROGRESS.md`. Las pruebas de geometría, accesibilidad e integridad de fuentes conservan sus umbrales.
