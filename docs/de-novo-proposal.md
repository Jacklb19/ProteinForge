# Propuesta acotada: una forma de novo en Colab

Preparada el 22 oct 2026. **Es una propuesta: no hay campaña, instalación ni gasto autorizados.** Requiere tu acuerdo explícito antes de ejecutar nada. No sustituye al [laboratorio ya implementado](laboratory.md) ni reabre las [tres variantes comprobadas](design-lab-three-variants.md), que son rediseño de secuencia sobre un esqueleto experimental conocido (1UBQ A) y no formas nuevas.

## Qué cambia respecto a lo ya ejecutado

Lo hecho hasta ahora parte de coordenadas existentes: ProteinMPNN propone secuencias para ese esqueleto y ESMFold predice cómo se plegarían. Una forma de novo genera **coordenadas nuevas** antes de cualquier secuencia. Son tres etapas encadenadas y cada una puede fallar por separado:

1. **Esqueleto nuevo** (RFdiffusion): produce trazas de cadena principal sin plantilla.
2. **Secuencia para ese esqueleto** (ProteinMPNN): la etapa que ya sabemos ejecutar y verificar.
3. **Predicción independiente** (ESMFold o ColabFold): se predice la secuencia diseñada y se compara con el esqueleto de la etapa 1.

El criterio habitual de la literatura es la **autoconsistencia**: que la predicción de la secuencia diseñada se parezca al esqueleto que se pidió. Es una comprobación computacional interna, no evidencia de plegamiento real, estabilidad, función ni novedad.

## Alcance propuesto

| Parámetro | Propuesta | Motivo |
|---|---|---|
| Objetivo | Un monómero sin ligando ni sitio funcional | La unión a un objetivo concreto es otra etapa, con evaluación especializada |
| Tamaño | Una cadena de 60–100 residuos | Dentro del rango ya manejado por el laboratorio (120 residuos máximo en el lector) |
| Esqueletos generados | 4 a 8 en una sesión | Permite descartar los que no cierren sin alargar la ocupación de GPU |
| Secuencias por esqueleto | 4 a 8 | Mismo orden que la campaña anterior |
| Predicciones | Solo las secuencias mejor puntuadas por ProteinMPNN, máximo 8 | La predicción es la etapa más cara |
| Resultado a conservar | 1 o 2 diseños con su trazabilidad completa | Suficiente para la demostración académica acordada |

## Presupuesto finito y hardware

Colab gratuito con GPU T4, el mismo entorno donde ya se ejecutaron y verificaron las tres variantes. **Presupuesto propuesto: un máximo de tres sesiones interactivas, cada una detenida a las dos horas o al agotar la asignación, lo que ocurra primero.** Si al terminar la tercera sesión no hay un diseño que supere los criterios de abajo, se detiene la línea y se informa el resultado negativo; no se compra GPU ni se contrata alojamiento.

Límites que no se cruzan: no entrenar modelos, no usar Colab como servicio permanente ni tras una API, no instalar Torch ni los modelos en Windows, no versionar pesos ni ZIP, y ningún recurso de pago.

Riesgo conocido sin verificar: RFdiffusion necesita descargar pesos propios y una instalación distinta de la del cuaderno actual. No está comprobado que esa instalación quepa en el tiempo y la memoria de una sesión gratuita de T4. Medir eso **es** la primera sesión; si no cabe, el resultado de esta propuesta es esa medición.

## Método, versiones y licencias

| Etapa | Herramienta | Licencia | Estado |
|---|---|---|---|
| Esqueleto | [RFdiffusion](https://github.com/RosettaCommons/RFdiffusion) | Código: su README declara «open source BSD License»; **no declara licencia de los pesos**, comprobarla antes de ejecutar | Nunca ejecutado aquí; versión y pesos a fijar en la primera sesión |
| Secuencia | [ProteinMPNN](https://github.com/dauparas/ProteinMPNN) | Código MIT | Ya ejecutado y verificado, revisión fijada en `src/features/design-lab/config.ts` |
| Predicción | [ESMFold](https://github.com/facebookresearch/esm) | Código MIT | Ya ejecutado y verificado en el cuaderno actual |
| Alternativa integrada | [Foundry](https://github.com/RosettaCommons/foundry) (RFD3 + MPNN + RF3) | Su `LICENSE.md` no se pudo leer el 22 oct (404 en la rama consultada); el BSD-3-Clause anotado el 12 oct queda sin confirmar | Una sola suite en lugar de tres instalaciones; incluye tutorial oficial en Colab; compatibilidad y consumo sin comprobar |

Recomendación: **ensayar primero RFdiffusion + el cuaderno actual**, porque las etapas 2 y 3 ya están comprobadas y reutilizan el formato de ZIP que el laboratorio sabe leer. Foundry queda como alternativa si la instalación de RFdiffusion no cabe en la sesión gratuita; cambiarse a Foundry obligaría a revalidar las tres etapas y el formato de salida.

## Archivos y procedencia

El resultado se entrega en el mismo formato de ZIP que ya valida el Worker de importación, con un manifiesto ampliado:

- `backbone/*.pdb`: esqueletos generados, con la semilla y los parámetros de difusión que los produjeron.
- `design/*.fasta`: secuencias por esqueleto, con su puntuación de ProteinMPNN.
- `prediction/*.pdb` y `*.npy`: predicción y PAE de cada secuencia predicha.
- `metrics.json`: RMSD esqueleto↔predicción, pLDDT medio y pTM por diseño.
- `manifest.json`: versiones, revisiones de repositorio, semillas, hora y SHA-256 de cada archivo.

Cambio necesario en la app: el lector actual exige una referencia experimental compartida por toda la campaña, porque hasta ahora siempre la había. Un diseño de novo no tiene estructura experimental de referencia. Habría que admitir **el esqueleto generado como referencia declarada**, etiquetado como tal en la interfaz y distinto de una estructura medida. Es un cambio de contrato del importador y del etiquetado: se presenta aparte y no se implementa con esta propuesta.

## Criterios verificables de éxito

Un diseño se conserva solo si cumple los cuatro:

1. **Autoconsistencia**: RMSD entre el esqueleto pedido y la predicción de su secuencia por debajo de 2 Å sobre todos los Cα correspondientes, calculado con la misma superposición de Horn que ya usa el laboratorio.
2. **Confianza**: pLDDT medio de la predicción por encima de 80 y pTM por encima de 0,7.
3. **Integridad**: el ZIP pasa el Worker de importación sin ajustar sus validaciones, con SHA-256 coincidentes y cadena/residuos completos.
4. **Reproducibilidad**: una repetición con la misma semilla y versiones devuelve el mismo esqueleto y la misma secuencia.

Un diseño que cumpla los cuatro es **un candidato computacional autoconsistente**. No es prueba de que la proteína se pliegue, sea estable, tenga función ni sea nueva; esa evaluación corresponde a laboratorio experimental y queda fuera del proyecto.

## Qué necesito de ti para empezar

Tu acuerdo sobre: el objetivo (monómero 60–100 residuos), el presupuesto (tres sesiones, dos horas cada una), la cadena elegida (RFdiffusion + cuaderno actual) y el criterio de parada. Con eso se prepara el cuaderno, se mide la primera sesión y se informa el resultado real, incluido el negativo.

[Plan](plan-desarrollo.md) · [laboratorio](laboratory.md) · [estudio y precios](design-lab-roadmap.md) · [restricciones ejecutadas](design-lab-constraints.md).
