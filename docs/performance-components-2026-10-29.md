# Medición repetible de LCP y coste de BackboneView e HydropathyProfile — 29 oct 2026

Rama `parallel/perf-components`, creada desde `dev` `869ce2d`, en el worktree `worktree-perf-components`. Sin push, merge, despliegue ni gasto.

## Por qué hace falta otro procedimiento

La auditoría del 27 y 28 de octubre ([detalle](performance-2026-10-27.md)) mide 7 cargas por ruta y build en corridas separadas. Eso tiene dos límites, que este procedimiento corrige:

1. **Con 7 cargas no se puede acreditar un p75.** El intervalo de confianza del 95 % de un cuantil, construido con estadísticos de orden, no tiene cota superior con 7 muestras: el número de cargas por debajo del p75 real sigue una binomial(7; 0,75), y ni siquiera la mayor de las 7 lo supera con un 97,5 % de probabilidad. Con 7 cargas, «p75 < 2,5 s» es una lectura, no una conclusión. La prueba `scripts/lcp-stats.test.mjs` lo deja fijado.
2. **Comparar corridas distintas mezcla el cambio con el estado del equipo.** El 28 de octubre el mismo build dio 238 y 518 ms de bloqueo con minutos de diferencia, y Analizar pasó de 2.449 a 2.526 ms de mediana sin cambiar el código.

## Procedimiento

**Builds.** Cada variante es un build de producción de un commit concreto, desde un árbol limpio, sin Auth configurada, como CI:

```powershell
$env:CI='true'; $env:VITE_SUPABASE_URL=''; $env:VITE_SUPABASE_ANON_KEY=''
npx vite build --outDir artifacts/lcp-builds/<commit>                 # tiempos
npx vite build --sourcemap --outDir artifacts/lcp-builds/<commit>-maps # perfil atribuido
```

**Cargas emparejadas** (`scripts/measure-lcp.mjs pairs`). Se sirven las dos variantes a la vez con `vite preview`, el mismo servidor que la auditoría, en los puertos 5340 (A) y 5341 (B). En cada ronda y cada ruta se carga A y B seguidas, y el orden se invierte en rondas alternas (ABBA), así que la deriva lenta del equipo afecta a las dos por igual y se cancela en la diferencia.

Las condiciones de cada carga son las de la auditoría:

- Chrome del sistema, contexto nuevo, Service Workers bloqueados y caché vacía.
- Ventana de 360 × 900 y movimiento sin reducir.
- Perfil RNF-03 «4G lenta» por CDP: 150 ms de latencia, 1,6 Mbit/s de bajada, 750 kbit/s de subida y CPU ×4.
- Se espera el `h1`, las fuentes y, en Analizar, los cinco campos de descriptores; después se observa 2,5 s más.

Por carga se registran el LCP con su elemento, el FCP, el CLS, las tareas largas y la fracción de CPU ocupada en el equipo durante la carga, incluido el propio navegador medido.

**Calibración A/A.** La misma build en los dos puertos. Es una diferencia que vale cero por construcción, así que su dispersión es el ruido del procedimiento en ese momento. Con ella se calcula cuántos pares hacen falta para resolver un efecto dado.

**Perfil atribuido** (`scripts/measure-lcp.mjs profile`). Con los builds con mapas de fuente, cada carga se muestrea con el perfilador de CDP hasta 2 s después de cargar, y el tiempo propio se asigna a su archivo de origen. Se informa el tiempo de BackboneView (`BackboneView.tsx` y `backbone.ts`), el de HydropathyProfile con sus piezas, y el total de script. Por omisión se perfila con movimiento reducido, como el perfil del que salen los 113 ms de BackboneView, porque con el giro en reposo el total depende de cuánto dura la ventana; `LCP_MOTION=no-preference` lo incluye.

## Estadística

Todo en `scripts/lcp-stats.mjs`, sin suponer normalidad, porque las cargas tienen colas por la contención del equipo:

- **Mediana y p75** con la convención de la auditoría: p75 por rango más cercano.
- **Intervalos del 95 %** de la mediana y del p75 por estadísticos de orden, binomial exacta. Si las cargas no alcanzan para una cota, la cota es nula y se dice.
- **Diferencia emparejada B − A**: mediana con su intervalo del 95 %, que es el de la prueba de signos, y recuento de pares en que B fue más rápida o más lenta.
- **Dispersión robusta**: 1,4826 × MAD, para que una carga atascada no la domine.
- **Tamaño necesario**, aproximación normal declarada:
  - pares para que el intervalo de la diferencia mediana sea más estrecho que ±δ: n ≥ (1,96 · √(π/2) · σ / δ)²;
  - cargas para que el intervalo del p75 quede a un lado de 2,5 s cuando el margen es m: n ≥ (1,96 · 1,363 · σ / m)².
- **Veredicto RNF-03** sobre el p75: «se cumple» solo si la cota superior del intervalo es menor que 2.500 ms; «no se cumple» si la inferior es mayor o igual; si no, «no concluyente».

## Repetición

```powershell
# Calibración A/A, 20 rondas por ruta
$env:LCP_A='artifacts/lcp-builds/869ce2d'; $env:LCP_B=$env:LCP_A; $env:LCP_OUTPUT='artifacts/quality/lcp-aa.json'; node scripts/measure-lcp.mjs pairs
# Antes (A) y después (B)
$env:LCP_A='artifacts/lcp-builds/869ce2d'; $env:LCP_B='artifacts/lcp-builds/<commit>'; $env:LCP_OUTPUT='artifacts/quality/lcp-ab.json'; node scripts/measure-lcp.mjs pairs
# Perfil atribuido, con los builds con mapas
$env:LCP_A='artifacts/lcp-builds/869ce2d-maps'; $env:LCP_B='artifacts/lcp-builds/<commit>-maps'; $env:LCP_ROUNDS='7'; $env:LCP_OUTPUT='artifacts/quality/lcp-profile.json'; node scripts/measure-lcp.mjs profile
```

`LCP_ROUNDS` fija las rondas y `LCP_ROUTES` las rutas (`home,analyze`). Los datos crudos van a `artifacts/quality/`, carpeta ignorada. **Estas tandas usan el navegador y ocupan el equipo: se ejecutan solo con el carril de mediciones asignado**, nunca a la vez que las E2E o las mediciones de otra sesión.

## Cambios

Queda adoptado solo el de BackboneView. Ninguno de los ensayados cambia lo que se ve, la química del color, los textos ni la composición. No hay textos nuevos de interfaz, así que los catálogos no cambian.

### BackboneView (`b1ebe5c`)

Está en Inicio (escenario con giro en reposo) y también en Analizar (la miniatura de la vista Resumen), así que afecta a las dos rutas medidas.

- **Un solo pintado por cambio.** Al montarse, el lienzo se pintaba tres veces con el mismo resultado: en el efecto de montaje, en el primer aviso del `ResizeObserver` —que el navegador siempre emite al observar— y al resolverse `document.fonts.ready`, aunque las fuentes ya estuvieran cargadas. Ahora se guarda de qué dependió el último pintado: tamaño, densidad, orientación, paleta, modo, selección por valor, etiquetas, modelo y referencia. Una petición idéntica no repinta. Las fuentes solo fuerzan otro pintado si estaban cargándose al montar, que es el único caso en que las etiquetas pueden cambiar.
- **Paleta por tema.** Los colores se leían de los tokens con `getComputedStyle` en cada pintado, también en cada fotograma del giro en reposo. Ahora se leen una vez por tema; `useThemeRevision` invalida la lectura, igual que antes invalidaba el efecto.
- **Colores por residuo calculados una vez.** El contorno y el brillo de cada segmento dependen del residuo, del modo y de la paleta, no de la orientación; se calculan una vez por paleta y modo. La niebla por profundidad sí depende del fotograma y se sigue calculando en cada uno, con la misma aritmética y el mismo redondeo.

**Comprobación de que no cambia nada visible:** `BackboneView.test.tsx` registra cada marca pintada en el lienzo —trazo con su recorrido, color, grosor, extremos y transformación; rectángulos y textos con su estilo, fuente y opacidad— y fija su huella en cinco casos: química con extremos de cadena, hidropatía con selección rotulada, cadenas sobre una referencia a densidad 2, giro por teclado y cambio a tema oscuro. La prueba se confirmó en `9a1ed06` **antes** de optimizar, y las cinco huellas son idénticas después. Las cuatro pruebas nuevas de repintado fallan con el código anterior y pasan con el nuevo.

### HydropathyProfile (`f24c328`, `14cdb45`): ensayado y revertido en `58b9488`

No midió ninguna mejora (ver resultados), así que se revirtió con un commit nuevo, sin reescribir historia. Se describe aquí lo que se probó.

En Analizar se monta siempre, aunque en la vista Resumen, la inicial, todas sus secciones están ocultas.

- **Sin volver a construir lo que no cambia** (`f24c328`). El lector de residuos, el mapa de la secuencia, las tiras de tendencia y la tabla de valores repiten cada residuo, unos novecientos elementos con el ejemplo de insulina, y cada render de la página de análisis los reconstruía. Ahora:
  - esas piezas están memorizadas;
  - el manejador de selección que reciben es estable y reenvía al último, porque el editor pasa uno nuevo en cada render;
  - la caja del gráfico solo se actualiza si cambian su ancho o su margen.

  Una prueba nueva cuenta los renders de cada pieza: falla con el código anterior, que las rehacía todas, y pasa con el nuevo.
- **El perfil calculado entra en una transición** (`14cdb45`). El render que llena esas secciones al llegar el resultado del Worker era trabajo urgente y podía caer justo antes de pintar las cifras de descriptores, que son el elemento LCP de Analizar. Ahora es una transición de React: cede ante las actualizaciones urgentes, sin cambiar qué se muestra ni cuándo desaparece «Calculando…» en una carga sin competencia.

## Calibración A/A y estado de RNF-03 en `dev` (`869ce2d`)

Tanda del 29 de octubre, 16:46 UTC, con el carril de mediciones asignado y **ninguna otra sesión usando el navegador ni ejecutando pruebas**. La CPU del equipo estuvo ocupada de mediana un 14 % en Inicio y un 13 % en Analizar, contando el propio navegador medido. Chrome 156.0.8078.48. El mismo build, `artifacts/lcp-builds/869ce2d`, se sirvió en los dos puertos: 20 rondas por ruta, es decir 40 cargas por ruta. Datos: `artifacts/quality/lcp-aa-2026-10-29.json`, ignorado.

### Ruido del procedimiento

La diferencia entre dos copias idénticas debería ser cero; lo que mide es el ruido.

| Ruta | Diferencia B − A, mediana [IC 95 %] | Pares B más rápida / más lenta | σ robusta de la diferencia | Pares para resolver ±10 / ±20 / ±30 / ±50 ms |
|---|---:|---:|---:|---:|
| Inicio | +2 ms [−6; +32] | 10 / 10 | 36 ms | 79 / 20 / 9 / 4 |
| Analizar | −12 ms [−23; +1] | 14 / 6 | 21 ms | 28 / 7 / 4 / 2 |

- Ningún intervalo excluye el cero: el procedimiento no inventa diferencias entre dos copias iguales.
- En Analizar la diferencia roza el límite, −12 ms con el intervalo terminando en +1. Puede ser un pequeño sesgo del puerto o simple azar. Por eso, al comparar dos builds, conviene repetir la tanda con los puertos intercambiados y combinar las dos.
- **Con 30 pares**, que es la tanda prevista para el antes y el después, se resuelven efectos de unos 20 ms en Inicio y de unos 10 ms en Analizar. Un efecto menor no se puede atribuir en este equipo.

### RNF-03 con 40 cargas del mismo build

| Ruta | LCP mediana [IC 95 %] | p75 [IC 95 %] | σ robusta | Mín. – máx. | Cargas < 2.500 ms | Veredicto sobre el p75 |
|---|---:|---:|---:|---:|---:|---|
| Inicio | 2.241 [2.232; 2.249] ms | 2.255 [2.243; 2.272] ms | 20 ms | 2.184 – 2.333 ms | 40 de 40 | **Se cumple**, con unos 230 ms de margen sobre la cota superior |
| Analizar | 2.541 [2.531; 2.552] ms | 2.555 [2.546; 2.566] ms | 25 ms | 2.474 – 2.582 ms | 1 de 40 | **No se cumple** |

En las dos rutas el elemento LCP es el de siempre:

- Inicio, el título `h1#hero-title`;
- Analizar, una cifra de descriptores (`dd`) o su texto explicativo (`span`).

El CLS máximo es 0,00005 en Inicio y 0,007 en Analizar, como en la auditoría.

**Conclusión, con método:** en `dev`, Analizar no cumple RNF-03 en este equipo con el perfil 4G lenta y CPU ×4.

- No es cuestión de ruido. Con la máquina en reposo, todo el intervalo del p75 queda por encima de 2,5 s, y solo 1 de 40 cargas bajó del objetivo.
- El 27 de octubre se midieron 2.449 ms de mediana con 7 cargas. Esa cifra no se repite hoy. Puede deberse a lo que `dev` ha incorporado desde entonces o a las condiciones de aquella noche; con 7 cargas sin intervalo no hay forma de saber cuál de las dos.
- Inicio sí queda acreditado de forma repetible, con un margen que es unas diez veces la dispersión.

## Antes y después

Mismas condiciones que la calibración, con el carril asignado y la máquina en reposo: CPU ocupada de mediana un 12–15 %. Autorizado por el propietario el 29 de octubre. Datos en `artifacts/quality/lcp-*-2026-10-29.json`, ignorado. Cada comparación se hizo dos veces, la segunda con los puertos intercambiados, y se combinan los pares para cancelar el posible sesgo del puerto.

### Coste propio de cada componente (perfil atribuido)

Se comparan 10 pares por ruta: `869ce2d` contra `14cdb45`, ambos con mapas de fuente. Los archivos de BackboneView son idénticos en `14cdb45` y en `b1ebe5c`, así que su fila vale para el cambio adoptado. Las cifras son tiempo propio muestreado en la ventana de carga con CPU ×4: mediana, con el intervalo del 95 % entre corchetes.

| Escenario | BackboneView antes → después | Diferencia emparejada | Script total, diferencia | HydropathyProfile antes → después |
|---|---:|---:|---:|---:|
| Inicio, movimiento reducido | 76 [72; 81] → **65** [59; 72] ms | −12 [−16; −1] ms, 9 de 10 más rápidas | −18 [−27; +6] ms | No está en la ruta |
| Analizar, movimiento reducido | 113 [102; 130] → **60** [58; 67] ms | **−49** [−66; −43] ms, 10 de 10 | −42 [−73; −25] ms | 15 → 16 ms, +2 [−3; +5] |
| Inicio, con giro en reposo | 1.864 [1.846; 1.881] → 1.842 [1.809; 1.860] ms | −32 [−53; +4] ms | −36 [−71; −10] ms | No está en la ruta |
| Analizar, con movimiento | 128 [114; 145] → **82** [73; 87] ms | **−45** [−65; −30] ms, 10 de 10 | −45 [−53; −16] ms | 15 → 17 ms, +1 [−3; +6] |

- **BackboneView: mejora real y repetible.** Con movimiento reducido, que es el perfil del que salían los 113 ms, su coste en Analizar baja a la mitad y en Inicio un 15 %. La reducción coincide con los dos pintados redundantes que se eliminaron. Esos 113 ms se reproducen exactamente en Analizar.
- **HydropathyProfile: su propio código cuesta unos 15 ms y no cambia.** Lo que memorizar ahorraría es trabajo de React en otras partes de la página, y no aparece ni en el script total ni en el LCP, abajo. **Revertido.**
- **Hallazgo — el giro en reposo de Inicio.** Con movimiento, BackboneView consume **unos 1,85 s de CPU** en los ~4,5 s que dura la ventana con CPU ×4, alrededor del 40 % del hilo principal.
  - No toca el LCP, porque el giro empieza después del primer pintado, ni crea tareas largas, porque ningún fotograma supera los 50 ms.
  - Sí compite con cualquier interacción mientras la portada está visible.
  - El coste es el trazado: unos 1.500 trazos de lienzo por fotograma, tres por cada uno de los ~500 segmentos. Mis cambios solo le quitan un 2 %.
  - Reducirlo de verdad exige dibujar menos o con menos frecuencia, y eso cambia lo que se ve: lo dejo como propuesta para el propietario, sin implementar.

### LCP y bloqueo

| Comparación (pares) | Ruta | LCP, diferencia B − A [IC 95 %] | B más rápida / más lenta | Bloqueo, diferencia | Mayor tarea, diferencia |
|---|---|---:|---:|---:|---:|
| `869ce2d` → `14cdb45`, los dos componentes (50) | Inicio | +3 [−5; +12] ms | 21 / 29 | +1 [−3; +9] ms | — |
| | Analizar | +6 [−6; +17] ms | 20 / 30 | −1 [−6; +5] ms | — |
| `869ce2d` → `b1ebe5c`, solo BackboneView (40) | Inicio | −5 [−22; +3] ms | 25 / 15 | −5 [−12; +3] ms | 0 [−4; +2] ms |
| | Analizar | +7 [−7; +24] ms | 18 / 22 | +2 [−10; +10] ms | +1 [−3; +4] ms |

**Ningún cambio mueve el LCP ni el bloqueo de forma detectable.** Lo que el procedimiento permite afirmar es lo siguiente:

- BackboneView adoptado no empeora el LCP de Inicio y, como mucho, lo empeora 24 ms en Analizar (cota superior del intervalo). Lo más probable, por la mediana, es que no cambie.
- El ahorro de CPU de BackboneView, unos 45–49 ms en Analizar, ocurre en tareas que no están en el camino del LCP y que no superan los 50 ms, así que no se ve ni en el LCP ni en el bloqueo.
- La transición de HydropathyProfile tampoco adelantó las cifras de descriptores: +6 ms [−6; +17] con los dos cambios juntos.

### RNF-03, en todas las tandas del día

| Tanda (hora UTC) | Build | Inicio p75 [IC] | Analizar mediana | Analizar p75 [IC] | Cargas de Analizar < 2.500 ms |
|---|---|---:|---:|---:|---:|
| A/A (16:46) | `869ce2d` | 2.255 [2.243; 2.272] | 2.541 | 2.555 [2.546; 2.566] | 1 / 40 |
| A/B (17:09 + 17:19) | `869ce2d` | 2.245 [2.237; 2.255] | 2.526 | 2.543 [2.532; 2.545] | 7 / 50 |
| A/B (17:09 + 17:19) | `14cdb45` | 2.252 [2.245; 2.264] | 2.528 | 2.556 [2.545; 2.573] | 9 / 50 |
| A/B (17:34 + 17:41) | `869ce2d` | 2.236 [2.229; 2.248] | 2.512 | 2.526 [2.518; 2.533] | 11 / 40 |
| A/B (17:34 + 17:41) | `b1ebe5c` | 2.230 [2.220; 2.235] | 2.511 | 2.531 [2.521; 2.562] | 11 / 40 |

**Respuesta sobre RNF-03, de forma repetible en este equipo, con 4G lenta y CPU ×4:**

- **Inicio se cumple.** En las cinco filas la cota superior del p75 queda entre 2.235 y 2.272 ms, y las 220 cargas bajan de 2,5 s.
- **Analizar no se cumple, ni antes ni después de este trabajo.** En las cinco filas la cota inferior del p75 queda por encima de 2.500 ms, entre 2.518 y 2.546. El veredicto no depende del ruido: lo que varía entre tandas, unos 30 ms de deriva en la mediana del mismo build a lo largo de una hora, desplaza las cifras pero no las lleva por debajo del objetivo.
- **Cuánto falta:** el p75 de Analizar está entre 25 y 60 ms por encima de 2,5 s. Para acreditarlo con este procedimiento, el cambio tendría que bajar el p75 al menos unos 60–80 ms, para que la cota superior quede por debajo del objetivo en todas las tandas. Los dos componentes de este encargo no están en ese camino. Lo que sí está, según la auditoría y el seguimiento del 28 de octubre, es la evaluación del JavaScript inicial y el primer render de los proveedores de estado.

## Verificación

Ejecutada en este worktree con `CI=true` y `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` vacías, sobre `14cdb45`, antes de revertir HydropathyProfile:

- tipos y lint correctos;
- **637/637 pruebas unitarias en 92 archivos**, con 2 trabajadores; cobertura del 87,3 % en sentencias, 78,23 % en ramas, 83,37 % en funciones y 91,19 % en líneas;
- build correcto, con precaché de 65 entradas y 2.578,52 KiB;
- `check:pwa` correcto en Chromium, en el puerto 5346.

Repetida sobre el árbol final, ya con HydropathyProfile revertido y en las mismas condiciones:

- tipos y lint correctos;
- **636/636 pruebas unitarias en 92 archivos**, una menos que antes: la prueba de memorización, que se revirtió con su código. Cobertura del 87,31 % en sentencias, 78,3 % en ramas, 83,36 % en funciones y 91,21 % en líneas;
- build correcto, con precaché de 65 entradas y 2.578,15 KiB, y el fragmento inicial de 356,96 kB (110,32 kB comprimido);
- `check:pwa` correcto en Chromium.

**La batería E2E no se ejecutó en esta rama:** el control de permisos de la sesión la bloqueó y queda pendiente de autorización expresa.

## Límites

- `vite preview` en local, sin CDN, TLS ni HTTP/2 real. La emulación de CPU ×4 no es un teléfono.
- Las tandas son de un solo equipo y de una sola tarde. La deriva entre tandas, unos 30 ms en la mediana de Analizar, es mayor que el efecto que se quería medir; por eso las comparaciones son siempre emparejadas.
- El perfil atribuido es un muestreo y añade su propia sobrecarga. Sus cifras sirven para comparar dentro de la misma tanda, no como tiempos absolutos.
- No se midió ninguna interacción, es decir RNF-01, ni el efecto del giro en reposo sobre ellas. Tampoco se ejecutó la batería E2E en esta rama.
- La prueba de huellas del lienzo usa un contexto registrado en jsdom: garantiza que las órdenes de pintado y su estado son idénticos, no la rasterización de un navegador concreto.
