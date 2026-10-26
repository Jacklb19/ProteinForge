# Obtener un rediseño completo y comprobarlo

Guía del **26 de octubre de 2026**. El propietario ejecutará el cuaderno manualmente. Esta guía no instala modelos en Windows, activa servicios o autoriza gastos.

**Ensayo recibido y comprobado:** el propietario ya completó este recorrido el 26 oct y entregó el ZIP. [Validación, métricas y siguiente paso](modeling-run-2026-10-26.md). No es necesario repetirlo para obtener un caso completo; los pasos siguientes quedan como instrucciones de reproducción.

## Qué existe y qué falta

Ya hay [tres variantes completas de 1UBQ A](design-lab-three-variants.md), de 76 residuos, generadas por ProteinMPNN y predichas por ESMFold. Sus ZIP y métricas fueron comprobados; el Laboratorio actual los puede importar. No hace falta repetirlos para disponer de una demostración. En este workspace el paquete conjunto está en `frontend/artifacts/design-lab/campaign/proteinforge-design-lab-campaign.zip`, ignorado en Git.

El resultado nuevo de RFD4 del 26 oct es distinto: 59 residuos en dos fragmentos, sin predicción independiente. No se presenta como proteína completa ni se introduce renumerando los huecos. La ejecución RFD4, su adaptación al importador y un ejecutor desde la web siguen pendientes. El cuaderno siguiente reproduce el recorrido ProteinMPNN+ESMFold; no repara ni valida aquel CIF.

## Recorrido más sencillo para ejecutar ahora

1. Abrir el [cuaderno de ProteinForge en Colab](https://colab.research.google.com/github/Jacklb19/ProteinForge/blob/main/notebooks/proteinforge-design-lab.ipynb). Si no carga desde GitHub, abrir Colab → Archivo → Subir cuaderno y elegir [el archivo local](../notebooks/proteinforge-design-lab.ipynb).
2. En Entorno de ejecución → Cambiar tipo de entorno de ejecución, elegir GPU/T4 gratuita si se ofrece. No contratar Pro, unidades de cómputo ni registrar tarjeta. El programa comprueba un mínimo de 12 GiB VRAM y 20 GiB de disco en Colab. Si no hay GPU compatible, detenerse y conservar el mensaje.
3. Para la primera reproducción dejar `DRAFT_MODE = "none"` y `RUN_CAMPAIGN = False`. No hace falta editar semillas ni subir archivos. Usa exclusivamente ubiquitina pública 1UBQ, cadena A, 76 residuos. La misma semilla puede reproducir las secuencias anteriores; no se promete novedad.
4. Elegir Entorno de ejecución → Ejecutar todas y mantener la sesión interactiva. Las etapas preparan la referencia, generan tres secuencias, repiten la generación y predicen la primera muestra con ESMFold. La descarga inicial de pesos es de unos 8,44 GB dentro de Colab; puede dominar la espera. No hay tiempo total garantizado.
5. En la salida final comprobar `"status": "completed"`, 76 residuos, valores de pLDDT/pTM y RMSD. Si falla una celda o aparece `incomplete`, conservar el error y no tratarlo como resultado completo. No continuar saltando verificaciones.
6. Descargar `proteinforge-design-lab-results.zip` y también el cuaderno ejecutado con sus salidas mediante Archivo → Descargar → Descargar .ipynb. No borrar ni editar el interior del ZIP. Si el navegador no ofrece la descarga, buscar el ZIP en el panel Archivos de Colab y descargarlo desde allí.
7. En [ProteinForge → Laboratorio](https://protein-forge.vercel.app/generate/lab), abrir el ZIP completo para su validación e inspección. Para continuar en otro chat, indicar las rutas exactas del ZIP y del cuaderno guardados; no hace falta compartir Drive públicamente.

La campaña opcional de tres predicciones requiere activar `RUN_CAMPAIGN = True` en su celda y produce otro paquete. Para avanzar rápido, basta primero el recorrido básico de una predicción. [Procedimiento completo y descarga de campaña](design-lab-colab.md).

## Qué significa la validación

El paquete vincula secuencia generada, predicción independiente por otro modelo, referencia y versiones. Comprueba secuencia exacta, residuos y átomos del esqueleto completos, coordenadas finitas, hashes y archivos asociados; registra confianza y RMSD tras superponer todas las posiciones. El estado `completed` certifica la coherencia técnica del ensayo, no calidad biológica ni un umbral universal de diseño aceptable.

pLDDT y pTM describen confianza del predictor; RMSD compara geometría con el esqueleto usado para diseñar. Es rediseño sobre una estructura conocida, no una forma de novo ni prueba de función o estabilidad experimental. El siguiente chat debe revisar los archivos y las métricas reales antes de presentar conclusiones.

La GPU y duración gratuitas no están garantizadas: [FAQ oficial de Colab](https://research.google.com/colaboratory/faq.html). El uso es interactivo en el cuaderno, sin API ni túneles sobre Colab. No se necesitan claves, montar Drive ni enviar datos privados. [Modelos y configuración fijados](../experiments/design-lab/config.json).
