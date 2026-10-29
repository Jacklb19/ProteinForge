# Rendimiento, WebKit sin conexión y accesibilidad — 27 oct 2026

Mediciones sobre el producto rediseñado (sitio público + laboratorio), rama `parallel/performance` creada desde `dev` `92e81a3`. Cada mejora se adoptó solo con una medición anterior y posterior en las mismas condiciones; dos ensayos que no mejoraron se descartaron y se documentan. No se cambiaron la composición aprobada, las capacidades, los algoritmos científicos, los contratos ni el backend.

## Método

- **Build de producción** sin Auth configurada, como CI: `CI=true`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` vacías, `npm run build`. Servido con `vite preview` en `127.0.0.1:5310`, sin CDN ni TLS.
- **Navegador**: Chrome 156.0.8078.48, contexto nuevo por carga, Service Workers bloqueados, caché vacía, movimiento del sistema sin reducir.
- **Equipo**: AMD Ryzen 7 8845HS, 16 procesadores lógicos, 16 GB, Windows 10.0.26200. La emulación no lo convierte en un móvil físico.
- **Perfil RNF-03 «4G lenta»** (el móvil de Lighthouse): 150 ms de latencia, 1,6 Mbit/s de bajada, 750 kbit/s de subida y CPU ×4 por CDP, ventana de 360 × 900. También se mide sin limitación como referencia.
- **Muestras**: 7 cargas por ruta y perfil, alternando rutas en cada ronda; se informa la **mediana** y el p75. La comprobación del desplazamiento usó 15 cargas.
- **Medidas por carga**: LCP y su elemento, FCP, CLS con los elementos desplazados, tareas largas (> 50 ms), tiempo de bloqueo (suma de lo que excede 50 ms) y bytes transferidos observados en la página.
- **Interacciones** (`AUDIT_PHASES=interactions`): 5 rondas por perfil (CPU ×4 y sin limitación) en 1280 px, con el menú del móvil a 360 px.
  - Recorridos: pestañas de herramientas del sitio público, Preferencias, cambio de tema, contraer y expandir la barra lateral, las cuatro vistas de Analizar, escribir 20 residuos en el editor, abrir y cerrar el menú del móvil, buscar en el generador, y en el laboratorio elegir posición, variante y vista.
  - Se usa Event Timing con umbral de 16 ms, agrupado por `interactionId`. Una interacción sin entrada cuenta como 16 ms, que es una cota superior.
  - Son interacciones sintéticas de laboratorio, **no INP de campo**.

Script: `scripts/audit-performance.mjs`. Los datos crudos quedan en `artifacts/quality/*-2026-10-27.json`, carpeta ignorada.

## Resultado final

| Ruta, 4G lenta (7 cargas) | LCP mediana (p75), base → final | FCP mediana | Bloqueo mediano | Mayor tarea | CLS máx. final | Bytes observados |
|---|---:|---:|---:|---:|---:|---:|
| Inicio `/` | 2.495 (2.518) → **2.150 (2.153) ms** | 2.495 → 2.150 ms | 207 → 198 ms | 181 → 170 ms | 0,00005 | 322 → 302 kB |
| Analizar `/analyze` | 3.198 (3.209) → **2.449 (2.457) ms** | 2.443 → 2.111 ms | 235 → 222 ms | 181 → 180 ms | 0,007 | 411 → 307 kB |

- **RNF-03 (LCP < 2,5 s con 4G lenta)** se cumple en ambas rutas con estas condiciones: Inicio con 350 ms de margen y Analizar con 43 ms en el p75. Analizar partía 0,7 s por encima.
- El elemento LCP de Inicio es el título `h1`. En Analizar es una cifra de descriptores (`dd`) o, en 3 de 7 cargas, el texto explicativo de una cifra, que ahora se pinta antes; se detalla abajo.
- Sin limitación: Inicio 165 ms y Analizar 192 ms de LCP mediano.
- CLS no se medía en la línea base. Se añadió al encontrar el desplazamiento corregido más abajo.
- Precaché de la PWA: 3.463 → 2.512 KiB.

### Interacciones (RNF-01, INP p75 < 200 ms)

190 interacciones por perfil y ronda completa.

| Perfil | p75 base → final | p98 base → final | Máximo base → final | Tareas > 50 ms durante interacciones |
|---|---:|---:|---:|---:|
| CPU ×4 | 48 → 48 ms | 128 → 120 ms | 392 → 144 ms | 15 → 16 (la mayor, 73 → 68 ms) |
| Sin limitar | 16 → 16 ms | 32 → 32 ms | 96 → 128 ms | 0 → 0 |

Por acción, con CPU ×4 y medición final: todas por debajo de 200 ms en el p75.

| Acción | p75 | Máximo |
|---|---:|---:|
| Cambiar tema | 136 ms | — |
| Abrir Preferencias | 80 ms | 144 ms |
| Elegir posición en el laboratorio | 88 ms | — |
| Vistas de Analizar | 64 ms | 96 ms |
| Barra lateral | 64 ms | — |
| Buscar en el generador | 64 ms | — |
| Abrir el menú | 56 ms | — |
| Escribir en el editor | 32 ms | 48 ms |
| Pestañas públicas | 40 ms | — |

El máximo de 392 ms de la base fue un caso aislado en la vista Estructura que no se repitió; no se atribuye a ningún cambio.

**Tareas < 50 ms: no se cumple con CPU ×4.**

- **Carga**: quedan dos tareas largas en ambas rutas.
  - Unos 135 ms de evaluación del JavaScript inicial.
  - Unos 165 ms del primer render de React.
  - Analizar añade unos 65 ms de efectos.
- **Interacciones**: tareas de 54–68 ms al cambiar el tema (estilos de toda la página y redibujo de lienzos), en las vistas de Analizar, al buscar en el generador y al elegir una posición del laboratorio.
- **Sin limitación** no hay ninguna tarea larga en las interacciones, y en la carga la mayor midió 88 ms en una muestra aislada.

Las propuestas de abajo explican qué haría falta y por qué no se aplicó esta noche.

## Cambios adoptados y su atribución

Cada fila compara la mediana de 7 cargas con 4G lenta con el paso anterior, en el mismo equipo y navegador.

| Paso y commit | Inicio LCP | Analizar LCP | Evidencia |
|---|---:|---:|---|
| Línea base, `92e81a3` | 2.495 ms | 3.198 ms | `baseline-2026-10-27.json` |
| Catálogos fuera de los Workers, `49b3c20` | 2.482 ms (ruido) | **2.763 ms (−435)** | `after-workers-2026-10-27.json` |
| Sin precarga de Plex Mono, `592db8f` | **2.269 ms (−213)** | **2.551 ms (−212)** | `after-fonts-2026-10-27.json` |
| Catálogo inglés bajo demanda, `6c6c26a` | **2.150 ms (−119)** | **2.437 ms (−114)** | `after-catalog-2026-10-27.json` |
| Campos de descriptores reservados, `a2e9427` | — | 2.442 ms (igual); CLS 0,14 → 0,007 | `after-pending-2026-10-27.json` (15 cargas) |
| Medición final, `5e7788b` | 2.150 ms | 2.449 ms | `final-2026-10-27.json` |

1. **Catálogos fuera de los Workers.**
   - **Causa:** las clases de error localizadas traducían su mensaje al construirse. Con eso, cada Worker incluía los catálogos español e inglés: unos 140 kB de cada archivo de unos 145 kB.
   - **Cambio:** `localized.ts` ya no importa catálogos y el mensaje del error es la clave. La traducción para registros y pruebas se registra desde `localize.ts` en el hilo de la interfaz. El Worker del perfil registra la clave de su aviso de fuente.
   - **Tamaño de los Workers de Analizar:** el de descriptores pasa de 143 a 4 kB y el del perfil de 146 a 6 kB.
   - **Otros Workers:** el de alineamiento, el de teselas y el de FASTA también adelgazan. El Worker de informes PDF conserva ambos catálogos porque redacta documentos en el idioma pedido.
2. **Plex Mono sin precarga.**
   - **Causa:** sus 49 kB se precargaban con prioridad alta y competían con el JavaScript inicial.
   - **Comportamiento ahora:** la fuente se descarga cuando aparece la primera cifra o secuencia.
   - **Sin desplazamiento:** su respaldo con métricas ajustadas evita saltos (CLS ≤ 0,00005 en Inicio y 0 en Analizar en esa medición). El LCP se registra con el primer pintado del texto.
   - **Documentación:** `docs/font-provenance.md` actualizado.
3. **Catálogo inglés bajo demanda.**
   - **Qué cambia:** el español, el idioma por defecto, sigue en el paquete inicial. El inglés pasa a ser un fragmento propio de 20,8 kB gzip. El fragmento de catálogos baja de 46,4 a 26,9 kB gzip.
   - **Cuándo se carga el inglés:**
     - antes del primer render, si es la preferencia guardada;
     - al cambiar de idioma, antes de aplicarlo.
   - **Sin conexión y en caso de fallo:** la PWA lo precarga, así que quien vuelve con inglés lo lee de la caché. Si no puede cargarse, se queda el idioma por defecto.
   - **Comprobación de uso:** `translateLoaded` falla si se pide un idioma sin cargar. Un error así no puede pasar desapercibido.
   - **Corrección posterior (`fix(i18n)`):** la E2E completa mostró que, con el inglés todavía en camino, el control de idioma no cambiaba al pulsarlo; parecía que se ignoraba la elección. Ahora el control muestra la elección al instante y los textos cambian al llegar el catálogo. Una prueba unitaria retiene el catálogo para comprobarlo.
4. **Campos de descriptores reservados.**
   - **Causa:** cuando el Worker respondía después del primer pintado, los cinco campos aparecían de golpe y empujaban el resumen. El desplazamiento fue de 0,14 en 3 de 21 cargas con 4G lenta.
   - **Cambio:** los campos se pintan desde el principio con su etiqueta, su lectura y una marca pendiente oculta a lectores de pantalla, dentro de una lista `aria-busy`.
   - **Resultado:** máximo de 0,007 en 15 cargas. Ese resto es la línea «Calculando…», que desaparece al llegar los valores.
   - **Efecto en el LCP:** en 3 de 7 cargas el elemento LCP pasa a ser el texto explicativo, ya pintado, y no la cifra. La mediana no cambia: 2.437 → 2.442 → 2.449 ms. **No se cuenta como mejora de LCP.**

## Ensayos descartados

| Ensayo | Resultado | Decisión |
|---|---|---|
| Arrancar el Worker de descriptores en el commit (`useLayoutEffect`) en vez de tras el primer pintado | Analizar 2.763 → 2.729 ms, dentro del ruido entre corridas | Revertido; no se adopta sin evidencia |
| Primer render dentro de `startTransition`, que React reparte en porciones | Bloqueo 202 → 92 ms en Inicio y 219 → 109 ms en Analizar; mayor tarea 170 → 142 ms. Pero el LCP empeora: Inicio +71 ms, Analizar +32 ms (p75 2.495 ms, en el límite). Queda la tarea de evaluación de unos 140 ms | Revertido: empeora el requisito medido (RNF-03) y no alcanza RNF-01. Ver propuestas |

## WebKit sin conexión

`quality-s7.md` registraba `page.reload: WebKit encountered an internal error` al recargar tras `context.setOffline(true)` en WebKit 26.6 (revisión 2359) sobre Windows. **No es un fallo del producto.** Diagnóstico con `scripts/probe-webkit-offline.mjs`:

- **Sitios comparados:**
  - el build del producto;
  - un sitio de control mínimo: una página y un Service Worker que responde desde su propia caché;
  - el mismo sitio de control con las cabeceras de aislamiento COOP/COEP/CORP del producto.
- **Pasos:** cada sitio se prueba con dos formas de dejar el navegador sin red: la emulación de Playwright y la parada real del servidor.

| Motor | Sitio | `reload` / `goto` / `location.reload` / `fetch`, con `setOffline` | `reload` / `fetch`, con el servidor parado |
|---|---|---|---|
| WebKit 26.6 | Producto | Fallan los cuatro (error interno, sin `load`, `TypeError: Load failed`) | Correctos: página controlada y aislada |
| WebKit 26.6 | Control | Fallan los cuatro, igual | Correctos |
| WebKit 26.6 | Control con aislamiento | Fallan los cuatro, igual | Correctos |
| Chromium 156 | Los tres | Correctos | Correctos |

**Conclusión:** la emulación sin red de WebKit en Windows impide que el Service Worker responda en navegaciones y `fetch`, también en un sitio de doce líneas sin aislamiento. Con una caída real, el mismo producto funciona.

**Cambio en la comprobación:** `check:pwa` ahora deja sin red parando el servidor, y no emulando. La batería completa **pasa en WebKit 26.6 y en Chromium 156**:

- recarga sin conexión e icono generado;
- las cuatro WOFF2 desde la precaché;
- Analizar;
- alineamiento con pareja nueva y aislamiento;
- generador y PDF;
- laboratorio y edición;
- cuaderno idéntico byte a byte;
- Mol* excluido.

En WebKit, sin `transferControlToOffscreen`, se comprueba la tabla calculada en lugar del lienzo, como antes. **Esto no certifica Safari** en macOS ni iOS.

## Accesibilidad transversal

**Nueva matriz `e2e/accessibility.spec.ts`:** 360 y 1280 px × español e inglés × claro y oscuro. Ejecuta axe con las reglas WCAG 2.1 A/AA en estos estados:

- sitio público con todas las secciones reveladas;
- Preferencias del sitio público y menú del móvil;
- barra lateral expandida y compacta, cada una con Preferencias abiertas;
- menú del laboratorio con Preferencias;
- menú de cuenta en ambos temas, que requiere identidad configurada;
- Guía.

Además recorre con el teclado la barra pública, la barra lateral en sus dos anchos y los dos menús del móvil. Comprueba que cada parada tenga un nombre (incluido el de su `label`), un anillo de foco y que ningún contenedor con desbordamiento lo recorte.

**Hallazgo y corrección (`4d0707b`):** la navegación de la barra lateral se desplaza, así que recortaba los laterales del anillo de foco de cada enlace en ambos anchos y en el menú del móvil.

- **Corrección:** se añade un margen interior igual al alcance del anillo, con un nuevo token `--focus-ring-reach`, compensado con un margen negativo; los enlaces quedan en su sitio.
- **Evidencia:** capturas antes y después, ignoradas: `artifacts/quality/sidebar-focus{,-compact}-{before,after}.png`.
- **Sin cambios de diseño:** no hay textos nuevos de interfaz por este cambio ni otra composición.

**Resultado:** sin otras infracciones AA en los estados de la matriz. Las 14 pruebas de la matriz y las 15 del marco pasan. Axe y las comprobaciones geométricas **no sustituyen** una auditoría con lector de pantalla.

## Propuestas que requieren cambiar arquitectura o composición

1. **Separar por rutas el código inicial, con precarga del fragmento de la ruta.**
   - **Problema:** el fragmento principal (110 kB gzip) incluye Analizar, Comparar, el marco del laboratorio y el sitio público. La tarea de evaluación de unos 135 ms con CPU ×4 sale de ahí.
   - **Por qué no basta separar:** sin una pista de precarga por ruta, Analizar esperaría un segundo viaje de ida y vuelta, de unos 150 ms o más en 4G.
   - **Obstáculo:** la CSP de producción (`script-src 'self'`) impide un script en línea que decida la precarga.
   - **Opciones:** un pequeño script externo generado en el build, o cabeceras `Link` por ruta en Vercel.
   - **Alcance:** es un cambio de arquitectura de carga.
2. **Diferir zod (24 kB gzip).**
   - **Situación:** se carga al arrancar porque la sesión, el borrador del editor y los contratos de Proyectos validan al importar.
   - **Propuesta:** hacer asíncronas esas validaciones de arranque.
   - **Alcance:** afecta a los proveedores de estado.
3. **Primer render en transición.** Reduce a la mitad el bloqueo de carga, pero cuesta de 30 a 70 ms de LCP. Conviene reconsiderarlo junto con la propuesta 1, que dejaría margen.
4. **`content-visibility: auto` en las secciones públicas por debajo del pliegue.**
   - **Ganancia esperada:** el layout de Inicio cuesta unos 190 ms con CPU ×4.
   - **Riesgo:** la contención de pintado recorta los anillos de foco junto a los bordes de cada sección.
   - **Requisito:** diseñar márgenes y probarlo con la matriz de accesibilidad.
5. **Subconjunto de IBM Plex Mono.**
   - **Ahorro posible:** unos 25 kB, quitando cirílico, vietnamita y dibujo de cajas.
   - **Obstáculo:** la licencia OFL de Plex reserva el nombre «Plex» para versiones modificadas.
   - **Alternativa:** usar un subconjunto publicado, por ejemplo Fontsource, con su procedencia.
6. **INP de campo.** Las cifras de interacción son sintéticas. Medir INP p75 real exige telemetría de usuarios con consentimiento, algo que hoy no existe.

## Verificación de cierre

Sobre `abe4463`, sin Auth configurada, como CI (`CI=true`, Supabase vacío):

- Tipos y lint correctos.
- Pruebas unitarias: 504/504 en 87 archivos, con 2 workers. Cobertura: 85,44 % de sentencias, 76,78 % de ramas, 81,92 % de funciones y 89,21 % de líneas.
- Build correcto: precaché de 64 entradas, 2.512,66 KiB.
- `check:pwa` correcto en Chromium 156 y en WebKit 26.6.
- E2E completas con un worker en el puerto 5315: 137 correctas y 2 omitidas por diseño. Las omitidas requieren evidencia local de Colab; las pruebas de cuenta se ejecutaron con los valores ficticios que `run-e2e` aplica.
- La primera ejecución completa falló en 5 recorridos que cambiaban a inglés. Esos fallos llevaron a la corrección del control de idioma y no se ocultaron.

## Repetición

```powershell
$env:CI='true'; $env:VITE_SUPABASE_URL=''; $env:VITE_SUPABASE_ANON_KEY=''; npm run build
$env:AUDIT_OUTPUT='artifacts/quality/otra-medicion.json'; node scripts/audit-performance.mjs
# Solo cargas de una ruta: $env:AUDIT_PHASES='loads'; $env:AUDIT_ROUTES='analyze'; $env:AUDIT_SAMPLES='15'
$env:PLAYWRIGHT_BROWSERS_PATH='artifacts/browsers'; node scripts/probe-webkit-offline.mjs
$env:PWA_CHECK_PORT='5317'; $env:PWA_CHECK_BROWSER='webkit'; npm run check:pwa
```

**WebKit:** el instalador de Playwright agotó la espera con dos de sus tres orígenes; WebKit se descargó del tercero, `cdn.playwright.dev/builds`. La utilidad `winldd` 1007 se descargó por PowerShell del mismo CDN oficial: 128.684 bytes, SHA-256 `0069f0d11d4ad6df068a068c003d22fe7dbec192a47bba64b2e115e9c8ce41d8`. Todo queda en `artifacts/browsers`, carpeta ignorada.

## Límites

- `vite preview` en local, sin CDN, HTTP/2 real ni TLS. La emulación de CPU ×4 no equivale a un móvil físico.
- Las cifras de interacción son de laboratorio, no INP de campo.
- No hay medición en el despliegue ni con la PWA ya instalada; esas condiciones cambiarían las cargas repetidas.
- Durante las mediciones podía haber otros procesos del equipo, de otras sesiones, que no se controlan. El perfil sin limitación mostró valores atípicos aislados, por ejemplo 305 ms en una carga de Inicio. Por eso se informa la mediana y las comparaciones se basan en el perfil limitado.
- WebKit en Windows no certifica Safari.
- No se usó lector de pantalla.

# Seguimiento de las propuestas 1, 5 y 2 — 28 oct 2026

Rama `parallel/perf-routes`, creada desde `dev` `0b22b4a`, en el worktree `worktree-performance`. Se trabajaron las tres propuestas aprobadas, en el orden pedido y midiendo cada una por separado. Las propuestas 3, 4 y 6 no se tocaron. No se publicó nada, no hubo push, merge ni despliegue, y el coste fue cero.

## Condiciones y línea base de hoy

El método es el de arriba, con `scripts/audit-performance.mjs` sin cambios y la invocación de la sección «Repetición»: build sin Auth configurada como CI, `vite preview` en `127.0.0.1:5310`, Chrome 156, contexto nuevo por carga, Service Workers bloqueados, 7 cargas por ruta alternando rutas, perfil «4G lenta» de 150 ms, 1,6 Mbit/s y CPU ×4, ventana de 360 × 900.

**La máquina no está en el mismo estado que anoche.** Hoy la comparten tres sesiones más; una de ellas tenía una batería E2E completa en marcha durante parte de estas mediciones. Por eso se vuelve a medir la línea base en lugar de comparar con las cifras del 27 de octubre.

| Ruta, 4G lenta, 7 cargas | LCP mediana (p75) | FCP mediana | Bloqueo | Mayor tarea | CLS máx. | Bytes |
|---|---:|---:|---:|---:|---:|---:|
| Inicio `/` | 2.231 (2.241) ms | 2.231 ms | 238 ms | 193 ms | 0,00005 | 302.141 |
| Analizar `/analyze` | 2.526 (2.535) ms | 2.179 ms | 284 ms | 217 ms | 0,007 | 307.192 |

Datos crudos en `artifacts/quality/split-baseline-2026-10-28.json`, carpeta ignorada. El bloqueo y la mayor tarea coinciden con los del 27 de octubre, 207 y 181 ms en Inicio, así que esa línea base se tomó en un momento tranquilo.

**Analizar ya no cumple RNF-03 en este equipo:** 2.526 ms de mediana y 2.535 de p75, 35 ms por encima del objetivo. Anoche quedaba 43 ms por debajo. El código es el mismo; la diferencia es la carga del equipo. Eso ya dice que un margen de decenas de milisegundos en esta máquina no es un margen.

## Propuesta 1 — Separar por rutas el código inicial, con precarga. **Revertida**

Se implementó completa y se midió en dos variantes. **La precarga funciona**, pero la separación empeora las dos rutas, así que no se adopta. Nada de esto queda en la rama.

### Qué se hizo

Inicio, Analizar y Comparar pasaron a ser archivos propios, junto con las pantallas que ya lo eran. Los dos marcos siguieron en el archivo inicial, de modo que la barra se pinta sin esperar.

### La precarga por ruta: medida y comprobada

Lo pedido era usar cabeceras `Link` por ruta en `vercel.json`. **Las cabeceras funcionan y se comprobó midiendo.** Con una cabecera `Link: </routes/analyze.js>; rel=modulepreload` en `/analyze`, la cascada de una carga con 4G lenta fue:

| Archivo | Empieza | Termina |
|---|---:|---:|
| `/routes/analyze.js`, precargado por la cabecera | 218 ms | 588 ms |
| `/assets/index-*.js`, el archivo inicial | 222 ms | 1.543 ms |

La pantalla empieza **antes** que el archivo inicial y termina casi un segundo antes. **No hay segundo viaje de ida y vuelta.**

Pero una cabecera no basta, y ahí está el hallazgo. Separar las pantallas hace que rolldown saque a archivos propios lo que esas pantallas comparten: `ViewTabs`, `annotations`, `ChemistryLegend`, `SequenceRibbon`, `StructureStage` y siete más. Esos módulos estaban dentro del archivo inicial y se precargaban desde `index.html`; al separar, el navegador solo los descubre al ejecutar la pantalla. En la misma carga aparecían en una **segunda oleada de 1.802 a 2.192 ms**, que la línea base no tiene: allí los 19 archivos llegan en una sola oleada y terminan a 1.554 ms.

`vercel.json` no puede nombrar esa oleada. Es un archivo estático y solo puede nombrar una dirección fija, mientras que lo que hay que precargar es un **conjunto de archivos que decide el build y cuyos nombres llevan hash de contenido**. Darles nombre fijo significaría renunciar al caché inmutable y al troceado del propio build. Así que se usó la alternativa que el encargo autoriza: el build escribe `route-preload.js`, un archivo del mismo origen que `index.html` carga primero y que añade las pistas de la dirección visitada. Se mantuvo además una cabecera `Link` por ruta en `vercel.json` para ese nombre fijo, `</route-preload.js>; rel=preload; as=script`, de modo que el navegador lo pida desde las cabeceras de la respuesta, antes de leer el documento.

**La CSP de producción quedó intacta**: `script-src 'self' 'wasm-unsafe-eval'`, nada en línea y nada de otro origen.

Con las dos piezas juntas, la cascada de `/analyze` fue:

| Archivo | Empieza | Termina |
|---|---:|---:|
| `/route-preload.js`, pedido por la cabecera `Link` | 204 ms | 384 ms |
| `/assets/index-*.js` | 214 ms | 1.650 ms |
| los 12 archivos de la pantalla, pistas añadidas a 394 ms | 394–404 ms | 1.267–1.711 ms |

**La segunda oleada desaparece**: todo llega junto con el archivo inicial. La precarga hace exactamente lo que debía hacer.

### Por qué aun así empeora

| Variante, 4G lenta, 7 cargas | Inicio LCP med. (p75) | Analizar LCP med. (p75) | Bloqueo Inicio / Analizar | Mayor tarea Inicio / Analizar | CLS máx. Inicio / Analizar | Bytes Inicio / Analizar |
|---|---:|---:|---:|---:|---:|---:|
| Línea base | 2.231 (2.241) | 2.526 (2.535) | 238 / 284 ms | 193 / 217 ms | 0,00005 / 0,007 | 302.141 / 307.192 |
| Separada, con `React.lazy` | 2.476 (2.552) | 2.721 (2.822) | 236 / 316 ms | 209 / 222 ms | **0,18** / 0,086 | 291.268 / 306.165 |
| Separada, arrancando la pantalla antes del primer render | 2.919 (3.203) | 3.656 (5.047) | **1.523 / 953 ms** | 994 / 874 ms | 0,00005 / 0,007 | 291.392 / 306.295 |

Evidencia: `split-after-2026-10-28.json` y `split-warm-2026-10-28.json`.

- **Con `React.lazy`** aparece un desplazamiento grande, de 0,00005 a **0,18** en Inicio. La causa es el estado de carga: `lazy` lo pinta siempre una vez, incluso con el archivo ya en el navegador, porque pide el módulo mientras renderiza y una promesa ya resuelta se resuelve un turno más tarde. Ese pintado se convierte en el FCP, que «mejora» de 2.231 a 1.982 ms porque pinta una página casi vacía, y al sustituirlo por el contenido real se produce el salto y el LCP se retrasa.
- **Arrancando la pantalla antes del primer render** desde `main.tsx`, el desplazamiento vuelve a su valor de siempre, lo que confirma el diagnóstico. Pero entonces el catálogo, la ejecución del módulo de la pantalla y el render completo caen en una sola tarea: el bloqueo pasa de 238 a **1.523 ms** y la mayor tarea de 193 a **994 ms**. Es lo contrario del objetivo de RNF-01.
- **Y el motivo de fondo:** los **bytes de Analizar no cambian**, 307.192 → 306.165 → 306.295. No pueden cambiar. La pantalla de Analizar es justamente lo que Analizar necesita para su primer pintado, así que sacarla del archivo inicial no quita ni un byte ni una línea que evaluar de su camino crítico; solo añade pasadas de render y archivos nuevos. Lo único que ahorra la separación es **no enviar las pantallas de las otras rutas**: Inicio baja 10.873 bytes, de 302.141 a 291.268, e Inicio ya tenía 350 ms de margen.

**La premisa de la propuesta no se sostiene para su propio objetivo.** Los unos 135 ms de evaluación no salen de las pantallas de ruta, sino del código común que Analizar necesita de todos modos: los proveedores de estado y sus dependencias, el catálogo de idioma, zod y protobuf. Por eso se revierte, siguiendo la regla de este informe de adoptar un cambio solo con una medición que lo respalde.

### Lo que sí queda de la propuesta 1

Una sola prueba en `src/test/headers.test.ts`, que fija que `script-src` sea exactamente `'self' 'wasm-unsafe-eval'`: nada en línea y nada de otro origen. Deja escrito por qué una pista de precarga elegida durante la carga tiene que venir de un archivo del propio origen y no de un script escrito en el documento.

### Cómo se haría si se retoma

Lo que reduciría el camino crítico de Analizar no es separar su pantalla, sino sacar del archivo inicial lo que Analizar **no** necesita para pintar: `generator/history`, el proveedor del laboratorio, `projects/snapshot` con su cliente, zod y los sellos de tiempo de protobuf. Eso es tocar los proveedores de estado, que es justo el límite que el encargo pone a la propuesta 2.

Para pistas sin latencia alguna haría falta que las cabeceras las generara el build, con la Build Output API de Vercel (`.vercel/output/config.json`) en lugar de `vercel.json`. Es un cambio de la forma de desplegar y no se puede comprobar aquí sin desplegar, que está fuera de alcance.

## Propuesta 5 — Subconjunto publicado de IBM Plex Mono. **Adoptada**

El archivo pasa de **49.248 a 14.708 bytes, 34.540 menos**, sin generar aquí ningún subconjunto.

### Procedencia

La licencia OFL de Plex reserva «Plex» como nombre para versiones modificadas, así que no se subdivide la fuente: se copia **sin modificar** `files/ibm-plex-mono-latin-400-normal.woff2` del paquete publicado `@fontsource/ibm-plex-mono` 5.3.0, igual que ya se hacía con Atkinson y Bricolage, y solo se cambia el nombre del archivo. El `shasum` del paquete descargado, `1879699d104602d5331e28e103f33c3b1b766b17`, coincide con el que publica el registro de npm; su SHA-256 es `60d3c0cfa549cb06fcb8867ee83f994d78e212abfac3bef3275436acb5c4d029`. El paquete trae su propia `LICENSE`, que es la SIL Open Font License 1.1, la misma que ya guarda `OFL-ibm-plex.txt`. No se añadió ninguna dependencia de ejecución.

El detalle queda registrado donde ya estaba el de las demás fuentes: `public/fonts/provenance.json`, que es el manifiesto único, y `docs/font-provenance.md`.

### Cobertura de glifos

El subconjunto `latin` declara `U+0000-00FF`, puntuación general `U+2000-206F`, `U+20AC`, `U+2122`, `U+2191`, `U+2193`, `U+2212` y `U+2215`. Eso cubre todo lo que escribe el token `--font-sequence`: códigos de aminoácido, cifras, accesos de UniProt, rangos, cabeceras FASTA y las etiquetas monoespaciadas en español, cuyos acentos y `¿ ¡ ñ ü` están en `U+0000-00FF`. Quedan fuera el cirílico, el vietnamita, el latín extendido y el dibujo de cajas, que esta interfaz no escribe. Si faltara un glifo se dibujaría con el respaldo monoespaciado de métricas ajustadas, sin desplazamiento. Las métricas de ese respaldo siguen valiendo porque los avances de los glifos no cambian: es la misma fuente, con menos glifos.

### Medición emparejada, y por qué hizo falta

Hoy tres sesiones más comparten el equipo, y su carga mueve una corrida completa: el **mismo** build medido con minutos de diferencia dio 238 y luego 518 ms de bloqueo, y 193 y luego 576 ms de mayor tarea. Una comparación de antes y después en corridas distintas no puede atribuir decenas de milisegundos bajo ese ruido; la primera que se hizo así daba el subconjunto como «peor», que es imposible para 34 kB menos.

Así que se midió **emparejado**, como ya se hizo el 25 de octubre con otro cambio: `tmp/compare-font-subset.mjs` sirve las dos variantes a la vez, en los puertos 5318 y 5319, y cada ronda alterna entre ellas y además invierte cuál va primero. Las variantes se diferencian en **un solo archivo estático**: se copia el build y se le repone la fuente que `git` todavía guarda, así que el HTML, los fragmentos y sus hashes son idénticos. El servidor del experimento comprime como lo hace `vite preview`, sin lo cual el volumen pasaría de 302 a 777 kB, que es otro régimen.

7 pares por ruta, 4G lenta y CPU ×4. Evidencia: `artifacts/quality/font-subset-paired-gzip-2026-10-28.json`.

| Ruta | Medida | Antes (49.248 B) | Después (14.708 B) |
|---|---|---:|---:|
| Inicio | Bytes observados (mediana) | 299.594 | **265.054** |
| Inicio | La fuente en la página | 49.548 | **15.008** |
| Inicio | LCP mediana | 2.419 ms | 2.359 ms |
| Inicio | LCP p75 | 2.465 ms | 2.456 ms |
| Inicio | Bloqueo mediano | 389 ms | 383 ms |
| Inicio | CLS máximo | 0,00005 | 0,00005 |
| Analizar | Bytes observados (mediana) | 304.612 | **270.072** |
| Analizar | LCP mediana | 2.785 ms | 2.665 ms |
| Analizar | LCP p75 | 2.807 ms | 2.840 ms |
| Analizar | Bloqueo mediano | 398 ms | 343 ms |
| Analizar | CLS máximo | 0,007 | 0,007 |

**Lo que está comprobado:** 34.540 bytes menos por carga en frío, en las dos rutas, exactamente el tamaño del archivo; y la precaché de la PWA baja de 2.512,69 a **2.478,85 KiB**, 33,84 menos, con las mismas 64 entradas.

**Lo que no se afirma:** una mejora de LCP. Las medianas bajan 60 ms en Inicio y 120 ms en Analizar, pero el p75 da −9 y +33 ms, así que no se separan del ruido. Era lo esperado: Plex Mono no se precarga desde el 27 de octubre y usa `font-display: swap`, así que el primer pintado ya se hacía con el respaldo y la fuente nunca estuvo en el camino del LCP. Lo que esta propuesta devuelve es ancho de banda que competía con el JavaScript inicial, y 33,8 KiB de la instalación de la PWA.

El CLS y el bloqueo no cambian, que es lo que había que comprobar: el subconjunto no introduce desplazamiento.

## Propuesta 2 — Diferir zod. **Descartada, con la razón medida**

El encargo la condiciona: hacerla «solo si esas validaciones de arranque se pueden volver asíncronas sin perder validación ni complicar los proveedores de estado». **No se cumple la condición**, así que no se implementó. No se tocó ningún proveedor.

### Lo que está en juego

zod es el archivo `assets/schemas-*.js`, de 85,24 kB sin comprimir y **24,24 kB comprimido**, y está en la lista de `modulepreload` que `index.html` escribe, es decir en el camino crítico de todas las rutas.

### Por qué no se puede diferir sin tocar los proveedores

No es una validación de arranque, son **cinco cadenas independientes de importación de valor**, a través de cuatro proveedores que se montan antes del primer render:

| Proveedor o módulo de arranque | Cadena hasta zod |
|---|---|
| `AuthProvider` | `auth/session.ts` (`sessionSchema`) y `auth/authApi.ts` |
| `ProjectProvider` | `projects/snapshot.ts` → `projects/contracts.ts` (`workspaceSchema`) |
| `ProjectProvider` | `generator/history.ts` |
| `App` | `editor/examples.ts` → `editor/source.ts` (`bundledSequenceSource`) |
| `LabProvider` | `design-lab/workspace.ts` |

Se ve también en el build: junto a `schemas-*.js`, la lista de `modulepreload` incluye `source-*.js`, `history-*.js` y `projectContext-*.js`.

Las que importan **tipos** de esos módulos no cuentan, porque TypeScript los borra: `SequenceDraftProvider` y `ProjectProvider` solo importan `type SequenceSource`, `type Project` y `type WorkspaceSnapshot`. El problema son las importaciones de valor de la tabla.

### Y el obstáculo que decide

`AuthProvider` lee la sesión guardada **de forma síncrona antes del primer render**, por diseño: su propio comentario lo dice, y el resultado es el valor inicial de su estado. Volverlo asíncrono significa que el primer render no sabe todavía si hay sesión, y entonces `status` vale `'loading'`, con lo cual `SessionActions` del marco público **no pinta nada**: la barra del sitio aparecería sin sus botones de acceso en cada carga en frío y se completaría después.

Eso no es solo incomodidad: es exactamente el modo de fallo que la propuesta 1 midió esta misma noche. Pintar primero una versión incompleta y sustituirla después retrasó el LCP y llevó el CLS de Inicio de 0,00005 a 0,18. Cambiar 24,24 kB de descarga por un desplazamiento en la barra y un LCP más tardío va en contra del objetivo.

### Qué haría falta

Para que mereciera la pena habría que, además de diferir zod, mover las cinco cadenas: separar cada esquema a su propio módulo, dejar en los actuales solo tipos escritos a mano —lo que duplica el contrato y pierde `z.infer` como única fuente— y dar a `AuthProvider` un estado inicial que no dependa de validar. Es rediseñar los proveedores de estado, no diferir una dependencia. Queda como propuesta, con la nota de que conviene hacerla junto con el trabajo descrito en «Cómo se haría si se retoma» de la propuesta 1, porque es el mismo problema: sacar del archivo inicial lo que la ruta visitada no necesita para pintar.

## Propuesta 3 — Primer render en transición: no se vuelve a medir, y por qué

El encargo pedía volver a medirla «si con el margen nuevo» de la propuesta 1 ya no costaba LCP. **Ese margen nuevo no existe**, porque la propuesta 1 se revierte. Al contrario: la línea base de hoy deja Analizar en 2.526 ms de mediana y 2.535 de p75, ya 35 ms **por encima** del objetivo con la carga actual del equipo.

La medición del 27 de octubre dice que el primer render en transición cuesta 71 ms de LCP en Inicio y 32 ms en Analizar. Con Analizar por encima del objetivo, aplicarlo lo empeora. **No se implementa y no se pide autorización para hacerlo.**

Lo que sí sigue siendo cierto de aquella medición es su otra mitad: reparte el bloqueo de 202 a 92 ms en Inicio y de 219 a 109 ms en Analizar. Es decir, sigue siendo la vía hacia RNF-01 y sigue chocando con RNF-03, y la forma de desbloquearla es reducir el trabajo de arranque, no repartirlo mejor.

## Verificación del 28 de octubre

Sobre el árbol final de `parallel/perf-routes`, es decir con el subconjunto de fuente y sin la separación por rutas, sin Auth configurada y como CI (`CI=true`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` vacías):

- Tipos y lint correctos.
- Pruebas unitarias: **505/505 en 87 archivos**. Cobertura: 85,44 % de sentencias, 76,78 % de ramas, 81,92 % de funciones y 89,21 % de líneas, las mismas que el 27 de octubre. Son 504 de antes más la única prueba nueva, la de la CSP.
- Build correcto: fragmento inicial de 355,92 kB (109,97 kB comprimido), igual que la línea base, y precaché de **64 entradas y 2.478,85 KiB**, frente a las 64 entradas y 2.512,69 KiB de `dev`.
- `check:pwa` correcto en Chromium 156, con la fuente nueva servida desde la precaché: comprueba `plex-mono-regular.woff2` con sus **14.708 bytes**, además del icono generado, la recarga sin conexión, el aislamiento, el laboratorio, el generador, el PDF y el cuaderno idéntico byte a byte. **No se ejecutó en WebKit**, por el límite de alcance de esta tarea.
- E2E completas en Chromium con un worker (`E2E_WORKERS=1`) en el puerto 5315: **137 correctas y 2 omitidas por diseño**, en 12,5 minutos. Las omitidas son las que requieren evidencia local de Colab; las de cuenta se ejecutaron con los valores ficticios que `run-e2e` aplica.
  - **La primera ejecución completa dio un fallo**, y no se oculta: `library.spec.ts:85`, «UniProt search and detail import exact sequence/version…», agotó los 30 s en el **primer** clic después de `goto`, el de la pestaña «Consultar UniProt». El contexto guardado en `test-results` muestra el elemento ya visible, habilitado y estable, con el clic detenido en «scrolling into view if needed». Ese spec aislado pasa entero, 6 de 6 en 33 s, y la batería completa repetida pasa. En paralelo había otra batería E2E completa y un build con cobertura de otras sesiones en el mismo equipo.
  - **No se tocó nada para que pasara:** ni tiempos de espera, ni marcas de inestabilidad, ni el propio test. Queda registrado como atasco atribuido a la contención del equipo, no comprobado contra una máquina en reposo.
- **No se añadió ninguna prueba E2E.** No apareció ningún fallo real que la justificara.

## Repetición de lo de esta noche

```powershell
$env:CI='true'; $env:VITE_SUPABASE_URL=''; $env:VITE_SUPABASE_ANON_KEY=''; npm run build
# Cargas, el mismo script y la misma invocación de la sección «Repetición» de arriba
$env:AUDIT_PHASES='loads'; $env:AUDIT_PORT='5310'; $env:AUDIT_OUTPUT='artifacts/quality/otra-medicion.json'; node scripts/audit-performance.mjs
# Comparación emparejada de la fuente, en los puertos 5318 y 5319
$env:PAIR_SAMPLES='7'; node tmp/compare-font-subset.mjs
$env:PWA_CHECK_PORT='5316'; $env:PWA_CHECK_BROWSER='chromium'; npm run check:pwa
$env:E2E_PORT='5315'; $env:E2E_WORKERS='1'; npm run test:e2e
```

`tmp/` y `artifacts/` son carpetas ignoradas, igual que en las mediciones anteriores. El script emparejado repone la fuente antigua con `git show HEAD:public/fonts/plex-mono-regular.woff2`, así que **solo sirve mientras ese archivo siga siendo el nuevo en `HEAD`**; después de otro cambio de fuente habría que apuntar al commit correspondiente.

## Límites de estas mediciones

A los límites de arriba, que siguen vigentes, se añaden los de esta noche:

- **El equipo estaba compartido y cargado.** Tres sesiones más trabajaban a la vez, una de ellas con una batería E2E completa. El mismo build dio 238 y luego 518 ms de bloqueo, y 193 y luego 576 ms de mayor tarea, con minutos de diferencia. Por eso la propuesta 5 se midió emparejada y por eso las cifras absolutas de esta noche no son comparables con las del 27 de octubre.
- **Las comparaciones no emparejadas de la propuesta 1 arrastran ese ruido.** La conclusión de revertirla no depende de ello: se apoya en el desplazamiento de 0,18, en el bloqueo de 1.523 ms y, sobre todo, en que los bytes de Analizar no cambian, que es una cuenta y no una medición.
- **El experimento emparejado usa un servidor propio**, no `vite preview`: comprime, pero no es el mismo servidor, y sus cifras absolutas salen algo más altas (Inicio 2.419 ms frente a 2.231). Lo que compara son sus dos columnas entre sí, no contra `vite preview`.
- **La cascada de la propuesta 1 se midió una sola vez por variante**, no siete. Sirve para decir si hay o no un segundo viaje de ida y vuelta, que es un hecho cualitativo, no para atribuir milisegundos.
- **No hay medición de la precarga por ruta en el despliegue.** Las cabeceras `Link` se comprobaron replicándolas en el servidor de `vite preview`, leídas del propio `vercel.json`; que Vercel las emita igual no se verificó, porque desplegar está fuera de alcance.
- **No se hizo nada de Safari en dispositivo, lector de pantalla ni INP de campo**, por decisión del propietario. `check:pwa` solo se ejecutó en Chromium.
- Sigue sin haber medición en producción, con CDN, HTTP/2 real, TLS ni la PWA ya instalada.

## Estado de las propuestas tras esta noche

| Propuesta | Estado |
|---|---|
| 1. Separar por rutas con precarga | **Implementada, medida y revertida.** La precarga funciona; la separación no ayuda a Analizar y empeora las dos rutas |
| 2. Diferir zod | **Descartada** por los proveedores que validan antes del primer render; 24,24 kB siguen en el camino crítico |
| 3. Primer render en transición | Sin cambios: sigue costando LCP y no hay margen nuevo que lo absorba |
| 4. `content-visibility: auto` | No se tocó |
| 5. Subconjunto de Plex Mono | **Adoptada:** 34.540 bytes menos por carga, precaché 33,84 KiB menor |
| 6. INP de campo | No se tocó |

Lo que queda sobre la mesa para RNF-01 y RNF-03 es una sola cosa, y las propuestas 1 y 2 apuntan las dos a ella: **sacar del arranque lo que la ruta visitada no necesita para pintar**, que hoy son los proveedores de estado y sus dependencias. No es un cambio de troceado, es un cambio de los proveedores.

# Qué se puede sacar del arranque — investigación del 29 oct 2026

Investigación, **sin implementar nada**. El árbol es el de `parallel/perf-routes` después de los tres commits, es decir con el subconjunto de fuente.

La propuesta 1 dejó una pregunta concreta: si separar las pantallas de ruta no ayuda, ¿qué sí está en el arranque sin hacer falta para pintar? Esto lo mide en lugar de suponerlo, con dos herramientas que no dependen del reloj del equipo ni de su carga.

## Primero, una corrección sobre el margen

Se repitió la línea base con el árbol actual. **El equipo nunca llegó a estar en reposo**: durante la medición había 17 procesos de Node y 8 de Chrome residentes y una carga de fondo del 30 %.

| Medición, 4G lenta, 7 cargas | Inicio LCP med. (p75) | Analizar LCP med. (p75) | Bloqueo Inicio / Analizar |
|---|---:|---:|---:|
| 27 oct, informe original | 2.150 (2.153) | 2.449 (2.457) | 198 / 222 ms |
| 28 oct, `dev` | 2.231 (2.241) | 2.526 (2.535) | 238 / 284 ms |
| 29 oct, árbol actual | 2.363 (2.415) | 2.649 (2.758) | 367 / 309 ms |

El código de Analizar no ha cambiado entre las tres, y su p75 va de 2.457 a 2.758 ms. **La variación entre corridas de este equipo es mayor que el margen que se estaba discutiendo**, así que el «margen de 43 ms» del 27 de octubre no es un margen: está dentro del ruido. En las dos mediciones posteriores Analizar queda por encima de 2,5 s. Dicho sin adornos: **RNF-03 no está acreditado de forma repetible en Analizar**, y acreditarlo pide una máquina controlada, no otro ajuste.

## Qué hay en el grafo inicial, por módulo

`tmp/attribute-initial-bytes.mjs` recorre los *source maps* de los 17 archivos que `index.html` nombra —el fragmento de entrada y su cierre de `modulepreload`— y carga cada tramo de código generado al archivo fuente del que vino. Es análisis estático: no lo afecta la carga del equipo. Build con `npm run build -- --sourcemap`; datos en `artifacts/quality/initial-graph-2026-10-29.json`.

**Grafo inicial: 17 archivos, 575.682 bytes, 180.269 comprimidos.** Por área:

| Área | Bytes | Parte |
|---|---:|---:|
| paquete react-dom | 207.219 | 36,0 % |
| **paquete zod** | **84.297** | **14,6 %** |
| src/i18n (70.602 de ellos, `es.ts`) | 72.235 | 12,5 % |
| paquete react-router | 37.931 | 6,6 % |
| src/features/descriptors | 23.066 | 4,0 % |
| src/features/projects | 19.218 | 3,3 % |
| src/features/editor | 16.467 | 2,9 % |
| src/features/alignment | 13.779 | 2,4 % |
| src/shell | 11.641 | 2,0 % |
| src/features/landing | 10.264 | 1,8 % |
| src/features/structure | 9.214 | 1,6 % |
| src/features/design-lab | 7.796 | 1,4 % |
| src/features/generator | 7.344 | 1,3 % |
| src/features/auth | 7.165 | 1,2 % |
| src/features/assistant | 5.389 | 0,9 % |
| src/features/reports | 3.386 | 0,6 % |

## Qué cuesta en tiempo de procesador

`scripts/profile-startup.mjs`, sin cambios, con CPU ×4 sobre Inicio. Datos en `artifacts/quality/startup-2026-10-29.json`.

Del muestreo total, 3.391 ms son espera y 614 ms son trabajo interno de V8 —compilar y recoger basura— que el perfil no reparte entre archivos. Queda **algo más de 500 ms de tiempo propio atribuible**, y así se reparte:

| Origen | Tiempo propio | Parte de lo atribuible |
|---|---:|---:|
| react-dom, renderizado | 141 ms | 28 % |
| `src/features/structure/BackboneView.tsx`, el esqueleto del hero | 113 ms | 22 % |
| **zod, construir esquemas** | **63 ms** | **12,5 %** |
| `src/i18n/useTranslation.ts` `formatNumber` | 59 ms | 12 % |
| react-router | 28 ms | 6 % |

Los 63 ms de zod son **construir esquemas que todavía no ha usado nadie**. A eso hay que sumarle su parte de los 614 ms de compilación, que el perfil no desglosa; por bytes le correspondería alrededor de 90 ms, pero eso es una regla de tres, no una medición.

## El candidato claro: zod fuera del arranque

Lo que bloqueaba la propuesta 2 era la lectura **síncrona** de la sesión antes del primer render. Al mirar módulo a módulo, el bloqueo es mucho más pequeño de lo que parecía:

- **`parseFragmentSession` no usa zod.** Es `URLSearchParams`, `atob` y `JSON.parse`. Y es la otra mitad de lo que `AuthProvider` hace antes del primer render.
- Así que **la única validación de zod en el camino síncrono es `sessionSchema`**, de `auth/session.ts`: cuatro campos, dos cadenas no vacías, un entero positivo y un objeto de usuario. `loadSession` solo quiere saber si vale o no, con `safeParse` y un booleano.

Las otras cuatro cadenas no están en el primer pintado, solo se importan a nivel de módulo:

| Cadena | Cuándo se usa de verdad | Qué haría falta |
|---|---|---|
| `auth/authApi.ts` | Dentro de `request`, en llamadas de red | Importarlos dentro de esas funciones, que ya son asíncronas |
| `editor/source.ts`, `sequenceSourceSchema` | **Solo lo usa `projects/contracts.ts`** | Moverlo allí; `source.ts` se queda con `bundledSequenceSource`, que es una expresión regular |
| `projects/snapshot.ts`, `workspaceSchema` | En `captureWorkspace` y `withGeneratorHistory`, llamadas desde el guardado, la apertura y el menú de exportación | Volver esas dos funciones asíncronas con importación dinámica; sus dos llamadas ya están en contextos asíncronos |
| `generator/history.ts` | En los tres callbacks de historial de `ProjectProvider` | Importación dinámica dentro de ellos |

Comprobaciones que lo sostienen:

- `design-lab/workspace.ts`, que también usa zod, **solo lo importa `import.worker.ts`**: ya está fuera del hilo de la interfaz.
- `api/apiClient.ts` ya está diferido, y hay un E2E que lo fija: «keeps the service transport deferred until a service is used».
- Todo lo que `reports/reportMessages.ts`, `reports/reportModel.ts` y `projects/rpcMapping.ts` toman de `contracts.ts` son **tipos**, que TypeScript borra. La única cadena de valor hacia `contracts.ts` desde el grafo inicial es `snapshot.ts`.
- `generatorHistorySnapshotSchema` y `sequenceSourceSchema` **solo los usa `contracts.ts`**, así que los esquemas pueden juntarse en un módulo y llegar cuando alguien guarda, abre o importa.
- En `ProjectProvider`, todo uso de lo pesado está dentro de callbacks, nunca en el estado inicial: su `EMPTY_WORKSPACE` solo necesita dos constantes pequeñas de configuración.

**Ganancia esperada:** el fragmento `schemas-*.js` sale del grafo inicial, **85.294 bytes y 24.093 comprimidos**, un 13,4 % de los 180.269 comprimidos que hoy se descargan en todas las rutas, más `history-*.js` con otros 1.955 comprimidos. En procesador, los 63 ms medidos de construcción de esquemas, más su parte de la compilación.

**Y lo que importa de la lección de la propuesta 1:** nada de esto está detrás de un render. Diferir un módulo que solo se alcanza desde un callback **no cuesta ninguna pasada de `Suspense`**, que es justo lo que hundió la propuesta 1. Esa es la diferencia entre los dos casos, y es la razón para esperar que este sí salga a favor.

**Lo que habría que cuidar:** `sessionSchema` pasa a ser una comprobación escrita a mano, así que hace falta una prueba que fije que acepta y rechaza exactamente lo mismo que el esquema. Eso es «no perder validación» de forma comprobable, no de palabra.

## Candidatos secundarios, con su cifra

- **`BackboneView`, 113 ms de procesador y 9.214 bytes.** Es el segundo mayor consumidor de arranque y dibuja el esqueleto del hero, **solo en Inicio**. No sirve para el margen de Analizar, pero es la mitad del coste de render de Inicio.
- **`formatNumber`, 59 ms.** Ya se investigó el 25 de octubre; sigue ahí.
- **`src/i18n/es.ts`, 70.602 bytes.** Es el catálogo por defecto, hace falta; recortarlo significaría partirlo por área, que es bastante más trabajo que las cadenas de zod.
- **`descriptors`, 23.066 bytes**, de los cuales 9.180 son `HydropathyProfile.tsx`, que es una **pestaña**, no la vista inicial de Analizar. Diferirla sí es un render, así que pagaría la pasada de `Suspense`; pero sería una pasada tras un clic, no en la carga, y ese es el patrón que ya usan las otras vistas.
- **`assistant`, 5.389 bytes**, y **`reports`, 3.386**: entran por componentes que el marco del laboratorio renderiza.

## Orden recomendado si se autoriza

1. Sacar zod del arranque por las cinco cadenas, con la comprobación de la sesión escrita a mano y su prueba de paridad. Es la única que da una cifra de dos dígitos en kB y no cuesta una pasada de render.
2. Volver a medir, emparejado, porque el margen en juego es menor que el ruido de este equipo.
3. Solo entonces mirar `BackboneView` para Inicio y `HydropathyProfile` para Analizar.

**No se implementó nada de esto.** Para hacerlo hace falta autorización: toca `AuthProvider`, `ProjectProvider`, `snapshot.ts`, `contracts.ts`, `source.ts`, `authApi.ts`, `history.ts` y sus pruebas.

# zod fuera del arranque — 29 oct 2026

Implementada la propuesta 2, por la vía que la investigación de arriba dejó abierta. **Ningún contrato cambia**: los mismos esquemas de zod, el mismo formato guardado, el mismo snapshot y el mismo protobuf. Lo único que cambia es **cuándo se carga ese código**.

## Resultado, con lo determinista

Grafo inicial, medido con `tmp/attribute-initial-bytes.mjs` sobre los archivos que `index.html` nombra. Evidencia: `artifacts/quality/initial-graph-2026-10-29.json` y `initial-graph-after-zod-2026-10-29.json`.

| | Antes | Después | Diferencia |
|---|---:|---:|---:|
| Archivos del grafo inicial | 17 | **3** | −14 |
| Bytes | 575.682 | **480.153** | **−95.529** |
| Bytes comprimidos | 180.269 | **150.328** | **−29.941 (−16,6 %)** |
| zod | 84.297 | **0** | −84.297 |
| `src/features/generator` | 7.344 | **0** | −7.344 |
| `src/features/projects` | 19.218 | 15.971 | −3.247 |

El fragmento de entrada sí **crece**, de 355,92 a 397,44 kB (109,97 → 124,54 comprimidos), porque al desaparecer catorce archivos pequeños su contenido pasa a ese fragmento. Lo que baja es **el grafo completo**, que es lo que el navegador descarga y evalúa antes de pintar. La precaché pasa de 64 entradas y 2.478,85 KiB a **57 y 2.477,76 KiB**: el código sigue existiendo, repartido de otra forma.

Procesador, con `scripts/profile-startup.mjs` sin cambios, CPU ×4 sobre Inicio. Evidencia: `startup-2026-10-29.json` y `startup-after-zod-2026-10-29.json`.

| Origen | Antes | Después |
|---|---:|---:|
| Tiempo propio atribuible | 477 ms | **334 ms** |
| **zod, construir esquemas** | **63 ms** | **0 ms** |
| react-dom, renderizado | 132 ms | 112 ms |
| `BackboneView`, el esqueleto del hero | 113 ms | 94 ms |
| react-router | 28 ms | 22 ms |

**No se afirma ninguna mejora de LCP.** La carga perfilada pasó de 2.354 a 1.905 ms, pero es **una** carga con el perfilador puesto, y esta máquina ya demostró que su variación entre corridas supera el margen en discusión. **El LCP de Analizar sigue sin estar acreditado de forma repetible**, y lo seguirá hasta medirlo en una máquina controlada.

## Las seis cadenas, y la que faltaba

| Cadena | Qué se hizo |
|---|---|
| `auth/session.ts` | Los esquemas pasan a `auth/schemas.ts`. `loadSession` usa `storedSession`, una comprobación escrita a mano, porque corre antes del primer render |
| `auth/authApi.ts` | Carga `./schemas` dentro de sus funciones de red, que ya eran asíncronas |
| `editor/source.ts` | El esquema pasa a `editor/sourceSchema.ts`; `source.ts` se queda con `bundledSequenceSource` y reexporta el tipo, que TypeScript borra |
| `projects/snapshot.ts` | `captureWorkspace` y `withGeneratorHistory` son asíncronas y cargan `./contracts` al usarse. `workspaceVersion` y `workspaceInputKey`, que se leen al renderizar, siguen síncronas y sin zod |
| `generator/history.ts` | `ProjectProvider` la carga dentro de sus tres callbacks de historial |
| **`generator/context.ts`** | **La investigación no la había visto.** `parseSearchForm` pasa a `generator/searchForm.ts`; el proveedor la carga con la primera búsqueda y la pantalla del generador, que ya es un archivo propio, la importa directamente |

La sexta apareció al comprobar el resultado: con las cinco primeras hechas, zod **seguía** en el grafo. El fragmento que lo arrastraba contenía `generator/search.ts`, y quien lo alcanzaba era `context.ts`, que importaba `searchParametersSchema` como valor para validar el formulario. Lo encontró la comprobación del build, no el análisis previo; por eso la comprobación es parte del método y no un trámite.

## Sin perder validación, y comprobado

`storedSession` sustituye a `sessionSchema.safeParse` en el único punto que no puede esperar. El esquema **sigue siendo la fuente de verdad** y sigue en `schemas.ts`, usado donde la carga es asíncrona. `src/features/auth/session.test.ts` pasa 31 casos por los dos y exige el mismo veredicto y, cuando aceptan, el mismo valor: sesión completa, correo vacío, campos ausentes uno a uno, tipos erróneos, cadenas vacías, nulos, arrays, expiraciones de cero, negativas, fraccionarias, `NaN`, infinitas, y campos desconocidos sueltos y dentro del usuario, que el esquema descarta y la comprobación también. Una prueba más fija que el esquema tenga exactamente esos cuatro campos, para que añadir uno no pase sin comprobarse.

**La prueba de paridad encontró una divergencia real antes de que llegara a ninguna parte:** con `expiresAt` de `2 ** 53`, `Number.isInteger` aceptaba y el `int()` de zod rechazaba, porque exige un entero exacto. La comprobación usa ahora `Number.isSafeInteger`. Sin esa prueba, el cambio habría aceptado sesiones que el esquema rechaza.

## Lo que se nota al usarlo

- **Exportar un informe** y **buscar en el generador** crean su Worker un turno más tarde: antes de crearlo se carga la validación. Nada en la interfaz espera por ello.
- **`captureWorkspace` y `withGeneratorHistory` son asíncronas.** Sus dos llamadas ya estaban en contextos asíncronos: el guardado de `ProjectProvider` y el menú de exportación.
- **Si la validación no pudiera cargarse**, una búsqueda queda informada como fallida en lugar de quedarse quieta.
- Las pruebas de esos dos recorridos esperan ese turno con `act`, y cargan el módulo una vez por archivo para que cada clic cueste solo el turno y no una lectura de módulo. **No se subió ningún tiempo de espera ni se marcó nada como inestable.**

## Verificación

Sobre el árbol final, sin Auth configurada y como CI:

- Tipos y lint correctos.
- Unitarias: **539/539 en 88 archivos**, frente a 505 en 87. Las 34 nuevas son la paridad de la sesión. Cobertura: 85,52 % de sentencias, 76,93 % de ramas, 81,94 % de funciones y 89,26 % de líneas.
- Build correcto; precaché de 57 entradas y 2.477,76 KiB.
- `check:pwa` correcto en Chromium 156, con las cuatro WOFF2 desde la precaché, el aislamiento, el laboratorio, el generador, el PDF y el cuaderno idéntico byte a byte. **No se ejecutó en WebKit**, por el alcance de la tarea.
- E2E completas en Chromium con un worker en el puerto 5315: **137 correctas y 2 omitidas por diseño**, en 8,7 minutos y **a la primera**. Se esperó a que no hubiera nada escuchando en 5190 ni en 5325, las baterías de otras sesiones, y la carga del equipo estaba al 4 %.
- Las siete pruebas que fallaron al introducir el turno de espera eran de `GeneratorPage` y `ReportActions`, y se arreglaron esperando ese turno, no debilitando lo que comprueban.

## Lo que queda

- El LCP de Analizar sigue **sin acreditar de forma repetible** en este equipo, y esta propuesta no lo cambia: lo que reduce es lo que se descarga y se evalúa, medido con lo determinista.
- Siguen en el grafo inicial, como candidatos ya cifrados: `BackboneView` con 113 ms y 9.212 bytes, solo de Inicio; `formatNumber` con 59 ms; el catálogo español con 70.602 bytes; y `HydropathyProfile` con 9.180, que es una pestaña y no la vista inicial de Analizar. **No se tocaron.**
