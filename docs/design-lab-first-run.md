# Primer ensayo completo de rediseño en Colab

Completado el **20 oct 2026, America/Bogota**; las mediciones conservan su fecha UTC del 21 oct. [Procedimiento y cuaderno reproducible](design-lab-colab.md).

## Resultado y alcance

Se completó el recorrido **esqueleto experimental conocido → tres secuencias ProteinMPNN → predicción ESMFold de la primera muestra → comparación → exportación y reapertura verificada**. Es rediseño sobre ubiquitina 1UBQ, cadena A, 76 residuos. No se generó un esqueleto nuevo ni se comprobó función o estabilidad experimental.

La generación se repitió con semilla 42 y dio las mismas tres secuencias. La primera muestra se eligió por índice antes de predecir; coincide en 42 de las 76 posiciones con la secuencia de referencia (55,26 %). No se eligió el candidato por confianza posterior.

```fasta
>ProteinForge sample 1; generated, not experimentally validated
MTIKVEFEDGTTLTLEVSPEDTIAELKAKIQEKTGIPPEEQRLIYKGKVLEDDKTLADYGIKEGDTIRLELVPKGG
```

| Medida | Resultado de este caso |
|---|---:|
| Residuos comparados, sin excluir posiciones | 76 |
| Átomos del PDB predicho | 592 |
| pLDDT medio de Cα, escala 0–100 | 93,38560485839844 |
| pTM, escala 0–1 | 0,8632462024688721 |
| RMSD Cα tras Kabsch sin reflexión, Å | 0,821844462267482 |

El esqueleto de referencia tiene 602 átomos; la secuencia rediseñada contiene otros residuos y no tiene por qué conservar el mismo número de átomos laterales. Se comprobaron N/Cα/C/O en las 76 posiciones y coordenadas finitas. El PDB predicho corresponde exactamente al candidato; no es una copia de coordenadas experimentales etiquetada como predicción.

Estos valores son evidencia computacional de **un caso**, no probabilidad de función, garantía de estabilidad, novedad biológica ni validación de otros objetivos.

## Entorno y mediciones

GPU Tesla T4 asignada por Colab gratuito. Python 3.13.15, Torch 2.11.0+cu130 y Transformers 4.57.1. Revisiones de ProteinMPNN/ESMFold, dependencias, pesos y SHA-256 fijados en `experiments/design-lab/config.json`. ESM en fp16, tronco/cabezas en fp32, chunk 32, tres reciclajes adicionales al pase inicial.

| Tramo medido | Segundos | Observación |
|---|---:|---|
| Primera generación de tres secuencias, con proceso/carga | 6,6573 | El propio muestreo MPNN informa 2,6732 s |
| Repetición de tres secuencias, con proceso/carga | 3,9862 | Mismas secuencias; muestreo informa 1,0719 s |
| Recuperación de pesos de caché y SHA-256 | 31,6093 | No es una medición de descarga en frío |
| Carga del modelo | 31,9999 | Pico RSS muestreado: 6.282.944.512 bytes |
| Predicción, validación y exportación | 2,9570 | Excluye carga y recuperación de pesos |

Durante el último tramo: pico Torch asignado 8.493.694.976 bytes (7,91 GiB), reservado 8.524.922.880 bytes; dispositivo muestreado 8.265 MiB. Muestreo cada 0,5 s, sin errores registrados. RSS puede sumar páginas compartidas y el muestreo puede perder picos breves. No extrapolar a otras longitudes, GPU, sesiones o proveedores.

## Fallos y correcciones conservados

1. Colab no disponía de `ensurepip` para el método inicial de entorno virtual. Se corrigió usando `venv --without-pip --system-site-packages` y el pip del runtime, con instalación dentro del entorno separado.
2. El primer cálculo de ESMFold llegó a producir la salida, pero falló la exportación al indexar pTM como vector. La salida es escalar para este caso; se corrigió a `output.ptm.item()`. El intento fallido, sus mediciones y el código previo están en `first-attempt/` dentro del ZIP. Se repitió la etapa de predicción y se validó el resultado exportado, sin reinterpretar el intento fallido como completado.
3. Transformers avisó de pesos ausentes en `esm.contact_head.regression`. El código fijado de ESMFold obtiene estados ocultos y no llama a `predict_contacts`; esa cabeza no participa en este recorrido. No se entrenó el modelo ni se descartaron otros avisos indiscriminadamente. [ESM](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/esm/modeling_esm.py), [ESMFold](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/esm/modeling_esmfold.py).
4. El panel JavaScript de resultados/descarga de Colab no cargó en Edge. Se recuperó el ZIP mediante salida de texto Base64 de la propia celda y se compararon sus bytes y SHA-256. No se cambiaron cookies, permisos, autenticación, compartición ni ajustes del navegador.

No se ejecutaron modelos en Windows, no se enviaron secuencias privadas y no se modificó FastAPI, Supabase o la aplicación publicada.

## Evidencia y comprobación local

Artefactos locales ignorados por Git:

- `artifacts/design-lab/proteinforge-design-lab-results.zip`: 134.359 bytes, 41 archivos.
- `artifacts/design-lab/local-verification.json`: resumen de comprobación local.
- `artifacts/design-lab/results/`: archivos recuperados, con PDB/FASTA, comparación, confianza, error alineado predicho, configuración, versiones, fuentes de ejecución, logs y mediciones.

SHA-256 del ZIP: `1120665208ef76ee8ff755397689a476c5a5e64850329e3bb1ad230016b35f67`.

SHA-256 del candidato: `39e5d092045ebb891a46d3e2c09c6323faddedc5f2a445e9bd9a67da0bfc2b6d`.

SHA-256 del código final ejecutado: `87b4238782e408d2f0a649c08a10f36e1f10935550c4d0f1ce4c3888d13bf1c8`, coincidente con la fuente local corregida. La procedencia conserva también el hash anterior y la corrección escalar aplicada.

Verificación local sin ejecutar modelos: todos los tamaños/hashes del manifiesto; nombres de ZIP sin duplicados ni escape de directorio; secuencia exacta del candidato/PDB y repetición; confianza y escala en columna B del PDB; matriz PAE 76×76 finita y no negativa; RMSD recalculado desde los PDB; asociación de código/configuración. `validation.json` y el manifiesto indican `completed` para el resultado técnico.

Los datos descargados y pesos no se versionan. El cuaderno reproducible del repositorio conserva salidas vacías. El ensayo guardado en Colab pertenece al propietario y no se hizo público.

## Lo siguiente

La continuación ya comprobó [tres variantes con la fuente final desde el inicio](design-lab-three-variants.md), incluida la repetición de este caso sin parche y las predicciones de las muestras 2 y 3. La caché de pesos se conservó; los resultados y procesos fueron nuevos. Están preparadas [dos propuestas visuales](design-lab-proposal.md), pendientes de elección del propietario. Siguen pendientes una forma nueva y la importación validada/persistencia e interfaz del laboratorio. No declarar integrado `DesignService` ni importación en la app: todavía no existen.
