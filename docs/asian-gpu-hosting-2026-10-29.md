# GPU gratuita en proveedores asiáticos

Investigación ampliada del **29 oct 2026**, America/Bogota. Petición: buscar alternativas distintas de las habituales, especialmente de Asia. Objetivo conservado: obtener rediseño/predicción **dentro de ProteinForge para hasta tres personas**, costo cero y sin tarjeta. Complementa el [primer estudio](free-laboratory-hosting-2026-10-29.md). No autoriza cuentas, solicitudes, despliegues o publicación.

**Actualización posterior de acceso, sesión 29–30 oct:** el propietario creó/inició sesión y envió él mismo la solicitud. Se comprobó `Application in Approval...` en ModelScope y Gradio/Docker deshabilitados como Paid en su cuenta HF. No se repitió la solicitud ni se creó recurso. [Pruebas y estado completo](session-review-2026-10-30.md), que incluye tres respuestas reales validadas del servidor público de ESM Atlas; no son pruebas sobre xGPU.

## Resultado

**Sí hay una alternativa asiática documentada: ModelScope xGPU, de Alibaba.** Su documentación internacional ofrece GPU gratuita para aplicaciones durante una beta con admisión previa. Merece comprobar acceso antes de descartarla o contratar nada. **No se ha comprobado que la cuenta del propietario sea admitida, que acepte ProteinMPNN/ESMFold o que permita conectar el backend de ProteinForge con cuota suficiente.**

La investigación también encontró ofertas de cuadernos, créditos y guías históricas que no equivalen a alojamiento GPU gratuito actual. No se afirma que no existan más programas en Asia: estos son los proveedores examinados y el alcance de la evidencia.

## ModelScope xGPU: candidato nuevo

La [guía internacional de xGPU](https://www.modelscope.ai/docs/studios/xGPU) confirma:

- GPU asignada por petición y liberada al terminar el cálculo.
- Aplicaciones mediante Gradio o Streamlit.
- Uso gratuito durante la beta, previa solicitud a la organización **xGPU-Explorers**.
- Límites de espacios por desarrollador y tiempo por usuario, distintos según GPU; la página no publica cantidades concretas.
- Suspensión automática cuando hay poca actividad.

La [organización pública](https://www.modelscope.ai/organization/xGPU-Explorers) ofrece solicitar ingreso; **no se pulsó Apply to join**. No se verificaron requisitos adicionales de identidad, tarjeta o país. El documento internacional permite distinguir esta oferta de la versión china: no hay que asumir que la disponibilidad de un programa chino se traslada a Colombia.

La [guía de recursos convencionales](https://www.modelscope.cn/docs/studios/resource-selections) ofrece CPU básica gratuita de 2 vCPU/16 GB; las ampliaciones GPU convencionales se contratan mediante PAI-EAS y generan cargos. **xGPU es un programa diferente**; la CPU gratuita no demuestra acceso a GPU. La [guía de creación](https://www.modelscope.cn/docs/studios/create) admite código y dependencias propios, recursos xGPU y publicación de aplicaciones. Esto no prueba por sí solo la llamada externa ni las reglas de cuota de un proxy central.

### Condiciones que cambian la decisión

Los [términos internacionales](https://www.modelscope.ai/protocol/Terms-and-Condition), secciones 3–6, limitan Studio al uso personal, educativo y no comercial; indican que no se debe aportar contenido confidencial o propietario, contemplan utilización del contenido para mejorar servicios y contienen una atribución amplia de derechos sobre materiales/resultados generados. **No prometer confidencialidad ni propiedad exclusiva de resultados bajo ese contrato sin aclaración del proveedor.** Un ensayo, si se aprueba, debe limitarse a entradas públicas. No se aceptaron términos ni se creó cuenta.

Los [términos chinos](https://www.modelscope.cn/protocol/用户协议), sección 10.2, orientan ese servicio a usuarios de China continental y no garantizan acceso fuera. Por eso se encontró y verificó expresamente la documentación internacional, cuyo operador contractual es Alibaba Cloud (Singapore) Private Limited. **La ubicación física de las GPU no está comprobada**; operador en Singapur no demuestra que el cálculo ocurra allí.

### Preguntas concretas antes de un ensayo

1. ¿Admiten una cuenta individual de Colombia para una demo académica no comercial usada por tres personas? ¿Exigen tarjeta, verificación adicional o vincular un servicio facturable?
2. ¿Permiten ejecutar nuestros pesos públicos de ProteinMPNN y ESMFold y qué GPU/VRAM/RAM se asignaría? Como referencia, el caso anterior de 76 residuos registró 7,91 GiB asignados en otra GPU; no es una medida de xGPU.
3. ¿Se permite llamar a nuestra aplicación Gradio desde FastAPI/Vercel mediante API, con identidad del trabajo, o el uso debe hacerse dentro de ModelScope? ¿Cómo se atribuye la cuota a tres usuarios de nuestra web?
4. ¿Cuál es la cuota concreta, duración máxima por petición, tiempo de espera y fecha/condición de fin de la beta?
5. ¿Qué condiciones aplican al uso y conservación de nuestras secuencias y resultados públicos?

Estas preguntas están preparadas para el propietario. **No se envió ningún mensaje al proveedor.** Una respuesta favorable y autorización separada permitirían ensayar los tres trabajos en serie del primer estudio. No diseñar pantallas ni cambiar contratos antes de obtener evidencia.

## Otros proveedores examinados

| Proveedor / mercado | Evidencia encontrada | Encaje con cero gasto y sin tarjeta |
|---|---|---|
| **Baidu AI Studio — China** | La guía de despliegue de proyectos permite exponer programas de Notebook como API pública, pero el servicio de máquina dedicada CPU/GPU se paga por tiempo, consume A-coins y se detiene al agotarlos. La guía limita la autenticación de la API al creador. | No se acreditó alojamiento GPU gratuito continuado. Una cuota gratuita de Notebook no debe confundirse con el despliegue. [Guía oficial, actualizada 1 jul 2025](https://ai.baidu.com/ai-doc/AISTUDIO/Blopive5g). |
| **OpenXLab — China / Shanghai AI Laboratory** | Guías antiguas: despliegue gratuito, solicitud de vGPU/A10/A100 e incrustación en otras webs. Pero el sitio actual muestra un aviso oficial del **20 nov 2025**: suspender nuevas aplicaciones/modelos/datasets un mes después y pasar a soporte mínimo. | Descartado para un proyecto nuevo. El intento de abrir la solicitud de hardware redirigió a la portada con ese aviso. [Portada y aviso](https://openxlab.org.cn/), [guía histórica](https://openxlab.org.cn/docs/en/apps/应用创建流程.html). |
| **Alibaba Cloud — oferta internacional** | Pruebas de producto una sola vez por usuario, con teléfono verificado y método de pago: tarjeta de crédito/débito admitida o PayTM para India. Las condiciones y recursos dependen del producto. | La prueba internacional convencional incumple «sin tarjeta» para nuestro caso colombiano y no equivale a una cuota permanente. No se acreditó una GPU concreta gratis para nuestra cuenta. [Condiciones de pruebas, actualizadas 13 oct 2026](https://www.alibabacloud.com/help/en/user-center/product-overview/learn-about-free-trials). |
| **Jarvislabs — India** | Su FAQ actual declara que **no ofrece prueba gratuita**. Compra mínima de crédito: US$25 para clientes internacionales o ₹500 para facturación en India. GPU disponible mediante pago por uso. | Descartado con presupuesto cero. No usar publicaciones antiguas de promociones como evidencia de una oferta actual. [FAQ del proveedor](https://jarvislabs.ai/). |

### Consultas con evidencia incompleta

- **E2E Networks, India:** los resultados del dominio oficial anuncian prueba limitada y programa para startups. Se alcanzó su página de precios mediante el resultado traducido, pero el acceso directo presentó una verificación de seguridad. **No se completó la verificación ni se acreditaron cuota, elegibilidad internacional, duración o requisitos de pago.** No se clasifica como solución gratuita disponible para ProteinForge. [Precios](https://www.e2enetworks.com/pricing).
- **Bohrium / DP Technology, China:** se localizaron documentación de Notebook y ofertas de créditos; no se consiguió leer la guía oficial de cómputo en la página consultada. **No se acreditó GPU gratuita para servir nuestra API**, ni se confundieron créditos de búsqueda bibliográfica con crédito GPU. [Documentación consultada](https://bohrium-doc.dp.tech/).

No se revisaron exhaustivamente todos los países asiáticos ni todas las becas universitarias. No se atribuye una GPU gratuita a Japón, Corea u otro país sin una oferta primaria comprobada.

## Recomendación para ProteinForge

Añadir **ModelScope xGPU internacional** como candidato junto a la alternativa anterior, con el estado **«beta gratuita documentada; acceso/cuota/contrato externo sin comprobar»**. No sustituir una implementación por un iframe de ejemplo ni presentar otra demo como integración propia. Ser tres personas reduce la capacidad necesaria, pero no elimina requisitos de admisión o uso.

Si se obtiene acceso válido: probar código público conocido, un trabajo simultáneo, secuencia exacta y paquete verificable; medir tres ejecuciones y consumo antes de integrar. Guardar los resultados fuera del ejecutor y conservar el archivo portable. Las pantallas nuevas, operaciones remotas y publicación siguen requiriendo sus autorizaciones correspondientes.

## Verificación realizada

Lectura en navegador de documentación y condiciones oficiales de ModelScope internacional/chino, organización pública xGPU, documentación de Baidu, aviso actual de OpenXLab, FAQ de Jarvislabs y reglas internacionales de pruebas de Alibaba. Búsquedas adicionales de E2E/Bohrium con límites indicados. El buscador dedicado devolvió 503; se usó navegador. Ningún resultado de resumen automático se trató como sustituto de una fuente oficial.

**No hubo altas, solicitudes de ingreso, mensajes, inferencia, descargas de pesos, secuencias enviadas, instalación, tarjeta, medición, despliegue o prueba con tres cuentas.** Solo documentación local, revisión de enlaces locales y `git diff --check`; sin pruebas de aplicación por no cambiar código. Backend intacto, sin commit ni push.
