# Continuación de rendimiento de Analizar — 29–30 oct 2026

El propietario autorizó revisar y probar lo necesario, con trabajo paralelo coordinado. Se reservó un único carril de mediciones en los puertos **5336/5337**. Este frente no cambió código del producto, contratos, interfaz, animación, traducciones ni configuración de Vite; tampoco hizo commits, push o publicación. [Método y evidencia anterior](performance-components-2026-10-29.md).

## Resultado

**Ninguna mejora nueva adoptada.** Compartir la caché de `Intl.NumberFormat` no ataca su coste principal, y el ensayo de evaluar el catálogo español mediante `JSON.parse` no mostró una mejora de LCP. Se conserva el comportamiento actual en lugar de introducir complejidad sin beneficio acreditado.

**No se acredita RNF-03 en Analizar.** La comparación de esta continuación es no concluyente y tuvo más ruido que la anterior. No sustituye el incumplimiento medido con más estabilidad el 29 de octubre por una declaración de cumplimiento.

## `formatNumber`: el coste está en el primer constructor

`src/i18n/useTranslation.ts` ya conserva hasta 16 formatos por instancia del hook. La hipótesis era compartirlos entre componentes para evitar construcciones repetidas. Se instrumentó `Intl.NumberFormat` desde el inicio de la página, únicamente en un script ignorado, sin modificar la aplicación.

Diagnóstico sobre tres cargas de Analizar, con CPU ×4, red 4G lenta, contexto nuevo y movimiento reducido:

| Medida | Observado |
|---|---:|
| Construcciones de `Intl.NumberFormat` por carga | 10 |
| Construcciones anteriores al LCP observado | 5 |
| Duración del primer constructor | 51,850–98,375 ms |
| Suma de los otros nueve constructores | 2,045–3,310 ms |

El primer constructor usa `es-CO` sin opciones. Los siguientes formatos repetidos son baratos frente a ese primer uso de `Intl`; el diagnóstico no atribuye sus operaciones internas. **Una caché compartida no elimina ese primer constructor** y solo podría ahorrar parte de los 2–3 ms restantes, además de su trabajo asociado. Eso queda por debajo de la resolución de unos 10 ms que permitía el procedimiento anterior en Analizar; aquí el ruido fue incluso mayor.

No se implementó la caché compartida. El diagnóstico sirve para localizar coste, no para certificar una mejora ni RNF-03: el envoltorio añade trabajo y las tres cargas no permiten acreditar un p75.

Fuentes y datos locales ignorados:

- `artifacts/quality/number-format-diagnostic.mjs`
- `artifacts/quality/number-format-diagnostic.json`
- `artifacts/quality/number-format-diagnostic.log`

## Catálogo español: ensayo aislado

Se creó una variante del build que reemplaza **solo durante su construcción** el objeto de `src/i18n/es.ts` por `JSON.parse` de su representación JSON. El objetivo era comprobar si cambiar la compilación/evaluación del objeto reduce el camino del primer pintado.

El catálogo contiene **1.058 claves**, todos sus valores son cadenas y no hay clave `__proto__`. La serialización JSON ocupa 76.160 bytes UTF-8. La transformación toma ese objeto real; no cambia cadenas ni modifica los catálogos fuente.

Ambas variantes se construyeron con mapas de fuente y con `CI=true`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` vacías, desde el código de `dev` `2cb6c8b` con los cambios de documentación ajenos conservados. El identificador de build queda nulo por árbol con documentación modificada, igual en ambas variantes.

| Build | Fragmento i18n | Gzip calculado con Node | Precaché publicada por el build |
|---|---:|---:|---:|
| A · referencia | 86.750 bytes | 27.724 bytes | 61 entradas; 2.589,14 KiB |
| B · catálogo JSON | 86.764 bytes | 27.731 bytes | 61 entradas; 2.589,15 KiB |

El gzip calculado es una comparación de tamaño; no certifica qué compresión usa un despliegue remoto. La variante queda únicamente en `artifacts/lcp-builds/continuation-catalog-json`, ignorada. El script que la genera es `artifacts/quality/build-catalog-variant.mjs`.

## Medición emparejada

Se utilizó `scripts/measure-lcp.mjs pairs`, sin modificarlo: **15 pares** con A en 5336/B en 5337, y **otros 15 pares** con los puertos intercambiados. Orden ABBA dentro de cada tanda, Chrome **156.0.8078.76**, ventana 360 × 900, red 4G lenta, CPU ×4, contexto y caché nuevos, Service Workers bloqueados. La medición normal conserva movimiento sin reducir, como el método acordado. Solo se midió Analizar.

Los comienzos registrados son `2026-10-30T04:54:49.684Z` y `2026-10-30T04:57:51.210Z` —29 oct por la noche en Bogotá— y el trabajo cruzó la medianoche local. No hubo otras pruebas automatizadas, builds ni otra batería de rendimiento durante ambas tandas. **El propietario estaba usando el navegador para registrarse en proveedores**, según la coordinación; no puede certificarse que la máquina estuviera en reposo.

Resultados de **30 pares / 60 cargas**, agregados con las funciones existentes de `scripts/lcp-stats.mjs`, sin eliminar valores atípicos:

| Medida | Resultado |
|---|---:|
| LCP, mediana de la diferencia B − A | **+3,225 ms** |
| IC 95 % de la diferencia | **[−15,170; +45,415] ms** |
| Pares B más rápida / más lenta | 13 / 17 |
| Dispersión robusta de la diferencia | 89,126 ms |
| Bloqueo, mediana de la diferencia B − A | +6 ms [−6; +19] |
| CPU ocupada del equipo, mediana A / B | 30,71 / 30,93 % |
| Errores de página/peticiones externas registrados | 0 |
| CLS máximo, ambas variantes | 0,0070627984 |

**El intervalo incluye cero: no hay mejora demostrada.** En esta tanda, la aproximación orientativa del método pide 480 pares para distinguir ±10 ms. No se ejecutarán más tandas para perseguir una cifra pequeña; el ensayo queda descartado para integrar con esta evidencia.

La primera mitad fue aún más ruidosa: dispersión de la diferencia de 183,583 ms y CPU ocupada de mediana 36,55 %. La calibración de la entrega anterior había observado unos 21 ms de dispersión en Analizar. Por eso no se trasladó su expectativa de resolución a esta tanda como si el equipo estuviera igual.

### Por qué el p75 de B no demuestra cumplimiento

| Variante | LCP mediana | p75 [IC 95 %] | Cargas bajo 2.500 ms | Veredicto del intervalo |
|---|---:|---:|---:|---|
| A · referencia | 2.302,100 ms | 2.563,890 [2.330,380; 3.122,870] ms | 22/30 | No concluyente |
| B · catálogo JSON | 2.287,782 ms | 2.419,565 [2.304,185; 3.044,200] ms | 25/30 | No concluyente |

Aunque el p75 puntual de B baja de 2,5 s, su intervalo llega a 3,044 s y la diferencia emparejada no favorece a B. Usar solo ese p75 para aprobar RNF-03 repetiría el error ya corregido en la entrega anterior.

Datos ignorados, conservados para revisión:

- `artifacts/quality/lcp-catalog-ab-2026-10-29.json` y `.log`
- `artifacts/quality/lcp-catalog-ba-2026-10-29.json` y `.log`
- `artifacts/quality/lcp-catalog-combined-2026-10-29.json`
- `artifacts/quality/summarize-catalog.mjs`

## Verificación y límites

Los dos builds de Vite finalizaron correctamente y generaron su precaché. La primera ejecución restringida del diagnóstico no pudo navegar a localhost (`ERR_NETWORK_ACCESS_DENIED`); se repitió con acceso de prueba local autorizado y completó sus seis cargas. Las dos tandas definitivas finalizaron con código 0 y cerraron navegador/servidores.

`git diff --name-only -- src vite.config.ts` quedó vacío al cerrar el frente. **No se repiten tipos, lint, cobertura, E2E o PWA en navegador porque no queda ningún cambio de código que verificar.** El build experimental no se copia a `dist` ni se publica. La documentación se revisa mediante enlaces locales y `git diff --check`.

Límites: un único equipo activo, navegador emulado y servidor local sin CDN/TLS/HTTP2; diagnóstico de Intl instrumentado; no interacción, INP de campo ni otro navegador. No se modificó ni midió el giro de portada en esta continuación, que necesita su propio ensayo y decisión visual del propietario.
