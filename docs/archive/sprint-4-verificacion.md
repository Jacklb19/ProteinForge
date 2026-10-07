# Sprint 4 — núcleo de alineamiento WebAssembly

## Implementación

RF-06 y RF-07: el cálculo de cada bloque Gotoh pasa a Rust/WASM tanto en el Worker coordinador sin memoria compartida como en los Workers paralelos. Se mantienen BLOSUM45/62/80, huecos afines 10/0,5, extremos globales gratuitos, desempates, métricas y reconstrucción de la traza. El planificador por antidiagonales y la cancelación permanecen en TypeScript. El núcleo TypeScript se conserva como referencia de pruebas y comparación.

Cada Worker inicializa una instancia privada de WASM. Rust recibe los residuos del bloque, la matriz y sus bordes; devuelve los bordes, el mejor punto y una traza compacta. El adaptador copia únicamente las celdas del bloque a la traza compartida. Las tareas de una antidiagonal escriben regiones disjuntas y la siguiente espera a todas las anteriores. No se comparte la memoria lineal de WASM ni se añade cómputo al hilo principal.

Se libera cada resultado Rust después de copiarlo. La frontera WASM valida dimensiones, índices y valores numéricos. Los fallos de carga o cálculo llegan al manejo de errores existente. No hay dependencias nuevas ni cambios visuales.

El paquete de `rust/alignment/pkg/` se genera con `npm run build:wasm`; se elimina su `.gitignore` generado antes del commit. El workflow `wasm.yml` reconstruye el paquete y comprueba diferencias y archivos nuevos. El binario mide 21.969 bytes. Reconstrucción local idéntica, SHA-256 `08093f10071af938a0025aef98733ef5712ad4ac9f0da257c42968a16be864ae`. La comprobación remota en Linux sigue pendiente.

## Comparación reproducible

Ejecutar `node scripts/benchmark-alignment.mjs`. Genera `artifacts/alignment-benchmark.json` sin versionarlo. Usa Chrome local en Windows (154), 16 procesadores lógicos informados, sin limitación artificial. Ambos núcleos recorren las mismas antidiagonales en un único Worker, BLOSUM62/global, secuencias periódicas de veinte residuos con una sustitución X central. Hay calentamiento de 256 residuos y tres repeticiones por tamaño. Se exige igualdad del resultado completo en cada repetición.

Se mide recorrido, cálculo, copia de bordes/traza y reconstrucción; quedan fuera la inicialización de WASM (9,145 ms), la creación del Worker y la reserva inicial de la traza. Esta comparación aísla los núcleos; no representa latencia de interfaz ni el rendimiento de un equipo de cuatro núcleos. La prueba E2E adicional ejercita la ruta paralela real de 2.000 residuos.

| Residuos por secuencia | TypeScript, ms (3 repeticiones) | WASM, ms (3 repeticiones) | Mejora de medianas | Traza, bytes |
|---|---|---|---|---|
| 2.000 | 218,895 / 175,205 / 173,235 | 72,770 / 77,390 / 78,645 | 2,26× | 4.004.001 |
| 5.000 | 1.039,115 / 1.192,735 / 1.060,990 | 461,605 / 487,895 / 440,090 | 2,30× | 25.010.001 |
| 10.000 | 4.318,355 / 4.777,680 / 5.134,795 | 1.778,760 / 2.102,840 / 1.416,980 | 2,69× | 100.020.001 |

Se conserva el límite público de 5.000: el incremento a 10.000 cuadruplica la traza y no hay evidencia en hardware modesto. Solo el instrumento de medición recorre 10.000, sin ampliar el límite de la aplicación.

## Verificación y límites

- Referencias Biopython existentes: puntuación y ambas secuencias alineadas.
- Comparación WASM/TypeScript de cada borde, mejor punto y byte de traza en bloques completos/parciales, ambas modalidades y las tres matrices.
- Rechazo de entradas malformadas, cancelación y coordinación con/sin memoria compartida.
- RNF-10: cobertura V8 del código TypeScript; no mide cobertura interna de Rust. El binario WASM real se ejecuta en las pruebas de integración.
- RNF-01: el núcleo continúa fuera del hilo principal; INP p75 y auditoría de tareas largas no se han medido en este sprint.
- RNF-02: falta certificar el objetivo en un equipo de gama media de cuatro núcleos.
- CI remoto, despliegue, Safari, Firefox, Edge y dispositivos físicos no verificados. Se mantienen como pendientes, sin atribuirles resultados de Chrome local.

### Salida local del 6 de octubre de 2026

- `npm run lint` y `npm run typecheck`: sin errores.
- `npm run test:coverage`: `Test Files 29 passed (29)`, `Tests 108 passed (108)`; sentencias 92,96 %, ramas 78,72 %, funciones 91,30 %, líneas 95,26 %. Alineamiento TypeScript: 94,38 % de sentencias.
- `npm run build`: `built in 573ms`, WASM 21,96 kB, `precache 16 entries (710.55 KiB)`.
- `node scripts/run-e2e.mjs e2e/alignment.spec.ts`: `3 passed (26.2s)`; progreso, cancelación, métricas, límites, accesibilidad y tamaños 360/1280 en ambos temas.
- `node scripts/run-e2e.mjs e2e/wasm.spec.ts`: `2 passed (10.0s)`; descarga efectiva del binario, resultado paralelo de 2.000 residuos en 699 ms incluyendo clic/espera de interfaz y fallo de descarga sin resultado ficticio.
- `node scripts/check-pwa.mjs`, con `PWA_CHECK_PORT=4175`: `Offline navigation, alignment workers, and cross-origin isolation verified.` También pasó la comprobación previa de fuentes e icono. El puerto es configurable porque 4173 ya estaba ocupado; no se detuvo ese servidor.
- `cargo fmt --manifest-path rust/alignment/Cargo.toml --check`, `wasm-pack build rust/alignment --target web --out-dir pkg` y `node scripts/verify-wasm.mjs`: correctos; reconstrucción binaria idéntica.

Los primeros intentos restringidos fallaron por permisos de temporales/Workers y acceso a localhost; se repitieron fuera del sandbox. La primera comparación byte a byte agotó el tiempo de prueba con la igualdad profunda de Vitest; se sustituyó por comparación binaria nativa, conservando todos los bytes y casos. El aviso previo de Vite sobre su futuro cargador nativo permanece. No se repitieron E2E de pantallas ajenas al cambio.
