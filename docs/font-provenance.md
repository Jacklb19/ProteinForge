# Procedencia de fuentes

Todas las fuentes son autoalojadas en `public/fonts/` y están bajo la licencia SIL OFL 1.1. `public/fonts/provenance.json` es el manifiesto único. Indica para cada archivo su familia, peso, función (`interface` o `sequence`), si se precarga, su tamaño y su SHA-256. Leen el manifiesto:

- el Worker de la gráfica, que registra su propia fuente;
- `vite.config.ts`, que genera los `preload` de `index.html`;
- las pruebas de integridad;
- los E2E;
- `check:pwa`.

| Archivo | Familia y peso | Bytes | SHA-256 | Origen |
|---|---|---:|---|---|
| bricolage-semibold.woff2 | Bricolage Grotesque 600 | 22456 | b34fc8c1ef0ac8798455ac2979eae4b4f90f0d327e3584d1032fa77a8a9a66ca | `@fontsource/bricolage-grotesque` 5.3.0, subconjunto latin |
| atkinson-next-regular.woff2 | Atkinson Hyperlegible Next 400 | 12096 | 5cb240a4d99ab7e6fc3a4d4e6d11d89789fdffe9c86a8384000d662c53283f6f | `@fontsource/atkinson-hyperlegible-next` 5.3.0, subconjunto latin |
| atkinson-next-semibold.woff2 | Atkinson Hyperlegible Next 600 | 12672 | 828f4525c741b6864718e41aa23a4acbc049b35e6271317c0fd86e0702dd5d2e | Ídem |
| plex-mono-regular.woff2 | IBM Plex Mono 400 | 14708 | 08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7 | `@fontsource/ibm-plex-mono` 5.3.0, subconjunto latin |

Los archivos de Atkinson se copiaron sin modificar del paquete npm (`files/atkinson-hyperlegible-next-latin-{400,600}-normal.woff2`) y solo se cambió su nombre. No se añadió ninguna dependencia de ejecución. Proyecto original: <https://github.com/googlefonts/atkinson-hyperlegible-next>. Licencias completas en `OFL-atkinson-hyperlegible-next.txt` y `OFL-ibm-plex.txt`.

## Por qué estas familias

- **Atkinson Hyperlegible Next.** Lo publicó el Braille Institute para maximizar la distinción entre caracteres (I/l/1, O/0). En esta aplicación importa porque I, L y O son códigos de aminoácido que aparecen en textos, tablas y lecturas. El subconjunto latin cubre el español y tiene la característica `tnum`: los valores usan `font-variant-numeric: tabular-nums` para alinear cifras.
- **IBM Plex Mono.** Se conserva solo para residuos en columna: editor, lector y bloques de alineamiento. Su geometría ya estaba verificada con el editor superpuesto.

### Subconjunto publicado de Plex Mono (28 oct 2026)

El archivo pasa de 49.248 a 14.708 bytes, 34.540 menos, sin generar aquí ningún subconjunto. La licencia OFL de Plex reserva «Plex» como nombre para versiones modificadas, así que el archivo se copia **sin modificar** del paquete publicado `@fontsource/ibm-plex-mono` 5.3.0, igual que ya se hace con Atkinson y Bricolage; solo se cambia su nombre de archivo.

- **Origen:** `https://registry.npmjs.org/@fontsource/ibm-plex-mono/-/ibm-plex-mono-5.3.0.tgz`, cuyo `shasum` publicado en el registro, `1879699d104602d5331e28e103f33c3b1b766b17`, coincide con el del paquete descargado. SHA-256 del paquete: `60d3c0cfa549cb06fcb8867ee83f994d78e212abfac3bef3275436acb5c4d029`. Archivo tomado: `files/ibm-plex-mono-latin-400-normal.woff2`.
- **Licencia:** el paquete incluye su propio `LICENSE`, que es la SIL Open Font License 1.1, la misma que ya guarda `OFL-ibm-plex.txt`. No se añade ninguna dependencia de ejecución.
- **Cobertura:** el subconjunto `latin` declara `U+0000-00FF` más puntuación general, `U+20AC`, `U+2122`, `U+2191`, `U+2193`, `U+2212` y `U+2215`. Cubre los códigos de aminoácido, las cifras, los accesos de UniProt y los acentos del español (`á é í ó ú ñ ü ¿ ¡`), que es todo lo que usa el token `--font-sequence`. Quedan fuera el cirílico, el vietnamita, el latín extendido y el dibujo de cajas, que esta interfaz no escribe.
- **Si faltara un glifo** se dibuja con el respaldo monoespaciado de métricas ajustadas, sin desplazamiento.

## Respaldos y comprobaciones

`src/fonts.css` declara respaldos locales ajustados:

- **Atkinson sobre Arial.** `size-adjust` del 98,9 %, calculado con fontTools a partir de los avances de texto corrido en español. Las métricas verticales salen de las tablas OS/2: ascendente 984 y descendente 316 sobre 1000.
- **Plex Mono.** Mantiene los respaldos Consolas y Courier New medidos anteriormente, que conservan el ajuste de líneas durante el intercambio.

Se precargan Bricolage 600 y Atkinson 400, las fuentes del primer texto visible. Plex Mono 400 ya no se precarga (27 oct 2026): sus 49 KB de entonces competían con el JavaScript inicial y retrasaban el LCP unos 210 ms con 4G lenta; se descarga al aparecer la primera cifra o secuencia, mientras su respaldo de métricas ajustadas evita desplazamientos (CLS medido ≈ 0). Todas las fuentes usan `font-display: swap` y `font-synthesis: none`, y los cuatro WOFF2 están en la precaché de Workbox.

Pruebas que cubren las fuentes:

- `src/test/fonts.test.ts` verifica:
  - la cabecera WOFF2, el tamaño y el SHA-256;
  - las licencias;
  - que `fonts.css` declare exactamente los archivos del manifiesto;
  - que los tokens tipográficos usen sus familias.
- El E2E del editor comprueba que las cifras de la interfaz sean tabulares en 400 y 600, y que el Worker mida igual que el documento.
- `check:pwa` verifica la caché, la respuesta binaria y la carga de cada fuente sin conexión, así como la fuente del Worker.
- **Bricolage Grotesque.** Titulares y marca del diseño Figma aprobado, peso 600 y ejes predeterminados de anchura 100/óptica 14. Copiada sin modificar desde el paquete fijado de Fontsource, con su licencia `OFL-bricolage-grotesque.txt`. Función `display` en el manifiesto; no sustituye la fuente del editor ni del Worker de la gráfica.
