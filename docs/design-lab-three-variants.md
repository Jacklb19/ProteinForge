# Tres variantes comprobadas en Colab

Completadas el **20 oct 2026, America/Bogota**, con marcas UTC del 21 oct. Continuación del [primer ensayo](design-lab-first-run.md); [procedimiento](design-lab-colab.md) y [propuesta de interfaz](design-lab-proposal.md).

## Resultado

Tres ejecuciones nuevas de **prepare → design → predict → package**, cada una con configuración, selección por índice y directorio propios. La primera utilizó la fuente corregida desde el principio, sin parche ni recuperación. Las otras dos predijeron las muestras 2 y 3. Cada ejecución generó tres secuencias y repitió el diseño con semilla 42; los seis conjuntos generados coinciden exactamente. Se evaluaron todos los índices prefijados; no se seleccionó un ganador por confianza.

Son **tres secuencias rediseñadas sobre el mismo esqueleto experimental 1UBQ A de 76 residuos**, con sus propias estructuras predichas. No son tres casos biológicos independientes ni tres formas generadas de novo. No demuestran función ni estabilidad experimental.

| Muestra | pLDDT medio Cα / 100 | pTM | RMSD Cα / Å | Identidad posicional | Predicción, validación y exportación / s | Carga del modelo / s |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 93,3856048584 | 0,8632462025 | 0,8218444623 | 42/76 | 2,9882 | 24,0564 |
| 2 | 93,4651031494 | 0,8611382842 | 0,7509967360 | 41/76 | 2,8788 | 21,3201 |
| 3 | 92,9193954468 | 0,8579508662 | 1,2112066934 | 40/76 | 3,0758 | 22,0430 |

RMSD: superposición Kabsch con rotación propia, 76 posiciones y sin excluir valores atípicos. Las identidades corresponden a las posiciones del esqueleto usado para diseñar; no implican conservación de función. El mayor pLDDT no es una demostración de mayor utilidad.

```fasta
>sample_1; generated, not experimentally validated
MTIKVEFEDGTTLTLEVSPEDTIAELKAKIQEKTGIPPEEQRLIYKGKVLEDDKTLADYGIKEGDTIRLELVPKGG
>sample_2; generated, not experimentally validated
MTIYVKFEDGTTLELEVKPSDTIAKLKEKIQEKTGIPPEEQVLIYKGKELKDDKTLADYNIKEGDTIELRLKPKGG
>sample_3; generated, not experimentally validated
MKIFVRSEDGTTLELEVEPDDTIAELKEKIEAQTGIPPEEQRLIYKGEVLEDDKTLADYGIEEGDTLELELVPAGG
```

La primera predicción reproduce exactamente las cifras y secuencia recuperadas en el ensayo anterior. La fuente y el entorno coinciden; esta observación no garantiza reproducción entre equipos distintos.

## Entorno y archivos

Colab gratuito administrado, Tesla T4; mismos modelos/revisiones, dependencias, precisión, semillas y configuración fijados en el [procedimiento](design-lab-colab.md). La caché de pesos ya existía: estas mediciones **no son descargas en frío**. Se cargó y liberó el modelo en un proceso independiente por muestra. Pico Torch asignado en cada predicción: 8.493.694.976 bytes (7,91 GiB); no extrapolar a otras longitudes o GPU.

Directorio de Colab: `/content/proteinforge-design-lab/run-20261021T041923340709Z/campaign/`. Cada `sample-N/run/` conserva las etapas y su manifiesto. Cada paquete contiene 36 archivos; ninguno contiene `failure.json`, `first-attempt/`, pesos o cachés. Se mantuvo el aviso conocido de la cabeza de contactos, que no participa en este recorrido; no se ocultaron avisos ni se entrenó un modelo.

Artefactos locales excluidos de Git en `artifacts/design-lab/campaign/`: ZIP conjunto, tres ZIP individuales, resultados extraídos, resumen, verificación local y captura `colab-three-variants.png`. La transferencia por texto visible verificó longitud y hash antes de guardar; no se cambiaron permisos, cookies ni compartición.

| Archivo | Bytes | SHA-256 |
|---|---:|---|
| Campaña completa | 224208 | `691a9ee63905e975918ec52cb486973515824f4f7c5eb0333d344353e1b036bf` |
| Muestra 1 | 76291 | `46dc015009a7767fe7bcccbb1038576017f866565d2ba0297135bbe99226ff90` |
| Muestra 2 | 76537 | `349fbadcfe242c5eadb2160ce38facce2975da4f23c367d2361553479528b5a8` |
| Muestra 3 | 76341 | `ea33ea195014901ce8f63dddf9c4ecaa98f44cab87d5342612994ffd859be3c3` |

SHA-256 del programa de inferencia ejecutado en los tres casos: `87b4238782e408d2f0a649c08a10f36e1f10935550c4d0f1ce4c3888d13bf1c8`, igual al archivo local. El ZIP conjunto conserva también el coordinador `campaign.py` utilizado.

## Comprobación independiente de los archivos

Se verificaron los 108 archivos de las tres muestras: integridad de ZIP, rutas acotadas y únicas, tamaños y hashes exactos del manifiesto, coincidencia de fuente/configuración, índice seleccionado, asociación candidato/predicción y secuencia PDB exacta. PDB completo y finito, confianza de 76 posiciones en 0–100, coherencia con columna B, PAE 76×76 finita/no negativa, repetición y mismo conjunto entre los casos. RMSD recalculado desde cada par de PDB, con determinante de rotación positivo, igual a lo exportado.

La comprobación del promedio en float64 tolera dos unidades de último lugar de float32: el promedio exportado procede de la reducción Torch en float32. La máxima diferencia observada es 0,0000146565 en la muestra 3; no es un cambio en las cifras originales ni en umbrales científicos.

Estos datos sirven de demo identificada y de entradas para preparar la importación. La aplicación todavía no ejecuta modelos ni importa estos paquetes. El próximo cambio de interfaz depende de elegir una de las dos propuestas; la forma nueva y la validación biológica siguen fuera de esta evidencia.
