# Laboratorio · Mesa de estructura

Implementación local del 21 oct 2026 de la dirección A y el [plan aprobado](design-lab-proposal.md). Ruta `/generate/lab`, accesible desde Diseñar. Español/inglés, temas claro/oscuro y controles por teclado. No requiere cuenta ni envía archivos o secuencias a servicios externos.

## Recorrido

- Abrir las tres variantes comprobadas de 1UBQ A, o un ZIP producido por `experiments/design-lab/experiment.py` o `campaign.py`.
- Girar la traza Cα, superponer la referencia experimental y seleccionar un residuo desde dibujo o secuencia. Mapeo explícito por cadena, número e inserción; correspondencia posicional únicamente para este rediseño de igual longitud, no SIFTS general.
- Proteger/liberar y sustituir posiciones, deshacer hasta 50 acciones y restaurar la secuencia original. Cada variante conserva un borrador independiente al cambiar de muestra o ruta. El lector está acotado a 120 residuos; no necesita virtualización para ese límite.
- Una sustitución retira figura, pLDDT, pTM y RMSD del borrador y deshabilita exportación estructural. Recuperar la secuencia original recupera su resultado. Proteger posiciones no modifica una ejecución histórica.
- Descargar el borrador JSON con posiciones protegidas y referencias, marcadas `constraintStatus: not-executed`. El ejecutor Colab actual no consume todavía ese formato: falta implementar y comprobar el recorrido condicionado antes de ofrecerlo como generación restringida.
- Guardar y reabrir un archivo completo del laboratorio. Reemplazar trabajo modificado pide confirmación; un error o cancelación conserva el conjunto anterior. Hay aviso al salir con cambios. No se guarda automáticamente en navegador ni en Proyectos.

## Ejemplo y procedencia

`src/features/design-lab/fixtures/ubiquitin.json` es una selección pequeña derivada de la [campaña real de tres muestras](design-lab-three-variants.md): secuencias, claves de residuos, coordenadas Cα medidas, confianza por posición, métricas y revisiones. Conserva SHA-256 del ZIP de origen y PDB por muestra. No contiene ZIP, PDB completo, pesos o cachés descargados. Los artefactos originales permanecen ignorados en `artifacts/design-lab/campaign/`.

Referencia experimental 1UBQ A de 76 residuos; tres secuencias rediseñadas por ProteinMPNN y predichas por ESMFold. Revisiones fijadas en `config.ts` y fuentes del experimento. El ejemplo permite exportar **solo traza Cα**, con nombre y REMARK explícitos. Al importar el ZIP válido, se exporta el **PDB original**, sin transformar sus coordenadas por la orientación del visor. Ningún átomo ausente se inventa.

La superposición recalcula RMSD sobre todos los Cα correspondientes usando rotación propia de Horn mediante cuaternión/Jacobi. No admite reflexión ni excluye posiciones. Reproduce las tres comparaciones originales con tolerancia 10⁻⁶ Å. pLDDT se muestra en 0–100; la columna B del PDB admite su redondeo a dos decimales. La media original float32 admite 0,00004 frente a acumulación float64 (dos ULP observadas), sin cambiar el valor mostrado. Estas cifras no demuestran función, estabilidad, novedad ni validación experimental. Son tres rediseños de un mismo esqueleto; no formas de novo.

## Importación y límites

Configuración central en `src/features/design-lab/config.ts`: ZIP de hasta 10 MB, archivo de trabajo hasta 15 MB, expansión total compartida de 24 MB, entrada hasta 8 MB, 160 entradas por ZIP, tres variantes y 120 residuos. Tiempo máximo de Worker 45 s, cancelable terminando el Worker. No se ejecutan scripts contenidos en paquetes.

Lector nativo de ZIP almacenado/Deflate mediante DecompressionStream, sin dependencias nuevas. Revisa directorio central antes de expandir, cabeceras locales, tamaños, intervalos solapados y CRC32. Rechaza rutas absolutas/ambiguas, duplicados incluso por mayúsculas, enlaces, cifrado, descriptores de datos, multivolumen y ZIP64 central. Admite el extra ZIP64 local pequeño que genera NumPy. PAE acepta únicamente NPY numérico little-endian f4/f8 de dimensiones N×N, finito y no negativo, sin pickle ni evaluación de cabeceras.

Luego valida manifiestos y hashes, procedencia/configuración, selección previa de muestra, FASTA repetido, secuencia SHA, PDB de cadena explícita con backbone completo y coordenadas finitas, claves/átomos, confianza y comparación recalculada. Una campaña debe compartir referencia y conjunto generado. Los hashes comprueban integridad interna; un manifiesto autocontenido no autentica al autor ni demuestra que se ejecutó un modelo. El importador admite este formato de experimento, no cualquier ZIP/PDB externo.

## Archivo de trabajo v1

JSON `kind: proteinforge-laboratory`, `schemaVersion: 1`. `source` referencia el ejemplo versionado o incorpora el ZIP original en Base64 con SHA-256. `state` conserva variante activa, posición seleccionada y, para cada variante, secuencia y posiciones protegidas de base cero. Deshacer es temporal; no se serializa el historial. No se confía en coordenadas o métricas serializadas: se relee la fuente y se revalida íntegramente en Worker al abrir y guardar. El borrador exportado por separado usa posiciones de cadena de base uno con claves explícitas.

No se cambian contratos protobuf, API o Supabase. Persistir ejecuciones/candidatos/estructuras dentro de Proyectos requiere una propuesta compatible separada con propiedad, RLS, concurrencia, tamaño y migración antes de implementarla. También siguen pendientes ejecución condicionada, predicción nueva desde la app y diseño de forma nueva.

## Verificación reproducible

`npm run typecheck`, `npm run lint`, `npm run test:coverage -- --maxWorkers=2`, `npm run build`, `npm run check:pwa` y `npm run test:e2e -- e2e/laboratory.spec.ts`. Las pruebas usan ZIP sintéticos generados independientemente del lector, casos matemáticos y el ejemplo curado; no dependen de descargas. El caso E2E adicional acepta `E2E_LAB_ARCHIVE` hacia el ZIP real ignorado, importa la campaña y compara la descarga del PDB con su SHA original. Capturas de aplicación en `artifacts/laboratory-a-{360,1280}-{light,dark}.png`.

Cierre local del 21 oct: 301 unitarias completas correctas (59 archivos); cobertura statements 85,06 %, branches 74,61 %, functions 83,53 %, lines 87,76 %, sin cambiar mínimos. Tras los últimos ajustes, otras 80 pruebas del laboratorio/visor correctas. Tipos/lint/build/PWA correctos; 24 recursos precacheados y laboratorio funcionando offline, con Worker, edición y descarga de archivo. Chrome local: 33 E2E afectadas correctas sobre build final, incluyendo 360/1280, ambos temas, AA automático, 44 px, foco/Escape, selección desde dibujo, borradores y reapertura del ZIP real incorporado al archivo de trabajo. PDB descargado con SHA idéntico al original. Se corrigieron desbordamiento de un botón largo y ancho del selector de aminoácido.

El arranque de módulos de Vite en desarrollo agotó 30 s en intentos previos; la comprobación final usa `npm run preview -- --host 127.0.0.1 --port 5204 --strictPort`, `E2E_BASE_URL=http://127.0.0.1:5204`, `E2E_WORKERS=1` y `node node_modules/playwright/cli.js test` con `e2e/{laboratory,generator,library,landing,shell,theme}.spec.ts` (enumerados por separado en PowerShell). No se aumentaron tiempos ni se deshabilitaron aserciones: la prueba de movimiento reducido admite el cero CSS equivalente en s/ms que normaliza el minificador. Lint excluye artefactos temporales de pruebas. Revisión visual determinista: sin errores; autofocus de Cancelar conservado por foco deliberado/restaurado. Permanecen los avisos previos de Vite sobre su cargador nativo futuro y chunks grandes. No se certifican otros motores, producción remota ni CI de esta entrega.
