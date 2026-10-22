# Rediseño con posiciones protegidas

Comprobado el 21 oct 2026. Conecta el borrador del [laboratorio A](laboratory.md) con el [cuaderno de Colab](../notebooks/proteinforge-design-lab.ipynb). Sin inferencia en Windows ni cambios de API/Supabase.

## Recorrido disponible

1. En el laboratorio, sustituir antes de proteger la posición deseada. Descargar el borrador JSON y el cuaderno de Colab desde «Archivos y procedencia».
2. Abrir el cuaderno en Google Colab, elegir una GPU gratuita disponible y usar `DRAFT_MODE = "upload"` en la celda opcional. Seleccionar **un** JSON v2 de hasta 64 KiB y continuar con referencia/diseño/predicción/paquete. La carga envía ese archivo a Colab: usar solo datos autorizados para ese destino. No se monta Drive ni se solicita una clave.
3. Solo los aminoácidos protegidos quedan fijos; los demás pueden cambiar. Debe quedar al menos una posición libre. Se rechazan referencias, longitudes, claves o aminoácidos incompatibles.
4. Abrir el ZIP completo en el laboratorio. Se valida antes de sustituir el conjunto anterior; recupera las protecciones ejecutadas y permite guardar/reabrir el archivo local con nuevos borradores.

El cuaderno también ofrece `public-demo` y `none`; por defecto sigue en `none`, sin cargar archivos automáticamente. El cuaderno descargable es el generado de las fuentes versionadas, sin salidas, también disponible offline. La ejecución en Colab requiere red/GPU; no es inferencia offline.

## Método y formatos

El borrador `proteinforge-design-draft` pasa a **v2**: secuencia editada, referencia, secuencia base y SHA, claves de la predicción y de cada posición protegida. Exporta posiciones de base uno; los borradores del archivo de trabajo conservan índices de base cero. Los borradores v1 deben volver a exportarse; el archivo de trabajo `proteinforge-laboratory` v1 y ZIP anteriores siguen siendo compatibles.

`constraints.py` valida el archivo y el SHA declarado en `config.design.constraints.draftSha256`. Produce `design-input.jsonl` con N/Cα/C/O medidos del esqueleto experimental y la secuencia editada en campos independientes, y `fixed-positions.jsonl` con índices de base uno. No renombra residuos de un PDB experimental ni inventa átomos laterales. Ejecuta las opciones oficiales `--jsonl_path` y `--fixed_positions_jsonl` de ProteinMPNN fijado.

Todas las muestras y su repetición deben conservar los aminoácidos protegidos. El reporte empieza `incomplete` y solo pasa a `executed` tras ambas generaciones verificadas. Empaquetar vuelve a comprobar FASTA, selección, resumen y reporte, invalidando primero cualquier validación antigua. Los archivos derivados existentes se comparan y no se sobrescriben silenciosamente. La campaña opcional copia borrador y módulo a cada caso.

La app comprueba también SHA, claves, secuencias base/referencia, coordenadas de entrada frente al PDB, índices fijos, reporte y argumentos de los dos comandos. No basta una etiqueta de éxito. Inicializa las protecciones del resultado importado; cambios posteriores preparan otro rediseño. Un manifiesto autocontenido verifica integridad/coherencia, no autentica al autor ni firma una ejecución.

## Caso real

Cuaderno privado del propietario: [ProteinForge-restricciones-Colab.ipynb](https://colab.research.google.com/drive/1pcQuGCXi9H3l9c9xHbD-ZoL6Nce_ZLBc), sin ampliar compartición ni alterar el cuaderno anterior. Tesla T4 de 15.360 MiB. RUN `/content/proteinforge-design-lab/run-20261021T175726032930Z`.

El borrador público parte de la muestra 1 anterior y sustituye T2 por **R2**; se fijan **R2, F7, R42**. La referencia experimental tiene Q2, por lo que copiar su secuencia habría dado el resultado incorrecto. Las tres muestras y su repetición mantuvieron las restricciones. La muestra 1 se seleccionó antes de predecir.

El JSON descargado realmente desde la interfaz coincide **byte por byte** con la copia pública ejecutada: 7.931 bytes, SHA-256 `3d8c0536470cbbf1d9a7101d99d167eafc472915b01b02dc2da9c08adecec40f`. No se enviaron secuencias privadas del usuario.

```text
MRIRVAFPDGRTLELEVSPEDTVAELKAKIQAATGIPPEEQRLIYRGRVLEPERTLADYGIEEGATIELELVPAGG
```

| Observación | Resultado |
|---|---|
| Residuos / átomos predichos | 76 / 586 |
| pLDDT Cα medio / 100 | 93,27986907958984 |
| pTM | 0,8669146299362183 |
| RMSD Cα, todas las posiciones | 1,294931898102576 Å |
| Generación / repetición | 4,5381 / 4,0193 s |
| Recuperación/descarga de pesos y hash | 217,8038 s |
| Carga / predicción con validación y exportación | 34,4488 / 2,6316 s |
| Pico Torch asignado / reservado | 8.493.694.976 / 8.524.922.880 bytes |
| RSS del árbol de procesos durante carga | 8.663.724.032 bytes |

Un caso, una GPU, muestreo de 0,5 s sin errores registrados; no es un benchmark general. RMSD conserva los extremos de mayor diferencia, sin excluir residuos. No demuestra función, estabilidad, mejora sobre otra muestra o forma nueva.

ZIP recuperado por salida Base64 visible sin cambiar permisos/cookies: **140.397 bytes**, SHA-256 `de440422fb122c55ed6d878a4f56756b22992a06882922c467b00a8fd08850f0`. Comprobados sus **43 archivos**, CRC/manifiestos/hashes, fuentes con saltos LF iguales a las locales, seis secuencias, borrador, PDB/FASTA, confianza/columna B, PAE numérica 76×76, RMSD independiente y posiciones protegidas. PDB original SHA-256 `b58add32d2222c46e5a2981a90e3be5c295917a8e20991e3fd21d256c3d7ed42`.

Artefactos ignorados en `artifacts/design-lab/constrained/`. Transferencia extensa desactivada después de recuperar los bytes; el cuaderno muestra un resumen pasivo. Sin modelos/datos descargados/salidas versionados.

## Comprobación y siguiente límite

21 pruebas Python sin Torch/GPU locales; 319 unitarias completas de frontend. Cobertura 85,26 % statements, 74,85 % branches, 83,68 % functions, 87,93 % lines, sin cambiar mínimos. Tipos/lint/build/PWA y E2E del laboratorio con ambos ZIP reales: exportación de borrador y cuaderno, importación, reapertura y matriz 360/1280 en ambos temas. Capturas `laboratory-constrained-*.png`.

La ejecución es manual en Colab, sin solicitud de inferencia desde la web. El guardado en nube tiene [propuesta separada](laboratory-projects-proposal.md). Forma de novo sigue pendiente.
