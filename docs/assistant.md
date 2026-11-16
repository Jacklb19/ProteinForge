# Lectura de los resultados

Una sección al pie de Analizar y del Laboratorio redacta, a petición, una explicación en prosa de los resultados que la pantalla ya calculó. Contrato y límites del servicio en la [documentación del backend](https://github.com/Jacklb19/Protein_Back/blob/main/docs/assistant.md).

## Uso y datos enviados

Con sesión y una API configurada, «Pedir una lectura» («Leer estas propiedades» o «Leer estos resultados») solicita una explicación en el idioma activo. Sin sesión ofrece iniciar sesión y regresar a la pantalla. La solicitud es deliberada, sin chat ni historial.

`AssistantService/Interpret` recibe solo datos etiqueta/valor/unidad:

- en Analizar: longitud, descriptores, composición y ventana del perfil;
- en el Laboratorio: muestra, referencia, longitud, pLDDT medio, RMSD Cα, pTM, identidad posicional y cantidad de posiciones protegidas.

Se usan las etiquetas y el formato numérico de la pantalla. **El cliente no tiene ningún campo para enviar la secuencia.** La clave de Groq permanece en el backend (proveedor Groq, modelo `openai/gpt-oss-120b`). Un borrador de laboratorio con la secuencia modificada envía solo su estado, longitud, muestra, referencia y cantidad de protecciones: las cifras de su predicción anterior quedan fuera.

El texto recibido se muestra como prosa plana, con las cifras enviadas al lado y la procedencia (modelo, proveedor y fecha). No se interpreta HTML ni Markdown. La prosa tiene 62 caracteres de ancho y un interlineado de 1,75 mediante tokens; las cifras van a la derecha en escritorio y debajo en móvil.

## Vigencia y errores

- La lectura pertenece a los datos y al idioma de la solicitud; cambiar cualquiera de ellos retira el texto anterior. Analizar ofrece la acción solo cuando sus descriptores están actualizados, y cargar otro conjunto del laboratorio invalida la lectura aunque reutilice identificadores de variantes.
- Las solicitudes se cancelan al desmontar el bloque o al pedir otra lectura; una respuesta cancelada que llega tarde no reemplaza a la nueva. No hay reintento automático.
- El plazo del cliente es de 40 s, frente a los 10 s generales: cubre la identidad (hasta 5 s), Groq (hasta 30 s) y el margen de transporte. Las demás rutas conservan 10 s.
- El presupuesto agotado, la sesión inválida, los fallos de red o del proveedor y las cifras rechazadas por la API muestran mensajes bilingües y permiten reintentar. Sin configuración de identidad ni de API no se muestra la sección.
- Los errores estables de la API se clasifican en el cliente: `FAILED_PRECONDITION` con `assistant-not-configured` es «indisponible»; `UNAVAILABLE` se distingue por su mensaje (`assistant-provider-error`, `assistant-unreachable`, `assistant-invalid-response`, `assistant-incomplete` o `assistant-unverified-figure`). El cliente conserva la referencia de la solicitud (`X-Request-Id`) y no expone el detalle del servidor.

## Comprobación de las cifras

La API comprueba que las cifras citadas en la prosa estén entre las enviadas. Además hay una comprobación conservadora de expresiones de cantidad en español e inglés (mitad, mayoría, minoría y equivalentes): si esa expresión no viene explícita en un valor enviado, el texto se rechaza con el código `assistant-unverified-figure`. No es una validación semántica completa y puede descartar una redacción correcta que no esté entre los valores suministrados; no garantiza lecturas válidas.

## Alcance

No calcula propiedades, no genera candidatos ni estructuras y no demuestra función, estabilidad ni actividad experimental. No interpreta todavía Comparar ni Diseñar, no guarda la lectura en Proyectos ni la exporta a los informes y no ofrece una alternativa local cuando falla Groq.

## Pruebas

Unitarias del cliente RPC real con respuestas simuladas (configuración ausente, proveedor inaccesible o fallido, respuesta inválida o incompleta, cifras rechazadas, cuota y sesión) y E2E de la sección en ambos idiomas con comprobaciones AA a 360 y 1280 px en los dos temas, con sesión y proveedor simulados. Estas pruebas no acreditan la corrección científica de una lectura real de Groq. En el backend, las pruebas de Connect y gRPC-Web comprueban que la configuración ausente devuelve su código estable sin consultar al proveedor.

## Cambios de contrato

Cuando un cambio modifica el contrato (`AssistantService`): publicar el backend, fijar `buf.gen.yaml` al commit publicado, ejecutar `npx buf generate`, revisar y confirmar el resultado y publicar el frontend. `GROQ_API_KEY` se configura en el proyecto de Vercel del backend; el `.env` local no la despliega.
