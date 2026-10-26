# Extractos públicos para mapeo por residuo

Obtenidos el 23 oct 2026, sin credenciales, de dos lecturas públicas pequeñas:

| Fuente original | Bytes | SHA-256 |
|---|---:|---|
| [SIFTS 1trz.xml.gz](https://ftp.ebi.ac.uk/pub/databases/msd/sifts/xml/1trz.xml.gz) | 9.620 | `5495bec6290b908ea48a19ef1f7cb27233e9e741daddee2d9855a58bce1e461b` |
| XML descomprimido, fecha de documento 2026-10-18 | 253.185 | `b152a6ee038c603406ae0da06f859d58f23f9c83155dd371406f4eb3501e611e` |
| [PDBe residue_listing/1trz](https://www.ebi.ac.uk/pdbe/api/pdb/entry/residue_listing/1trz) | 13.315 | `31bebbc3a6f0e14cdae4a2ac476c4fd44072408f2be0125ffb31ba139dc2b4b4` |

Los originales quedan fuera de Git. Se conservan solo ocho correspondencias: primer y último residuo de cada cadena proteica A/B/C/D, con sus identificadores originales. En XML se retiraron otras bases, anotaciones y residuos intermedios; se conservan accession, fecha, namespace, segmento, números y nombres de residuos PDB/UniProt. Los identificadores de segmento siguen describiendo el segmento original: **no autorizan a rellenar sus residuos omitidos**. En JSON se conservaron las dos moléculas proteicas y esas mismas posiciones, con sus campos originales; se retiraron las otras moléculas y residuos. No es una respuesta completa ni se distribuye como tal.

| Extracto versionado (UTF-8, finales LF) | Bytes | SHA-256 |
|---|---:|---|
| `1trz-sifts-excerpt.xml` | 3.261 | `feba210f06b5d9792882324a23d45c36bda9620674ce03a60ebf4bf100ceb705` |
| `1trz-residues-excerpt.json` | 2.581 | `d8ce2eaa8a4b7c1048f3ccbba7b9061cd626214f674c7841319a7d0e52cf22c3` |

Normalizar CRLF a LF antes de comprobar hashes de extractos en Windows. Las coordenadas se reutilizan de [1TRZ.bcif existente](../../../../e2e/fixtures/README.md), sin otra descarga ni copia. El FASTA P01308 también es el fixture existente de descriptores. `structureResidues.test.ts` analiza ese BinaryCIF real con Mol*; las pruebas adicionales que modifican un identificador son sintéticas y no representan otra observación experimental.

Procedencia: PDBe–UniProt/SIFTS, EMBL-EBI. El XML original incluye aviso de copyright 2004–2020 de EMBL-EBI, PDBe-UniProt y atribuye Dana, Tyagi, Choudhary, Gutmanas, O'Donovan, Martin y Velankar. [SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/overview.html), [publicación del recurso](https://pmc.ncbi.nlm.nih.gov/articles/PMC10097656/), [términos de EMBL-EBI](https://www.ebi.ac.uk/about/terms-of-use/), revisados el 23 oct 2026 (página fechada 14 oct 2026). Se conserva atribución y procedencia del extracto; no se le asigna por inferencia la licencia de las coordenadas PDB. Los [términos RCSB](https://www.rcsb.org/pages/policies) distinguen datos del archivo PDB, CC0, de recursos externos integrados.
