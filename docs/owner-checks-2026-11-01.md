# Comprobaciones del propietario con sesión real — 1 nov 2026

Tres scripts de Node que el propietario ejecuta personalmente para acreditar los criterios que necesitan una sesión real: **pendientes 1, 2 y 4** de [prompt-siguiente-entrega.md](prompt-siguiente-entrega.md). Están en `scripts/owner-checks/`.

| Script | Pendiente | Qué acredita | Duración aproximada |
|---|---|---|---|
| `isolation.mjs` | 2 | Una segunda cuenta no puede leer, modificar ni borrar un proyecto ajeno por su ID | 1 min |
| `gateway.mjs` | 1 | Cuota de referencias de 20/min (incluido SIFTS) y rechazo de un JWT manipulado y de uno caducado en toda la pasarela | 2 min + hasta 60 min de espera para el caducado |
| `generator-history.mjs` | 4 | Guardar una búsqueda del generador en un proyecto, ver el recuento, reabrirla y verificarla | 1 min |

**Estado:** implementados y probados solo con simulaciones (31 pruebas unitarias y de recorrido con API, Supabase y Auth simulados). **No se han ejecutado contra servicios reales.** Ningún agente ha usado credenciales para escribirlos.

## Garantías sobre credenciales

- Correo y contraseña se escriben **solo** en un indicador oculto de la terminal. Los scripts no los aceptan como argumentos, variables de entorno ni archivos. Si la entrada no es una terminal interactiva (tubería, archivo), se detienen antes de pedir nada.
- Un argumento no reconocido se rechaza **sin repetirlo** en pantalla, por si fuera una contraseña escrita donde no debía.
- Credenciales y JWT viven solo en memoria. Nada se imprime, registra ni escribe en disco. La salida es una tabla con etiquetas, PASS/FAIL/INCONCLUSIVE y resúmenes del tipo `rpc NotFound project-not-found` o `supabase 200 rows=0`: nunca tokens, correos, cuerpos de respuesta ni secuencias. Los detalles del servidor solo se muestran si tienen forma de código estable.
- Al terminar (también con Ctrl+C durante una espera) cada script cierra **solo su propia sesión** (`/auth/v1/logout?scope=local`). Las sesiones abiertas en el navegador siguen activas.
- Los scripts reutilizan los clientes reales de la app (`src/features/...`): Auth de Supabase, `ProjectService`, contratos de proyecto, historial del generador y generador de candidatos, cargados con el ejecutor de módulos de Vite. No hay URL fijas: Supabase sale del `.env` del frontend y la API del `.env` o de `--api`.

## Antes de empezar

1. Node 24 y dependencias instaladas en `frontend/` (`npm ci`).
2. `frontend/.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto correcto. Son valores públicos; no se tocan.
3. Elegir la API:
   - **Local, recomendado para la cuota.** Un único proceso, así que la cuota es determinista. En otra terminal, desde `frontend/`: `npm run dev:prediction` (API en `http://127.0.0.1:5331`, misma identidad Supabase). Después se pasa `--api http://127.0.0.1:5331`.
   - **Producción.** `--api https://protein-back.vercel.app`. Vercel puede repartir solicitudes entre varias instancias con contadores propios; por eso la cuota puede salir INCONCLUSIVE allí sin que eso sea un fallo.
   - Sin `--api` se usa `VITE_API_BASE_URL` del `.env`.
4. Ejecutar desde `frontend/` en una terminal interactiva (PowerShell o Windows Terminal). No pegar la salida en ningún sitio con datos personales: la salida no los contiene, pero conviene revisarla antes de copiarla.

Códigos de salida: **0** todo PASS (o SKIPPED), **1** algún FAIL, **2** algún INCONCLUSIVE sin FAIL.

## (a) Aislamiento por ID — `isolation.mjs`

```powershell
node scripts/owner-checks/isolation.mjs --api http://127.0.0.1:5331
```

Necesita **dos cuentas distintas**: A (la del propietario) y B (una segunda cuenta que el propietario crea por su cuenta si no la tiene; los agentes no crean cuentas). El script pide correo y contraseña de A y después de B, y se detiene si ambas son la misma cuenta.

Recorrido:

1. A crea un proyecto vacío, sin secuencia, llamado `Comprobación del propietario · aislamiento · <fecha ISO>`.
2. Controles: A lo lee por la API REST y por Supabase REST (debe ver exactamente 1 fila). Si un control no pasa, los PASS que dependen de él bajan a INCONCLUSIVE.
3. B intenta, con el ID real del proyecto de A y su fecha de actualización:
   - por el cliente de la app (gRPC-Web): leer, guardar encima y borrar; además se comprueba que el proyecto no aparece en la lista de B;
   - por la API REST: `GET`, `PUT` y `DELETE /v1/projects/{id}`;
   - directamente contra Supabase REST con su propio JWT y la clave pública, como hace la API: `GET`, `PATCH` y `DELETE` en `projects?id=eq.{id}`, y las funciones `pf_project_document`, `pf_save_project` y `pf_delete_project`.
4. A vuelve a abrir el proyecto y comprueba que **nombre y fecha de actualización no cambiaron**.
5. A borra el proyecto y comprueba que ya no existe. Este paso se ejecuta aunque algo falle antes.

**PASS** en una fila de B: rechazo (`NotFound`, 403/404, código `PT404`/`PT409`), validación o respuesta vacía (`rows=0`). **FAIL**: B obtiene datos o una operación se completa (por ejemplo, un 204 al borrar). **INCONCLUSIVE**: B no quedó autenticado o el servicio no respondió; la fila no prueba nada. El criterio queda acreditado si todas las filas salen PASS, en especial «A finds it unchanged» y «check project deleted and gone».

Si el borrado final falla, el script imprime el nombre del proyecto sobrante para borrarlo a mano en Proyectos.

## (b) Cuota y tokens rechazados — `gateway.mjs`

```powershell
node scripts/owner-checks/gateway.mjs --api http://127.0.0.1:5331
```

Opción: `--skip-expired` omite la espera del token caducado (la fila queda SKIPPED).

**No uses la app mientras corre**: las consultas de Biblioteca y Analizar comparten el mismo presupuesto.

Recorrido:

1. Controles con el token auténtico en los 22 métodos autenticados de la pasarela: 11 gRPC-Web (`AccountService`, `ProjectService` ×5, `ReferenceService` ×3, `AssistantService`, `FoldingService`) y sus 11 equivalentes REST. Las entradas son deliberadamente inválidas o inexistentes (ID de proyecto ausente, nombre vacío, accesión inválida, dos residuos sin consentimiento): con un token válido responden validación o «no encontrado», y nunca pueden modificar datos, llamar a Groq/ESM Atlas ni crear proyectos.
2. **Token manipulado:** copia en memoria con **un byte de la firma** cambiado (se cambia el byte decodificado, no el último carácter base64url, que puede tener bits sin uso). Se comprueba localmente que difiere en exactamente un byte y se envía a los 22 métodos. PASS solo con `Unauthenticated`/401. Cualquier otra respuesta, incluida una validación, es FAIL: significaría que la petición pasó la autenticación.
3. **Cuota:** espera 61 s para que caduque cualquier ventana anterior y hace 21 llamadas seguidas con la misma identidad: 1 `GetEntry` de P01308, 1 correspondencia SIFTS P01308→1TRZ (fila propia: debe responder), 18 `GetEntry` más y, como llamada 21, otra correspondencia SIFTS. PASS si exactamente 20 pasaron el presupuesto y la 21 recibió `ResourceExhausted uniprot-rate-limit` dentro de una sola ventana de 60 s. Es un tráfico mínimo: 21 lecturas públicas en un minuto. Resultados posibles:
   - FAIL en API local si la llamada 21 se atiende: el límite no funciona.
   - INCONCLUSIVE si el presupuesto ya estaba en uso (vuelve a ejecutar un minuto después), si el límite vino del proveedor (`sifts-provider-rate-limit`), si las 21 llamadas no cupieron en 60 s o si producción atendió la 21 (varias instancias).
4. **Token caducado:** el token auténtico original se guarda en memoria hasta que pasa su `exp` más 30 s (hasta unos 60 min con la caducidad habitual de Supabase). Deja la ventana abierta y la API local en marcha. Después se envía a los 22 métodos; PASS solo con `Unauthenticated`/401.

La cuota es por identidad **y por proceso** (`backend/app/rate_limit.py`): un PASS local acredita el mecanismo con la identidad real; no es una cuota global entre instancias de Vercel.

## (c) Historial del generador — `generator-history.mjs`

```powershell
node scripts/owner-checks/generator-history.mjs --api http://127.0.0.1:5331
```

Recorrido:

1. Ejecuta localmente la búsqueda por defecto del generador (formulario inicial: 40 residuos, presupuesto 1000, semilla 42, GRAVY −0,5…0,5) con el mismo código de la app. Las secuencias generadas no se muestran.
2. Guarda el resultado como hace «Guardar en proyecto» con destino nuevo: mismo texto exportado, mismo registro y sobre del historial, en un proyecto `Comprobación del propietario · historial del generador · <fecha ISO>`.
3. Comprueba que la lista de Proyectos muestra **1 búsqueda guardada** (`generatorRuns=1`).
4. Reabre el proyecto, verifica los hashes del documento y de la búsqueda (`verifyGeneratorHistory`) y que el texto guardado es idéntico byte a byte al exportado.
5. Borra el proyecto y comprueba que ya no existe, aunque algo falle antes.

Todas las filas deben salir PASS. No sustituye la revisión visual del botón en producción, que ya se observó activado.

## Después de ejecutar

Anota en el relevo y en PROGRESS la fecha, la API usada (local o producción), el commit del backend en ejecución y la tabla. Distingue lo que pasó en local de lo que pasó en producción. Si algo sale FAIL, guarda la tabla tal cual: no contiene secretos.

## Pruebas de los scripts

```powershell
npx vitest run scripts/owner-checks
```

`owner-checks.test.mjs` cubre las partes puras: manipulación de un byte de firma, lectura de `exp`, comparación de cuentas sin revelarlas, teclas del indicador oculto y rechazo de entradas no interactivas, argumentos rechazados sin eco, clasificación de respuestas, veredictos de token, aislamiento y cuota, y la tabla sin secretos. `flows.test.mjs` recorre los tres scripts contra una API, Supabase REST y Auth simulados en memoria (tokens falsos), incluidos casos con fugas deliberadas que deben salir FAIL, y confirma limpieza del proyecto y cierre local de las sesiones.
