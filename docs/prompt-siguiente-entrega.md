# Relevo de desarrollo — ProteinForge

Actualizado al cierre de la **sesión del 1 de noviembre de 2026**, America/Bogota. Leer este documento completo, los AGENTS de raíz/frontend/backend y las últimas entradas de ambos PROGRESS. La raíz no tiene Git; frontend y backend son repositorios independientes. Las versiones anteriores de este relevo están en [archive/relevo-2026-10-28.md](archive/relevo-2026-10-28.md) y [archive/relevo-2026-10-27.md](archive/relevo-2026-10-27.md); describen su momento y no son instrucciones vigentes.

## Producción comprobada — 1 nov 2026

**Predicción, guardado en la nube y reapertura desde producción correctos con sesión real del propietario.** [Informe de publicación, CI y evidencia](release-2026-11-01.md). Backend main `1401432`, frontend main `0ffaf4d`; Vercel informó ambos despliegues correctos. El bundle público y la pestaña usada cargaron el hash completo del merge frontend. Se creó el proyecto «Prueba de predicción 2026-11-01», se recargó Proyectos y se reabrió su laboratorio desde el servidor. El portable reexportado conserva todos los datos del original, incluido el PDB exacto de 76 residuos y 49.452 bytes. No se extrajo JWT ni se sobrescribieron proyectos existentes; la prueba se dejó en la cuenta.

La migración y variables ya las confirmó el propietario y los push/merge ya se ejecutaron con autor/committer exclusivos Jacklb19: no volver a pedirlos para esta entrega. La pestaña Predicción y la solicitud real observadas acreditan activación efectiva; el SQL exacto permanece como declaración del propietario sin nueva inspección de metadatos. El navegador integrado conservaba la PWA antigua tras recargar; cerrar y reabrir solo la pestaña pública cargó la nueva versión conservando la sesión. Si ocurre a otro visitante, comprobar el bundle antes de atribuir ausencia de la función a las variables.

El informe enlazado y las últimas entradas de PROGRESS conservan los resultados remotos finales y los pendientes reales. Los apartados siguientes describen la secuencia anterior de preparación y publicación; su mención de predicción/guardado públicos pendientes quedó superada por esta comprobación.

## Autorización y secuencia de publicación — 1 nov 2026

El propietario confirmó aplicada la migración nueva `20261030000000_structure_predictions.sql` y configuradas las dos banderas en Vercel, y autorizó push/merge de ambos repositorios exclusivamente a su nombre. No pedir repetir estos pasos: son declaraciones recibidas del propietario, a distinguir de las comprobaciones que ejecutemos. Esta autorización corresponde a esta entrega y no cubre futuras publicaciones o cambios remotos.

Backend `dev` **89b9ed3**, merge `main` **14014324a7c3db9eda551e12fd9c3e502fb77788**, subidos. CI correcto en ambas ramas con Python 3.14: 146 descubiertas, 127 ejecutadas correctas y 19 SQL omitidas; lint/generación protobuf correctos. Vercel informa despliegue correcto asociado a ese merge. El frontend conserva el pin **77a753c2f8673b964e1943a8845767c9dce67635**, contenido en el backend publicado; la regeneración aislada desde GitHub produjo **7 archivos, 0 diferentes**.

Se publica ahora el frontend desde dev a main, comprobando sus dos flujos de CI y el hash incorporado en el bundle público. No confundir el CI local del 30 oct con estas ejecuciones remotas. Los hashes finales y resultados observados al cerrar se registran en las últimas entradas de ambos PROGRESS locales; consultar también GitHub Actions para el commit exacto. Se conserva pendiente la comprobación de predicción/guardado con sesión desde producción, además de cuotas/tokens de SIFTS, segunda cuenta, prosa aceptada, decisiones TOTP/giro y RNF-03. La sesión real probada abajo fue local.

## Comprobaciones locales anteriores a la publicación — 1 nov 2026

**Predicción real con la sesión del propietario: correcta en local. Sin publicar.** [Informe con casos y límites](readiness-2026-11-01.md), [guía exacta para el propietario](owner-next-steps-2026-11-01.md). `npm run dev:prediction` inicia frontend 5330/API 5331 y comprueba Auth del mismo proyecto, sin cambiar `.env`; quedó ejecutándose para revisión. Rechaza puertos ocupados sin detener otros procesos. El propietario inició sesión personalmente; no se extrajo ni guardó su JWT.

Variante pública 1: 76 residuos, PDB de **49.452 bytes**, validado por backend y descargado; el portable v2 contiene exactamente el mismo PDB. La repetición inmediata mostró el límite y conservó el resultado. No acredita tres cuentas ni guardado remoto. SIFTS autenticado por la API local mostró P01308:90 (G) → A/autor A:1/interna 1 y 110 (N) → A/autor A:21/interna 21; faltan cuota completa y JWT auténtico manipulado/caducado. API sin token y con token constante inválido: 401. Las tres lecturas reales del asistente (variantes 1–3) fueron rechazadas por `assistant-unverified-figure`: no hubo prosa visible que certificar, ni se inspeccionó el texto descartado para distinguir error real de falso positivo. No debilitar el verificador.

**Supabase remoto inspeccionado solo con SELECT de metadatos**, en el navegador del propietario y proyecto `ycskfgimxrnhozmmqnze`, coincidente con Auth local. `backend/supabase/checks/prediction-readiness.sql`: **false / false / false / false / true**, en orden validador de predicción, laboratorio v2, guardia workspace v4, cuatro funciones invoker y RLS de projects/analyses. Falta la migración nueva; el cuarto false ya se explica por la función ausente, sin concluir que las existentes sean SECURITY DEFINER. RLS activado no acredita aislamiento entre cuentas. No se ejecutó DDL ni se modificaron filas/configuración; SQL Editor guardó automáticamente un borrador privado de la consulta.

Commits **locales**, sin push: frontend código `5364848`, backend asistente `46ed857`, predicción/contrato `77a753c` y consulta `9f2aeec`. Autor y committer exclusivos Jacklb19. El pin de `buf.gen.yaml` ya es **77a753c2f8673b964e1943a8845767c9dce67635**, aún no remoto. Generación aislada del contrato local: **7 archivos, 0 diferentes**. Publicar backend antes de que CI intente descargar ese commit. Los commits posteriores de herramientas/documentación no cambian ese contrato.

Comprobaciones nuevas: sintaxis de ambos scripts, lint, inicio real/health 200, rechazo seguro de segundo inicio, navegador anónimo exige sesión, predicción/descargas/SIFTS reales y SELECT remoto. Consulta local PostgreSQL 18: cinco true; clúster nuevamente detenido. No se repitieron las baterías completas del 30 oct por cambios de herramientas/documentación y pin con generación idéntica; sus cifras permanecen abajo, fechadas. No se midió nuevo LCP.

Lo siguiente: propietario aplica la **nueva** migración preparada y configura las dos banderas de Vercel, o autoriza específicamente esas operaciones; autorización expresa y fechada de publicación para ambos repositorios; después coordinación prueba predicción y guardado/reapertura desde producción con sesión. No pedir repetir migraciones antiguas ya declaradas. La guía contiene SQL canónico, copia transaccional y variables exactas. Aislamiento con segunda cuenta sigue a cargo del propietario. TOTP, giro, RNF-03 y diagnóstico de prosa siguen pendientes. No hay GPU propia concedida ni garantía del servicio público.

**Las secciones siguientes conservan la historia del 29–30 oct.** Sus referencias a cambios sin commit, pin 18d9444 y ausencia de sesión real describen aquel cierre; el estado de este apartado las sustituye. `main` sigue en los últimos despliegues observados `00157a1` frontend / `18d9444` backend, sin reconsultarlos hoy.

## Entrega local — cierre del 30 oct 2026

**Predicción desde el laboratorio implementada localmente, sin publicar.** [Informe verificable](prediction-delivery-2026-10-30.md), [contrato](prediction-contract-2026-10-30.md) y [plan/maquetas revisados antes de la pantalla](prediction-ui-proposal-2026-10-30.md). El propietario delegó la coordinación y revisión de esta entrega mientras descansaba; no se atribuye aprobación personal de las capturas. El primer intento de crear chats separados fue rechazado por la revisión automática por límite de uso. Un intento posterior sí creó dos chats: revisión final de API/persistencia y revisión final del laboratorio, ambos de solo lectura y sin ocupar el carril de pruebas. La coordinación reprodujo y corrigió dos hallazgos P2 (prefijo ATOM omitido por el Worker y deadline RPC); ambos revisores confirmaron por lectura su cierre, y coordinación ejecutó las regresiones y baterías.

La pestaña Predicción necesita cuenta, consentimiento por solicitud y `VITE_STRUCTURE_PREDICTION=enabled`; backend `FOLDING_ENABLED=enabled`. Ambas desactivadas por defecto. REST y RPC envían solo la secuencia canónica de 3–120 residuos a ESM Atlas, sin token del usuario; una activa y tres por minuto por proceso, una por identidad/minuto, sin reintentos ni caché privada. El servicio público no garantiza disponibilidad ni inferencia nueva frente a caché. Worker y backend validan secuencia/PDB/hashes; visor Cα y descarga original, sin inventar pTM/PAE/confianza/revisión. La predicción se guarda por separado del resultado Colab original y se retira al cambiar la secuencia.

Persistencia local: laboratorio portable v2, envoltorio v1 y workspace v4; conserva fuente, borradores, protecciones, selección e historial. Migración nueva `backend/supabase/migrations/20261030000000_structure_predictions.sql` aplicada **solo en PostgreSQL temporal local**, sin tablas ni Storage nuevos y con guardia monótona/RLS. Para publicar después con autorización: migración revisada y backend primero; repinchar `buf.gen.yaml` al commit backend publicado, regenerar y comprobar CI; frontend después y activación explícita. **El pin remoto actual 18d9444 no contiene el contrato nuevo**: los stubs se generaron desde el hermano local y CI no podrá regenerarlos desde ese pin hasta actualizarlo tras publicar backend.

Verificado: 8 combinaciones de navegador (1280/360 × claro/oscuro × es/en), Worker real, consentimiento, PDB original idéntico, guardado v4 y reapertura portable; 0 infracciones Axe en la pestaña, 0 errores de página. Identidad/proyectos simulados y PDB público grabado, sin inferencias nuevas. Backend: 146 descubiertas, 127 ejecutadas correctas + 19 SQL omitidas sin base; las 19 SQL pasaron aparte en PostgreSQL 18 temporal, `auth.uid()` emulado, clúster detenido. Python local 3.13.14, `buf lint` correcto; CI Python 3.14 sin reejecutar. Tipos/lint/build/PWA del frontend correctos. 715 unitarias en 100 archivos; cobertura final 87,84 / 79,04 / 83,78 / 91,62 %, con dos trabajadores y umbrales/plazos originales. E2E existente: 141 correctas y 2 omitidas por diseño, de 143, en 9,1 min, un trabajador y puerto 5190. Tras la regresión real de ATOM volvieron a pasar tipos/lint/cobertura/build/PWA. Los recuentos y límites están en el informe.

Se conservan los dos arreglos del asistente (signo numérico y Decimal largo) y sus tres regresiones del frente anterior. El ensayo anterior de rendimiento, 30 pares/60 cargas y catálogo JSON.parse solo en artefactos, no mostró mejora: diferencia +3,225 ms, IC95 % [−15,170; +45,415], ruido 89,126 ms. No se adoptó. **No se midió LCP de esta entrega nueva; RNF-03 sigue sin acreditarse.** [Informe anterior](performance-continuation-2026-10-29.md).

## Proveedores y producción observados — revisión inicial 29–30 oct

[Investigación asiática](asian-gpu-hosting-2026-10-29.md) y [alternativas gratuitas](free-laboratory-hosting-2026-10-29.md). ModelScope: el propietario envió su solicitud y después se comprobó `Application in Approval...`; no hay GPU concedida. Hugging Face: su formulario ofrece Static gratis, Gradio/Docker deshabilitados como Paid; no se creó Space ni contrató nada. Son observaciones de esa revisión, no estados reconsultados al cierre.

ESM Atlas respondió anteriormente sin credenciales a tres secuencias públicas distintas de 76 residuos: 601/592/605 átomos, backbone completo y secuencia exacta. Los tres PDB guardados pasan también el nuevo validador backend sin volver a enviarlos. No demuestra tres cuentas reales ni GPU propia. Evidencia ignorada en `artifacts/gpu-trial-2026-10-29/`; nuevo ensayo web en `artifacts/prediction-2026-10-30/`.

Producción: control del historial visible sin sesión; backend health 200 y me/SIFTS 401 sin token en la revisión inicial. El propietario declaró activar `VITE_GENERATOR_HISTORY=enabled` el 29 oct, pero falta guardar realmente con sesión. Continúan pendientes SIFTS con JWT real/cuota/rechazo de token, aislamiento por ID con dos cuentas que revisa el propietario y prosa real del asistente. No se hizo commit, push, merge, despliegue ni modificación remota; los hashes siguientes siguen siendo HEAD con cambios locales pendientes en ambos repositorios.

## Estado publicado

| Repositorio | `main` | `dev` |
|---|---|---|
| Frontend | `00157a1` | `2cb6c8b` (referencia local observada; documentación de esta investigación sin commit) |
| Backend | `18d9444` | `cbff97e` |

El frontend se publicó **dos veces el 29 de octubre**, ambas con autorización expresa del propietario y autoría exclusiva suya.

1. Por la mañana, `65a0b74` llevó a `main` la pasada de rendimiento, el subconjunto de IBM Plex Mono y la pestaña «Dominios». **Falló en CI** por un defecto de idioma; el arreglo `869ce2d` se publicó enseguida como `09989b0` y dejó ambas ramas en verde.
2. Por la tarde, `00157a1` llevó a `main` el resto de la jornada: zod fuera del arranque, la capa de cliente del segundo factor, la corrección de repintado de `BackboneView` y el método de medición de LCP.

Comprobado desde coordinación tras la segunda publicación, sin intermediarios:

- **CI de GitHub Actions en verde** en los dos flujos, integración continua y WebAssembly, para `dev` `747d065` y para `main` `00157a1`.
- **Producción sirve exactamente `main`.** El panel de Vercel no se puede mirar desde coordinación, porque la cuenta conectada a sus herramientas pertenece a otro proyecto, igual que ocurre con Supabase. Pero el paquete publicado incorpora su propio commit a través de `VITE_APP_BUILD`, que `vite.config.ts` toma de `VERCEL_GIT_COMMIT_SHA`: el bundle servido en <https://protein-forge.vercel.app/> contiene `00157a11aceff946655200e42a63eed99179609e`, que es `main` carácter por carácter. Eso identifica el despliegue sin depender del panel. La portada carga sin errores de consola, con su lienzo y los 110 residuos.

Lo que entre en `dev` a partir de aquí **no está publicado** y necesita autorización nueva, expresa y fechada: la del 29 de octubre quedó consumida. El backend sigue con un commit de documentación sin subir (`cbff97e`), también pendiente.

El frontend fija el backend publicado `18d9444` en `buf.gen.yaml`; la regeneración fue idéntica. Si cambia el contrato, el orden sigue siendo **migración → backend → repin/regeneración → frontend**.

## Integrado en `dev` el 29 de octubre: zod fuera del arranque

El merge `9927ce9` incorpora los commits `eb4c420`…`739e2b5` de la rama `parallel/perf-routes`. [Detalle y cifras](performance-2026-10-27.md).

Lo que midió esa sesión sobre su propio árbol: el grafo inicial baja de 17 archivos y 180.269 bytes comprimidos a **3 y 150.328** (−16,6 %), y el tiempo propio atribuible con CPU ×4 sobre Inicio baja de 477 a **334 ms**. El fragmento de entrada crece, porque catorce archivos pequeños pasan a él; lo que baja es el grafo completo, que es lo que el navegador descarga y evalúa antes de pintar. La precaché queda en 57 entradas y 2.477,76 KiB.

**No se afirma ninguna mejora de LCP.** La carga perfilada pasó de 2.354 a 1.905 ms, pero es una sola carga con el perfilador puesto y la variación de esta máquina supera el margen en discusión. El LCP de Analizar sigue **sin acreditar de forma repetible**.

Seis cadenas llevaban zod al arranque; la sexta (`generator/context.ts`) la encontró la comprobación del build, no el análisis previo. `storedSession` sustituye a `sessionSchema.safeParse` solo en el punto que corre antes del primer render; el esquema sigue siendo la fuente de verdad. Una prueba de paridad de 31 casos encontró una divergencia real antes de que llegara a ninguna parte: con `expiresAt` de `2 ** 53`, `Number.isInteger` aceptaba y el `int()` de zod rechazaba; la comprobación usa ahora `Number.isSafeInteger`.

**Verificación del merge en el checkout principal**, sin Auth configurada y como CI (`CI=true`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` vacías):

| Comprobación | Resultado |
|---|---|
| `typecheck` | correcto, 14 s |
| `lint` | correcto, 63 s |
| `test:coverage` | **653 pruebas en 91 archivos**, todas correctas, 55 s |
| Cobertura | 85,70 / 77,26 / 82,31 / 89,39 %, mínimos intactos |
| `build` | correcto, 34 s |
| `check:pwa` | correcto, 5 s, con recarga real sin conexión, las cuatro WOFF2 desde la precaché, aislamiento, laboratorio, generador, PDF y cuaderno idéntico byte a byte |
| E2E completa, un trabajador, puerto 5190 | **141 correctas y 2 omitidas** por diseño de 143, 8,0 minutos, a la primera |

Las dos omitidas requieren evidencia local de Colab. La integración queda verificada; publicar sigue necesitando autorización.

## Integrado en `dev` el 29 de octubre: RNF-03 corregido y `BackboneView`

El merge `4050ae1` incorpora los nueve commits `a50f03b`…`ac3b149` de `parallel/perf-components`. [Detalle y todas las cifras](performance-components-2026-10-29.md).

**Lo primero es una corrección, no una mejora.** El proyecto daba RNF-03 por cumplido desde el 28 de octubre. **No lo está en Analizar.** Aquella cifra salía de siete cargas, y con siete cargas el intervalo de un p75 no tiene cota superior: se puede calcular un número, pero no sostenerlo. Una prueba unitaria deja fijada esa limitación para que no vuelva a pasar.

Medido con `scripts/measure-lcp.mjs` y `scripts/lcp-stats.mjs`, que sirven las dos builds a la vez, alternan el orden de carga en cada ronda con 4G lenta y CPU ×4, y dan intervalos del 95 % sin suponer normalidad, repitiendo cada comparación con los puertos intercambiados:

| Ruta | p75 en cinco tandas | Cargas bajo 2,5 s | Veredicto |
|---|---|---|---|
| Inicio | 2.226–2.264 ms | 220 de 220 | **cumple**, cota superior ≤ 2.272 ms |
| Analizar | 2.526–2.556 ms | del 11 al 28 % | **no cumple** |

El ruido de esta máquina, medido comparando una build consigo misma, es de unos 36 ms en Inicio y 21 ms en Analizar; con 30 pares se distinguen efectos de unos 20 y 10 ms. Así que **no es ruido**: a Analizar le faltan entre 25 y 60 ms, y acreditarlo exigiría bajar el p75 unos 60–80 ms.

**`BackboneView`, adoptado** (`b1ebe5c`). Al montarse pintaba tres veces lo mismo; ahora pinta una, lee la paleta una vez por tema y calcula los colores de cada residuo una sola vez. CPU propia en Analizar de 113 a 60 ms (**−49 ms** [−66; −43], 10 de 10 cargas más rápidas) y en Inicio −12 ms [−16; −1]. Una prueba registra cada orden de dibujo del lienzo en cinco casos, confirmada **antes** de optimizar (`9a1ed06`) e idéntica después: lo que se ve no cambia.

**`HydropathyProfile`, ensayado y revertido** (`58b9488`). No reconstruir sus vistas por residuo y aplicar el resultado del Worker en una transición no dio efecto medible: +2 ms [−3; +5] con 50 pares, sin cambio en LCP ni en bloqueo. `src/features/descriptors` queda idéntico a `dev`.

**El LCP no se mueve** con ninguno de los dos: Inicio −5 ms [−22; +3] y Analizar +7 ms [−7; +24] con 40 pares. Bajar la CPU de un componente no es bajar el LCP, y aquí está medido en lugar de supuesto. Ninguno de los dos estaba en el camino de los 60–80 ms que faltan.

**Hallazgo nuevo, sin resolver y sin tocar:** sin «reducir movimiento» activado, el giro en reposo de Inicio consume unos 1,85 s de CPU de cada 4,5 s con CPU ×4. No afecta al LCP, pero compite con las interacciones. Reducirlo cambiaría lo que se ve, así que es **propuesta para el propietario**, no tarea.

**Verificación del merge** en el checkout principal, sin Auth y como CI: tipos correctos (11 s), lint correcto (41 s), **695 unitarias en 96 archivos** todas correctas (41 s), cobertura **87,64 / 78,97 / 83,78 / 91,50 %**, build correcto (17 s), `check:pwa` correcto (5 s) y batería E2E completa con un trabajador en el puerto 5190: **141 correctas y 2 omitidas** por diseño de 143, en 7,6 minutos. Esta batería es la que la sesión del frente no pudo ejecutar; se corrió aquí sobre el árbol integrado, que es lo que cuenta.

## Integrado en `dev` el 29 de octubre: segundo factor, solo la capa de cliente

El merge `d5419eb` incorpora los siete commits `fde6360`…`d172464` de `parallel/auth-totp`, más el merge `6311593` con el que esa rama absorbió `dev` para resolver el único choque, en `src/features/auth/authApi.ts`, contra la carga diferida de esquemas de `b352eae`. Se resolvió fusionando `dev` dentro de la rama, **sin rebase**, igual que había hecho `parallel/perf-routes`. El resultado conserva las dos intenciones: zod sigue fuera del arranque y el cliente MFA se descarga en su primer uso.

- **Contrato documentado** en [auth-totp-contract.md](auth-totp-contract.md), sacado del código fuente de Supabase Auth `v2.197.0`, su `openapi.yaml`, supabase-js y las guías oficiales. Verificar el código devuelve una sesión aal2 que sustituye a la guardada y el servidor cierra las sesiones aal1 del usuario en otros dispositivos; una sesión aal2 sigue en aal2 al refrescarse. **Una sesión aal1 sigue valiendo para la API:** exigir aal2 requiere políticas RLS y la misma comprobación en FastAPI, y es una decisión entre los dos repositorios que sigue sin tomarse.
- **Capa de cliente sin interfaz:** `mfaApi.ts` inscribe, desafía, verifica, quita y lista factores; `assurance.ts` lee `aal`/`amr` del token; los códigos se normalizan a seis cifras y los identificadores de factor se restringen a UUID antes de cualquier petición; los catorce mensajes nuevos están en es/en. Los valores ajustables van a `src/features/auth/config.ts`.
- **Un fallo real anterior, corregido:** el proveedor de sesión descartaba mal un refresco que llegaba tarde y podía pisar una sesión nueva o reabrir una ya cerrada. Dos pruebas fijan la guarda y fallan si se quita.
- **Códigos de recuperación no implementados:** las rutas existen en `v2.197.0` pero vienen desactivadas por defecto y supabase-js las marca como experimentales.
- **Ninguna pantalla programada.** La [propuesta de interfaz](auth-totp-ui-proposal-2026-10-29.md) y sus 72 capturas en `artifacts/auth-totp-2026-10-29/` esperan la aprobación del propietario, con cuatro decisiones suyas: aprobar la opción A (aplicación de respaldo), si quiere o no códigos de recuperación —la sesión recomienda que no por ahora—, si se exige aal2 en datos y API, y si acepta recuperar cuentas quitando él el factor a mano en Supabase.

**Verificación del merge** en el checkout principal, sin Auth y como CI: tipos correctos (12 s), lint correcto (42 s), **678 unitarias en 94 archivos** todas correctas (56 s), cobertura **86,00 / 77,68 / 82,74 / 89,68 %** con los mínimos intactos, build correcto (25 s), `check:pwa` correcto (6 s) y batería E2E completa con un trabajador en el puerto 5190: **141 correctas y 2 omitidas** por diseño de 143, en 7,6 minutos.

**Límites declarados:** nada se ha probado contra un proyecto Supabase real, no se sabe qué versión de Auth ejecuta el proyecto alojado ni si sus límites coinciden con los valores por defecto, y la imagen QR de la maqueta es ilustrativa.

## Historial del generador: activación visible, guardado pendiente

Contrato, backend, cliente e interfaz están implementados y publicados en `main`; la interfaz permanece oculta salvo con `VITE_GENERATOR_HISTORY=enabled`. [Contrato](../../backend/docs/generator-history-contract-proposal.md), [interfaz aprobada](generator-history-ui-proposal-2026-10-27.md).

1. **Migración:** el propietario declara que aplicó `20261027000000_generator_history.sql` en Supabase remoto el 28 de octubre. No se ha inspeccionado desde coordinación, porque la cuenta de Supabase conectada allí corresponde a otro proyecto. Queda como declaración suya, pendiente de comprobación; no volver a pedirla ni repetirla.
2. **Activación:** el propietario declara haber activado `VITE_GENERATOR_HISTORY=enabled` el 29 oct. Comprobado después en esta continuación: `/generate` público completa una búsqueda y muestra el aviso «Guardar búsquedas en un proyecto requiere una cuenta», que pertenece al control activado. No se modificó configuración remota ni se pidió repetirla.
3. Falta comprobar un guardado real con sesión del propietario y el recuento en Proyectos. La presencia del aviso sin sesión no prueba ese guardado ni la cadena Auth/PostgREST/RLS.

## Decisiones vigentes

Registradas en [decisiones](decisiones.md). Las que siguen condicionan el trabajo actual:

- **Rendimiento.** De las seis propuestas de [la auditoría](performance-2026-10-27.md) quedan adoptadas el subconjunto publicado de IBM Plex Mono y diferir zod, ya integradas. La separación de código por rutas se implementó y **se revirtió**, porque empeoró el LCP de Inicio y Analizar. Siguen descartadas por ahora el primer render en transición, `content-visibility` en las secciones públicas y el INP de campo. Candidatos siguientes ya cifrados y **sin tocar**: `BackboneView` (113 ms y 9.212 bytes, solo en Inicio), `formatNumber` (59 ms), el catálogo español (70.602 bytes) e `HydropathyProfile` (9.180 bytes, una pestaña y no la vista inicial de Analizar).
- **Alcance de pruebas.** Solo las necesarias: tipos, lint, unitarias con cobertura, build, `check:pwa` en Chromium y la batería E2E completa en Chromium con un trabajador, más la matriz de accesibilidad existente a 360/1280 px en es/en y ambos temas. Safari en dispositivo real, lector de pantalla e INP de campo son **límites conocidos documentados**, no tareas pendientes. No añadir recorridos E2E nuevos salvo como regresión de un fallo real.
- **Modelado.** El cuaderno manual de Colab sigue publicado. La predicción del borrador mediante ESM Atlas se reabrió e implementó localmente el 30 oct; no está publicada y no ejecuta ProteinMPNN ni diseño de novo. [Forma de novo](de-novo-proposal.md) queda fuera del alcance de la asignatura, porque depende del mismo ejecutor. Ninguna de las dos propuestas se borra.
- **Catálogo de dominios.** Pestaña «Dominios» de Biblioteca integrada y **publicada**. Catálogo de 48 piezas verificado contra sus fuentes (`b23110f`): las 48 rederivadas de las descargas guardadas sin discrepancias y ocho reconsultadas en UniProt; una prueba fija esas invariantes. El ensamblado se analiza, se descarga en FASTA o se guarda a través de Analizar, siempre como texto sin fuente, sin cambiar ningún contrato persistido.

## Orden de continuación

0. Revisar la [entrega local de predicción](prediction-delivery-2026-10-30.md) con el propietario. No confundir la comprobación con dobles/respuestas grabadas con tres cuentas reales. Si se autoriza publicar: backend/migración primero, repin y regeneración frontend, CI y activación explícita después. La autorización nocturna no se usó para modificar producción.

1. **Publicado.** El propietario autorizó la publicación el 29 de octubre por la tarde, una vez integrados y verificados los dos frentes, y se ejecutó: `main` `00157a1`, con CI en verde y el despliegue identificado por su propio commit. Esa autorización queda consumida.
2. Comprobar un guardado real del historial y su recuento con sesión del propietario; la activación ya está visible en producción.
3. Llevar al propietario la [propuesta de pantallas del segundo factor](auth-totp-ui-proposal-2026-10-29.md) con sus cuatro decisiones. Sin su aprobación no se programa ninguna pantalla, y la capa de cliente ya integrada se queda sin usar, que es el comportamiento correcto.
4. Decidir sobre el **giro en reposo de Inicio** (1,85 s de CPU de cada 4,5 s sin «reducir movimiento»): reducirlo cambiaría lo que se ve, así que es decisión del propietario. Y, si se quiere acreditar RNF-03 en Analizar, buscar los 60–80 ms donde de verdad están, con `scripts/measure-lcp.mjs` como método, no a ojo. Los dos frentes abiertos el 29 oct ya están integrados y verificados.
5. Recorrido con Supabase local y dos cuentas reales para cerrar el aislamiento por ID y un guardado real del historial; el propietario indicó el 28 de octubre que revisa él esa parte.
6. Pendientes antiguos que siguen abiertos: aislamiento por ID con segunda cuenta en producción, recorrido SIFTS con JWT real y lectura autenticada del asistente comprobada en prosa.

## Copias de trabajo

| Copia | Rama | Estado | Puertos |
|---|---|---|---|
| Coordinación | `frontend/dev`, `backend/dev` | Documentación general e integración | 5330–5339; E2E de verificación en 5190 |

**No queda ningún worktree abierto.** Los cuatro del 29 de octubre se retiraron el mismo día, siempre tras comprobar que su rama era antepasada de `dev` y no tenía commits pendientes, y borrando las ramas con `-d`, sin forzar: `worktree-domains` y `worktree-performance` por la mañana (`parallel/domains`, `parallel/perf-routes`, `parallel/performance`), y `worktree-perf-components` y `worktree-auth-totp` por la tarde, ya publicado su trabajo. Sus evidencias están en `artifacts/worktree-evidence/`, ignorada, junto a las de `worktree-quality`, `worktree-sifts` y `worktree-auth`. Se conserva el stash antiguo «discarded: interface redesign v3». [Plan de desarrollo paralelo](../../parallel-development.md).

La raíz del espacio de trabajo queda con `frontend`, `backend` y nada más. Las dos carpetas de la tarde resistieron el borrado mientras sus sesiones seguían abiertas —Windows no elimina un directorio en uso— y se retiraron al archivarlas.

**Una sola batería E2E a la vez en esta máquina.** Dos a la vez provocan fallos falsos. Los frentes tienen puertos propios, pero el carril se pide a coordinación antes de lanzar E2E o mediciones con navegador.

## Reglas vigentes

Trabajar en `dev`. Autor y committer exclusivamente Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas, coautores ni menciones a herramientas o agentes de IA en Git y GitHub, tampoco en mensajes de merge o PR; comprobarlo antes de cada push. Commits pequeños en inglés con pathspec explícito; documentación y respuestas en español. Cada texto visible va en `src/i18n/es.ts` y `src/i18n/en.ts` en el mismo cambio. No forzar al índice AGENTS, PROGRESS, propuestas, artifacts, secretos ni dependencias.

Costo cero estricto, sin tarjeta ni modelos en Windows. Sin push, merge, despliegue, migraciones remotas, cambios de servicios o secretos y sin cuentas nuevas salvo autorización expresa y fechada del propietario. La autorización de publicación del 29 de octubre quedó consumida y no cubre lo que entre después en `dev`. No repetir migraciones ya aplicadas ni reabrir aprobaciones visuales existentes: «Mesa clara», la presentación pública separada del laboratorio, el historial del generador y la pestaña «Dominios» están aprobados e implementados.

Interfaz nueva: se entregan maquetas y un plan por pantallas para que el propietario los apruebe antes de programar. Para la pestaña Predicción del 30 oct, el propietario delegó expresamente la revisión nocturna al coordinador: maquetas/plan revisados antes de código, sin atribuirle una revisión personal. La delegación se limita a esta entrega; no equivale a aprobar decisiones remotas o de seguridad de TOTP.
