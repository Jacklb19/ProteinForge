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
