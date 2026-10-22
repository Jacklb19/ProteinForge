# Asistente de interpretación (RF-11) · propuesta

Preparada el **22 oct 2026**. Requiere decisión del propietario antes de implementar. No se habilitó proveedor, no se creó cuenta, no se configuró clave y no se envió ningún dato. Concreta RF-11 de la [definición vigente](definicion-proyecto.md), que prevé un asistente con Groq y `openai/gpt-oss-120b` pero deja sin verificar proveedor, límites, consentimiento y retención.

El asistente **interpreta resultados ya calculados**. No genera secuencias, no sustituye al generador, no predice estructura y no decide ciencia: eso lo hacen los módulos existentes ([candidatos](candidates.md), [laboratorio](laboratory.md), [informes](reports.md)).

## Lo que se decide

1. Si hace falta un modelo de lenguaje o basta un resumen determinista escrito por nosotros.
2. Si se habilita Groq: qué modelo, qué contexto sale del navegador y con qué consentimiento.
3. Retención del proveedor y si se activa retención cero en la cuenta.
4. Qué hacer cuando la cuota se agota.

## Opciones

| | A · Resumen determinista local (recomendado primero) | B · Groq con contexto reducido | C · Modelo en el navegador |
|---|---|---|---|
| Cómo funciona | Reglas y plantillas bilingües sobre las cifras ya calculadas | La API envía un contexto acotado al proveedor y devuelve texto | Modelo descargado al cliente |
| Qué sale del dispositivo | Nada | Descriptores, anotación y parámetros; **nunca** la secuencia completa | Nada |
| Consentimiento | No hace falta | Obligatorio y explícito, nombrando proveedor y datos | No hace falta |
| Costo | Cero | Plan gratuito con límites por cuenta | Cero en dinero; coste alto de descarga |
| Riesgo de inventar datos | Nulo: solo redacta lo que existe | Real; exige pruebas que lo impidan | Real, y peor con modelos pequeños |
| Trabajo | Textos `es.ts`/`en.ts` y reglas | Endpoint, clave de servidor, cuotas, caché, consentimiento y pruebas | Carga, memoria y rendimiento en el navegador |
| Límite | Lenguaje acotado, sin matices | Depende de un proveedor externo | No encaja con el peso ya existente de Mol* y WASM |

Se recomienda **A** como primera entrega: cubre buena parte de RF-11 sin proveedor, sin consentimiento, sin cuota y sin riesgo de afirmaciones inventadas; los informes ya contienen las cifras que el texto describiría. **B** queda como ampliación posterior, si el propietario quiere redacción flexible. **C** se descarta por peso.

## Si se elige Groq

- **Ruta prevista:** `POST /v1/assistant/interpret`, autenticada, ya anunciada como prevista en los contratos del backend. Clave únicamente en variables del servidor; el navegador nunca la ve.
- **Contexto:** descriptores calculados, anotación de referencias, parámetros y resultados numéricos. La secuencia completa no se envía. Los errores siguen nombrando campos, no valores, y las secuencias no se registran en logs.
- **Límites publicados:** la página de límites de Groq publica cifras por modelo del plan Developer — por ejemplo `openai/gpt-oss-120b` con 30 peticiones por minuto, 1.000 al día, 8.000 tokens por minuto y 200.000 al día — y remite los valores exactos del plan gratuito a la configuración de la cuenta. Hay que leerlos en la cuenta del propietario antes de prometer disponibilidad, y añadir cuota propia por usuario.
- **Retención:** Groq declara que por defecto no conserva datos de cliente en solicitudes de inferencia, que puede registrar entradas y salidas temporalmente para fiabilidad o abuso durante hasta 30 días, que ese registro se puede desactivar y que existe retención cero. La página consultada **no** dice si las entradas se usan para entrenar: eso se comprueba en los términos antes de habilitar nada. Decisión 3: activar retención cero en la cuenta o no usar el proveedor.
- **Cuota agotada:** respuesta explícita con plantilla bilingüe y, si procede, el resumen determinista de la opción A como alternativa visible, siempre identificado como texto propio y no como respuesta del modelo.
- **Caché:** por clave de contexto, para no repetir envíos idénticos; retención corta y acotada.

## Reglas de contenido y pruebas

- El texto solo puede citar valores presentes en el contexto; cualquier cifra ausente es un fallo de la prueba, no un matiz.
- Prohibido afirmar función, estabilidad, actividad, novedad, probabilidad de éxito o calidad biológica. Un candidato que cumple intervalos no es una proteína validada, y una predicción no demuestra actividad.
- El texto se marca como interpretación automática de resultados ya calculados, con su proveedor cuando lo haya.
- Pruebas: contexto sin un campo, cifras fuera de rango, cuota agotada, proveedor caído, consentimiento ausente y comparación del texto contra los valores de entrada. Idioma correcto en los dos catálogos.
- Interfaz: cualquier panel o aviso nuevo necesita propuesta maquetada aprobada y textos simultáneos en `src/i18n/es.ts` y `src/i18n/en.ts`.

## Lo que no incluye

Conversación abierta, memoria entre sesiones, envío de la secuencia completa, generación de secuencias, interpretación de estructuras no calculadas por la app, gasto, publicación ni migraciones.

## Decisión pedida

- **Opción A:** implementar el resumen determinista bilingüe, sin proveedor externo.
- **Opción B:** habilitar Groq con `openai/gpt-oss-120b`, retención cero confirmada en la cuenta, contexto sin secuencia y consentimiento explícito.
- **Opción A+B:** A ahora y B después, con A como alternativa cuando el proveedor falle o se agote la cuota.
- **Opción D:** dejar RF-11 pendiente.

Fuentes consultadas el 22 oct 2026: [límites de Groq](https://console.groq.com/docs/rate-limits), [datos y retención de Groq](https://console.groq.com/docs/your-data), [contratos de API](../../backend/docs/api.md), [arquitectura del backend](../../backend/docs/arquitectura.md), [informes](reports.md).
