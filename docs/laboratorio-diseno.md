# Laboratorio de diseño: alcance, recorrido con Colab y límites

El laboratorio didáctico ([laboratorio](laboratory.md)) permite explorar y modificar rediseños de una proteína conocida. Los rediseños se producen fuera de la aplicación, en un cuaderno de Colab, y se importan como un ZIP validado. Este documento describe el alcance, el recorrido, los métodos y sus límites.

## Alcance

- La aplicación ofrece herramientas para objetivos definidos y la exportación de los resultados. Síntesis y validación experimental corresponden a otros profesionales. Generar una secuencia, predecir una estructura y demostrar una función son resultados distintos y ninguno se presenta como prueba del siguiente.
- Basta con obtener dos o tres diseños computacionales para una demostración académica, guardarlos, explorarlos y compararlos. No se entrena ningún modelo propio ni se mantiene inferencia permanente.
- Tras editar una secuencia, el modelo original sigue siendo una referencia hasta que exista una predicción asociada a esa variante. Animar o recolorear no recalcula coordenadas.
- El caso implementado es **rediseño sobre un esqueleto conocido**, no generación de una forma nueva. El diseño de formas nuevas (RFdiffusion, Foundry) queda fuera del alcance porque exige una GPU que los planes gratuitos no ofrecen de forma estable.

| Objetivo | Estado |
|---|---|
| Secuencia bajo propiedades sencillas | [Generador](candidates.md): sin significado estructural garantizado |
| Rediseño de una proteína conocida con posiciones protegidas | Implementado con Colab (este documento) |
| Predicción de una secuencia editada | Desde la aplicación con ESM Atlas, opcional ([predicción](prediccion.md)), o en Colab |
| Nueva forma y secuencia compatibles | Fuera del alcance |
| Unión a un objetivo o una función descrita libremente | Fuera del alcance: no existe una conversión universal de texto a proteína funcional |

## Herramientas

| Etapa | Herramienta | Notas |
|---|---|---|
| Diseñar la secuencia sobre un esqueleto | ProteinMPNN (código MIT) | Aminoácidos compatibles con el esqueleto y con las posiciones protegidas |
| Predecir desde la secuencia | ESMFold (`facebook/esmfold_v1`) | Comparación y confianza; no acredita función |
| Alternativas descartadas | RFdiffusion, ColabFold/AlphaFold2, Foundry | Se valoraron para el diseño de formas nuevas |

Fuentes: [ProteinMPNN](https://github.com/dauparas/ProteinMPNN), [modelo ESMFold](https://huggingface.co/facebook/esmfold_v1), [código de Transformers](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/esm/modeling_esmfold.py), [referencia 1UBQ](https://www.rcsb.org/structure/1UBQ).

## Dónde se ejecuta

La app se aloja en Vercel y Supabase; el experimento es interactivo, en Colab con GPU gratuita o en un equipo local. Colab no garantiza GPU ni duración de sesión ([FAQ](https://research.google.com/colaboratory/faq.html)), no admite usarse como servicio externo y por eso el recorrido es manual: cuaderno → descargar el ZIP → importar en ProteinForge. No hay API, túnel ni servicio permanente sobre Colab. Los modelos no se instalan en la función de Vercel ni se versionan en Git.

## Recorrido

1. En el laboratorio, sustituir los aminoácidos deseados y proteger las posiciones que deben quedar fijas. Descargar el borrador JSON y el cuaderno desde «Archivos y procedencia».
2. Abrir el cuaderno (`notebooks/proteinforge-design-lab.ipynb`) con **Subir notebook** en [Colab](https://colab.research.google.com/), elegir una GPU gratuita (el ensayo exige al menos 12 GiB de VRAM y 20 GiB de disco libres) y **Ejecutar todas**. El entorno temporal hereda Torch y CUDA del runtime y fija las dependencias de `experiments/design-lab/requirements-colab.txt`. No hacen falta credenciales, ni montar Drive.
3. Para usar el borrador, poner `DRAFT_MODE = "upload"` en la celda opcional y seleccionar **un** JSON v2 de hasta 64 KiB. La carga envía ese archivo a Colab: usar solo datos autorizados para ese destino. El cuaderno ofrece también `public-demo` y `none` (por omisión, `none`: no carga archivos).
4. Revisar las salidas de cada etapa. Si una etapa falla, no se continúa como si hubiera resultados; la última celda permite descargar la evidencia parcial marcada `incomplete`.
5. Descargar `proteinforge-design-lab-results.zip` y abrirlo en el laboratorio. Se valida antes de reemplazar el conjunto anterior, recupera las protecciones ejecutadas y permite guardar o reabrir el archivo local.

**Campaña de tres variantes.** El cuaderno incorpora `campaign.py`: con `RUN_CAMPAIGN = True`, ejecuta las cuatro etapas desde cero para cada índice 1, 2 y 3 en directorios separados de `RUN/campaign/`, regenera y repite las tres secuencias en cada caso y rechaza diferencias entre conjuntos. Solo reutiliza la caché de modelos y el entorno instalado. Conserva una campaña parcial y rechaza sobrescribir su carpeta. Queda desactivada por defecto para que «Ejecutar todas» conserve el recorrido básico de una predicción.

## Métodos y trazabilidad

- **ProteinMPNN:** revisión `8907e6671bfbfc92303b5f79c4b5e6ce47cdef57`, pesos `v_48_020`, con SHA-256 de scripts, licencia y pesos comprobados antes de ejecutarlos. Semilla 42, tres muestras y temperatura 0,1; repetición en la misma sesión y comparación exacta de las secuencias. No se promete igualdad bit a bit entre hardware distinto.
- **ESMFold:** `facebook/esmfold_v1`, revisión `75a3841ee059df2bf4d56688166c8fb459ddd97a`, Transformers 4.57.1, con un archivo de pesos de 8.442.062.570 bytes y su SHA-256 fijado. El modelo de lenguaje va en fp16 y el tronco y las cabezas de plegamiento en fp32, con chunk 32 y tres reciclajes adicionales al pase inicial. El cuaderno no usa la API pública de ESM Atlas.
- **pLDDT:** el port fijado de Transformers lo devuelve en 0–1; el resumen y la columna B del PDB se convierten explícitamente a 0–100 y ambas escalas se conservan en la procedencia.
- **Validación del PDB:** primera conformación, cadena explícita, residuos estándar, sin átomos duplicados, coordenadas finitas y átomos N, Cα, C y O completos. La secuencia predicha debe coincidir exactamente con el candidato.
- **Comparación:** superposición de Cα con Kabsch, rotación propia sin reflexión, todas las posiciones y sin eliminar valores atípicos. RMSD en Å; ni RMSD, pTM, pLDDT ni la puntuación de MPNN acreditan actividad biológica.
- **Memoria y tiempos:** muestreo del RSS del árbol de procesos y de la memoria de la GPU, con picos de asignación de Torch en la inferencia. Puede perder picos breves; los tiempos de descarga, carga e inferencia se miden por separado.

El ZIP excluye pesos, fuentes descargadas y cachés e incluye la referencia PDB y FASTA, el candidato FASTA, todas las muestras y su repetición, el PDB predicho, el pLDDT por residuo, el pTM, el error alineado predicho, RMSD y distancias, parámetros, comandos, logs, versiones y mediciones. Su manifiesto lleva el tamaño y el SHA-256 de cada archivo y se reabre el ZIP para comprobar los bytes antes de ofrecerlo. `validation.json` indica `completed` solo si existen las salidas necesarias y se validan sus asociaciones: es un éxito técnico, no una certificación biológica. Los fallos se conservan en `failure.json`.

Desarrollo y comprobación del cuaderno (sin Torch ni GPU):

```bash
python experiments/design-lab/build_notebook.py
python -m unittest discover -s experiments/design-lab -v
```

El cuaderno generado debe coincidir con las fuentes, tener código compilable y no contener salidas, claves, cuentas ni archivos pesados.

## Rediseño con posiciones protegidas

El borrador `proteinforge-design-draft` es **v2**: secuencia editada, referencia, secuencia base y SHA, claves de la predicción y de cada posición protegida. Exporta posiciones de base uno; los borradores del archivo de trabajo conservan índices de base cero. Los borradores v1 deben volver a exportarse.

- `constraints.py` valida el archivo y el SHA declarado en `config.design.constraints.draftSha256`. Produce `design-input.jsonl` con los N, Cα, C y O medidos del esqueleto experimental y la secuencia editada en campos independientes, y `fixed-positions.jsonl` con índices de base uno. No renombra residuos de un PDB experimental ni inventa átomos laterales. Usa las opciones oficiales `--jsonl_path` y `--fixed_positions_jsonl` de ProteinMPNN.
- Solo los aminoácidos protegidos quedan fijos; debe haber al menos una posición libre. Se rechazan referencias, longitudes, claves o aminoácidos incompatibles. Todas las muestras y su repetición deben conservar los aminoácidos protegidos. El reporte empieza `incomplete` y pasa a `executed` solo tras verificar ambas generaciones; empaquetar comprueba de nuevo FASTA, selección, resumen y reporte, e invalida primero cualquier validación antigua.
- La aplicación comprueba también el SHA, las claves, las secuencias base y de referencia, las coordenadas de entrada frente al PDB, los índices fijos, el reporte y los argumentos de los dos comandos: no basta una etiqueta de éxito. Inicializa las protecciones del resultado importado.

## Resultados de referencia

Ejecutados en Colab con una GPU Tesla T4 (Python 3.13, Torch 2.11, Transformers 4.57.1), sobre la ubiquitina 1UBQ cadena A (76 residuos). La muestra se elige por índice antes de predecir, no por confianza. Son casos únicos, no un benchmark.

| Muestra | pLDDT medio Cα (0–100) | pTM | RMSD Cα (Å) | Identidad posicional |
|---|---:|---:|---:|---:|
| 1 | 93,39 | 0,863 | 0,822 | 42/76 |
| 2 | 93,47 | 0,861 | 0,751 | 41/76 |
| 3 | 92,92 | 0,858 | 1,211 | 40/76 |

Las tres secuencias comparten el esqueleto experimental, no son tres problemas biológicos independientes ni formas de novo, y no demuestran función ni estabilidad. La identidad es posicional respecto de la referencia. Con posiciones protegidas (borrador que sustituye T2 por R2 y fija R2, F7 y R42), la muestra 1 dio pLDDT 93,28, pTM 0,867 y RMSD 1,295 Å. La referencia experimental tiene Q2, de modo que copiar su secuencia habría dado un resultado incorrecto. Tiempos de referencia en la T4: carga de ESMFold unos 22–34 s, predicción con validación y exportación unos 3 s, y un pico de unos 8,5 GB de memoria de GPU asignada.

## Límites

- Cada ejecución depende de que Colab asigne una GPU compatible; si no ocurre, se registra el límite.
- Ningún valor (RMSD, pLDDT, pTM, puntuación de MPNN) acredita función, estabilidad ni novedad.
- Un manifiesto autocontenido verifica integridad y coherencia, no autentica al autor ni firma una ejecución.
