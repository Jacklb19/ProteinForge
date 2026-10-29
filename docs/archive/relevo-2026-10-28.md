# Relevo de desarrollo — ProteinForge

Actualizado el **28 de octubre de 2026**. Leer este documento completo, los AGENTS de raíz/frontend/backend y las últimas entradas de ambos PROGRESS. La raíz no tiene Git; frontend y backend son repositorios independientes. Las versiones anteriores de este relevo están en [archive/relevo-2026-10-27.md](archive/relevo-2026-10-27.md); describen su momento y no son instrucciones vigentes.

## Estado publicado

| Repositorio | `main` | `dev` |
|---|---|---|
| Frontend | `84f9da5` | `0b22b4a` |
| Backend | `18d9444` | `acfea11` |

Ambos `main` se publicaron el 27 de octubre con CI y Vercel correctos; los remotos conservan únicamente `dev` y `main`. Lo que hay en `dev` por encima de `main` todavía no está publicado y necesita autorización expresa del propietario.

El frontend fija el backend publicado `18d9444` en `buf.gen.yaml`; la regeneración fue idéntica. Si cambia el contrato, el orden sigue siendo **migración → backend → repin/regeneración → frontend**.

## Integrado en `dev` el 28 de octubre: rendimiento y accesibilidad

El merge `0b22b4a` incorpora los doce commits `a90f5aa`…`9d274da` de la pasada de rendimiento y accesibilidad, antes aislada en `parallel/performance`. [Detalle, cifras crudas y propuestas](performance-2026-10-27.md); resumen en [calidad](quality-s7.md).

- **RNF-03 cumplido en medición local:** LCP mediano con 4G lenta y CPU ×4 baja de 2.495 a 2.150 ms en Inicio y de 3.198 a 2.449 ms en Analizar. Analizar supera el objetivo por 43 ms en p75, margen estrecho. Causas corregidas: catálogos de idioma dentro de cada Worker, precarga de la monoespaciada y catálogo inglés en el paquete inicial. El precaché de la PWA baja de 3.463 a 2.512 KiB.
- **RNF-01 cumplido solo en parte:** las interacciones sintéticas con CPU ×4 quedan en p75 de 48 ms y máximo de 144 ms, por debajo de 200 ms, pero al cargar persisten tareas de más de 50 ms (unos 135 ms de evaluación y unos 165 ms de render). No son INP de campo.
- **WebKit sin conexión:** el «internal error» registrado el 25 y 26 de octubre lo produce la emulación `setOffline` de Playwright en WebKit/Windows, no el producto. Con el servidor realmente parado, la aplicación recarga desde su Service Worker; `check:pwa` usa ahora esa caída real y pasa en WebKit 26.6 y Chromium 156. No certifica Safari.
- **Accesibilidad:** matriz AA nueva en es/en, 360/1280 px, claro/oscuro, con recorridos de teclado. Encontró y corrigió un defecto real: el anillo de foco quedaba recortado en la navegación desplazable de la barra lateral.

Verificación del merge, sin Auth configurada y como CI: tipos y lint correctos; **504 unitarias en 87 archivos**; cobertura 85,44 / 76,78 / 81,92 / 89,21 %, mínimos intactos; build correcto; `check:pwa` correcto. Batería E2E completa correcta en el checkout principal (puerto 5190, un trabajador): **137 correctas y 2 omitidas** por diseño, en 9,0 minutos. Las omitidas requieren evidencia local de Colab. La integración queda verificada; publicar sigue necesitando autorización.

## Historial del generador: pendiente solo de activarlo

Contrato, backend, cliente e interfaz están implementados y publicados en `main`; la interfaz permanece oculta salvo con `VITE_GENERATOR_HISTORY=enabled`. [Contrato](../../backend/docs/generator-history-contract-proposal.md), [interfaz aprobada](generator-history-ui-proposal-2026-10-27.md).

1. **Migración:** el propietario declara que aplicó `20261027000000_generator_history.sql` en Supabase remoto el 28 de octubre. No se ha inspeccionado desde coordinación, porque la cuenta de Supabase conectada allí corresponde a otro proyecto. Queda como declaración suya, pendiente de comprobación; no volver a pedirla ni repetirla.
2. **Activación:** falta añadir `VITE_GENERATOR_HISTORY=enabled` al entorno de producción del proyecto de Vercel **del frontend** y volver a desplegar. Es una variable de build de Vite: un redespliegue con caché previa no la aplica. Mientras no exista, producción no ofrece guardar búsquedas, que es el comportamiento deseado.
3. Tras activarla, comprobar un guardado real con sesión del propietario y el recuento en Proyectos.

## Decisiones tomadas por delegación el 28 de octubre

El propietario delegó las decisiones técnicas y pidió consolidar documentación. Registradas también en [decisiones](decisiones.md).

- **Rendimiento.** Se implementan las propuestas 1 (separar el código inicial por rutas con precarga mediante cabeceras `Link`, sin tocar la CSP `script-src 'self'`), 5 (subconjunto **publicado** de IBM Plex Mono con su procedencia, sin generarlo aquí por la reserva de nombre de la OFL) y 2 (diferir zod, solo si no enreda los proveedores de estado). Se descartan por ahora la 3 (primer render en transición: únicamente volver a medirla cuando la 1 dé margen), la 4 (`content-visibility` en las secciones públicas, por el riesgo de recortar anillos de foco) y la 6 (INP de campo, que exigiría telemetría de usuarios con consentimiento).
- **Alcance de pruebas.** Se mantienen solo las necesarias: tipos, lint, unitarias con cobertura, build, `check:pwa` en Chromium y la batería E2E completa en Chromium con un trabajador, más la matriz de accesibilidad existente a 360/1280 px en es/en y ambos temas. Safari en dispositivo real, lector de pantalla e INP de campo pasan a **límites conocidos documentados**, no tareas pendientes. No añadir recorridos E2E nuevos salvo como regresión de un fallo real.
- **Modelado.** El cuaderno manual de Colab sigue siendo la vía oficial y documentada. [Inferencia desde la app](app-inference-proposal.md) queda aplazada y solo se reabre si aparece un ejecutor gratuito cuyos términos permitan este uso. [Forma de novo](de-novo-proposal.md) queda fuera del alcance de la asignatura, porque depende del mismo ejecutor. Ninguna de las dos propuestas se borra.
- **Catálogo de dominios.** Pestaña «Dominios» de Biblioteca **integrada en `dev`** el 29 oct con el merge `a3acf37`, sin publicar. Catálogo de 48 piezas verificado contra sus fuentes antes de aceptarlo (`b23110f`): las 48 rederivadas de las descargas guardadas sin discrepancias y ocho reconsultadas en UniProt; una prueba fija esas invariantes. Interfaz aprobada por el propietario el 28 oct con la condición de usar solo los tokens y clases de la app ([propuesta](domains-proposal-2026-10-28.md)). El ensamblado se analiza, se descarga en FASTA o se guarda a través de Analizar, siempre como texto sin fuente, sin cambiar ningún contrato persistido. El catálogo se carga solo al abrir la pestaña (16,24 kB gzip); la precaché crece unos 98 KiB para que funcione sin conexión. Verificación de `dev` tras el merge, sin Auth y como CI: tipos, lint, 619 unitarias, build, `check:pwa` y batería E2E completa con un trabajador, **140 correctas y 2 omitidas** por diseño.

## Orden de continuación

1. Publicar `dev` (rendimiento, subconjunto de Plex Mono y pestaña Dominios) cuando el propietario lo autorice, con CI y Vercel de `main` correctos después del merge.
2. Activar el historial del generador en producción según el apartado anterior, con el propietario.
3. Recorrido con Supabase local y dos cuentas reales para cerrar el aislamiento por ID y un guardado real del historial; el propietario indicó el 28 de octubre que revisa él esa parte.
4. Pendientes antiguos que siguen abiertos: aislamiento por ID con segunda cuenta en producción, recorrido SIFTS con JWT real y lectura autenticada del asistente comprobada en prosa.

## Copias de trabajo

| Copia | Rama | Estado | Puertos |
|---|---|---|---|
| `worktree-performance` | `parallel/performance` | Ya integrada en `dev` (`0b22b4a`); sin commits pendientes | 5310–5319, E2E 5315 |
| `worktree-domains` | `parallel/domains` | Integrada en `dev` con `a3acf37`; se puede retirar | 5320–5329, E2E 5325 |
| Coordinación | `frontend/dev`, `backend/dev` | Documentación general e integración | 5330–5339; E2E de verificación en 5190 |

Las copias `worktree-quality`, `worktree-sifts` y `worktree-auth` se eliminaron el 27 de octubre tras comprobar con `git cherry` que no faltaba ningún commit en `dev`; sus evidencias están en `artifacts/worktree-evidence/`, ignorada. Se conserva el stash antiguo «discarded: interface redesign v3». [Plan de desarrollo paralelo](../../parallel-development.md).

## Reglas vigentes

Trabajar en `dev`. Autor y committer exclusivamente Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas, coautores ni menciones a herramientas o agentes de IA en Git y GitHub, tampoco en mensajes de merge o PR; comprobarlo antes de cada push. Commits pequeños en inglés con pathspec explícito; documentación y respuestas en español. Cada texto visible va en `src/i18n/es.ts` y `src/i18n/en.ts` en el mismo cambio. No forzar al índice AGENTS, PROGRESS, propuestas, artifacts, secretos ni dependencias.

Costo cero estricto, sin tarjeta ni modelos en Windows. Sin push, merge, despliegue, migraciones remotas, cambios de servicios o secretos y sin cuentas nuevas salvo autorización expresa y fechada del propietario. La autorización de publicación del 27 de octubre quedó consumida y no cubre lo que entre después en `dev`. No repetir migraciones ya aplicadas ni reabrir aprobaciones visuales existentes: «Mesa clara», la presentación pública separada del laboratorio y el historial del generador están aprobados e implementados.

Interfaz nueva: se entregan maquetas y un plan por pantallas para que el propietario los apruebe antes de programar. Esa regla sigue en pie para cualquier pantalla que no esté ya aprobada.
