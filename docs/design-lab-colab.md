# Primer ensayo en Colab

Preparado el 20 oct 2026. [Cuaderno](../notebooks/proteinforge-design-lab.ipynb), [fuentes del ensayo](../experiments/design-lab/) y [alcance del laboratorio](design-lab-roadmap.md).

**Ensayo completo recuperado y verificado:** [resultados, mediciones y límites](design-lab-first-run.md). La generación y predicción se ejecutaron realmente en Colab; la fuente final corrige la exportación de pTM escalar. Las notas de incidencia inferiores describen el recorrido, no el estado final.

## Alcance y estado

El primer caso es **rediseño sobre un esqueleto conocido**, no generación de una forma nueva: ubiquitina experimental 1UBQ, cadena A, 76 residuos → tres muestras ProteinMPNN → repetición con la misma semilla → predicción ESMFold de la muestra 1 → comparación con la referencia. La muestra se fija antes de predecir; no se elige por confianza. No demuestra función, estabilidad experimental ni novedad biológica.

Fuentes, configuración y cuaderno están preparados; diez pruebas locales de validación de archivos y comparación con coordenadas sintéticas identificadas como tales pasan. La referencia pública real se validó por hash, secuencia exacta, 76 residuos y 602 átomos.

Se creó [ProteinForge-ensayo-Colab.ipynb](https://colab.research.google.com/drive/1t_MeCkwU3cN8oLtiCHG7_JRBo59SjiDC) en la cuenta del propietario mediante el editor. GPU asignada observada: Tesla T4, 15.360 MiB; runtime Python 3.13 y 12,67 GB RAM anunciados por Colab. Se corrigió la ausencia de `ensurepip` usando `venv --without-pip --system-site-packages`, que hereda el pip existente. La celda de preparación pegada se comparó con el texto local y coincidió exactamente.

La sesión mostró la preparación terminada y ProteinMPNN completó generación y repetición antes de avanzar a predicción. Primera muestra observada, seleccionada por índice antes de predecir:

```fasta
>ProteinForge sample 1; generated, not experimentally validated
MTIKVEFEDGTTLTLEVSPEDTIAELKAKIQEKTGIPPEEQRLIYKGKVLEDDKTLADYGIKEGDTIRLELVPKGG
```

La primera sesión se perdió tras la interrupción, sin recuperar un PDB. Después de que el propietario recargara el cuaderno, se repitió el caso conservando logs. Se corrigió la lectura escalar de pTM y se recuperó el ensayo completo: PDB, confianza, comparación, mediciones y ZIP con hashes comprobados también localmente. El panel de descarga de Colab falló; se transfirieron los mismos bytes mediante Base64 desde la salida visible, sin cambiar permisos ni cookies. El primer intento fallido permanece identificado en el paquete.

El generador del cuaderno incorpora las fuentes locales y deja todas las salidas vacías. No depende de que este trabajo esté publicado en GitHub. El ZIP resultante todavía no se importa automáticamente en la aplicación; es evidencia para definir después la integración.

## Ejecución

1. En [Colab](https://colab.research.google.com/), abrir **Subir notebook** y elegir `notebooks/proteinforge-design-lab.ipynb`.
2. En **Entorno de ejecución → Cambiar tipo de entorno**, elegir GPU gratuita si hay disponible. El ensayo exige al menos 12 GiB VRAM y 20 GiB de disco libre en esa máquina. No contratar recursos; si Colab no asigna una GPU compatible, registrar el límite.
3. Elegir **Ejecutar todas** y mantener la sesión interactiva. Se crea un entorno temporal que hereda Torch/CUDA del runtime y fija las dependencias de `requirements-colab.txt`. No se instala ni ejecuta el modelo en Windows.
4. Revisar las salidas de cada etapa. Si falla una etapa, no continuar como si hubiese resultados; la última celda permite descargar evidencia parcial marcada `incomplete`.
5. Descargar `proteinforge-design-lab-results.zip`. Conservar el cuaderno ejecutado con sus salidas para revisar fallos y tiempos.

La carga automática mediante la extensión de Edge puede requerir acceso a archivos locales. La carga manual desde Colab permite abrir el archivo sin cambiar permisos de la extensión. No se necesitan credenciales en el cuaderno, montar Drive ni compartir secuencias privadas. El ensayo usa únicamente una estructura pública; los pesos y dependencias se descargan a la máquina temporal de Colab.

La GPU, duración y RAM de Colab no están garantizadas: [FAQ oficial](https://research.google.com/colaboratory/faq.html). No se abre una API, túnel ni servicio permanente sobre Colab.

## Métodos y trazabilidad

- ProteinMPNN: revisión `8907e6671bfbfc92303b5f79c4b5e6ce47cdef57`, pesos `v_48_020`, SHA-256 de scripts, licencia y pesos comprobados antes de ejecutarlos. Semilla 42, tres muestras, temperatura 0,1; repetición en la misma sesión y comparación exacta de secuencias. No se promete igualdad bit a bit entre hardware distinto.
- ESMFold: `facebook/esmfold_v1`, revisión `75a3841ee059df2bf4d56688166c8fb459ddd97a`, Transformers 4.57.1. Archivo de pesos de 8.442.062.570 bytes con SHA-256 fijado. No utiliza la antigua API pública de ESM Atlas ni envía la secuencia a un proveedor de inferencia adicional.
- Lenguaje en fp16, tronco y cabezas de plegamiento en fp32; chunk 32 y tres reciclajes adicionales al pase inicial. Esta configuración se registra y debe validarse en la GPU realmente asignada.
- El port fijado de Transformers devuelve pLDDT en **0–1**. El resumen y la columna B del PDB se convierten explícitamente a **0–100**. Se conservan ambas escalas en la procedencia; no inferir la escala a partir del valor observado.
- Validación de PDB: primera conformación, cadena explícita, residuos estándar, sin átomos duplicados, coordenadas finitas y átomos N/Cα/C/O completos. La secuencia de la predicción debe coincidir exactamente con el candidato. No se supone una correspondencia UniProt/PDB general.
- Comparación: superposición de Cα por Kabsch, rotación propia sin reflexión, todas las posiciones del esqueleto de diseño, sin eliminar valores atípicos. RMSD en Å; ni RMSD, pTM, pLDDT ni puntuación de MPNN acreditan actividad biológica.
- Memoria: muestreo del RSS del árbol de procesos y memoria usada del dispositivo GPU; en inferencia se registran también picos de asignación/reserva de Torch. El muestreo puede perder picos breves y sumar páginas compartidas; los errores del muestreador son explícitos. Tiempos de descarga/carga/inferencia separados; la primera descarga depende de la red y caché.

## Contenido del resultado

El ZIP excluye pesos, fuentes descargadas y cachés. Incluye referencia PDB/FASTA, candidato FASTA, todas las muestras y repetición, PDB predicho, pLDDT por residuo, pTM, error alineado predicho, RMSD/distancias, parámetros, comandos, logs, versiones y mediciones. Su manifiesto lleva tamaño/SHA-256 por archivo; se reabre el ZIP y se vuelven a comprobar los bytes antes de ofrecerlo.

`validation.json` solo indica `completed` si existen las salidas necesarias y se validan sus asociaciones. Es éxito técnico del ensayo, no una certificación biológica. Los fallos se conservan en `failure.json`; una descarga parcial no se presenta como una predicción completada.

## Desarrollo y comprobación

```text
python experiments/design-lab/build_notebook.py
python -m unittest discover -s experiments/design-lab -v
```

Las pruebas de este directorio no necesitan Torch ni GPU y no cambian el runtime del backend o las dependencias de la app. El cuaderno generado debe coincidir con las fuentes, tener código compilable y no contener salidas, claves, cuentas o archivos pesados.

Fuentes primarias: [ProteinMPNN](https://github.com/dauparas/ProteinMPNN), [modelo ESMFold](https://huggingface.co/facebook/esmfold_v1), [código fijado de Transformers](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/esm/modeling_esmfold.py), [referencia 1UBQ](https://www.rcsb.org/structure/1UBQ).
