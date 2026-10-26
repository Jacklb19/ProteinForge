# Calidad y rendimiento S7

**Actualización del 26 de octubre:** segunda entrega del 25, cierre de herramientas y transición de PWA instalada al final de este documento. Las secciones y cifras del 23 conservan la evidencia inicial; no describen la matriz de motores ni las correcciones posteriores.

Auditoría local del 23 de octubre de 2026, desde frontend `4404997`, aislada en `parallel/quality`. Esta evidencia no certifica producción, Safari ni hardware de cuatro núcleos. No se usaron sesiones del propietario ni servicios reales para los datos autenticados.

## Alcance y correcciones

- Marco común: el menú móvil declaraba modalidad, pero Tab salía al contenido de detrás. La regresión reproduce el fallo antes de corregirlo. Tab y Mayús+Tab ahora recorren el panel; cambiar tema/idioma conserva el foco, Escape lo devuelve al botón y elegir otra ruta lo lleva al contenido. Se conserva la composición y no hay claves de idioma nuevas.
- Carga: las visitas anónimas descargaban el cliente de proyectos; la configuración común del asistente también importaba su contrato generado. Los clientes se preparan al iniciar sesión, los errores comunes ya no importan el transporte y el mapeo de sujetos queda en el adaptador RPC. Se conservan categorías, contratos, lectura, presupuesto y borradores.
- Comprobaciones: `E2E_BROWSER` admite `chromium`, `firefox` o `webkit`, validando el valor y reservando el ejecutable de Chrome a Chromium. Las E2E generales bloquean Service Workers para aislar los servicios simulados; `check:pwa` comprueba la caché real por separado. Añadidas regresiones de carga y accesibilidad del menú de informes.
- La comparación de movimiento reducido admite `0ms` y `0s`, dos representaciones de duración nula. El build minificado normaliza a segundos; se mantiene el requisito de cero movimiento.

No se modificaron algoritmos, Workers científicos, WASM generado, visor/mapeo SIFTS, laboratorio, contratos backend, dependencias ni composición visual.

## Método de rendimiento

`scripts/audit-performance.mjs` abre el build con Vite preview en `127.0.0.1:5310`, un navegador aislado y cinco muestras por ruta/perfil. Guarda las muestras crudas en `artifacts/quality/`, incluido el equipo, versión del navegador y hash del HTML del build. No usa una sesión ni llama a servicios externos; un error de página o petición externa falla la ejecución.

Cada carga fría usa un contexto nuevo de 360 × 900, movimiento reducido y Service Workers bloqueados. Perfiles: velocidad nativa y CDP con 1,6 Mbit/s de bajada, 750 kbit/s de subida, 150 ms de latencia y CPU ×4. Se observa LCP y tareas largas hasta dos segundos después de fuentes/contenido inicial. El p75 es el cuarto valor ordenado de cinco. La suma de `transferSize` corresponde a recursos observados en la página; no representa todo el tráfico de Workers ni la instalación completa de la PWA. Preview local no representa CDN/TLS de producción.

El equipo anuncia AMD Ryzen 7 8845HS, 16 procesadores lógicos y 16.435.761.152 bytes de RAM; Chrome 156.0.8078.48. CPU ×4 no convierte ese equipo en hardware físico certificado de cuatro núcleos. Se evitaron otras pruebas propias durante la comparación principal; no se controlan procesos ajenos del equipo.

Línea base: `artifacts/quality/before-load-split.json`. Ensayo de separar también las rutas de Analizar/Alinear: `after-load-split.json`; se descartó porque empeoró Inicio pese a reducir bytes. Las rutas conservan su carga anterior. La primera medición exploratoria (`baseline.json`) coincidió con otras comprobaciones y no se usa como comparación principal.

Corrección del metadato inicial: la nota «Uncompressed» de esos dos primeros JSON era incorrecta. Las mediciones crudas de `transferSize` se conservan; esta comparación usa los bytes observados, sin suponer transferencia sin compresión. El registrador final corrige la descripción.

Los tiempos de alineamiento incluyen clic, cálculo real de dos secuencias idénticas de 2.000 residuos y resultado visible, con WASM ya inicializado. No equivalen a arranque en frío ni certifican todos los pares. Event Timing conserva las interacciones de laboratorio observadas; no calcula INP p75 de usuarios reales ni reemplaza medición de campo.

## Resultado medido

Comparación principal de cinco muestras por celda, con el mismo navegador, contexto y perfil. Resultado final en `artifacts/quality/final-performance.json`; HTML SHA-256 `f71c9f0156931b16f312f8de1ce4cc76f6a6646de209934a03446b002732f247`.

| Ruta y perfil | LCP p75 anterior → final | Mayor tarea anterior → final | Bytes observados anterior → final |
|---|---:|---:|---:|
| Inicio, nativo | 357,7 → 254,9 ms | 71 → 53 ms | 463.607 → 424.659 |
| Analizar, nativo | 295,3 → 235,9 ms | 65 → 62 ms | 406.057 → 365.998 |
| Inicio, 4G/CPU ×4 | 2.829,4 → 2.706,2 ms | 338 → 313 ms | 463.607 → 424.659 |
| Analizar, 4G/CPU ×4 | 2.784,7 → 2.499,2 ms | 440 → 284 ms | 406.057 → 365.998 |

Se retiran 38.948 bytes observados de Inicio y 40.059 de Analizar; el transporte permanece disponible al iniciar sesión. La mejora de LCP simulado es aproximadamente 4 % y 10 %, respectivamente. Analizar queda apenas 0,8 ms bajo el objetivo en esta muestra pequeña: no ofrece margen para certificar RNF-03. Inicio lo supera y las tareas largas de arranque persisten; no se ocultan con umbrales nuevos.

Alineamiento final: cinco mediciones de 146,5–168,6 ms, p75 148,7 ms, sin tareas largas observadas durante ese cálculo. Las entradas Event Timing registradas fueron de 16–24 ms; no todas las interacciones producen entradas por debajo del umbral de 16 ms. Una navegación interna caliente por Inicio/Analizar/Alinear tardó 109,3/116,7/123,1 ms, incluido clic y encabezado visible. No es una distribución de campo ni un INP. Cero errores de página o peticiones externas durante la auditoría.

## Verificación local

- Tipos, lint y build correctos. El build conserva los avisos previos del cargador nativo futuro y del tamaño de Mol*; no se cambian límites ni umbrales.
- 357 unitarias / 66 archivos correctos, máximo dos workers. Cobertura final: 84,11 % statements, 74,70 % branches, 81,75 % functions y 87,29 % lines; mínimos del 70 % intactos. Registro `artifacts/quality/unit-final.log`.
- 33 E2E iniciales correctas sobre desarrollo. Sobre el build final: 42 de 43 correctas; el único fallo fue la representación equivalente `0s` frente a `0ms`. El caso corregido se repitió sobre el mismo build: 1/1 correcto. Los 43 recorridos quedan verificados en esas dos ejecuciones, sin omisiones ni otra repetición de los casos ya aprobados. Registros `e2e-final.log` y `e2e-recheck.log` bajo `artifacts/quality/`.
- Las ocho E2E de lectura usan Auth/RPC simulados; no prueban Groq autenticado en producción. El caso WASM del build midió 240 ms, separado de la campaña principal.
- PWA final correcta: 46 recursos, 2.846,78 KiB de precaché; fuentes locales también dentro del Worker, aislamiento COOP/COEP, alineamiento, búsqueda, PDF, laboratorio y cuaderno exacto disponibles sin conexión. Mol* permanece excluido. Registro `artifacts/quality/pwa-final.log`. Esto no añade sincronización offline de proyectos ni datos externos.

## Compatibilidad y accesibilidad

Chromium ejecutado con perfil de pruebas independiente. Firefox 155 / revisión Playwright 1543 y WebKit 26.6 / revisión 2359 no llegaron a instalarse: los endpoints oficiales `cdn.playwright.dev` y `playwright.download.prss.microsoft.com` agotaron espera, incluidos los reintentos del instalador. No se atribuye soporte probado a esos motores. Chrome y Edge comparten Chromium; no son dos motores adicionales. Incluso una futura prueba de WebKit en Windows no certificará las dos versiones objetivo de Safari en macOS/iOS.

La matriz cubre marco/navegación, Analizar, Alinear, colección de Proyectos e informes a 360/1280, claro/oscuro, teclado, foco, desbordamiento y controles de 44 px. Axe comprueba reglas WCAG A/AA incluidas en las E2E. También se ejercitan fuentes de respaldo, movimiento reducido, cancelación/alineamiento y fallo de descarga WASM. Auth y RPC se simulan. El PDF exportado se verifica como artefacto local; continúa sin PDF etiquetado. Axe y capturas no sustituyen auditoría manual con lector de pantalla.

Las capturas quedan ignoradas en `artifacts/`: `menu-*-360.png`, `analysis-*-360/1280.png`, `alignment-*-360/1280.png`, `projects-cards-360/1280-*.png` y `quality/reports-360/1280-*.png`. Revisión visual conserva jerarquía, química, tipografías y temas. La revisión CLI `21st review` no se ejecutó porque el binario no está instalado; no se enviaron fuentes a un servicio de revisión.

## Repetición

Desde esta copia, instalar sus dependencias con `npm ci` y configurar únicamente valores públicos ficticios:

```powershell
$env:VITE_SUPABASE_URL='https://e2e-project.supabase.invalid'
$env:VITE_SUPABASE_ANON_KEY='e2e-public-anon-key'
$env:VITE_API_BASE_URL='https://api.e2e.invalid'
npm run build
$env:AUDIT_OUTPUT='artifacts/quality/repeated.json'
node scripts/audit-performance.mjs
```

Para E2E generales: `E2E_PORT=5311`, `E2E_WORKERS=1`, `E2E_BROWSER=chromium` y `npm run test:e2e -- e2e/shell.spec.ts e2e/responsive.spec.ts e2e/editor-design.spec.ts e2e/alignment.spec.ts e2e/projects-collection.spec.ts e2e/reports.spec.ts e2e/wasm.spec.ts e2e/loading.spec.ts e2e/assistant.spec.ts`. En PowerShell asignar esas variables mediante `$env:`. Para repetir sobre el build, iniciar `npm run preview -- --host 127.0.0.1 --port 5311 --strictPort` y, en otra terminal con los mismos valores públicos ficticios, usar `E2E_BASE_URL=http://127.0.0.1:5311` con `npx playwright test` y esos archivos. Detener solo el servidor propio al terminar.

Para otro motor, descargarlo primero mediante el instalador oficial con `PLAYWRIGHT_BROWSERS_PATH` bajo `artifacts/browsers` y elegir `E2E_BROWSER`. Conservar resultados/capturas por motor antes de ejecutar el siguiente. Para PWA: `PWA_CHECK_PORT=5312 npm run check:pwa`, con sintaxis `$env:` en PowerShell. Los puertos 5310–5319 pertenecen a este frente.

## Estado de los requisitos

| Requisito | Evidencia y pendiente |
|---|---|
| RNF-01 | Descriptores, alineamiento, búsqueda e informes ejecutan Workers; se observan tareas de más de 50 ms durante arranque/renderizado. La muestra de Event Timing no certifica INP p75 <200 ms. Falta perfilar/dividir las tareas largas demostradas y medir interacciones representativas en campo. |
| RNF-02 | Alineamiento real 2.000 × 2.000 medido localmente bajo 5 s. Falta repetir en hardware físico acordado de cuatro núcleos, con procedencia, pares variados y condiciones térmicas/carga controladas. |
| RNF-03 | Comparación local repetible de LCP con perfil explícito; no acredita objetivo en producción ni con la instalación inicial de toda la PWA. Falta repetir en despliegue autorizado, varias rutas y dispositivos/redes, sin confundir CPU limitada con móvil físico. |
| RNF-04 | No se hizo carga remota. Falta prueba local del backend a 100 peticiones/min durante cinco minutos con latencias/errores/recursos; no dirigirla a Groq ni a proveedores compartidos. Corresponde a coordinación/backend. |
| RNF-08/09 | AA automático y teclado/foco/geometría en Chromium; falta lector de pantalla y matriz real de Firefox/WebKit/Safari y últimas dos versiones objetivo. |
| S7 | Entrega local revisable de auditoría, corrección y herramientas. El cierre integral sigue condicionado a las brechas anteriores; no se declara certificado por pasar las pruebas locales. |

## Segunda entrega — 25 de octubre de 2026

Continuación desde `a5de1cf`, en el mismo worktree y rama, sin mezclar `dev`. Los cuatro commits iniciales se conservan; el coordinador los integró por separado. Sin cambios de contrato, composición, catálogos es/en, algoritmos, WASM generado, Biblioteca/SIFTS, laboratorio ni backend.

### Sesión y modalidad

Dos regresiones fallaron antes de la corrección: una acción de Proyectos podía enviar una escritura con el token anterior tras cerrar sesión mientras esperaba el import; las cifras de una lectura seguían visibles sin sesión y la lectura podía reaparecer para otro propietario. Ahora se comprueba una revisión de propietario antes de continuar o publicar errores de la espera. La lectura y su import pertenecen a un componente por propietario; salir o cambiar cuenta desmonta esa instancia y cancela la petición. Refrescar el token del mismo propietario conserva la vista. Las pruebas cubren import abandonado, respuesta tardía, cifras retiradas y un acceso posterior que vuelve a funcionar con su sesión vigente.

El panel móvil usa `dialog.showModal()`: la prueba previa permitía enfocar programáticamente el contenido de fondo y ahora ese foco queda bloqueado. Se conserva el recorrido explícito de Tab/Mayús+Tab, Escape, cierre por velo y devolución del foco. Chromium comprueba también que el árbol AX no exponga el `main` del fondo; Firefox y WebKit comprueban el bloqueo de foco y los recorridos. No equivale a probar NVDA/VoiceOver reales. Las capturas revisadas mantienen el panel aprobado, ambos temas y 360/1280.

La matriz WebKit demostró contraste 1,6:1 en los botones de exportación oscuros: el fondo nativo gris variaba por motor. La primitiva `.button` recibe fondo transparente explícito; los estilos primario/secundario mantienen sus fondos. La comprobación AA del menú pasa después de la corrección.

### Recursos y motores reales

El instalador Node volvió a agotar espera, pero las mismas fuentes oficiales respondían por PowerShell. Se descargaron los ZIP indicados por `npx playwright install --dry-run`, validaron sus rutas antes de extraer y abrieron perfiles independientes:

| Motor | Archivo oficial y evidencia local |
|---|---|
| Firefox 155, revisión 1543 | Espejo oficial `playwright.download.prss.microsoft.com`, 127.960.949 bytes; SHA-256 `cb0cd830e2a5d6dc6f2122649de45123d778b7e94f9259e2f2c1436f425f5d69` |
| WebKit 26.6, revisión 2359 | `cdn.playwright.dev`, 62.672.093 bytes; SHA-256 `b9a4d90a004b0119ff590e26fddc84e2df0bb512304823974003a79b7d0bd2db` |

También se obtuvieron las utilidades oficiales FFmpeg 1011 y Winldd 1007. Todo queda bajo `artifacts/browsers`, ignorado. No se instalaron dependencias de aplicación ni se usó el navegador del propietario. Windows/WebKit **no certifica Safari**, macOS, iOS ni las dos versiones objetivo de cada navegador.

WebKit mostraba fallos al reutilizar Workers: el diagnóstico registró bloqueos COEP con caché normal, desaparecían sin revalidación y las respuestas 304 de preview omitían las cabeceras configuradas. La política CORP `same-origin` se aplica antes de la validación de caché en desarrollo/preview, conservando COOP y COEP; también se declara en `vercel.json`. Las recargas y la navegación con caché normal pasan en los tres motores. El síntoma coincide con [un fallo de revalidación/CORP documentado por WebKit](https://bugs.webkit.org/show_bug.cgi?id=289517); esta asociación es una inferencia, no una comprobación de su implementación interna. La configuración de despliegue queda para revisión/publicación posterior: no se comprobó remotamente.

Firefox exponía HTTP 304 desde Workers hijos y la antigua E2E exigía 200 en todos ellos. Se mantiene el resultado científico y se refuerza la comprobación: al menos una descarga 200, binario idéntico byte por byte al WASM versionado, revalidaciones solo de esa URL y petición condicional explícita con el ETag conocido, respuesta 304 y CORP. No se acepta un error como éxito ni se cambian umbrales. La cancelación usa teclado sobre el máximo de entrada ya admitido, de modo que la estabilidad geométrica del botón no consuma la breve ventana de cancelación; se sigue exigiendo estado cancelado y ausencia de resultado.

Este WebKit carece de `transferControlToOffscreen`. Se conserva el aviso y la tabla calculada existentes, con pruebas obligatorias de datos y cambio de ventana. Las aserciones antiguas que exigen gráfica/fuente del canvas no se relajaron ni se marcaron omitidas. Por tanto, no se declara verde la batería gráfica completa de ese motor.

### Rendimiento atribuido e interacciones

El perfil de Inicio con mapas de fuentes identificó construcción repetida de `Intl.NumberFormat`. Se reutilizan formateadores por hook, idioma y opciones, con hasta 16 variantes retenidas. Pruebas comparan la salida nativa para español/inglés, unidades, opciones mutadas, negativos, cero negativo, infinito y NaN; también verifican reutilización entre valores y renders. No se cachean cifras ni se cambian métodos científicos.

La primera comparación no alternada del día dio LCP p75 de Inicio 2.303 ms antes y 2.400 ms después; **no se usa para atribuir una mejora**. Se hizo después un experimento alternado de cinco pares fríos, con el mismo navegador y perfil 4G/CPU ×4. La variante de referencia solo sustituye `useTranslation.ts` por su fuente de `a5de1cf`, mediante un plugin temporal de build; mantiene las demás correcciones. No se modificó `src` para generar esa variante.

| Medida del experimento alternado | Sin reutilización | Con reutilización |
|---|---:|---:|
| LCP p75 Inicio | 2.426,0 ms | 2.345,6 ms |
| Mayor tarea observada | 217 ms | 175 ms |

Los cinco pares favorecieron la reutilización; diferencia p75 aproximada del 3,3 %. El perfil diagnóstico separado redujo el tiempo propio muestreado de formateo de 129,1 a 51,1 ms. El perfil añade sobrecarga y no es una distribución estadística; las tareas de más de 50 ms persisten, especialmente en dibujo/layout. No se modificó el visor compartido para ampliar esa optimización.

La medición final también registra Event Timing con umbral 16 ms, retraso de entrada y procesamiento; agrupa eventos por `interactionId`, espera su entrega y excluye entradas anteriores a cada acción. Son interacciones sintéticas en el perfil nativo, no CPU ×4 ni INP de campo:

| Acción, cinco muestras | Interacciones reportadas | p75 / máximo reportado |
|---|---:|---:|
| Abrir menú | 5 | 24 / 40 ms |
| Cambiar tema | 5 | 40 / 40 ms |
| Cerrar menú | 5 | 24 / 32 ms |
| Cambiar ventana de perfil | 5 | 24 / 24 ms |
| Escribir 20 residuos por muestra | 47 | 16 / 16 ms |

Una entrada ausente no equivale a latencia cero. No se calcula ni certifica INP p75 de usuarios. Antes de la medición se comprobó la lista de procesos de pruebas: vacía; el coordinador había comunicado el fin de sus runners. No se controlan temperatura, energía ni aplicaciones ajenas del equipo.

Artefactos ignorados bajo `artifacts/quality`: `before-formatting-2026-10-25.json`, `after-formatting-2026-10-25.json`, `paired-number-startup-2026-10-25.json`, `startup-before.cpuprofile`, `startup-before-profile.json`, `startup-after-profile.cpuprofile`, `startup-after-profile.json`, mapas del índice y `processes-before-final-performance-2026-10-25.json`. El experimento alternado y su variante se conservan en `tmp/compare-number-startup.mjs`, `tmp/build-number-baseline.mjs` y `artifacts/quality/no-number-cache-2026-10-25`; sus condiciones están en el JSON.

Para repetir la atribución: build con `npm run build -- --sourcemap`; `STARTUP_PROFILE_OUTPUT=artifacts/quality/otro-perfil node scripts/profile-startup.mjs`. Para tiempos/interacciones sin profiler: `AUDIT_OUTPUT=artifacts/quality/otra-medicion.json node scripts/audit-performance.mjs`. Asignar variables mediante `$env:` en PowerShell. Después se verificó el build normal sin mapas. Los mapas y perfiles no se versionan.

### Verificación y límites de cierre

- 362 unitarias / 69 archivos correctos, dos workers. Cobertura 84,20 / 74,81 / 81,75 / 87,41 %, mínimos intactos. Repetición final afectada 13/13. Tipos, lint y build normal correctos; avisos previos de Vite conservados.
- Chromium: 44/44 en la matriz inicial y 11/11 de comprobaciones posteriores. Firefox: 43/44 inicialmente; el único fallo era la interpretación de 304, luego WASM 2/2 y nuevas comprobaciones de caché, tabla y contraste correctas. No se repitieron los 43 recorridos ya aprobados.
- WebKit: matriz inicial 25/44; se conservaron sus fallos como evidencia. Tras corregir caché/contraste y hacer determinista la cancelación: 8/8 afectados correctos (alineamiento, informes PDF/JSON/CSV consecutivos, carga anónima, recargas y tabla), además de modalidad y WASM correctos en las comprobaciones específicas. Las gráficas sin transferencia de canvas continúan como capacidad ausente, no como pruebas aprobadas.
- PWA limpia final correcta en Chromium y Firefox: 46 recursos / 2.847,23 KiB; fuentes, Workers/WASM, aislamiento, PDF, laboratorio y cuaderno exacto offline; Mol* excluido. WebKit registra `page.reload: WebKit encountered an internal error` al recargar tras `setOffline(true)`: **offline no certificado** en ese motor; no se evitó esa comprobación para darla por aprobada.
- **Al cierre del 25, actualización de PWA existente no probada.** Los recursos cuyo hash no cambie pueden conservar respuestas precache previas sin CORP. Las pruebas con perfil limpio no acreditan migración de cabeceras ni actualización segura desde una instalación anterior. La comprobación acotada del 26 se describe al final; no equivale a migrar todas las cabeceras ni a certificar otras transiciones.
- Capturas por motor en `artifacts/quality/{chromium,firefox,webkit}-2026-10-25/`, tabla en `profile-data-*-2026-10-25.png`, exportación en `reports-*-*.png`. Se revisaron el menú y la alternativa de tabla y el contraste corregido; no hay nueva composición.

Quedan abiertos RNF-01 (tareas largas e INP de campo), RNF-02 (hardware físico acordado), RNF-03 (producción/red/PWA instalada), RNF-04 (carga del backend), lectores de pantalla reales, Safari/dispositivos físicos/versiones anteriores y los límites PWA indicados. Esta entrega reduce defectos comprobados y amplía evidencia; no certifica S7 integral ni publica cambios.

### Cierre de herramientas — 26 de octubre de 2026

`check-pwa.mjs` incluye ahora el arranque del navegador dentro de `try/finally` y cierra el servidor incluso si falla el arranque o el cierre del navegador. Verificación acotada con ejecutable inexistente: error de arranque esperado, proceso terminado y puerto 5319 disponible para un nuevo servidor. La comprobación inicial por conexión recibió `EACCES` del entorno y no se usó como evidencia; la comprobación posterior pudo enlazar y liberar ese mismo puerto. Registros `artifacts/quality/pwa-launch-failure-2026-10-26.log` y `pwa-launch-cleanup-2026-10-26.log`; sintaxis y diff correctos. No se repiten ni se amplían las baterías de aplicación por este ajuste de limpieza.

## Transición de PWA instalada — 26 de octubre de 2026

Comprobación adicional de un solo escenario en **WebKit 26.6 / Windows**, con Service Workers permitidos y un contexto de navegador independiente. Se generaron dos builds con las mismas dependencias instaladas: fuente Git completa de `a5de1cf7dab7b49330ca15ec13c95aa9365e73e6`, anterior a CORP, y fuente de esta copia en `1893ff3f9ed8623edda16d72bbf09a1f70ff0fcf`. La fuente anterior se extrajo con `git archive` bajo `tmp`, validando las rutas antes de extraer; sin checkout/rebase ni escritura en `dev`. No se prueba el árbol canónico posterior con cambios de otros frentes.

Ambas versiones se sirven sucesivamente desde **el mismo servidor y origen** `http://127.0.0.1:5316`: COOP `same-origin` y COEP `require-corp` en ambas fases, CORP `same-origin` solo en la nueva. El servidor estático local conserva caché HTTP, ETag y respuestas condicionales; las rutas Auth/RPC se resuelven en una fixture local con identidad ficticia y un documento en memoria. No se interceptan recursos con `page.route`, no se desactiva la caché, no se usan servicios reales ni credenciales del propietario. Esto comprueba la transición local de precaché, no el comportamiento de un CDN o despliegue real.

Recorrido final, **1/1 correcto**:

1. Instalar la versión anterior y recargar hasta que su Service Worker controle la página; comprobar aislamiento y nueve recursos comunes precacheados sin CORP.
2. Editar una secuencia propia de 60 residuos y ventana 19, calcular y guardar proyecto mediante la API local simulada.
3. Cambiar el servidor al build nuevo y solicitar la comprobación normal con `registration.update()`. El reemplazo queda `installed/waiting`; no se fuerza `skipWaiting`. El borrador sigue intacto y permite editar a 61 residuos y ventana 9; se guardan esos cambios explícitamente.
4. Cerrar todas las páginas controladas, dejar la aplicación cerrada un segundo y reabrir en **el mismo contexto y origen**. Comprobar controlador activo, ausencia de reemplazo en espera y script principal del build nuevo. Ese segundo representa el intervalo entre cerrar/reabrir; no mide latencia de actualización ni sustituye las aserciones del estado activo.
5. Comprobar recuperación de los 61 residuos y ventana 9 del proyecto guardado, y contenido de `localStorage` idéntico, incluida la referencia al proyecto. Editar a 62 residuos, recalcular cinco descriptores, alinear una pareja nueva de nueve residuos con resultado `9 de 9` y volver a Analizar manteniendo el nuevo borrador.

Los nueve recursos comunes —ocho Workers y WASM— permanecen precacheados **sin CORP**, como antes. No hubo peticiones al servidor de esos recursos durante la fase nueva; el cálculo y alineamiento funcionan con los recursos retenidos. El WASM de 21.953 bytes coincide exactamente con el versionado, SHA-256 `55f5794d3016738c551ae7b10fdcccc0cf89a6137928924c27a32879078bed9f`. Aislamiento conservado, dos escrituras explícitas a la fixture local, cero errores de página/consola y cero peticiones externas en la ejecución final. No se borraron perfiles, almacenamiento ni cachés manualmente; solo se ejecutó la limpieza normal del propio Workbox al activar. **Esta transición online no reproduce una necesidad de invalidar recursos por CORP**, por lo que no se cambia la política de precaché ni se modifica código de producto.

La conservación tiene un alcance preciso: el borrador sin guardar permanece mientras espera la actualización y entre rutas dentro de una página viva; tras cerrar/reabrir se recupera el **proyecto guardado**. El editor mantiene intencionadamente su texto en memoria, sin persistir secuencias en almacenamiento local. No se atribuye a esta prueba recuperación automática de texto sin guardar tras cerrar la aplicación, ni se prueba persistencia real de Supabase/JWT.

Artefactos ignorados: `artifacts/quality/pwa-upgrade-2026-10-26/result.json`, builds `before/after`, fuente Git archivada y `after-upgrade.png`, revisada. Log final `artifacts/quality/pwa-upgrade-online-final-2026-10-26.log`. SHA-256 de los Service Workers: anterior `948f3f1a75ae43bf6e273cc7552261860c62d403d4240868b1ea213f0c7507e5`, nuevo `47460a0580b1b5bc9d274e48a3c2eb881a24191a044549b440cbe0b9a04a7468`.

Los intentos previos se conservan y **no se cuentan como aprobados**: acceso local inicialmente restringido, espera de evento de inspección no expuesto por WebKit y timeouts al reabrir/probar activación. La ejecución final usa el estado de registro desde la página y el intervalo de aplicación cerrada descrito. Un intento adicional con `setOffline(true)` después de activar y recuperar el proyecto permitió recalcular con el Worker ya vivo, pero al crear el alineamiento emitió `WebKit encountered an internal error`; evidencia en `offline-internal-error.json` y `pwa-upgrade-final-2026-10-26.log`. El resultado online final **no resuelve ni certifica offline**, y no basta para atribuir aquel error a CORP o a la migración. Se mantienen los límites gráficos/offline de WebKit, Safari, versiones anteriores, actualización en producción y borradores sin guardar. No se amplió la matriz ni se repitieron rendimiento/baterías generales.

Reproducción del escenario completo (requiere el WebKit oficial instalado y `tar` disponible):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $PWD 'artifacts/browsers'
$env:PWA_UPGRADE_OUTPUT='artifacts/quality/otra-transicion'
node node_modules/playwright/cli.js test --config scripts/pwa-upgrade.config.mjs
```

El comando genera ambos builds bajo la salida indicada y usa solo ajustes públicos ficticios del servidor local. `PWA_UPGRADE_BEFORE_REVISION` permite elegir explícitamente otra revisión, que constituye otra transición por verificar. La configuración dedicada usa un solo motor/worker y no incorpora el archivo `.check.ts` a las E2E generales. Tipos E2E, lint del comprobador y sintaxis de su configuración correctos; no hay cambios de dependencias ni nuevos textos de interfaz.
