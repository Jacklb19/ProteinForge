# Calidad y rendimiento

Metodología de medición, resultados y límites de las comprobaciones de calidad del frontend. Las cifras proceden de mediciones locales con `vite preview`; no certifican producción, hardware físico ni dispositivos reales.

## Comprobaciones automáticas

| Comprobación | Qué cubre |
|---|---|
| `npm run typecheck` | `tsc` estricto con `noUncheckedIndexedAccess`, `noUnusedLocals` y `noUnusedParameters` |
| `npm run lint` | ESLint con `typescript-eslint` y las reglas de hooks de React |
| `npm run test:coverage` | Vitest con cobertura V8; mínimo del 70 % (V8 no mide el código interno de Rust) |
| `npm run build` | Comprobación de tipos y build de producción con PWA |
| `npm run check:pwa` | Caché real del build: recursos, fuentes, Workers, WASM, laboratorio, cuaderno y PDF sin conexión |
| `npm run test:e2e` | Playwright: recorridos críticos con Auth y RPC simulados; `E2E_BROWSER` admite `chromium`, `firefox` y `webkit` |
| `cargo test` y `npm run check:wasm` | Núcleo Rust y reconstrucción reproducible del paquete WASM |

CI ejecuta todas ellas, además de `npm audit --omit=dev` y la comprobación de que el código generado (`src/gen/`) coincide con el contrato del backend.

**Compatibilidad.** Se verifican Chromium, Firefox y WebKit en Windows. Chrome y Edge comparten motor y no cuentan como dos motores distintos. Safari en dispositivo real y los lectores de pantalla no están cubiertos: son un límite conocido. La batería E2E general bloquea los Service Workers para aislar los servicios simulados; `check:pwa` verifica la caché real por separado.

**Accesibilidad.** Axe (`@axe-core/playwright`, reglas WCAG A/AA) se ejecuta dentro de los E2E, con revisión de teclado, foco, desbordamiento y objetivos de 44 px a 360 y 1280 px, en claro y oscuro y en español e inglés. La prueba de movimiento reducido admite `0s` y `0ms` como duraciones nulas equivalentes. El PDF exportado no está etiquetado para lectores de pantalla; JSON, CSV y la interfaz son alternativas. Axe y las capturas no sustituyen una auditoría manual con lector de pantalla.

## Método de rendimiento

- `scripts/audit-performance.mjs` abre el build con `vite preview`, un navegador aislado y varias muestras por ruta y perfil, y guarda las muestras crudas en `artifacts/quality/`. Cada carga fría usa un contexto nuevo de 360 × 900 con movimiento reducido y Service Workers bloqueados. Perfiles: velocidad nativa y CDP con 1,6 Mbit/s de bajada, 750 kbit/s de subida, 150 ms de latencia y CPU ×4. Registra LCP y tareas largas hasta dos segundos después de fuentes y contenido iniciales. Un error de página o una petición externa hacen fallar la ejecución.
- `scripts/measure-lcp.mjs` y `scripts/lcp-stats.mjs` comparan dos builds servidos a la vez, con orden alternado (ABBA) y calibración A/A para medir el ruido del equipo. Informan el p75 con su intervalo, y `lcp-stats.test.mjs` fija la limitación de que con pocas cargas el intervalo de un p75 no tiene cota superior.
- Los tiempos de alineamiento incluyen el clic, el cálculo real de dos secuencias idénticas de 2.000 residuos y el resultado visible, con WASM ya inicializado. Event Timing conserva las interacciones observadas pero no calcula un INP de campo.
- CPU ×4 no convierte un equipo de varios núcleos en hardware certificado de cuatro núcleos, y `vite preview` no representa la CDN ni el TLS de producción.

## Resultados

| Medida | Resultado |
|---|---|
| RNF-02: alineamiento de 2 × 2.000 residuos | Entre 146 y 169 ms (p75 ≈ 149 ms) con WASM inicializado, muy por debajo de los 5 s |
| RNF-01: interacciones sintéticas con CPU ×4 | p75 de unos 48 ms; persisten tareas de más de 50 ms durante la carga inicial |
| RNF-03: LCP de Inicio (4G lenta, CPU ×4) | **Cumple**: p75 entre 2.226 y 2.264 ms en cinco tandas; 220 de 220 cargas por debajo de 2,5 s |
| RNF-03: LCP de Analizar | **No cumple**: p75 entre 2.526 y 2.556 ms; entre el 11 y el 28 % de las cargas queda por debajo del objetivo. El ruido del equipo es de unos 21 ms, así que la diferencia no es ruido: faltan entre 25 y 60 ms |
| Precaché de la PWA | Unos 6 MiB, con el motor de Mol* incluido para que una pestaña abierta durante un despliegue siga cargando el 3D |
| Grafo inicial | 17 archivos y 150.328 bytes comprimidos |

Ninguna medición se presenta como cumplimiento de producción. Una pantalla a 144 Hz influye en las medidas que dependen de la tasa de fotogramas; no se midió a 60 Hz.

## Cambios adoptados y descartados

**Adoptados**

- Subconjunto publicado de IBM Plex Mono, copiado sin modificar de `@fontsource/ibm-plex-mono` (−34.540 bytes por carga en frío). Ver [procedencia de fuentes](font-provenance.md).
- Zod sale del camino de arranque: seis cadenas de importación lo cargaban, los esquemas pasan a archivos propios y `storedSession`, escrita a mano con paridad probada en 31 casos, cubre el único punto que corre antes del primer render. Tiempo propio atribuible de Inicio con CPU ×4: de 477 a 334 ms. No se afirma una mejora del LCP, porque el ruido del equipo supera ese margen.
- `BackboneView` pinta una vez al montarse en lugar de tres, con la paleta leída una vez por tema y los colores de cada residuo calculados una sola vez. Su CPU propia en Analizar baja de 113 a 60 ms (−49 ms, IC [−66; −43]) y en Inicio 12 ms; una prueba fija los cinco dibujos del lienzo para demostrar que el resultado visible no cambia.
- El giro de reposo de la portada se limita a 30 fotogramas por segundo (`IDLE_FRAMES_PER_SECOND` en `src/features/structure/config.ts`). Sin reducir el movimiento, el giro consumía unos 1,85 s de CPU de cada 4,5 s con CPU ×4; con el límite, 28,8 pintados por segundo a 144 Hz.
- Menú modal móvil: Tab y Mayús+Tab recorren el panel y Escape devuelve el foco al botón. Los clientes de proyectos y del asistente se cargan al iniciar sesión, de modo que una visita anónima no los descarga.
- Cada versión guarda todos sus archivos de código en la precaché y la página recarga una vez si falta uno (`src/shell/staleCode.ts`).

**Descartados o revertidos, con su motivo**

- Separar por rutas el código inicial con precarga: empeoró el LCP de Inicio y Analizar, porque la pantalla de Analizar está en su camino crítico.
- Memorizar `HydropathyProfile`: efecto no medible (+2 ms, IC [−3; +5], con 50 pares).
- `content-visibility` en secciones públicas: riesgo de recortar los anillos de foco.
- INP de campo: exige telemetría de usuarios con consentimiento.
- `formatNumber` y el catálogo español, las dos opciones restantes, no justificaron el cambio.

## Límites

- Una medición local con `vite preview` no representa producción, la CDN ni dispositivos físicos.
- Safari en dispositivo real, lectores de pantalla y el INP de campo quedan fuera.
- La carga de la API a 100 peticiones por minuto (RNF-04) se prueba en local contra el backend, nunca contra Groq ni proveedores compartidos.

## Repetir las mediciones

```bash
npm run build
node scripts/audit-performance.mjs
node scripts/measure-lcp.mjs pairs     # requiere dos builds en artifacts/lcp-builds (LCP_A y LCP_B)
npm run check:pwa
```

Las variables de cada script (`AUDIT_ROUTES`, `AUDIT_SAMPLES`, `LCP_ROUNDS` y otras) se leen al comienzo de `scripts/audit-performance.mjs` y `scripts/measure-lcp.mjs`, con sus valores por defecto.
