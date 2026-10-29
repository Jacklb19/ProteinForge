# Relevo de desarrollo — ProteinForge

Actualizado el **29 de octubre de 2026**. Leer este documento completo, los AGENTS de raíz/frontend/backend y las últimas entradas de ambos PROGRESS. La raíz no tiene Git; frontend y backend son repositorios independientes. Las versiones anteriores de este relevo están en [archive/relevo-2026-10-28.md](archive/relevo-2026-10-28.md) y [archive/relevo-2026-10-27.md](archive/relevo-2026-10-27.md); describen su momento y no son instrucciones vigentes.

## Estado publicado

| Repositorio | `main` | `dev` |
|---|---|---|
| Frontend | `09989b0` | `9927ce9` |
| Backend | `18d9444` | `cbff97e` |

El frontend se publicó el **29 de octubre**: el merge `65a0b74` llevó a `main` la pasada de rendimiento, el subconjunto de IBM Plex Mono y la pestaña «Dominios». Esa primera publicación **falló en CI** por un defecto de idioma; el arreglo `869ce2d` se publicó enseguida como `09989b0` y dejó ambas ramas en verde.

Comprobado el 29 de octubre desde coordinación, sin intermediarios:

- **CI de GitHub Actions en verde** en los dos flujos (integración continua y WebAssembly) para `dev` `869ce2d` y para `main` `09989b0`.
- **Producción sirve el arreglo de idioma.** No se pudo mirar el panel de Vercel porque la cuenta conectada a las herramientas de coordinación pertenece a otro proyecto, igual que ocurre con Supabase. Se comprobó por comportamiento en <https://protein-forge.vercel.app/>: elegir inglés, recargar y seguir en inglés, que es exactamente lo que `869ce2d` arregla. Con la versión anterior habría vuelto a español.

Lo que hay en `dev` por encima de `main` **no está publicado** y necesita autorización expresa y fechada del propietario. El backend tiene un commit de documentación sin subir (`cbff97e`), también pendiente de autorización.

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

1. Pedir autorización para publicar `dev` `9927ce9` (zod fuera del arranque), con CI y Vercel de `main` correctos después del merge.
2. Activar el historial del generador en producción según el apartado anterior, con el propietario.
3. Integrar y verificar lo que entreguen los dos frentes abiertos el 29 de octubre: rendimiento de `BackboneView`/`HydropathyProfile` con medición repetible, y el segundo factor TOTP (capa de cliente ya; interfaz solo tras aprobación del propietario).
4. Recorrido con Supabase local y dos cuentas reales para cerrar el aislamiento por ID y un guardado real del historial; el propietario indicó el 28 de octubre que revisa él esa parte.
5. Pendientes antiguos que siguen abiertos: aislamiento por ID con segunda cuenta en producción, recorrido SIFTS con JWT real y lectura autenticada del asistente comprobada en prosa.

## Copias de trabajo

| Copia | Rama | Estado | Puertos |
|---|---|---|---|
| `worktree-perf-components` | `parallel/perf-components` | Abierta el 29 oct: medición repetible de LCP y después `BackboneView` e `HydropathyProfile` | 5340–5349, E2E 5345 |
| `worktree-auth-totp` | `parallel/auth-totp` | Abierta el 29 oct: contrato TOTP/aal2, capa de cliente sin interfaz, maqueta y plan por pantallas para aprobación | 5350–5359, E2E 5355 |
| Coordinación | `frontend/dev`, `backend/dev` | Documentación general e integración | 5330–5339; E2E de verificación en 5190 |

`worktree-domains` y `worktree-performance` se retiraron el 29 de octubre, después de comprobar que `parallel/domains`, `parallel/perf-routes` y `parallel/performance` eran antepasados de `dev` y no tenían commits pendientes; las tres ramas se borraron con `-d`. Sus evidencias están en `artifacts/worktree-evidence/`, ignorada, junto a las de `worktree-quality`, `worktree-sifts` y `worktree-auth`. Se conserva el stash antiguo «discarded: interface redesign v3». [Plan de desarrollo paralelo](../../parallel-development.md).

**Una sola batería E2E a la vez en esta máquina.** Dos a la vez provocan fallos falsos. Los frentes tienen puertos propios, pero el carril se pide a coordinación antes de lanzar E2E o mediciones con navegador.

## Reglas vigentes

Trabajar en `dev`. Autor y committer exclusivamente Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas, coautores ni menciones a herramientas o agentes de IA en Git y GitHub, tampoco en mensajes de merge o PR; comprobarlo antes de cada push. Commits pequeños en inglés con pathspec explícito; documentación y respuestas en español. Cada texto visible va en `src/i18n/es.ts` y `src/i18n/en.ts` en el mismo cambio. No forzar al índice AGENTS, PROGRESS, propuestas, artifacts, secretos ni dependencias.

Costo cero estricto, sin tarjeta ni modelos en Windows. Sin push, merge, despliegue, migraciones remotas, cambios de servicios o secretos y sin cuentas nuevas salvo autorización expresa y fechada del propietario. La autorización de publicación del 29 de octubre quedó consumida y no cubre lo que entre después en `dev`. No repetir migraciones ya aplicadas ni reabrir aprobaciones visuales existentes: «Mesa clara», la presentación pública separada del laboratorio, el historial del generador y la pestaña «Dominios» están aprobados e implementados.

Interfaz nueva: se entregan maquetas y un plan por pantallas para que el propietario los apruebe antes de programar. Esa regla sigue en pie para cualquier pantalla que no esté ya aprobada.
