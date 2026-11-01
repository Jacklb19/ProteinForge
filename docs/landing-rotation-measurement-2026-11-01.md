# Medición del giro de la portada y sus alternativas — 1 nov 2026

> **Decisión del 1 nov:** el propietario eligió 30 fps. Implementado con la misma regla que la variante medida; ver [decisiones](decisiones.md).

Solo medición. No cambia el producto: las variantes se construyeron en una copia temporal de `dev` (`582dd00`), fuera del repositorio, y se borraron al terminar. **La decisión visual es del propietario.** Antecedente: [componentes del 29 oct](performance-components-2026-10-29.md), que estimó unos 1,85 s de CPU de BackboneView por cada 4,5 s con CPU ×4.

## Qué se comparó

El giro está en `src/features/structure/BackboneView.tsx` (`idleTurn`, solo en la portada). En cada fotograma de `requestAnimationFrame` avanza el ángulo y repinta el lienzo completo. Velocidad actual: `IDLE_RADIANS_PER_SECOND = 0,12`, una vuelta cada 52 s. El giro ya se detiene cuando el visitante arrastra o usa el teclado sobre la figura, cuando la figura sale de la pantalla, cuando la pestaña está oculta y con movimiento reducido.

| Variante | Qué cambia |
|---|---|
| Actual | Sin cambios. Repinta en cada fotograma que da la pantalla. |
| Actual (copia A/A) | El mismo build en otro puerto, para medir el ruido del método. |
| Estática | Sin giro automático. Se ve el encuadre inicial. Arrastrar y usar el teclado siguen funcionando. |
| Media velocidad | 0,06 rad/s (una vuelta cada 105 s). Sigue repintando en cada fotograma. |
| 30 fps | Misma velocidad. Repinta como mucho 30 veces por segundo. |
| 15 fps | Misma velocidad. Repinta como mucho 15 veces por segundo. |

Las variantes se activaron con variables de build en la copia temporal. El parche está en `artifacts/landing-rotation-2026-11-01/variant-flags.patch`. Cada variante es un build de producción (`vite build`, `CI=true`, Supabase vacío) servido con `vite preview` en los puertos 5333–5338.

## Método y condiciones

- Chrome **156.0.8078.76** del sistema, sin interfaz, mediante Playwright. Ventana de 1280 × 800, tema claro, sin movimiento reducido, CPU ×4 por CDP, red sin limitar, Service Workers bloqueados y un contexto nuevo en cada ejecución.
- **Pantalla del equipo: 144 Hz.** Chrome sin interfaz sigue esa frecuencia: medido en una página vacía, unos 140 fotogramas por segundo. No hubo forma de fijar 60 Hz con el Chrome instalado, porque `--disable-frame-rate-limit` deja el ritmo libre en lugar de fijarlo. **Todo lo de abajo es a 144 Hz.** No se midió a 60 Hz.
- Cada ejecución sigue estos pasos:
  1. Abre la portada, espera el `h1` y las fuentes, y deja pasar 4 s.
  2. Mide **8 s de reposo** con `Performance.getMetrics`: `TaskDuration` (tiempo del hilo principal ocupado en tareas, incluida la ralentización ×4), `ThreadTime` (CPU que de verdad consume el hilo) y `ScriptDuration`. Registra también las tareas largas (`longtask`) y los fotogramas dibujados, contando `setTransform`, que BackboneView llama una vez por pintado.
  3. Hace **16 interacciones** con el giro en marcha, con 700 ms más una variación fija de 0–96 ms entre una y otra, sin tocar el lienzo para no detener el giro. Alterna estas cuatro: elegir «Hidropatía», seleccionar el residuo B12 en la secuencia, elegir «Química» y seleccionar el residuo A11. Cada una provoca un render de React y un repintado.
- Latencia de interacción, con dos medidas:
  - **Event Timing**: la duración más larga por interacción, la misma base que INP. El navegador redondea a 8 ms y solo registra interacciones de 16 ms o más; las demás cuentan como «< 16».
  - **Próximo fotograma**: del `pointerdown` a una tarea lanzada desde el primer `requestAnimationFrame` tras el clic. Es una medida propia y no incluye la presentación en pantalla.
- **14 rondas × 6 variantes = 84 ejecuciones**, 224 interacciones por variante. En cada ronda el orden rota, como un cuadrado latino, y se invierte en las rondas impares. Hora: 07:32–08:12 UTC (02:32–03:12 en Bogotá). 0 errores de página y 0 peticiones externas.
- Estadística (`artifacts/landing-rotation-2026-11-01/analyze.mjs`, que reutiliza `scripts/lcp-stats.mjs`):
  - medianas con intervalo del 95 % por estadísticos de orden;
  - p75 de interacción con intervalo del 95 % por bootstrap que remuestrea ejecuciones completas (10.000 remuestreos);
  - diferencias emparejadas contra «Actual» por ronda, con el intervalo de la prueba de signos.
- **Carga ajena:** según la coordinación, otra sesión trabajaba a la vez en el repositorio y podía lanzar pruebas o builds. La CPU del equipo durante el reposo tuvo una mediana del 25 % y superó el 60 % en 9 de las 84 ejecuciones, todas en las rondas 0–6. Por eso se da también un subconjunto «tranquilo»: las rondas 8–13, en las que ninguna ejecución pasó del 50 %.

## Resultados — las 14 rondas

| Variante | Fotogramas/s, mediana (mín–máx) | Hilo ocupado `TaskDuration`, ms/s [IC 95 %] | CPU real `ThreadTime`, ms/s [IC 95 %] | Tareas largas en reposo (total / ejecuciones con alguna) | Interacción p75 Event Timing, ms [IC 95 %] | Interacción p75 próximo fotograma, ms [IC 95 %] |
|---|---:|---:|---:|---:|---:|---:|
| Actual | 78,1 (51–102) | **990** [989; 991] | 242 [240; 243] | 13 / 2 | 72 [72; 80] | 64,0 [61; 67] |
| Actual (copia A/A) | 79,0 (53–98) | 990 [990; 991] | 242 [241; 243] | 2 / 1 | 80 [72; 88] | 66,6 [63; 74] |
| Estática | 0 | **0** [0; 0] | 0 [0; 0] | 0 / 0 | **48** [48; 56] | **40,2** [37; 44] |
| Media velocidad | 66,9 (28–97) | **990** [989; 991] | 242 [237; 243] | 74 / 4 | 96 [80; 136] | 79,6 [68; 123] |
| 30 fps | 28,8 (27–29) | **505** [468; 684] | 126 [116; 167] | 16 / 3 | 56 [56; 64] | 71,2 [66; 78] |
| 15 fps | 14,5 (14–15) | **293** [225; 371] | 74 [56; 95] | 14 / 2 | 56 [48; 72] | 58,5 [54; 83] |

1.000 ms/s de `TaskDuration` equivalen al hilo principal ocupado todo el tiempo. Con CPU ×4, `ThreadTime` vale aproximadamente la cuarta parte de `TaskDuration`.

### Diferencia emparejada contra «Actual» (B − A, 14 pares)

| Variante | Hilo ocupado, ms/s | p75 Event Timing por ejecución, ms | p75 próximo fotograma por ejecución, ms |
|---|---:|---:|---:|
| Copia A/A (ruido) | +0,3 [−1; +1] | 0 [−8; +8] | +1,4 [−4; +5] |
| Estática | **−990** [−990; −989] | **−32** [−32; −24] | **−26** [−31; −21] |
| Media velocidad | +0,2 [−2; +1] | +4 [−8; +32] | +6 [−3; +25] |
| 30 fps | **−486** [−521; −305] | **−16** [−24; −8] | +2 [0; +8] |
| 15 fps | **−696** [−765; −620] | **−24** [−24; −8] | −8 [−11; +5] |

### Subconjunto tranquilo — rondas 8–13, 6 pares

| Variante | Hilo ocupado, ms/s [IC 95 %] | Tareas largas | p75 Event Timing, ms [IC 95 %] | p75 próximo fotograma, ms [IC 95 %] | Diferencia del hilo contra «Actual» |
|---|---:|---:|---:|---:|---:|
| Actual | 990 [989; 991] | 0 | 72 [72; 72] | 62,2 [59; 63] | — |
| Copia A/A | 990 [989; 991] | 0 | 72 [72; 72] | 63,8 [60; 65] | +0,4 [0; +1] |
| Estática | 0 [0; 1] | 0 | 40 [40; 48] | 32,0 [30; 38] | −990 |
| Media velocidad | 990 [989; 991] | 0 | 72 [72; 72] | 60,3 [58; 65] | +0,2 [−2; 0] |
| 30 fps | 475 [429; 515] | 0 | 56 [56; 56] | 64,9 [64; 67] | −515 [−561; −475] |
| 15 fps | 229 [219; 246] | 0 | 48 [48; 48] | 50,6 [50; 52] | −761 [−772; −743] |

## Lectura

- **En este equipo, con CPU ×4 y pantalla de 144 Hz, el giro actual ocupa el hilo principal casi entero (99 %).** No llega a 144 fotogramas: dibuja entre 51 y 102 por segundo, según lo ocupada que esté la máquina.
- **Bajar la velocidad no ahorra nada.** «Media velocidad» repinta igual de a menudo y cuesta lo mismo: +0,2 ms/s [−2; +1]. El coste depende de cuántas veces se pinta, no de lo rápido que gira.
- **Limitar los fotogramas sí ahorra.** 30 fps ocupa aproximadamente la mitad del hilo (−486 ms/s) y 15 fps unos dos tercios menos (−696 ms/s). Su ritmo es estable: 28,8 y 14,5 fotogramas por segundo. Cada pintado consume algo más de CPU cuando se pinta menos a menudo, de 2,7 a 4 ms de `ThreadTime` en el subconjunto tranquilo. No se investigó la causa.
- **Tareas largas:** con la máquina tranquila no hubo ninguna en ninguna variante. Las 13–74 por variante de la tabla completa aparecen solo en ejecuciones con el equipo al 54 % de CPU o más durante el reposo, por ejemplo una ejecución de media velocidad al 100 %. **No se atribuyen a las variantes.**
- **Interacción:**
  - Todas las variantes quedan muy por debajo de 200 ms, el umbral de INP «bueno», con estas condiciones.
  - Según Event Timing, el giro actual añade unos 32 ms al p75 frente a la imagen estática (72 frente a 40–48 ms).
  - Con Event Timing, 30 fps recupera la mitad (−16 ms) y 15 fps unos tres cuartos (−24 ms).
  - La medida propia del próximo fotograma coincide en la variante estática (−26 ms), pero no ve mejora con 30 fps (+2 ms [0; +8]) y solo una pequeña con 15 fps. Las dos medidas no miden lo mismo: la propia termina antes de la presentación en pantalla. **No se aclaró por qué discrepan en las variantes limitadas.**
- **Ruido:** la copia A/A da diferencias de 0 ±1 ms/s en CPU, 0 [−8; +8] ms en Event Timing y +1 [−4; +5] ms en el próximo fotograma. Los efectos señalados en negrita superan claramente ese ruido. Los de media velocidad no.

## Lo que notaría quien mira

Son cálculos a partir de la velocidad del código y del tamaño de la figura en la captura a 1280 px. No se hizo ninguna prueba con observadores.

| Variante | Vuelta completa | Desplazamiento del borde de la figura | Paso por fotograma en el borde |
|---|---:|---:|---:|
| Actual a 144 Hz | 52 s | ≈ 22 px/s | ≈ 0,15 px (≈ 0,36 px con 60 Hz) |
| Media velocidad | 105 s | ≈ 11 px/s | ≈ 0,08 px |
| 30 fps | 52 s | ≈ 22 px/s | ≈ 0,7 px |
| 15 fps | 52 s | ≈ 22 px/s | ≈ 1,4 px |
| Estática | — | 0 | — |

- **30 fps:** el giro es tan lento que un paso de 0,7 px debería verse continuo. Es una suposición sin verificar.
- **15 fps:** pasos de unos 1,4 px. Mirando fijamente las etiquetas (B1, A21) podría notarse un leve escalonado. Suposición sin verificar.
- **Media velocidad:** el movimiento se percibe más quieto, pero no ahorra CPU.
- **Estática:** la portada pierde la sensación de objeto 3D hasta que alguien arrastra la figura. El texto «Arrastra para girar» sigue ahí.
- Con la variante actual, el ritmo de fotogramas también varía con la carga del equipo, de 51 a 102 por segundo. Con pasos de 0,15–0,3 px, probablemente no se note.

## Resumen para decidir

Datos medidos en este equipo, con CPU ×4 y pantalla de 144 Hz:

- Quitar el giro libera todo el hilo que hoy ocupa (≈ 990 ms/s) y baja el p75 de Event Timing unos 32 ms.
- Bajar la velocidad no cambia el coste.
- **Las variantes que mantienen el movimiento visible con parte del coste son las de fotogramas limitados.** 30 fps cuesta ≈ 51 % del actual (≈ 48 % con la máquina tranquila) y 15 fps ≈ 30 % (≈ 23 %). En Event Timing recuperan, respectivamente, la mitad y unos tres cuartos de los 32 ms.
- Ninguna variante produjo tareas largas atribuibles ni superó 200 ms de interacción en estas condiciones.

Mantener el giro actual, limitarlo o quitarlo es una decisión visual del propietario. Este informe no la toma.

## Límites

- **Solo 144 Hz.** En una pantalla de 60 Hz, el giro actual pintaría como mucho 60 veces por segundo, así que costaría menos que aquí y la ventaja relativa de 30/15 fps sería menor. **No se midió.**
- Un único equipo, Chrome sin interfaz, emulación de CPU ×4 (no es un teléfono) y `vite preview` local.
- La otra sesión cargaba la máquina en las rondas 0–6. Las conclusiones de CPU no cambian en el subconjunto tranquilo. Las tareas largas y la cola del p75 sí dependen de esa carga.
- La interacción es sintética, de dos tipos de clic, y no es INP de campo.
- La variante «Estática» se mide sin la animación y no por su impresión visual. Las notas perceptivas son cálculos.
- `ProcessTime` dio valores sin sentido (≈ 1.000 ms/s incluso con la imagen estática): se guardó en los datos crudos, pero no se usa.
- Esta cifra no es directamente comparable con los 1,85 s / 4,5 s del 29 de octubre: aquello era tiempo propio de BackboneView en una ventana de carga a 360 × 900, y esto es tiempo total del hilo en reposo a 1280 × 800.

## Datos y reproducción

Los datos y scripts están en `artifacts/landing-rotation-2026-11-01/`, una carpeta ignorada por Git:

- `measure.mjs`: el arnés de medición;
- `analyze.mjs`: la estadística;
- `variant-flags.patch`: las variables de build de las variantes;
- `raw-main-144hz.json` y `.log`: los datos crudos;
- `summary-main-144hz.json` y `summary-quiet-144hz.json`: los resúmenes;
- las pruebas previas (`smoke*.json`, `raf-probe.mjs`, `probe*.{mjs,png}`).

Para repetir la medición:

1. Exportar `dev` con `git archive` a una carpeta temporal.
2. Aplicar el parche.
3. Construir cada variante con `VITE_HERO_STATIC`, `VITE_HERO_SPEED` y `VITE_HERO_FPS` en `artifacts/landing-rotation-2026-11-01/builds/<variante>`.
4. Ejecutar `HERO_SCRATCH=<copia> node artifacts/landing-rotation-2026-11-01/measure.mjs`.

Los builds y la copia temporal se borraron al terminar.
