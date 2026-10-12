# Verificación de S3 y base de interfaz

Cierre local: 6 de octubre de 2026, rama `sprint-3/alineamiento`. El código está en commits atómicos; no se hizo push ni fusión. `docs/definicion-proyecto.md` permanece sin cambios.

## Entregable y criterios

| Criterio | Estado | Evidencia o límite |
|---|---|---|
| RF-02: alfabeto ampliado | Cumplido según decisión aprobada | U/O/B/Z/X aceptados con aviso; se quita únicamente el `*` final. Los descriptores excluyen esos residuos con conteo y las ventanas que los contienen conservan posiciones y muestran «sin dato». |
| RF-06: alineamiento global y local | Cumplido según decisión aprobada | Gotoh, BLOSUM45/62/80, apertura 10, extensión 0,5 y extremos globales gratuitos. Fixtures de Biopython 1.87, incluido un caso donde cobrar extremos cambia la puntuación. Las penalizaciones son fijas por la convención aprobada. |
| RF-07: resultado comprensible | Cumplido | Identidad y similitud en texto, marcas `|`/`:`, resaltado y bloques de 60 columnas virtualizados. Desplazamiento por teclado verificado a 360 px. |
| RF-16: reproducibilidad | Cumplido para el resultado de S3; persistencia pendiente S6 | El resultado conserva matriz, modo, apertura, extensión y extremos. Guardarlo en un proyecto requiere la persistencia de S6. |
| HU-05: 2.000 residuos, progreso e interfaz utilizable | Cumplido en el equipo local | Máximo 370,58 ms desde clic hasta resultado visible; E2E de progreso y cancelación. |
| RNF-02: equipo de gama media de cuatro núcleos | No verificable con este equipo | Chrome expone 16 hilos lógicos. Falta repetir en el equipo requerido. |
| RNF-08: AA | Verificación automatizada cumplida; auditoría manual pendiente | Axe sin infracciones WCAG 2.1 A/AA en editor, ajustes y alineamiento, con ambos temas; pruebas de contraste de tokens, foco y zonas táctiles de 44 × 44 px. No sustituye lector de pantalla ni auditoría manual completa. |
| RNF-09: compatibilidad | Parcial | Chrome 154 local. Faltan las dos últimas versiones de Chrome, Firefox, Edge y Safari. |
| RNF-10: calidad y cobertura | Cumplido | 93 pruebas en 27 archivos; cobertura global: 92,92 % sentencias, 77,39 % ramas, 91,61 % funciones y 95,41 % líneas. |
| Compilación inicial de Rust | Cumplido | wasm-pack genera el módulo; una comprobación JavaScript lo inicializa y llama a su exportación. El portado del algoritmo corresponde a S4. |
| Base PWA | Cumplido localmente | Build con manifiesto y service worker, 12 recursos en precaché; navegación a `/alignment` y cálculo sin conexión con aislamiento conservado. HU-09 completo requiere también sincronización posterior. |
| E2E de S3 | Cumplido localmente | Recorrido 1 con pegado real desde portapapeles y validación/descriptores/canvas; recorrido 3 con progreso y cancelación. CI configurada, aún sin ejecución remota de estos commits. |

## Mediciones de alineamiento

Medidas el 5 de octubre de 2026 sobre el commit `7937331`, Windows y Chrome 154 en modo headless, `crossOriginIsolated = true`, 16 hilos lógicos declarados por el navegador. Tres repeticiones por tamaño, BLOSUM62 y modo global. La secuencia se construyó repitiendo los veinte residuos estándar.

El núcleo secuencial se midió dentro de un Worker con `performance.now()`. La segunda secuencia cambia el residuo central por X. La medición de interfaz usa dos secuencias iguales y abarca desde el evento `click` hasta dos `requestAnimationFrame` después de aparecer el resultado. Ambas series miden recorridos distintos y no deben compararse como una aceleración exacta.

| Residuos por secuencia | Núcleo secuencial: tres tiempos (ms) | Mediana (ms) | Traza exacta (bytes) | Traza + seis filas Float32 (bytes) |
|---|---|---|---|---|
| 2.000 | 623,09; 500,29; 476,76 | 500,29 | 4.004.001 | 4.052.025 |
| 5.000 | 2.196,60; 2.213,16; 2.264,35 | 2.213,16 | 25.010.001 | 25.130.025 |
| 10.000 | 7.182,87; 7.107,47; 7.303,04 | 7.182,87 | 100.020.001 | 100.260.025 |

| Residuos por secuencia | Worker por bloques hasta resultado visible: tres tiempos (ms) | Mediana (ms) | Máximo (ms) |
|---|---|---|---|
| 2.000 | 370,58; 281,64; 268,62 | 281,64 | 370,58 |
| 5.000 | 681,85; 613,73; 614,22 | 614,22 | 681,85 |
| 10.000 | Fuera del límite de la interfaz | — | — |

La traza almacena un byte por celda. El total de seis filas corresponde al núcleo secuencial de referencia; el frente de onda añade fronteras de bloques, memoria temporal de los hilos y objetos del resultado. Estas cifras no son una medición del pico de memoria de todo el navegador. El límite de 5.000 reduce la traza a una cuarta parte de la necesaria para 10.000 y evita el caso secuencial de más de siete segundos. La interfaz explica el límite antes de reservar la matriz.

## Renombrados principales

El renombrado de símbolos y referencias utilizó el servicio de lenguaje de TypeScript. Los selectores CSS, textos de pruebas y comentarios se editaron de forma contextual.

| Antes | Después |
|---|---|
| `src/features/descriptores/` | `src/features/descriptors/` |
| `src/features/alineamiento/` | `src/features/alignment/` |
| `CargadorFasta` / `archivoFasta.ts` / `alturaFila.ts` | `FastaLoader` / `fastaFile.ts` / `rowHeight.ts` |
| `PanelDescriptores` / `PerfilHidrofobicidad` | `DescriptorPanel` / `HydropathyProfile` |
| `calcularDescriptores` / `calcularPerfil` | `calculateDescriptors` / `calculateProfile` |
| `ResultadoAlineamiento` / `ParametrosAlineamiento` | `AlignmentResult` / `AlignmentParameters` |
| `alinearSecuencias` / `alinearPorBloques` | `alignSequences` / `alignInTiles` |
| `editor-capa` / `residuo-invalido` / `tabla-perfil-contenedor` | `editor-layer` / `invalid-residue` / `profile-table-container` |
| Rutas previstas `/alineamiento`, `/privacidad`, `/proyectos` | `/alignment`, `/privacy`, `/projects` |

Los tokens CSS ya tenían nombres en inglés; se conservaron. La búsqueda final por AST comprobó 297 nombres originales en `src/`, sin coincidencias restantes. La búsqueda de nombres de archivos, exports, clases CSS y rutas no encontró los nombres españoles revisados. Las rutas implementadas son `/`, `/alignment` y `/settings`; las futuras están en `docs/pantallas.md`. Los textos españoles del catálogo, las aserciones sobre textos de interfaz y los documentos de `docs/` son intencionales.

## Interfaz, capturas y preferencias

La traducción propia añade cero dependencias de idioma, mantiene claves tipadas y permite usar el mismo catálogo fuera de React. La prueba estática rechaza texto JSX, atributos visibles y variables con literales visibles sin traducción; TypeScript rechaza claves ausentes y la prueba comprueba que ninguna entrada española esté vacía. El inglés está marcado como pendiente para S7. Se verificó persistencia tras recarga y funcionamiento cuando `localStorage` falla.

Los recorridos de editor y ajustes se comprobaron en 360, 768, 1280 y 1440 px, con ambos temas, sin desplazamiento horizontal del cuerpo. Las tablas y bloques extensos conservan su desplazamiento propio. Las capturas locales, no versionadas, se regeneran con `npm run test:e2e`:

| Tema | 360 px | 1280 px |
|---|---|---|
| Claro | `artifacts/light-360.png` | `artifacts/light-1280.png` |
| Oscuro | `artifacts/dark-360.png` | `artifacts/dark-1280.png` |

## Cabeceras efectivas en producción

El 5 de octubre, `curl -I https://protein-forge.vercel.app` respondió `200 OK`:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co https://models.rcsb.org;
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

La evaluación en Chrome devolvió `crossOriginIsolated: true`; el editor mostró la tabla tras introducir una secuencia y no hubo errores de página. Esta comprobación corresponde a la producción de `main`, anterior a publicar S3. La vista previa protegida por SSO se sustituyó por la URL pública por decisión del usuario.

## Comandos y salida de verificación

```text
npm run lint                  exit 0, sin errores
npm run typecheck             exit 0
npm run test:coverage         27 passed; 93 passed
npm run test:e2e              8 passed
npm run build                 built; PWA precache 12 entries
npm run build:wasm            wasm pkg generated successfully
npm run check:wasm            WebAssembly module initialized successfully.
npm run check:pwa             Offline navigation, alignment workers, and cross-origin isolation verified.
cargo fmt --manifest-path rust/alignment/Cargo.toml --check   exit 0
cargo test --manifest-path rust/alignment/Cargo.toml --locked exit 0; módulo inicial sin pruebas de algoritmo Rust
npm audit                    0 vulnerabilities tras actualizar source-map-js a 1.2.2
```

La descarga del Chromium empaquetado agotó el tiempo de espera del CDN; las comprobaciones locales usaron Chrome instalado. CI instala Chromium y corre los recorridos, pero su ejecución remota requiere publicar la rama. Vite 8 avisa de imports sin extensión para un futuro cambio a `configLoader: native`; el build actual funciona. El aviso deberá revisarse al actualizar Vite. Siguen pendientes el equipo de cuatro núcleos, la auditoría manual de accesibilidad, los otros navegadores, INP/LCP y la verificación del despliegue de S3 tras publicar.
