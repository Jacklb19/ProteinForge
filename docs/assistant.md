# Lectura de los resultados

Publicada el 23 oct 2026, con la dirección A revisada y aprobada por el propietario: una sección al pie de Analizar y del Laboratorio. La entrega posterior del 26 oct también está publicada y su CI terminó correctamente. [Decisión visual](assistant-ui-proposal.md) · [contrato backend](../../backend/docs/assistant.md) · [relevo vigente](prompt-siguiente-entrega.md). La corrección de errores descrita abajo es posterior y permanece local.

## Diagnóstico local del 26 oct 2026

La lectura de cifras públicas de insulina en producción mostró «No se pudo obtener la lectura». La evidencia conservada no incluye el estado RPC ni su mensaje de error: no permite atribuir la causa a la clave, al modelo o a Groq.

Se reprodujo una omisión del cliente: `assistant-not-configured` llega como `FAILED_PRECONDITION` (9), pero faltaba en el catálogo de errores y acababa en `unknown`, que muestra exactamente ese texto genérico. La corrección lo clasifica como `unavailable` y reutiliza el mensaje ya existente en español e inglés. No modifica el contrato, el proveedor, el presupuesto, los plazos ni el verificador de cifras. Es una causa compatible con el síntoma, **no la causa demostrada del incidente**.

La regresión recorre el cliente gRPC-Web real con respuestas simuladas: falta de configuración, proveedor inaccesible o fallido, respuesta inválida o incompleta, cifras rechazadas, cuota y sesión. Conserva la referencia de solicitud y no expone el detalle del servidor. El backend comprueba por Connect y gRPC-Web que la configuración ausente devuelve su código estable sin consultar al proveedor. El recorrido de navegador comprueba el mensaje de indisponibilidad en ambos idiomas, sin mostrar fuentes ni bloquear la acción.

Para cerrar el incidente hace falta el código RPC y el mensaje estable de la respuesta fallida, junto con su `X-Request-Id` si está disponible. No compartir `Authorization`, cookies, claves, un HAR completo ni datos privados. `FAILED_PRECONDITION`/`assistant-not-configured` acredita configuración ausente en ese proceso; `UNAVAILABLE` debe distinguirse por su mensaje (`assistant-provider-error`, `assistant-unreachable`, `assistant-invalid-response`, `assistant-incomplete` o `assistant-unverified-figure`). La captura visual por sí sola no distingue esos casos. Esta continuación no repite la solicitud real ni consume cuota remota.

## Uso y datos enviados

Con sesión y una API configurada, «Leer estas propiedades» o «Leer estos resultados» solicita una explicación en el idioma activo. Sin sesión ofrece iniciar sesión y regresar a la pantalla. La solicitud es deliberada, sin chat ni historial.

`AssistantService/Interpret` recibe solo datos etiqueta/valor/unidad: en Analizar, longitud, descriptores, composición y ventana del perfil; en Laboratorio, muestra, referencia, longitud, pLDDT medio, RMSD Cα, pTM, identidad posicional y cantidad de posiciones protegidas. Se usan las etiquetas y el formato numérico de la pantalla. **El cliente no tiene un campo para enviar la secuencia.** La clave de Groq permanece en el backend.

Un borrador de laboratorio con la secuencia modificada solo envía su estado, longitud, muestra, referencia y cantidad de protecciones: las cifras de su predicción anterior quedan fuera. El texto recibido se muestra como prosa plana, con las cifras enviadas al lado y procedencia de modelo, proveedor y fecha. No se interpreta HTML ni Markdown.

## Vigencia y errores

La lectura pertenece a los datos y al idioma de la solicitud; cambiar cualquiera de ellos retira el texto anterior. Analizar solo ofrece la acción cuando sus descriptores están actualizados, y cargar otro conjunto del laboratorio invalida la lectura aunque reutilice identificadores de variantes. Las solicitudes se cancelan al desmontar el bloque o pedir otra lectura; una respuesta cancelada que llegue tarde no reemplaza la nueva. El presupuesto agotado, la sesión inválida, los fallos de red/proveedor y las cifras rechazadas por la API muestran mensajes bilingües y permiten reintentar. Sin configuración de identidad/API no se muestra la sección.

No calcula propiedades, no genera candidatos ni estructuras y no demuestra función, estabilidad o actividad experimental. No interpreta todavía Alinear ni Diseñar, no persiste la lectura en Proyectos ni la exporta a los informes. No ofrece una alternativa local cuando falla Groq.

## Verificación y publicación

Corrección local del 26 oct: tipos, lint y build correctos; **444 unitarias en 78 archivos** y **9/9 E2E del asistente** en Chromium, con sesión/proveedor simulados. Incluye indisponibilidad en español/inglés y comprobaciones AA a 360/1280 en ambos temas. Backend: **10/10 pruebas del asistente**, incluida configuración ausente por Connect/gRPC-Web y rechazo de cifras inventadas. Regresión del cliente observada antes del arreglo (1 fallo de 8), corregida después; el primer E2E nuevo buscaba el selector de idioma en el pie de una sesión autenticada, se corrigió para usar Perfil y la batería final pasó completa. Persisten los avisos previos de Vite/fuentes/chunks; no se cambió PWA, Workers ni caché y no se repitió su certificación.

Verificación del 23 oct: tipos, lint y build correctos; **357 unitarias en 66 archivos**, cobertura 84,50 % sentencias / 75,14 % ramas / 81,91 % funciones / 87,67 % líneas. **33/33 E2E sin omisiones**: `assistant.spec.ts`, `laboratory.spec.ts`, `editor-design.spec.ts`, `projects.spec.ts` y `reports.spec.ts`, con ambos ZIP reales de Colab. Incluye 8 casos del asistente, AA a 360/1280 en los dos temas y regresión de reemplazo del conjunto. PWA correcta con 47 recursos: fuentes, Workers/WASM, laboratorio, cuaderno y exportación local sin conexión.

Los transportes, textos de respuesta y sesiones de esas E2E son simulados; no acreditan integración autenticada con el backend publicado ni corrección científica de una lectura real de Groq. Las cuatro capturas `artifacts/assistant-reading-{360,1280}-{light,dark}.png` se revisaron visualmente; son locales y no se versionan. Código RPC regenerado desde `../backend/proto` sin diferencias. Persisten los avisos previos de Vite sobre cargador futuro y chunks grandes.

La publicación del asistente y de SIFTS ya terminó: no repetirla. El pin actual de `frontend/buf.gen.yaml` es `a3edaf1d7a43ada2b2bbf9113ff9ccef7f123a57`, backend publicado con ambos servicios. No hacen falta migraciones nuevas.

**Para una futura entrega autorizada que cambie el contrato:**

1. Publicar `dev` del backend y fusionar/publicar su `main`; comprobar CI y despliegue. `GROQ_API_KEY` debe estar configurada por el propietario en Vercel: el `.env` local no la publica.
2. Fijar `frontend/buf.gen.yaml` al commit backend recién publicado que contiene `AssistantService`; ejecutar `npx buf generate`, revisar y confirmar el cambio.
3. Publicar `dev` del frontend y fusionar/publicar su `main`; verificar CI, despliegue y las dos pantallas.

La corrección local de clasificación no cambia protobuf ni requiere regeneración. Publicarla necesita autorización propia; el permiso de la entrega anterior ya se ejecutó.
