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
