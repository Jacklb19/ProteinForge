# Biblioteca y estructuras experimentales

Implementación local del 12 oct 2026 en `/library`, accesible desde Mi espacio y Analizar. Catálogo inicial de tres secuencias completas P01308/P00698/P13569 (110/147/1480 residuos), usando los FASTA ya incluidos. Conserva accession y SV conocido (1/1/3); versión de entrada y fecha desconocidas son null. No es el catálogo de 30–50 dominios InterPro/Pfam ni ensamblado de fragmentos. Una cabecera FASTA arbitraria no certifica procedencia.

UniProt se consulta manualmente con cuenta y API configuradas. El backend valida el JWT, limita consultas y valida la anotación; no comparte tokens ni secuencias del editor con UniProt. Detalle: secuencia exacta, organismo, estado revisado, versiones, fecha, función en idioma original y referencias PDB. El cliente confirma antes de reemplazar un borrador. La procedencia se conserva en proyectos/informes mientras la secuencia sea exacta; editar la retira. [Contrato backend](../../backend/docs/uniprot.md).

Mol* 5.13.1 fijado: módulo y motor cargados bajo demanda. Descarga BinaryCIF público de `models.rcsb.org/{id}.bcif`, sin credenciales, timeout 20 s y límite 25 MB. Se muestra el primer modelo y su unidad asimétrica, polímeros en cartoon por cadena. No se fabrica estructura, no se interpreta como ensamblaje biológico ni predicción. Botones españoles/teclado para cámara, reintento/error explícitos, pausa del render fuera de pantalla y al ocultar el documento, dispose al cerrar. El motor de unos 3 MB minificado se excluye del precache; las coordenadas requieren red. Sin autogiro.

La cobertura suma intervalos UniProt únicos de cadenas, evitando duplicados; en P01308/1TRZ son 51 de 110 residuos anotados. No cuenta coordenadas observadas. RF10 sigue pendiente: hace falta mapeo SIFTS y reconciliar numeración, cadenas, inserciones y residuos ausentes antes de conectar selecciones.

Evidencia: API pública real P01308 y búsqueda respondieron; visor Chromium renderizó el BinaryCIF real 1TRZ (fixture de prueba 246.214 bytes) a 360/1280, claro/oscuro, AA/44 px y cámara. Otros E2E usan Auth/API simulados para importación/errores. No equivale a despliegue, JWT real ni garantía futura del proveedor. Fuente y hash del fixture en `e2e/fixtures/README.md`.

Fuentes oficiales: [UniProt REST](https://www.uniprot.org/help/api_queries), [Mol*](https://molstar.org/docs/plugin/), [RCSB 1TRZ](https://www.rcsb.org/structure/1TRZ).
