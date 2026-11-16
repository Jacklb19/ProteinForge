# Búsqueda de candidatos (RF-17)

Implementada en `/generate`. Recorrido: fijar longitud, rangos, presupuesto y semilla → dos métodos en un Worker → métricas y candidatos → análisis de uno o alineamiento de los mejores → exportación JSON. Reemplazar un borrador requiere confirmación; editar las condiciones marca el resultado anterior y desactiva su uso y exportación; cancelar termina el Worker y conserva solo la ejecución completa anterior. Cambiar de ruta conserva la búsqueda en memoria y recargar la descarta.

## Condiciones y límites

- Veinte aminoácidos estándar, longitud exacta de 5 a 300, masa media en Da y GRAVY de Kyte-Doolittle.
- Al menos un rango activo, inclusivo y finito, con mínimo ≤ máximo. GRAVY físico de −4,5 a 4,5; masa positiva hasta 100.000 Da.
- Presupuesto configurable de 100 a 5.000 **evaluaciones por método** y semilla uint32 no nula.
- Valores por defecto: 40 residuos, 1.000 evaluaciones, semilla 42, GRAVY [−0,5; 0,5] y masa [3.000; 6.000] desactivada.
- Un rango imposible produce cero coincidencias, no una garantía de solución. Límite operativo del Worker: 60 s. Todo se configura en `features/generator/config.ts`.

## Método

`proteinforge-candidates-v1` es un recocido simulado con una mutación de residuo garantizada por evaluación y temperatura exponencial de 1 a 0,01. Acepta mejoras y empates, o deterioros con probabilidad `exp(−Δ/T)`. La referencia aleatoria muestrea una secuencia completa por evaluación del mismo alfabeto.

- Ambos usan xorshift32 (13, 17, 5); la semilla de la referencia es `(seed XOR 0x9e3779b9) >>> 0`, con 1 como alternativa. El desempate usa el orden ASCII, de modo que es determinista. El generador no es criptográfico. Los mismos parámetros y versión reproducen los resultados, salvo variaciones numéricas de plataforma en límites de coma flotante.
- Penalización: suma de la distancia fuera de cada intervalo activo dividida por `max(amplitud, escala mínima)`, con escalas mínimas de 0,01 de GRAVY y 1 Da; cero significa cumplir todos los rangos. Se reutiliza `calculateDescriptors`; no hay otro cálculo de masa ni de hidropatía.
- Archivo acotado de hasta cinco secuencias por brazo: primero por penalización y con una distancia de Hamming normalizada ≥ 0,1 entre las retenidas. No es un archivo exhaustivo ni garantiza el óptimo global. La distancia mide diversidad de secuencia, no de función.
- Las evaluaciones en rango incluyen repetidas y no se llaman candidatos únicos. Se informan el presupuesto realizado, la mejor penalización, los candidatos distintos y la distancia mínima observada.
- El JSON (`schemaVersion: 1`) incluye condiciones, versión, semilla, descriptores sin redondear, ambos brazos y referencias, y se descarga localmente. Un proyecto puede guardar el candidato seleccionado y sus análisis; el historial de búsquedas se guarda con `VITE_GENERATOR_HISTORY` (ver [decisiones](decisiones.md)).

## Comparación medida

Experimento reproducible en `benchmark.test.ts`: 30 residuos, GRAVY [1,9; 2,1], masa desactivada y 500 evaluaciones por brazo.

| Semilla | Evaluaciones en rango (guiada) | Evaluaciones en rango (aleatoria) | Mejor penalización (guiada) | Mejor penalización (aleatoria) | Distancia mínima guiada / aleatoria |
|---|---:|---:|---:|---:|---|
| 1 | 97 | 0 | 0 | 5,55 | 10 % / 86,67 % |
| 7 | 112 | 0 | 0 | 3,7167 | 10 % / 83,33 % |
| 42 | 115 | 0 | 0 | 4,0167 | 10 % / 83,33 % |
| 100 | 141 | 0 | 0 | 2,9167 | 13,33 % / 86,67 % |
| 2026 | 129 | 0 | 0 | 3,65 | 10 % / 86,67 % |

Es un caso de hidropatía acotado, sin conclusión universal ni equivalencia biológica: la referencia retiene más diversidad. No se afirma un rendimiento superior para otros rangos ni estabilidad, plegamiento, función, novedad o síntesis. Las pruebas recalculan cada candidato y verifican semilla, igual presupuesto, diversidad, rangos exactos, cero coincidencias imposibles y cancelación; en Chromium se prueba la transferencia al análisis y al alineamiento, los parámetros desactualizados, el teclado, AA, los 44 px y ambos temas a 360 y 1280 px.

## Relación con otras funciones

La predicción estructural es una función distinta que se pide desde el [laboratorio](laboratory.md) ([predicción](prediccion.md)). El [asistente](assistant.md) solo interpreta datos ya calculados; no modifica el generador ni lo sustituye.

Fundamentos: [Kirkpatrick, Gelatt y Vecchi, recocido simulado (1983)](https://research.ibm.com/publications/optimization-by-simulated-annealing); [Marsaglia, xorshift (2003)](https://www.jstatsoft.org/article/view/v008i14); [ExPASy ProtParam](https://web.expasy.org/protparam/). La variante, los límites y la penalización son decisiones de implementación de ProteinForge; esas publicaciones no validan proteínas generadas.
