# Diseño visual vigente

Actualizado el 8 de octubre de 2026. La dirección es **la forja**: la proteína es el material y la interfaz es el banco donde se trabaja. El contenido de dominio sigue siendo la secuencia y sus cifras, pero ahora la página lo muestra desde el primer segundo con datos reales calculados en el navegador, no con decoración.

## Referencias del dominio

| Herramienta | Patrón adoptado |
|---|---|
| [ProtParam y ProtScale](https://web.expasy.org/protparam/protparam-doc.html) (Expasy) | Un solo paso de entrada; cada cifra con su método. Perfil por ventana centrada (9 para superficie y 19 para transmembrana) |
| [UniProt, componente `Sequence`](https://github.com/ebi-uniprot/franklin-sites) | Secuencia en bloques de 10 con la numeración de cada bloque, en monoespaciada |
| [Nightingale y ProtVista](https://github.com/ebi-webcomponents/nightingale) (EBI) y [RCSB Saguaro](https://www.rcsb.org/docs/sequence-viewers/sequence-annotations-viewer) | Pistas por residuo con resaltado sincronizado entre vistas |
| [EMBOSS Needle y Water](https://emboss.sourceforge.net/docs/themes/AlignFormats.html) | Resumen de identidad, similitud, huecos y puntuación como n/longitud (%); marcas `\|` y `:` |
| [Jalview](https://www.jalview.org/help/html/menus/alwformat.html) | Regla y posiciones junto a las filas alineadas |
| Pauling y Corey (1951) | Hélice α ideal: 3,6 residuos por vuelta, 1,5 Å de avance, 2,3 Å de radio Cα y puentes i → i+4. Se dibuja como geometría de referencia, nunca como estructura experimental |

## Decisiones

- **Firma de la página: la cadena viva.** El héroe de Inicio dibuja el perfil Kyte–Doolittle de la insulina humana (P01308, ventana 9) calculado al abrir la página con `calculateProfile`. Cada residuo es una cuenta sobre su valor: ámbar si es hidrofóbico y cian si es hidrofílico. La curva se traza, las cuentas aparecen en orden y una banda recorre la cadena como el cursor del lector. La misma cadena, compacta, acompaña las pantallas de acceso.
- **Segunda escena: la hélice.** La sección de criterio muestra una hélice α ideal en un lienzo 2D con proyección 3D (rotación lenta, profundidad por tamaño y opacidad, puentes de hidrógeno punteados). Su pie de figura dice que es geometría de referencia.
- **Color.**
  - Fondo frío: `#f4f6fb` en claro, `#0b0e17` en oscuro; superficies elevadas blancas o `#121626`.
  - Tinta: `#121826` / `#eef1f8`. Secundario `#4f576b` / `#a6aec2`.
  - Un único color de acción y selección: índigo `#4338ca` en claro y `#a5b4fc` en oscuro.
  - Colores de cadena reservados a residuos: ámbar `#d97706` / `#fbbf24` para hidrofóbicos y cian `#0e7490` / `#67e8f9` para hidrofílicos. No se usan en controles.
  - Estados: error `#b3261e` / `#ff8f86` y éxito `#1b6b3a` / `#86efac`, cada uno con su fondo tenue.
  - La curva del perfil de Analizar sigue en tinta.
- **Tipografía.**
  - [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) 400/600 para la interfaz, con titulares de hasta 3,75 rem, interlineado 1,05 y seguimiento −0,02 em.
  - IBM Plex Mono 400 para residuos, cifras de entrada, sobretítulos en versalitas espaciadas e insignias de estado.
  - Escala: 12, 14, 16, 18, 22, 32 px y titular fluido; 26 px para el título en móvil.
- **Superficies.** Tarjetas con borde fino, radio de 1 rem y sombra suave; barra superior en píldora con desenfoque; las tarjetas previstas no tienen relleno ni sombra para que la jerarquía diga lo que está listo.
- **Navegación.** Escritorio: barra superior flotante con Inicio · Analizar · Alinear · Ajustes, cambio de tema y Acceder (o el correo de la sesión). Móvil: el mismo `nav` como barra inferior con icono y texto.
- **Movimiento.** Entradas de página y de tarjetas con elevación de 18 px y escalonado de 70 ms; trazo del perfil en 1,6 s; barra ambiental de 6 s; hélice a 0,08 vueltas por segundo que se detiene fuera de pantalla. Con movimiento reducido todas las duraciones pasan a 0 ms, la banda desaparece y la hélice queda fija.
- **Lenguaje.** Los estados se dicen con palabras («desactualizados», «En preparación», «Previsto»). Ningún texto afirma plegamiento, función ni novedad.
- **Imágenes.** No se usan fotografías ni estructuras aplanadas. Las dos escenas se generan a partir de datos y geometría publicados.

## Fuentes de verdad

- `src/design-tokens.css` contiene los tokens semánticos (`--bg-*`, `--text-*`, `--accent-brand`, `--chain-*`, `--status-*`, espaciado, radios, duraciones y medidas). Cada color tiene una pareja `--dark-`.
- `src/index.css` contiene el marco, los controles, las pantallas y las `@keyframes`. Ningún componente define colores ni medidas.
- Las opciones y los valores ajustables están en la configuración de cada característica:
  - `features/*/config.ts` (incluidos `landing` y `auth`)
  - `preferences/config.ts`
  - `i18n/config.ts`
  - `shared/navigation.ts`
- `public/fonts/provenance.json` es el manifiesto único de fuentes. Ver [procedencia](font-provenance.md).
- Componentes base: `PageHeading`, `SegmentedControl`, `Icon`, `BrandMark`, `ResidueReader`, `HeroChain`, `HelixScene`, `TextField` y `PasswordField`.

## Contratos visuales que requieren cuidado

| Mecanismo | Mantener y verificar si se modifica |
|---|---|
| Editor superpuesto | Misma fuente, tamaño, relleno, borde, interlineado y scroll en el textarea y el resaltado |
| FASTA virtualizado | Filas de 44 px medidas tras `document.fonts.ready` |
| Lector de residuos | Bloques por línea medidos con `ResizeObserver`; solo se pintan las líneas cercanas |
| Bloques de alineamiento | Altura de 112 px y virtualización |
| Canvas de hidropatía | Colores desde tokens en el hilo principal; dibujo en Worker con la fuente del manifiesto |
| Cadena del héroe | Posiciones calculadas por `buildChainLayout`; `pathLength` 1 para el trazo; `--i`/`--n` para el escalonado |
| Hélice | Perspectiva en ångström, no en píxeles; repintado al cambiar el tema; pausa fuera del viewport |
| Estados desactualizados | Escala de grises y texto secundario; nunca opacidad que rompa AA |
| Secciones reveladas | `.reveal` oculta hasta `is-visible`; los E2E recorren la página antes de la captura |

## Comprobación de cambios visuales

Revisar cada pantalla afectada a 360 y 1280 px, en claro y oscuro, con estados reales (vacío, cálculo, resultado, inválido, desactualizado, error, acceso sin configurar). Comprobar foco, teclado, contraste, desbordamiento y movimiento reducido. Las pruebas de contraste de `chartStyle.test.ts` exigen AA a los tokens; las geométricas y de fuentes conservan sus umbrales.
