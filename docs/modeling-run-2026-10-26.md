# Ensayo de Colab recibido del propietario — 26 oct 2026

El propietario ejecutó el cuaderno y señaló `C:\Users\josel\Desktop\proteinforge-design-lab-results.zip`; indica que abre en ProteinForge. Archivo original leído sin modificar. Copia y auditoría ignoradas bajo `artifacts/modeling/colab-2026-10-26-a67aebba/`. No se ejecutaron programas incluidos en el ZIP, modelos en Windows ni solicitudes de inferencia nuevas.

## Resultado comprobado

| Dato | Resultado |
|---|---|
| ZIP / entradas | 86.952 bytes / 39 archivos |
| SHA-256 | `a67aebbac04b9fbed6e8c1ed52119f8880284c68c412131efc543dd48bbf6909` |
| Referencia / muestra | 1UBQ, cadena A / muestra 1 seleccionada antes de predecir |
| Secuencia / estructura predicha | 76 residuos / 592 átomos |
| pLDDT Cα medio / pTM | 93,3856048584 / 0,8632462025 |
| RMSD Cα, todas las posiciones | 0,8218444623 Å |
| Identidad posicional con referencia | 42/76 |
| Distancia entre Cα consecutivos | 3,7203–3,9403 Å |
| Distancia C–N entre residuos consecutivos | 1,2310–1,4325 Å |
| Entorno declarado | Tesla T4, Python 3.13.16, Torch 2.11.0+cu130 |

La secuencia coincide exactamente con la muestra 1 del [ensayo anterior de tres variantes](design-lab-three-variants.md), al igual que las métricas principales. Es una reproducción del recorrido con semilla 42, no evidencia de diversidad nueva ni forma de novo.

## Validación efectuada

Una comprobación dedicada usa el importador real de ProteinForge: límites del ZIP y expansión, rutas, CRC, manifiesto/tamaños/SHA-256 de todos los archivos, configuración/modelos fijados, referencia pública, candidato/FASTA/PDB idénticos, repetición, esqueleto N/Cα/C/O completo y finito, confianza coherente, PAE y RMSD recalculado. La numeración de la predicción es A:1–76, sin inserciones ni huecos. Auditoría adicional de las distancias consecutivas conserva las 75 uniones; no se eliminan extremos o valores atípicos.

`experiment.py` coincide con la fuente local después de normalizar CRLF de Windows a LF de Colab; sus bytes originales y los de config.json coinciden con los hashes declarados en environment.json. Los archivos de código del ZIP, incluida una caché Python, solo se leen/verifican y no se ejecutan. La auditoría dedicada pasó. Artefactos: `audit.json`, copia del ZIP, FASTA y PDB, más `artifacts/colab-user-audit.{config,smoke}.ts`, todos ignorados.

## Alcance y siguiente paso

El promedio de confianza no describe por igual toda la estructura: posiciones 74–76 con pLDDT 67,99/55,89/44,03. No se ocultan esos extremos. La integridad del manifiesto no autentica independientemente cómo se ejecutó un programa. Aún no se recibió el cuaderno ejecutado con sus salidas; el ZIP sí contiene configuración, versiones, mediciones y logs.

Este resultado cierra la reproducción manual completa ProteinMPNN→ESMFold y su compatibilidad con el importador. No acredita función, estabilidad experimental o una forma nueva. Tampoco completa el ensayo RFD4 fragmentario ni habilita un servicio de inferencia desde la web.

El propietario puede conservar el ZIP original y usar «Guardar en Proyecto» o «Guardar archivo del laboratorio» para conservar su sesión del Laboratorio. No se guardó ningún proyecto ni se modificó su cuenta durante esta revisión. Para continuar desarrollo, abordar diagnóstico de Groq y decisiones de ejecutor gratuito/consentimiento/cuotas/persistencia, sin volver a exigir el mismo ensayo completo. [Relevo](prompt-siguiente-entrega.md), [guía manual](modeling-next-run.md).
