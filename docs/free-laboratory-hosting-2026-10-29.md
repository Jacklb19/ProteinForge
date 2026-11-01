# Laboratorio gratuito desde ProteinForge: investigación

Consulta del **29 de octubre de 2026**, America/Bogota. Alcance aclarado por el propietario: crear/modificar proteínas y obtener su estructura **desde su propia web**, para **hasta tres personas**, además de conservar y compartir resultados. No exige tráfico elevado. Investigación, sin implementar, crear cuentas, desplegar ni ejecutar inferencia remota.

**Ampliación solicitada el mismo día:** [proveedores asiáticos](asian-gpu-hosting-2026-10-29.md), con ModelScope xGPU internacional como candidato gratuito en beta sujeto a admisión/cuota/condiciones; Baidu, OpenXLab, Alibaba Cloud y Jarvislabs contrastados con sus fuentes actuales. Sin inferencia ni alta. Este primer estudio no es una búsqueda exhaustiva de proveedores.

**Pruebas posteriores autorizadas, sesión 29–30 oct:** [tres respuestas PDB de ESM Atlas validadas](session-review-2026-10-30.md), sin integración todavía. El propietario envió personalmente la solicitud ModelScope, comprobada pendiente; la cuenta HF actual deshabilita Gradio/Docker. Las afirmaciones inferiores de «sin pruebas nuevas» describen solo esta primera investigación.

## Resultado y recomendación

**Hay un candidato concreto para una demo pública pequeña: un Space propio de Hugging Face ZeroGPU con ProteinMPNN y ESMFold, manteniendo Vercel y Supabase.** La documentación permite alojamiento gratuito y llamadas por API. Eso justifica una prueba técnica; todavía no demuestra que nuestro experimento funcione en ese entorno ni cuántas ejecuciones permite realmente.

Se recomienda comprobar primero **un rediseño de 1UBQ A de 76 residuos, una variante por petición y una tarea a la vez**, antes de ampliar la interfaz. Es el caso que ya tiene evidencia científica y archivos compatibles. Tres personas no necesitan tres GPUs: pueden esperar su turno. Generar esqueletos nuevos desde cero sigue fuera de esta prueba; rediseñar una secuencia sobre una referencia y predecirla no demuestra función biológica.

El flujo objetivo sería: **usuario en ProteinForge → petición autenticada → ejecutor ZeroGPU → resultado validado por el Worker → visor y guardado en Proyecto**. Es una propuesta, no funcionalidad existente.

## Qué permite actualmente Hugging Face

Las cuentas personales gratuitas con correo verificado, más de 30 días y en buen estado pueden alojar hasta **dos Spaces ZeroGPU**. La cuota diaria publicada es de **cinco minutos de GPU por cuenta gratuita**, o dos sin autenticar. Hay cola. La modalidad normal ofrece 48 GB de VRAM y exige Gradio; la compatibilidad del código debe ensayarse. [Documentación ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu).

Los Spaces Gradio exponen API utilizable desde HTTP, Python o JavaScript, con envío de trabajo y consulta del resultado. **Un token central consume la cuota de su cuenta**; tres usuarios de Supabase no reciben por ello tres cuotas de Hugging Face. Sin token se usa un fondo compartido más limitado. [API de Spaces](https://huggingface.co/docs/hub/spaces-api-endpoints).

Para la primera prueba se propone un único ejecutor y presupuesto central estricto, suficiente solo si lo confirma la medición. Si no alcanza, el acceso individual a Hugging Face sería una alternativa a estudiar; no se implementa ni se presupone aprobado. Nunca exponer un token del propietario en React ni fabricar cabeceras para aparentar identidades distintas.

La excepción ZeroGPU importa: crear un Space convencional Gradio/Docker requiere un plan pagado, aunque CPU Basic tenga precio horario cero. También hay solicitudes de ayudas comunitarias de GPU, sujetas a aprobación. No se cuenta con una ayuda concedida. [Spaces Overview](https://huggingface.co/docs/hub/spaces-overview).

Los términos generales contemplan aplicaciones públicas y despliegue, sujetos a licencias y políticas, y permiten modificar o retirar el servicio. **Lectura técnica:** es un candidato para esta demo limitada, sin prometer disponibilidad continua. No se ha aceptado ningún contrato ni completado un alta para confirmar requisitos de esa cuenta. [Condiciones](https://huggingface.co/terms-of-service).

La ficha oficial de **facebook/esmfold_v1** declara licencia MIT y uso mediante Transformers. También indica que el modelo no está desplegado por un Inference Provider: que existan pesos descargables no equivale a disponer de una API gratuita lista. [Ficha del modelo](https://huggingface.co/facebook/esmfold_v1).

## Evidencia propia y lo que todavía no sabemos

La [campaña anterior en Colab](design-lab-three-variants.md) registró, para 76 residuos en una T4:

| Medida histórica | Resultado |
|---|---:|
| Predicción, validación y exportación por muestra | 2,8788–3,0758 s |
| Carga del modelo por muestra | 21,3201–24,0564 s |
| Pico Torch asignado | 7,91 GiB |
| ZIP conjunto de tres muestras | 224.208 bytes |

**Son medidas anteriores en Colab, no mediciones de ZeroGPU.** Excluyen la descarga en frío y no permiten anunciar latencia ni número de trabajos por día en Hugging Face. Su hardware publicado tiene más VRAM que aquel pico, pero falta comprobar RAM del proceso, dependencias, arranque, temporales y adaptación al ciclo de asignación de GPU. El programa actual carga el modelo en cada proceso; no basta envolverlo sin cambios en una llamada remota.

Se inspeccionó también el Space público [ProteinMPNNESM](https://huggingface.co/spaces/simonduerr/ProteinMPNNESM): su interfaz se anuncia en ejecución y contiene el recorrido MPNN/ESMFold. **No se pulsó Run**. Es una referencia de implementación, no nuestro ejecutor, una ejecución comprobada ni una garantía de disponibilidad o permiso para consumir sus recursos desde ProteinForge.

## Guardar y compartir

El código actual ya guarda el laboratorio en el snapshot privado del proyecto: documento de **1.000.000 bytes**, hash y revalidación al abrir. El archivo portable conserva el ZIP en Base64, por lo que el tamaño guardado es mayor que el ZIP. La importación local admite ZIP de hasta 10 MB y archivo de trabajo de hasta 15 MB; esos límites **no** amplían el del proyecto en nube. Fuentes: `src/features/design-lab/config.ts`, `workspace.ts`, `validate.ts` y `../backend/app/laboratory.py`.

Para tres personas y resultados pequeños, conviene aprovechar primero ese guardado. Compartir hoy puede hacerse entregando el archivo portable a la otra persona para que lo importe. **No hay un enlace de proyecto que dé acceso a otra cuenta**. El importador acepta nuestro formato validado; no cualquier PDB/CIF o ZIP descargado de otro proveedor.

Si hacen falta paquetes mayores o enlaces temporales, la ampliación recomendada es **Supabase Storage privado**, guardando en la base solo metadatos, propietario y hash. Free publica **1 GB de archivos**, separado de **500 MB de base**, 5 GB de salida y otros 5 GB de salida cacheada, y máximo de 50 MB por archivo. Los proyectos gratuitos pueden pausarse tras una semana sin actividad; no incluyen backups automáticos ni SLA. Son límites del plan, no espacio libre medido en nuestro proyecto. [Precios oficiales](https://supabase.com/pricing).

Los buckets privados aplican RLS también a la descarga y permiten URLs firmadas con caducidad. Quien tenga una URL firmada podrá usarla hasta su vencimiento; compartirla debe ser explícito. No hacer público el bucket para resolver el intercambio. Esta integración requiere contrato, políticas y pruebas propios; **no está implementada**. [Modelo de acceso](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Alternativas revisadas

| Opción | Resultado para este alcance |
|---|---|
| Colab gratuito manual | Mantener como respaldo. Su FAQ restringe servicios web ajenos al uso interactivo y eludir el notebook; no convertirlo en servidor de nuestra web mediante túnel. [FAQ oficial](https://research.google.com/colaboratory/faq.html). |
| AlphaFold Server | Herramienta gratuita para uso no comercial, con condiciones específicas sobre resultados. Puede servir para trabajo manual; no se comprobó una API integrable. Sus archivos no son directamente compatibles con nuestro importador actual. [Términos oficiales](https://alphafoldserver.com/terms). |
| OpenProtein | Tiene API de predicción documentada, pero no se encontró una oferta gratuita permanente acreditada para este uso en las páginas revisadas. La web anuncia suscripción; no presupuestar cero ni integración pública sin condiciones concretas. [API](https://docs.openprotein.ai/rest-api/fold.html), [oferta](https://www.openprotein.ai/), [condiciones](https://www.openprotein.ai/terms-conditions/). |
| Equipo propio o universitario | Alternativa si ya hay GPU y autorización de uso. El portátil conocido queda al límite del pico anterior; no probado. Un equipo universitario disponible tampoco se ha acreditado. |
| NVIDIA de prueba | Se conserva el descarte para producción de la [revisión anterior](app-inference-proposal.md): evaluación interna. No se volvieron a revisar sus términos en esta investigación. |

## Prueba concreta propuesta antes de integrar

1. El propietario confirma que ya dispone de una cuenta Hugging Face elegible y autoriza expresamente crear/desplegar **un Space ZeroGPU gratuito**, sin tarjeta ni mejoras de pago. Si no es elegible, no asumir acceso inmediato ni crear cuentas por nuestra parte.
2. Preparar el ejecutor separado de FastAPI, con versiones/licencias fijadas y solo el caso público 1UBQ A. Generación ProteinMPNN sobre referencia, predicción ESMFold de la secuencia exacta y paquete con procedencia. Para predecir solo una edición se omite MPNN; no sustituir la edición del usuario por otro rediseño.
3. Medir arranque en frío y en caliente, GPU/RAM, tiempo de cola, tiempo de cómputo y cuota realmente descontada. Ejecutar tres trabajos distintos en serie, identificados, y comprobar que el tercero termina dentro del presupuesto disponible. Si la cuota se agota, registrar ese límite; no eludirlo.
4. Reimportar resultados con el Worker y verificar secuencia, coordenadas, confianza, hashes y asociación de cada trabajo. No forzar el formato antiguo ni fabricar campos para que acepte un resultado nuevo.
5. Solo si pasa, acordar el contrato de trabajos asíncronos, identidad/propiedad, consentimiento, cuota, fallo/cancelación y conservación del resultado. Evitar mantener una función Vercel bloqueada mientras espera GPU. La autorización de una prueba no incluye publicar la integración ni aplicar migraciones.
6. Preparar las pantallas y el plan para aprobación antes de programar la interfaz nueva. Verificar después el flujo desde ProteinForge con las tres sesiones y el guardado, sin confundir tres ejecuciones técnicas con tres cuentas reales comprobadas.

## Verificación de esta investigación

Lectura del relevo, reglas, documentos de arquitectura/contratos, código del laboratorio/persistencia, rutas/migraciones y fuentes oficiales anteriores. Ambas copias estaban en `dev`, frontend `2cb6c8b` y backend `cbff97e`, según referencias locales, sin fetch. El buscador devolvió 503 en dos intentos; las fuentes se consultaron directamente en navegador, con una búsqueda web para localizar alternativas.

**Ninguna inferencia nueva, instalación, alta, carga de secuencias privadas, prueba con cuentas, medición de rendimiento, migración o publicación.** No se ejecutó la batería de aplicación porque solo cambia documentación. No se afirma que la cadena ZeroGPU ya funcione ni que la cuota alcance para las tres personas.
