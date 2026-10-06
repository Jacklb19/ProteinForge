# IBM Plex

Fuentes oficiales autoalojadas. IBM Plex Sans 1.1.0, revisión inmutable del repositorio IBM/Plex: `763c36ef9117782905ae010056dfbe8fd2653a25`.

Procedencia: https://github.com/IBM/plex/tree/763c36ef9117782905ae010056dfbe8fd2653a25

Sans: `packages/plex-sans/fonts/complete/woff2/`. Mono: `packages/plex-mono/fonts/complete/woff2/`. Los archivos conservan el contenido original; solo cambia su nombre de archivo. Licencia SIL OFL 1.1 completa en `OFL.txt`.

| Archivo | Peso | Bytes | SHA-256 |
|---|---:|---:|---|
| plex-sans-regular.woff2 | 400 | 63020 | ba711a3085ff9f27440b6b9c4550cfc47c97bf36591d5da958b975bb3add8c1a |
| plex-sans-semibold.woff2 | 600 | 67060 | f78048030eab62e860efa39a0df79e2e5581bf122eb95b9bc42c0b8a4988d205 |
| plex-sans-bold.woff2 | 700 | 63012 | fa7130d854a660b39a7fc9e6e0f2dc23dba5f1346e2adea3e1fe37b6d884133d |
| plex-mono-regular.woff2 | 400 | 49248 | ba204497f16b6d334cee9d1e963a831b73e3a56e1d6300a8489d18df7214b350 |

Solo se precargan Sans 400 (lectura) y Mono 400 (editor). Sans 600 se usa en títulos y acciones; 700 en etiquetas. Mono no usa negrita. `font-synthesis: none` impide pesos artificiales. Todos usan `font-display: swap`; los cuatro WOFF2 se incluyen en la precaché de Workbox.

`src/fonts.css` declara respaldos locales con `size-adjust` y métricas verticales. Los descriptores de `@font-face` exigen valores constantes y no resuelven variables del documento. Las familias consumidas por los componentes sí son tokens. Medición en Chrome/Windows a 100 px: Sans 400 mide 1270,10 px para `ACDEFGHIKLMNPQRSTVWY`, Arial 1366,80 px (ajuste 92,93 %); Mono mide 1200 px, Consolas 1099,61 px (109,13 %), Courier New 1200,20 px (99,984 %). El interlineado explícito limita cambios de altura; la anchura proporcional de otros textos puede variar durante el intercambio. En plataformas sin esos respaldos locales se usa la familia genérica hasta completar la carga.

Los diez dígitos de Sans 400 y Mono 400 midieron 60 px cada uno a 100 px. Los datos usan `font-variant-numeric: tabular-nums`; E2E comprueba los tres pesos Sans. Las pruebas de integridad verifican tamaño, cabecera WOFF2 y SHA-256. `check:pwa` verifica caché, respuesta binaria y carga de las fuentes después de recargar sin red.
