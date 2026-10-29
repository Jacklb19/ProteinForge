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

Ninguno cambia lo que se ve, la química del color, los textos ni la composición. No hay textos nuevos de interfaz, así que los catálogos no cambian.

### BackboneView (`b1ebe5c`)

Está en Inicio (escenario con giro en reposo) y también en Analizar (la miniatura de la vista Resumen), así que afecta a las dos rutas medidas.

- **Un solo pintado por cambio.** Al montarse, el lienzo se pintaba tres veces con el mismo resultado: en el efecto de montaje, en el primer aviso del `ResizeObserver` —que el navegador siempre emite al observar— y al resolverse `document.fonts.ready`, aunque las fuentes ya estuvieran cargadas. Ahora se guarda de qué dependió el último pintado: tamaño, densidad, orientación, paleta, modo, selección por valor, etiquetas, modelo y referencia. Una petición idéntica no repinta. Las fuentes solo fuerzan otro pintado si estaban cargándose al montar, que es el único caso en que las etiquetas pueden cambiar.
- **Paleta por tema.** Los colores se leían de los tokens con `getComputedStyle` en cada pintado, también en cada fotograma del giro en reposo. Ahora se leen una vez por tema; `useThemeRevision` invalida la lectura, igual que antes invalidaba el efecto.
- **Colores por residuo calculados una vez.** El contorno y el brillo de cada segmento dependen del residuo, del modo y de la paleta, no de la orientación; se calculan una vez por paleta y modo. La niebla por profundidad sí depende del fotograma y se sigue calculando en cada uno, con la misma aritmética y el mismo redondeo.

**Comprobación de que no cambia nada visible:** `BackboneView.test.tsx` registra cada marca pintada en el lienzo —trazo con su recorrido, color, grosor, extremos y transformación; rectángulos y textos con su estilo, fuente y opacidad— y fija su huella en cinco casos: química con extremos de cadena, hidropatía con selección rotulada, cadenas sobre una referencia a densidad 2, giro por teclado y cambio a tema oscuro. La prueba se confirmó en `9a1ed06` **antes** de optimizar, y las cinco huellas son idénticas después. Las cuatro pruebas nuevas de repintado fallan con el código anterior y pasan con el nuevo.

### HydropathyProfile (`f24c328`, `14cdb45`)

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
