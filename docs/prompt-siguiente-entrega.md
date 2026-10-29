# Relevo de desarrollo — ProteinForge

Actualizado el **29 de octubre de 2026**. Leer este documento completo, los AGENTS de raíz/frontend/backend y las últimas entradas de ambos PROGRESS. La raíz no tiene Git; frontend y backend son repositorios independientes. Las versiones anteriores de este relevo están en [archive/relevo-2026-10-28.md](archive/relevo-2026-10-28.md) y [archive/relevo-2026-10-27.md](archive/relevo-2026-10-27.md); describen su momento y no son instrucciones vigentes.

## Estado publicado

| Repositorio | `main` | `dev` |
|---|---|---|
| Frontend | `00157a1` | `747d065` (más el registro de esta publicación, sin subir) |
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

## Historial del generador: pendiente solo de activarlo

Contrato, backend, cliente e interfaz están implementados y publicados en `main`; la interfaz permanece oculta salvo con `VITE_GENERATOR_HISTORY=enabled`. [Contrato](../../backend/docs/generator-history-contract-proposal.md), [interfaz aprobada](generator-history-ui-proposal-2026-10-27.md).

1. **Migración:** el propietario declara que aplicó `20261027000000_generator_history.sql` en Supabase remoto el 28 de octubre. No se ha inspeccionado desde coordinación, porque la cuenta de Supabase conectada allí corresponde a otro proyecto. Queda como declaración suya, pendiente de comprobación; no volver a pedirla ni repetirla.
2. **Activación:** falta añadir `VITE_GENERATOR_HISTORY=enabled` al entorno de producción del proyecto de Vercel **del frontend** y volver a desplegar **sin caché**. Es una variable de build de Vite: un redespliegue con caché previa no la aplica. Mientras no exista, producción no ofrece guardar búsquedas, que es el comportamiento deseado.
3. Tras activarla, comprobar un guardado real con sesión del propietario y el recuento en Proyectos.

## Decisiones vigentes

Registradas en [decisiones](decisiones.md). Las que siguen condicionan el trabajo actual:

- **Rendimiento.** De las seis propuestas de [la auditoría](performance-2026-10-27.md) quedan adoptadas el subconjunto publicado de IBM Plex Mono y diferir zod, ya integradas. La separación de código por rutas se implementó y **se revirtió**, porque empeoró el LCP de Inicio y Analizar. Siguen descartadas por ahora el primer render en transición, `content-visibility` en las secciones públicas y el INP de campo. Candidatos siguientes ya cifrados y **sin tocar**: `BackboneView` (113 ms y 9.212 bytes, solo en Inicio), `formatNumber` (59 ms), el catálogo español (70.602 bytes) e `HydropathyProfile` (9.180 bytes, una pestaña y no la vista inicial de Analizar).
- **Alcance de pruebas.** Solo las necesarias: tipos, lint, unitarias con cobertura, build, `check:pwa` en Chromium y la batería E2E completa en Chromium con un trabajador, más la matriz de accesibilidad existente a 360/1280 px en es/en y ambos temas. Safari en dispositivo real, lector de pantalla e INP de campo son **límites conocidos documentados**, no tareas pendientes. No añadir recorridos E2E nuevos salvo como regresión de un fallo real.
- **Modelado.** El cuaderno manual de Colab sigue siendo la vía oficial y documentada. [Inferencia desde la app](app-inference-proposal.md) queda aplazada y solo se reabre si aparece un ejecutor gratuito cuyos términos permitan este uso. [Forma de novo](de-novo-proposal.md) queda fuera del alcance de la asignatura, porque depende del mismo ejecutor. Ninguna de las dos propuestas se borra.
- **Catálogo de dominios.** Pestaña «Dominios» de Biblioteca integrada y **publicada**. Catálogo de 48 piezas verificado contra sus fuentes (`b23110f`): las 48 rederivadas de las descargas guardadas sin discrepancias y ocho reconsultadas en UniProt; una prueba fija esas invariantes. El ensamblado se analiza, se descarga en FASTA o se guarda a través de Analizar, siempre como texto sin fuente, sin cambiar ningún contrato persistido.

## Orden de continuación

1. **Publicado.** El propietario autorizó la publicación el 29 de octubre por la tarde, una vez integrados y verificados los dos frentes, y se ejecutó: `main` `00157a1`, con CI en verde y el despliegue identificado por su propio commit. Esa autorización queda consumida.
2. Activar el historial del generador en producción según el apartado anterior, con el propietario.
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

Interfaz nueva: se entregan maquetas y un plan por pantallas para que el propietario los apruebe antes de programar. Esa regla sigue en pie para cualquier pantalla que no esté ya aprobada.
