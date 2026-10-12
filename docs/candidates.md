# RF17: búsqueda local de candidatos

Implementado en `/generate` por la autorización autónoma del 12 oct 2026. Recorrido: fijar longitud/rangos/presupuesto/semilla → dos métodos en Worker → métricas y candidatos → análisis de uno o alineamiento de los mejores → exportación JSON. Reemplazar un borrador requiere confirmación. Editar condiciones marca el resultado anterior y desactiva uso/exportación. Cancelar termina el Worker y conserva solo la ejecución completa anterior. Cambiar rutas conserva la búsqueda en memoria; recargar la descarta.

## Decisión revisable y límites

Se limita a veinte aminoácidos estándar, longitud exacta 5–300, masa media en Da y GRAVY Kyte–Doolittle. Al menos un rango activo, inclusivo y finito, mínimo ≤ máximo. GRAVY físico −4,5 a 4,5; masa positiva hasta 100.000 Da. Presupuesto configurable 100–5.000 **evaluaciones por método**; semilla uint32 no nula. Defaults: 40 residuos, 1.000 evaluaciones, semilla 42, GRAVY [−0,5;0,5]; masa [3.000;6.000] desactivada. Rangos imposibles producen cero coincidencias, no una garantía de solución. Límite operativo Worker 60 s; configurable en `features/generator/config.ts`.

Método `proteinforge-candidates-v1`: recocido simulado con una mutación de residuo garantizada por evaluación; temperatura exponencial 1→0,01. Acepta mejoras/empates, o deterioros con probabilidad exp(−Δ/T). La referencia muestrea una secuencia completa por evaluación, del mismo alfabeto. Ambos usan xorshift32 (13,17,5); semilla de referencia `(seed XOR 0x9e3779b9) >>> 0`, fallback 1. Orden ASCII determinista para empates. RNG no criptográfico. Los mismos parámetros y versión reproducen resultados, salvo variaciones numéricas de plataforma en límites de coma flotante.

Penalización = suma de distancia fuera de cada intervalo activo / max(amplitud, escala mínima). Escalas mínimas 0,01 GRAVY y 1 Da; cero significa cumplir todos los rangos. Se reutiliza `calculateDescriptors`; no se introduce otro cálculo de masa/hidropatía. Archivo acotado de hasta cinco secuencias por brazo: penalización primero y distancia de Hamming normalizada ≥0,1 entre retenidos. No es archivo exhaustivo ni garantiza óptimo global. Esta distancia mide diversidad de secuencia, no de función.

Las evaluaciones en rango incluyen repetidas y no se denominan candidatos únicos. Se informa presupuesto realizado, mejor penalización, candidatos distintos y distancia mínima observada. JSON schemaVersion 1 incluye condiciones, versión, semilla, descriptores sin redondear, ambos brazos y referencias; se descarga localmente. El proyecto puede guardar el candidato seleccionado y sus análisis; no guarda la ejecución completa del generador. Persistir historial completo queda pendiente.

## Comparación comprobada

Experimento reproducible en `benchmark.test.ts`: 30 residuos, GRAVY [1,9;2,1], masa desactivada, 500 evaluaciones por brazo, semillas indicadas. Conteos observados:

| Semilla | Evaluaciones en rango guiadas | Aleatorias | Mejor penalización guiada | Aleatoria | Distancia mínima guiada / aleatoria |
|---|---:|---:|---:|---:|---|
| 1 | 97 | 0 | 0 | 5,55 | 10 % / 86,67 % |
| 7 | 112 | 0 | 0 | 3,7167 | 10 % / 83,33 % |
| 42 | 115 | 0 | 0 | 4,0167 | 10 % / 83,33 % |
| 100 | 141 | 0 | 0 | 2,9167 | 13,33 % / 86,67 % |
| 2026 | 129 | 0 | 0 | 3,65 | 10 % / 86,67 % |

Es un caso de hidropatía acotado, sin conclusión universal ni equivalencia biológica. La referencia tiene más diversidad retenida. No se afirma rendimiento superior para otros rangos, estabilidad, plegamiento, función, novedad ni síntesis. Pruebas recalculan cada candidato, verifican semilla/igual presupuesto/diversidad, rangos exactos, cero coincidencias imposibles y cancelación. Chromium prueba transferencia al análisis/alineamiento, parámetros desactualizados, teclado, AA/44 px y ambos temas a 360/1280.

Fundamentos: [Kirkpatrick, Gelatt y Vecchi, recocido simulado (1983)](https://research.ibm.com/publications/optimization-by-simulated-annealing); [Marsaglia, xorshift (2003)](https://www.jstatsoft.org/article/view/v008i14); [ExPASy ProtParam](https://web.expasy.org/protparam/). La variante, límites y penalización son decisiones de implementación revisables de ProteinForge; esas publicaciones no validan proteínas generadas.

## RF18 e interpretación: siguiente bloque, aún pendiente

Propuesta concreta: endpoint autenticado POST `/v1/predictions`, proveedor ESM Atlas/ESMFold seleccionado en la definición, un candidato estándar de hasta 300 residuos por solicitud deliberada; consentimiento separado que nombre proveedor/envío y referencia a privacidad. Sin lote/reintento automático. Antes de habilitarlo verificar límites/condiciones y disponibilidad actuales de proveedor sin enviar una secuencia privada. No basta la respuesta puntual histórica de ubiquitina.

Validar PDB retornado (tamaño, ATOM, coordenadas finitas, cadena/residuos y asociación exacta), procedencia/modelo/fecha/hash; confianza solo si el proveedor la documenta. Caché privada con RLS, SHA-256 de secuencia+proveedor+versión y retención explícita, sobre tabla prevista sin service_role. Integrar el mismo visor con etiqueta Predicha y error/reintento deliberado. Añadir fixtures públicos trazables de respaldo; nunca presentarlos como nueva predicción. Falta concretar contrato/cache y verificar el servicio: no hay envío ni endpoint activo.

Asistente separado: interpretará el snapshot ya calculado; requiere proveedor/modelo/límites y política de retención verificables, consentimiento para enviar contexto y tests que impidan inventar valores. No modifica el generador ni sustituye predicción. No se habilitó un proveedor sin comprobar esas condiciones.
