# Laboratorio 3D · Mesa de estructura

Ruta `/generate/lab`, accesible desde Diseñar y desde la barra lateral. Español e inglés, temas claro y oscuro y teclado completo. Abrir, editar y guardar un archivo local no envía nada al servidor; «Guardar en Proyecto» es una acción explícita que envía el documento a la cuenta ([proyectos](projects.md)). El recorrido de Colab que produce los resultados está en [laboratorio de diseño](laboratorio-diseno.md).

## Recorrido

- Abrir las tres variantes comprobadas de 1UBQ A, o un ZIP producido por `experiments/design-lab/experiment.py` o `campaign.py`.
- Girar la traza Cα, superponer la referencia experimental y seleccionar un residuo desde el dibujo o desde la secuencia. El mapeo es explícito por cadena, número e inserción y es una correspondencia posicional válida solo para este rediseño de igual longitud, no un mapeo SIFTS general.
- Proteger o liberar y sustituir posiciones, deshacer hasta 50 acciones y restaurar la secuencia original. Cada variante conserva un borrador independiente al cambiar de muestra o de ruta. El lector está acotado a 120 residuos.
- Una sustitución retira la figura, pLDDT, pTM y RMSD del borrador y desactiva la exportación estructural; recuperar la secuencia original recupera su resultado. Proteger posiciones no modifica una ejecución histórica.
- Descargar el borrador JSON v2 y el cuaderno de Colab. El borrador marca `constraintStatus: not-executed` hasta ejecutarse. Solo las posiciones protegidas quedan fijas. Cargarlo en Colab envía su secuencia a ese entorno, por acción expresa.
- Guardar y reabrir un archivo completo del laboratorio. Reemplazar trabajo modificado pide confirmación y un error o una cancelación conserva el conjunto anterior. Hay aviso al salir con cambios. No hay almacenamiento automático de secuencias en el navegador.

## Ejemplo y procedencia

`src/features/design-lab/fixtures/ubiquitin.json` es una selección pequeña derivada de la campaña real de tres muestras: secuencias, claves de residuos, coordenadas Cα medidas, confianza por posición, métricas y revisiones, con el SHA-256 del ZIP de origen y el PDB de cada muestra. No contiene el ZIP, el PDB completo, los pesos ni cachés descargadas.

La referencia es 1UBQ A, de 76 residuos; las tres secuencias fueron rediseñadas con ProteinMPNN y predichas con ESMFold. Las revisiones están fijadas en `config.ts` y en las fuentes del experimento. El ejemplo exporta **solo la traza Cα**, con nombre y REMARK explícitos; al importar un ZIP válido, se exporta el **PDB original**, sin transformar sus coordenadas por la orientación del visor. Ningún átomo ausente se inventa.

La superposición recalcula el RMSD sobre todos los Cα correspondientes con una rotación propia de Horn (cuaternión y Jacobi), sin reflexión y sin excluir posiciones, y reproduce las tres comparaciones originales con tolerancia de 10⁻⁶ Å. pLDDT se muestra de 0 a 100. Estas cifras no demuestran función, estabilidad, novedad ni validación experimental, y las tres secuencias comparten el mismo esqueleto: no son formas de novo.

### Distancia de la predicción a la referencia

La pestaña Predicción ([predicción](prediccion.md)) muestra el RMSD Cα de la estructura de ESM Atlas frente a la referencia del laboratorio, con el mismo `superpose` y el mismo emparejamiento que Colab: el residuo *i* con el residuo *i* de la referencia, todas las posiciones (también las sustituidas) y sin números de residuo. Se calcula en el Worker de predicción tras validar el PDB, con cancelación y un límite de 10 s (`compareWithReference`, `measurePrediction`); no se guarda en el documento, así que una predicción guardada obtiene su cifra al abrirse. Con menos de `PREDICTION_CONFIG.minimumPairedPositions` (3) posiciones emparejadas, o sin referencia, no se muestra ninguna cifra. Sobre el PDB público de la variante 1, la aplicación da 0,823 Å en 76 posiciones y Colab dio 0,822 Å para la misma secuencia. La cifra no mide plegamiento, estabilidad ni función, y la pantalla lo dice. La prueba usa `fixtures/esm-atlas-sample-1-ca.json`: solo los 76 Cα de esa respuesta pública con el SHA-256 del PDB completo.

## Importación y límites

Configuración central en `src/features/design-lab/config.ts`: ZIP de hasta 10 MB, archivo de trabajo de hasta 15 MB, expansión total compartida de 24 MB, entrada de hasta 8 MB, 160 entradas por ZIP, tres variantes y 120 residuos. Tiempo máximo del Worker 45 s, cancelable terminando el Worker. No se ejecutan scripts contenidos en los paquetes.

- Lector nativo de ZIP almacenado y Deflate mediante `DecompressionStream`, sin dependencias nuevas. Revisa el directorio central antes de expandir, las cabeceras locales, los tamaños, los intervalos solapados y el CRC32. Rechaza rutas absolutas o ambiguas, duplicados (también por mayúsculas), enlaces, cifrado, descriptores de datos, multivolumen y ZIP64 central. Admite el extra ZIP64 local pequeño que genera NumPy.
- PAE acepta únicamente NPY numérico little-endian f4/f8 de dimensiones N×N, finito y no negativo, sin pickle ni evaluación de cabeceras.
- Valida manifiestos y hashes, procedencia y configuración, la selección previa de la muestra, el FASTA repetido, el SHA de la secuencia, el PDB de cadena explícita con esqueleto completo y coordenadas finitas, claves y átomos, la confianza y la comparación recalculada. Una campaña debe compartir referencia y conjunto generado. Los hashes comprueban integridad interna: un manifiesto autocontenido no autentica al autor ni demuestra que se ejecutó un modelo. El importador admite este formato de experimento, no cualquier ZIP o PDB externo.

## Archivo de trabajo

JSON con `kind: proteinforge-laboratory`. La versión 1 tiene `source` (el ejemplo versionado, o el ZIP original en Base64 con su SHA-256) y `state` (variante activa, posición seleccionada y, por variante, secuencia y posiciones protegidas de base cero); el historial de deshacer no se serializa. La versión 2 añade las predicciones ([predicción](prediccion.md)). No se confía en coordenadas ni métricas serializadas: se relee la fuente y se revalida íntegramente en un Worker al abrir y al guardar. El borrador exportado por separado usa posiciones de cadena de base uno con claves explícitas.

El laboratorio declara si puede sustituirse sin perder nada (ejemplo integrado sin editar, o nada cargado), de modo que una importación o una edición siguen protegiendo el borrador frente a una apertura demorada. Guardar en la cuenta, sus límites y su concurrencia están en [proyectos](projects.md).

## Verificación

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:pwa
npm run test:e2e -- e2e/laboratory.spec.ts
```

Las pruebas usan ZIP sintéticos generados independientemente del lector, casos matemáticos y el ejemplo curado; no dependen de descargas. El E2E adicional acepta `E2E_LAB_ARCHIVE` apuntando al ZIP real (ignorado por Git), importa la campaña y compara la descarga del PDB con su SHA original. En entornos donde el arranque de módulos de Vite en desarrollo es lento, la batería E2E puede ejecutarse contra `npm run preview` con `E2E_BASE_URL` y `E2E_WORKERS=1`.
