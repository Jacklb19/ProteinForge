# Laboratorio didáctico de diseño de proteínas

Cierre local del 21 oct: [persistencia del laboratorio en Proyectos](laboratory-projects.md) aprobada e implementada en ambos repositorios, con pruebas de API y PostgreSQL real local. Publicación y migración remota pendientes de autorización específica. Las etapas siguientes conservan el historial.

Acuerdo inicial del 12 de octubre de 2026. [Estado actual](plan-desarrollo.md), [generador](candidates.md) y [visor](references.md). Los apartados inferiores conservan el plan y consultas originales; consultar primero las actualizaciones.

Continuación del 21 oct: [restricciones ejecutadas en Colab y verificadas](design-lab-constraints.md). El laboratorio exporta JSON v2 y cuaderno, importa el resultado condicionado y conserva sus protecciones. Se presenta la [propuesta de guardado en Proyectos](laboratory-projects-proposal.md), todavía sin implementar contratos/migraciones de nube. El resto de la actualización inicial del día se conserva como historia.

Actualización del 21 oct: A · Mesa de estructura y plan aprobados; [laboratorio implementado](laboratory.md) en `/generate/lab`. Incluye importación validada, correspondencia de este rediseño, selección secuencia/3D, edición/protección/deshacer, variantes y persistencia en archivo local. El ejemplo deriva de las tres ejecuciones reales; no inventa coordenadas. Pendientes: ejecutar restricciones en Colab, persistir resultados en Proyectos mediante contrato separado, inferencia desde la app y forma de novo. No se amplía el backend ni se publica esta entrega.

Actualización del 20 oct: el usuario confirma **Colab como entorno del ensayo**. [Cuaderno y ejecución](design-lab-colab.md), con [primer rediseño y predicción completos](design-lab-first-run.md) y continuación de [tres variantes verificadas con la fuente final desde el inicio](design-lab-three-variants.md): cada muestra tiene PDB, confianza, RMSD, mediciones y ZIP propios; la primera reproduce el resultado anterior sin parche. Las tres secuencias comparten el esqueleto experimental 1UBQ A; no son formas nuevas ni acreditan función. No se ejecutaron modelos en Windows. [Dos propuestas visuales y plan por pantallas](design-lab-proposal.md) preparados, pendientes de elección antes de integrar. Faltan importación/selección/edición/persistencia y diseño de novo. Proyectos y migraciones ya publicados/aplicados; confirmación de correo resuelta según el propietario, con CI correcto. Los apartados históricos inferiores no vuelven a abrir esos pendientes.

## Objetivo acordado

Volver a la consigna de crear proteínas mediante un recorrido visual comprensible. Basta obtener dos o tres diseños computacionales útiles para una demostración académica, guardarlos, explorarlos y compararlos. No se necesita atender a muchos usuarios ni mantener inferencia disponible permanentemente.

La aplicación ofrece herramientas para objetivos definidos y exportación para evaluación posterior. Síntesis y validación experimental corresponden a otros profesionales. Generar una secuencia, predecir una estructura y demostrar una función son resultados distintos; ninguno se presenta como prueba del siguiente.

Experiencia propuesta «Diseña tu proteína»: modelo 3D central, explicaciones breves, selección vinculada a la secuencia, sustitución/deshacer, posiciones protegidas, variantes y comparación original/diseño/predicción. Parámetros técnicos en un panel avanzado. Explorar/calcular localmente debe poder hacerse sin cuenta; guardar remotamente requiere identidad y persistencia operativa.

Ya existen editor, descriptores, alineamiento, generador reproducible por masa/GRAVY, Mol* experimental, informes y proyectos preparados. El generador no diseña plegamiento ni garantiza función; el visor no predice una secuencia editada. Faltan correspondencia 3D/secuencia verificada, edición didáctica, importación validada, ejecución de modelos y procedencia del experimento.

Modificar una proteína conocida y diseñar desde cero serán recorridos distintos. Tras editar, el modelo original sigue siendo una referencia hasta obtener una predicción asociada a la variante. Animar o recolorear no recalcula coordenadas. Una trayectoria de difusión, si se muestra, se etiqueta como proceso del algoritmo, no como plegamiento físico ni dinámica molecular.

## Primera prueba antes de ampliar la interfaz

Propuesta: una sola cadena de aproximadamente 80–120 aminoácidos, un trabajo por turno y pocos candidatos. Tamaño inicial para reducir consumo, no límite probado ni garantía de éxito. Puede hacer falta más de tres intentos para conservar dos o tres resultados razonables.

1. Preparar un entorno aislado del backend y fijar versiones, pesos/licencias y entradas.
2. Ejecutar un caso completo; medir instalación/descargas, GPU/RAM máximas, tiempo y fallos.
3. Obtener secuencia, forma diseñada y estructura predicha de esa secuencia exacta; conservar parámetros, semillas y versiones.
4. Validar archivos, cadenas/residuos, asociación de secuencia y coordenadas finitas.
5. Comparar diseño/predicción y documentar métricas/confianza sin convertirlas en probabilidad de función.
6. Guardar y comprobar reapertura/exportación; después repetir para la demo y comprobar una ejecución nueva.

No entrenar un modelo propio. Esta consulta no instaló dependencias estructurales, descargó pesos ni envió secuencias. La prueba real queda pendiente; comprobar reglas de tamaño/descargas y autorización vigente antes de ejecutarla. No instalar modelos en la función FastAPI de Vercel ni versionarlos en Git.

## Herramientas consideradas

| Etapa | Opción | Papel y límite |
|---|---|---|
| Diseñar forma nueva | RFdiffusion | Genera esqueleto, incluso sin plantilla; no completa la secuencia diseñada. Código BSD |
| Diseñar secuencia | ProteinMPNN | Aminoácidos compatibles con esqueleto y posiciones protegidas. Código MIT; CPU/GPU |
| Predecir desde secuencia | ColabFold / AlphaFold2 | Comparación y confianza; no acredita función. ColabFold MIT, pesos AlphaFold2 CC BY 4.0 |
| Alternativa integrada reciente | Foundry: RFD3 + MPNN + RF3 | Suite de Rosetta Commons con tutorial Colab completo. Código BSD-3-Clause; pesos, compatibilidad y consumo por comprobar |
| Alternativa de predicción | ESMFold | CPU/offload disponibles; dependencias originales antiguas y repositorio archivado. API pública histórica sin garantía de disponibilidad |

Fuentes primarias: [RFdiffusion](https://github.com/RosettaCommons/RFdiffusion), [ProteinMPNN](https://github.com/dauparas/ProteinMPNN), [ColabFold](https://github.com/sokrypton/ColabFold), [AlphaFold2/licencias](https://github.com/google-deepmind/alphafold#license-and-disclaimer), [Foundry/tutorial](https://github.com/RosettaCommons/foundry#google-colab), [ESMFold](https://github.com/facebookresearch/esm).

Foundry y RFdiffusion/MPNN/ColabFold son alternativas a ensayar, no dos cadenas a integrar simultáneamente. Elegir tras un caso completo. Entornos de modelos pueden requerir Python/CUDA distintos del backend; no cambiar su runtime ni añadir PyTorch a la API web por eso.

## Objetivos específicos y dificultad

| Objetivo | Alcance |
|---|---|
| Secuencia bajo propiedades sencillas | Generador actual; no significado estructural garantizado |
| Nueva forma y secuencia compatibles | Primera prueba; tres etapas y comparación |
| Conservar región y rediseñar resto | Restricciones verificadas, mapeo y diseño condicionado |
| Unión a objetivo concreto | Preparación del objetivo/método específico; etapa posterior con evaluación especializada |
| Cualquier función descrita libremente | No es una conversión universal realizable de texto a proteína funcional |

Podemos desarrollar herramientas sin ensayos de laboratorio, pero traducir funciones a restricciones sigue siendo una decisión científica. Dificultad media-alta para objetivos acotados. El asistente no inventa función, fuerzas, estabilidad ni puntuaciones de éxito. [Límites AlphaFold](https://www.alphafold.ebi.ac.uk/faq).

## Ejecución y alojamiento

Preferencia inicial: app en Vercel/Supabase y experimento interactivo en Colab gratuito o equipo local. Se detectó RTX 4060 Laptop con 8.188 MiB VRAM; RAM del sistema y ejecución de modelos no verificadas. No asegurar que la cadena cabe en esa GPU. Universidad es alternativa si hay acceso autorizado.

Colab no garantiza GPU/sesiones. Notebooks gratuitos duran como máximo doce horas según disponibilidad/uso; se restringe usarlo como servicio externo o eludir su interfaz. Inicio manual: notebook → descargar → importar en ProteinForge. No proponer túnel/API permanente sobre Colab gratuito. [Condiciones](https://research.google.com/colaboratory/faq.html).

Si luego se exige automatización, definir API/cola y ejecutor GPU separados, con estado/cancelación/errores y resultados fuera de disco efímero. Ejecutor local funciona mientras el equipo esté disponible. Propiedad, almacenamiento, consentimiento y contratos antes de endpoints/migraciones. No hacen falta múltiples ejecutores ni Kubernetes para dos o tres usos.

ZeroGPU publica hasta dos Spaces gratuitos para cuentas verificadas con más de treinta días y cinco minutos diarios para usuario gratuito, con cuotas/colas. La documentación general de Spaces exige plan pagado para nuevos Spaces convencionales con cómputo aunque CPU Basic tenga tarifa horaria cero. Comprobar esa diferencia en la cuenta y compatibilidad antes de depender del servicio. [ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu), [Spaces](https://huggingface.co/docs/hub/spaces-overview).

Railway declara que no ofrece GPU. Render publica CPU/RAM, sin GPU cotizada en el catálogo consultado; Docker/CUDA no acredita GPU física. Ambos pueden alojar API/coordinación de ejecutor externo. Más RAM no sustituye GPU; probar ProteinMPNN CPU aparte sin prometer rendimiento de un plan concreto.

## Precios consultados, sin contratación autorizada

Fotografía oficial del 12 de octubre de 2026, USD. Verificar disponibilidad, impuestos, almacenamiento/tráfico, facturación inicial y requisitos de cuenta antes de contratar. No se crearon recursos ni autorizaron gastos.

| Servicio | Precio publicado | Observación |
|---|---|---|
| Railway Free | US$0 y US$1/mes de crédito | Recursos pequeños; sin GPU |
| Railway Hobby | Mínimo US$5/mes, incluye US$5 de consumo | Se factura exceso |
| Railway contenedores | RAM US$10/GB/mes, CPU US$20/vCPU/mes | Proporcional al consumo; RAM ocupada cuenta sin tráfico. Sandboxes tienen otra tarifa |
| Render Free | US$0, 512 MB | Suspensión tras quince minutos sin tráfico; disco efímero; sin worker gratuito |
| Render 0.5c-512mb | US$7/mes, 512 MB | API ligera |
| Render 1c-2g | US$25/mes, 2 GB | API con más memoria |
| Render 2c-8g | US$135/mes, 8 GB | CPU, no VRAM; no recomendado para primera prueba |
| Runpod RTX A5000 | US$0,27/h, 24 GB VRAM | GPU temporal, más almacenamiento/cargos |
| Runpod L4 | US$0,59/h, 24 GB VRAM | GPU temporal |
| Runpod RTX A6000 | US$0,59/h, 48 GB VRAM | GPU temporal |

Ejemplo aritmético: dos horas de A5000 son US$0,54 solo de cómputo. No es duración medida, garantía de resultados ni importe mínimo para empezar. También cuentan preparación/descargas; almacenamiento retenido puede seguir facturándose. No contratar CPU grande sin medir primero.

Fuentes: [Railway tarifas](https://docs.railway.com/pricing/plans), [facturación](https://docs.railway.com/guides/right-size-cpu-memory), [sin GPU](https://docs.railway.com/guides/open-webui#gpu-and-ollama), [Render precios](https://render.com/pricing), [planes](https://render.com/docs/compute-plans), [gratuito](https://render.com/docs/free), [Runpod precios](https://www.runpod.io/pricing), [Vercel límites](https://vercel.com/docs/functions/limitations).

## Criterio para continuar

Demostrar archivos reales asociados, recursos/tiempo, procedencia y reapertura antes de ampliar el laboratorio. Resultados guardados sirven de ejemplos identificados; no sustituyen comprobar una ejecución nueva. Sin evidencia, seguir con editor/visor de referencias sin llamar predicción a una estructura nueva.

Migraciones Supabase, correos y retornos Google siguen pendientes. Google solicita volver al origen actual; admitir /app y /recover del host/puerto local en Supabase para evitar retorno al sitio publicado. La causa concreta del retorno reportado sigue sin inspección de configuración remota.

El push autorizado de la entrega actual no autoriza merge, migraciones, contratar alojamiento ni publicar modelos. Próximo trabajo desde dev limpio, autoría exclusiva del propietario y sin trailers de coautoría.
