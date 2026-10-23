# Lectura de los resultados

Implementada en `dev` el 23 oct 2026, con la dirección A revisada y aprobada por el propietario: una sección al pie de Analizar y del Laboratorio. [Decisión visual](assistant-ui-proposal.md) · [contrato backend](../../backend/docs/assistant.md). La implementación local todavía no está publicada.

## Uso y datos enviados

Con sesión y una API configurada, «Leer estas propiedades» o «Leer estos resultados» solicita una explicación en el idioma activo. Sin sesión ofrece iniciar sesión y regresar a la pantalla. La solicitud es deliberada, sin chat ni historial.

`AssistantService/Interpret` recibe solo datos etiqueta/valor/unidad: en Analizar, longitud, descriptores, composición y ventana del perfil; en Laboratorio, muestra, referencia, longitud, pLDDT medio, RMSD Cα, pTM, identidad posicional y cantidad de posiciones protegidas. Se usan las etiquetas y el formato numérico de la pantalla. **El cliente no tiene un campo para enviar la secuencia.** La clave de Groq permanece en el backend.

Un borrador de laboratorio con la secuencia modificada solo envía su estado, longitud, muestra, referencia y cantidad de protecciones: las cifras de su predicción anterior quedan fuera. El texto recibido se muestra como prosa plana, con las cifras enviadas al lado y procedencia de modelo, proveedor y fecha. No se interpreta HTML ni Markdown.

## Vigencia y errores

La lectura pertenece a los datos y al idioma de la solicitud; cambiar cualquiera de ellos retira el texto anterior. Analizar solo ofrece la acción cuando sus descriptores están actualizados, y cargar otro conjunto del laboratorio invalida la lectura aunque reutilice identificadores de variantes. Las solicitudes se cancelan al desmontar el bloque o pedir otra lectura; una respuesta cancelada que llegue tarde no reemplaza la nueva. El presupuesto agotado, la sesión inválida, los fallos de red/proveedor y las cifras rechazadas por la API muestran mensajes bilingües y permiten reintentar. Sin configuración de identidad/API no se muestra la sección.

No calcula propiedades, no genera candidatos ni estructuras y no demuestra función, estabilidad o actividad experimental. No interpreta todavía Alinear ni Diseñar, no persiste la lectura en Proyectos ni la exporta a los informes. No ofrece una alternativa local cuando falla Groq.

## Verificación y publicación

Verificación del 23 oct: tipos, lint y build correctos; **357 unitarias en 66 archivos**, cobertura 84,50 % sentencias / 75,14 % ramas / 81,91 % funciones / 87,67 % líneas. **33/33 E2E sin omisiones**: `assistant.spec.ts`, `laboratory.spec.ts`, `editor-design.spec.ts`, `projects.spec.ts` y `reports.spec.ts`, con ambos ZIP reales de Colab. Incluye 8 casos del asistente, AA a 360/1280 en los dos temas y regresión de reemplazo del conjunto. PWA correcta con 47 recursos: fuentes, Workers/WASM, laboratorio, cuaderno y exportación local sin conexión.

Los transportes, textos de respuesta y sesiones de esas E2E son simulados; no acreditan integración autenticada con el backend publicado ni corrección científica de una lectura real de Groq. Las cuatro capturas `artifacts/assistant-reading-{360,1280}-{light,dark}.png` se revisaron visualmente; son locales y no se versionan. Código RPC regenerado desde `../backend/proto` sin diferencias. Persisten los avisos previos de Vite sobre cargador futuro y chunks grandes.

**Orden obligatorio de publicación, tras autorización expresa:**

1. Publicar `dev` del backend y fusionar/publicar su `main`; comprobar CI y despliegue. `GROQ_API_KEY` debe estar configurada por el propietario en Vercel: el `.env` local no la publica.
2. Fijar `frontend/buf.gen.yaml` al commit backend recién publicado que contiene `AssistantService`; ejecutar `npx buf generate`, revisar y confirmar el cambio.
3. Publicar `dev` del frontend y fusionar/publicar su `main`; verificar CI, despliegue y las dos pantallas.

El pin actual `5b6c4505c77293e1f4798e0bd86932e13c11600f` no contiene el asistente. Hasta publicar backend, la generación local usa `npx buf generate ../backend/proto`. **No publicar el frontend con ese pin antiguo:** CI regenera desde él y detectaría diferencias. No se necesitan migraciones nuevas.
