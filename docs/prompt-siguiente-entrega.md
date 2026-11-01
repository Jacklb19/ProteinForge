# Prompt para la siguiente sesión de desarrollo de ProteinForge

Estado de referencia: **1 de noviembre de 2026, America/Bogota**. Este documento sustituye el relevo anterior. Los informes fechados y `docs/archive/` conservan historia, no instrucciones vigentes. Comprueba los cambios posteriores antes de asumir que las referencias Git siguen iguales.

## Primero, entender lo que existe

Continúa ProteinForge en `C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge`. La raíz no tiene Git. Hay dos repositorios independientes: `frontend/` (React + TypeScript + Vite, Workers/WASM, PWA) y `backend/` (FastAPI + Supabase). Nunca crees Git en la raíz ni anides repositorios.

Antes de tocar código, lee en este orden: AGENTS de raíz/frontend/backend; este relevo; [plan](plan-desarrollo.md); [decisiones](decisiones.md); `frontend/docs/PROGRESS.md`; [arquitectura backend](../../backend/docs/arquitectura.md); [API backend](../../backend/docs/api.md); [publicación y prueba real del 1 nov](release-2026-11-01.md). Después recorre `frontend/src/features/` por funcionalidades y backend por rutas, contratos y migraciones. Lee los documentos específicos del pendiente que vayas a abordar.

Explica antes de programar qué hace la aplicación, qué está publicado y qué sigue pendiente. Permite analizar/comparar secuencias, consultar referencias, buscar candidatos y modificar borradores en el laboratorio. Ya predice la estructura de una secuencia exacta mediante un servicio externo. Eso no equivale a fabricar proteínas físicas, ejecutar ProteinMPNN o diseñar formas de novo.

## Reglas que siguen vigentes

- Trabaja en `dev` de cada repositorio. Conserva los cambios locales ajenos; inspecciona estado/diff antes de editar. AGENTS y PROGRESS son locales ignorados: no los fuerces al índice.
- Autor y committer exclusivos: **Jacklb19 <jose.burbanob@campusucc.edu.co>**, también en merges. Sin firmas, Co-Authored-By ni menciones a herramientas, modelos o agentes de IA en asuntos/cuerpos de commits, merges o PR. Antes de cada push ejecuta `git log --format='%an <%ae> | %cn <%ce>%n%b' origin/dev..dev`; comprueba también el rango de main si vas a subir un merge.
- Textos visibles en `src/i18n/es.ts` y `src/i18n/en.ts` en el mismo cambio. Opciones, límites, tamaños y URLs en configuración por característica; CSS solo con tokens de `src/design-tokens.css`.
- Toda pantalla nueva necesita PNG y plan por pantallas aprobados por el propietario antes de programarla. La delegación nocturna del 30 oct correspondía a la entrega de Predicción ya terminada; no autoriza aprobar ahora TOTP ni otra interfaz en su nombre.
- Las decisiones técnicas ordinarias son tuyas. El propietario reserva aprobación de interfaz, publicación, operaciones remotas, coste y riesgos sobre datos.
- **Sin nueva autorización expresa y fechada: ningún push, merge, despliegue, migración remota, cambio en Vercel/Supabase, cuenta nueva o gasto.** La publicación del 1 nov ya se autorizó y ejecutó; ese permiso no cubre otra entrega. Coste cero y sin tarjeta.
- Español sencillo; distingue medido, declarado y supuesto. No inventes requisitos, cifras científicas, respuestas de API o rendimiento. Descriptores y predicciones no prueban plegamiento, estabilidad o función.
- No pidas ni extraigas contraseñas/JWT. El propietario inicia sesión personalmente. No guardes HAR/cabeceras/tokens ni secuencias privadas en logs. Una sesión en Chrome no se comparte con el navegador integrado.
- Puerto 5173 ocupado por otro proyecto. Desarrollo local en 5330–5339; E2E en 5190. Nunca dos baterías E2E simultáneas en esta máquina; reparte el carril si se autorizan agentes o sesiones paralelas. No termines procesos ajenos.

## Estado Git y publicado

| Repositorio | main publicado | dev al preparar este prompt |
|---|---|---|
| Frontend | `0ffaf4d4f6fc3afb02cc7ddc3b14d6dff632daec` | `582dd0063dd5a68ca5f7009c064a5d60e9e18cbe`, sincronizado con origin/dev; añade notas de cierre a la versión funcional `7d0fd1b` |
| Backend | `14014324a7c3db9eda551e12fd9c3e502fb77788` | `89b9ed3e7163635606832ed6aa34d50c62d59efa`, sincronizado con origin/dev |

**Avance local posterior del 1 nov, sin publicar.** Frontend dev queda 5 commits por delante de origin/dev (`140c5cf`, `ad3b663`, `0d68ca6`, `b34b353` y la actualización de este relevo); backend dev, 2 por delante (`9d27dda`, `2ea64f0`). Autor y committer exclusivos Jacklb19, sin trailers. Publicar exige nueva autorización expresa y fechada.

- **Preferencias y cuenta (propuesta A «Controles compactos»).** El propietario respondió «Implementa la A» el 1 nov a las maquetas de `artifacts/preferences-account-2026-11-01/`. Se quitó el panel «Preferencias»; ES/EN y botón luna/sol en barra pública, menú de teléfono y pie lateral sin sesión; la cuenta es un enlace directo a `/profile`, sin menú; «Sitio de ProteinForge» y «Cerrar sesión» en la cabecera del perfil. Barra lateral plegada sin maqueta: versión mínima (un botón con el otro idioma y la luna). Un invitado que use el botón no puede volver a «Sistema» (queda en Perfil). Local: tipos/lint/build correctos; **722 unitarias/101 archivos**; cobertura **88,37/79,36/84,47/92 %**; E2E de 11 specs afectadas **66 correctas + 2 omitidas por diseño**, 5190, un trabajador, solo Chromium. Sin batería E2E completa ni `check:pwa` nuevos. Capturas reales y lista de comparación en `artifacts/preferences-account-2026-11-01/implementado/`. Decisión en [decisiones](decisiones.md).
- **Asistente (backend).** Repetición offline de las variantes públicas 1–3: las respuestas fieles pasan; se rechazan umbrales de memoria, recuentos derivados, porcentajes y «la mayoría». Causa de los tres rechazos reales: **sin determinar**, probablemente rechazos legítimos. Corregidos dos falsos positivos en inglés («at most», «the third variant»); el log de rechazo registra tipo y recuento, nunca cifras, prosa ni secuencias. Prompt endurecido (decisión de coordinación): sin umbrales fuera del glosario, sin proporciones de residuos desde una media, sin comparaciones ausentes, sin afirmar plegamiento/estabilidad/función. Sin umbral pTM (cifra científica no inventada); «todos/all» aplazado. **152 descubiertas: 133 correctas, 19 SQL omitidas**. El efecto sobre respuestas reales de Groq no se midió. [Detalle](../../backend/docs/assistant.md).
- **Giro de portada medido.** [Informe](landing-rotation-measurement-2026-11-01.md): 14 rondas × 6 variantes, 144 Hz, CPU ×4, 1280×800, sobre `582dd00`. El coste depende de repintar cada fotograma, no de la velocidad: media velocidad cuesta igual (990 ms/s de hilo ocupado). Fijo: 0 ms/s y p75 de interacción −32 ms; 30 fps: 505 ms/s, −16 ms; 15 fps: 293 ms/s, −24 ms. Todas bajo 200 ms. No medido a 60 Hz ni en teléfono. El propietario eligió 30 fps; implementado en local (28,8 pintados/s a 144 Hz).

Este prompt se actualiza localmente después de esos commits: inspecciona `git status` y conserva su actualización; prepararlo no implica otro push. No queda pendiente subir el antiguo commit backend `cbff97e`: ya se publicó como antecesor de esta entrega.

Frontend público: <https://protein-forge.vercel.app/>. Backend: <https://protein-back.vercel.app/>. Vercel informó ambos despliegues correctos. El bundle `/assets/index-CPsr69N7.js` incorpora el hash completo del main frontend; la pestaña usada para la prueba cargó ese archivo. Identifica futuras publicaciones por el hash del bundle, no por una captura del panel de otro proyecto.

`frontend/buf.gen.yaml` fija el contrato backend **77a753c2f8673b964e1943a8845767c9dce67635**, ya publicado y contenido en main. Regeneración aislada desde GitHub: **7 archivos, 0 diferentes**. No necesita otro repin ahora. Si cambia el contrato después: migración autorizada si corresponde → backend → pin/regeneración/CI → frontend.

Los conectores de Vercel/Supabase se habían vinculado a otro proyecto; no atribuyas sus datos a ProteinForge. El proyecto Supabase correcto observado es `ycskfgimxrnhozmmqnze`. El navegador del propietario permitió consultar metadatos antes de la migración; después Chrome dejó de responder al control y no se repitió esa consulta. La terminal tuvo un fallo DNS del backend mientras el navegador sí respondía: no confundirlo con caída de producción.

## Lo que ya está terminado y no hay que pedir otra vez

La dirección «Mesa clara», presentación pública separada del laboratorio, historial del generador y pestaña Dominios están aprobados, implementados y publicados. TOTP tiene cliente publicado, sin pantallas.

El propietario **confirmó aplicada** `backend/supabase/migrations/20261030000000_structure_predictions.sql` y configuradas `FOLDING_ENABLED=enabled` en backend y `VITE_STRUCTURE_PREDICTION=enabled` en frontend. No repetir SQL ni pedirle que vuelva a ponerlas. El contenido exacto del SQL remoto queda declarado, sin nueva inspección; la activación y el guardado efectivos sí se observaron.

Predicción publicada: REST `/v1/predictions/fold` y RPC `proteinforge.folding.v1.FoldingService/Predict`, cuenta y consentimiento por solicitud, secuencia canónica exacta de 3–120 residuos enviada a ESM Atlas sin JWT del usuario. Una solicitud activa y tres/minuto por proceso; una/minuto por identidad. Sin reintentos ni caché privada. Validación PDB/secuencia/hashes en API y Worker, visor Cα y descarga original. pTM, PAE, confianza y revisión ausentes se conservan ausentes. Portable laboratorio v2, envoltorio v1, workspace v4; predicciones separadas del resultado Colab y guardia contra sobrescritura por clientes antiguos. [Contrato](prediction-contract-2026-10-30.md), [API y persistencia](../../backend/docs/folding.md).

**Prueba real de producción del 1 nov:** el propietario inició sesión en el navegador integrado; variante pública 1 de ubiquitina, 76 residuos. Predicción correcta; PDB de **49.452 bytes**, SHA256 `8dafcdec20d2fee788b3566bd047c653a90d80717af483042ea80dafc45abf75`, idéntico al del portable descargado. Se creó el proyecto **«Prueba de predicción 2026-11-01»**. Recarga completa de Proyectos, búsqueda y reapertura desde el servidor recuperaron la predicción; el portable reexportado coincide en **todos sus datos** con el original. Backend validó los archivos. No se extrajo JWT, no se sobrescribieron/borraron proyectos existentes y el proyecto de prueba quedó en la cuenta. Esto acredita una identidad real, no aislamiento frente a otra cuenta.

No hay GPU propia reservada. El endpoint público compartido funcionó; no garantiza disponibilidad para tres personas ni demuestra inferencia nueva frente a caché. ModelScope quedó `Application in Approval...` y la cuenta HF observada no ofrecía Gradio/Docker gratis en la revisión del 29–30 oct; no se reconsultaron esos estados en el cierre. [Investigación asiática](asian-gpu-hosting-2026-10-29.md). No rehagas por rutina esa investigación ni contrates recursos para sustituir un flujo ya comprobado.

La PWA conservó el bundle antiguo tras recargar. Cerrar y reabrir solo la pestaña pública cargó la versión nueva y conservó la sesión. Si falta Predicción, comprueba primero qué bundle carga; no cambies variables por suposición ni borres el almacenamiento del propietario. `registerType` actual es `prompt`; una mejora del aviso de actualización necesita propuesta si cambia la interfaz.

## Verificación ejecutada y referencia de pruebas

- Backend CI dev [41280481599](https://github.com/Jacklb19/Protein_Back/actions/runs/41280481599) y main [41280558712](https://github.com/Jacklb19/Protein_Back/actions/runs/41280558712): correctos, **Python 3.14**, lint/generación protobuf correctos; **146 descubiertas: 127 correctas y 19 SQL omitidas** sin base. Las **19 SQL pasaron aparte** en PostgreSQL 18 temporal en la entrega local del 30 oct, con auth.uid() emulado; clúster detenido. No son 146 ejecutadas ni una certificación de dos cuentas desplegadas.
- Frontend de la versión publicada: CI dev [41280753516](https://github.com/Jacklb19/ProteinForge/actions/runs/41280753516) y main [41281519512](https://github.com/Jacklb19/ProteinForge/actions/runs/41281519512), y sus flujos WebAssembly, correctos. **715 unitarias en 100 archivos**; cobertura **87,84 / 79,04 / 83,78 / 91,62 %**. Tipos/lint/contrato/build correctos. **141 E2E correctas + 2 omitidas por diseño/143**; 8,1 min en dev y 10,9 min en main, sin flaky en ese cierre. Umbrales y esperas intactos.
- La última ejecución local de `check:pwa` fue la del 30 oct y pasó. No atribuir una ejecución nueva de ese script al workflow remoto, que no lo llama como paso independiente. La matriz local de Predicción fue 1280/360 × claro/oscuro × es/en, 0 infracciones Axe y 0 errores de página; usó Auth/API simuladas y PDB público grabado, a diferencia del recorrido real del 1 nov.
- Notas documentales `582dd00`: WebAssembly [41282424395](https://github.com/Jacklb19/ProteinForge/actions/runs/41282424395) e integración [41282424441](https://github.com/Jacklb19/ProteinForge/actions/runs/41282424441) **terminaron correctamente**. Último dev: 715 unitarias/100 archivos, misma cobertura, **141 E2E correctas + 2 omitidas/143, 11,0 min**. Ya no queda ese CI pendiente; no cambia código de aplicación ni el despliegue de main.

Para cambios de código, verifica solo lo necesario; una pasada completa cuando afecte módulos compartidos. Reproduce las condiciones acordadas desde frontend, sin secretos reales:

```powershell
$env:CI='true'
$env:VITE_SUPABASE_URL=''
$env:VITE_SUPABASE_ANON_KEY=''
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run check:pwa
$env:E2E_PORT='5190'
$env:E2E_WORKERS='1'
node scripts/run-e2e.mjs
```

Backend: `python -m unittest discover -s tests`. Las SQL requieren una base local configurada; no apuntes las pruebas a producción. No debilites aserciones/cobertura ni añadas E2E salvo regresión de un fallo real. Documentación sola: enlaces, coherencia y diff; no repetir baterías de producto. Safari físico, lector de pantalla e INP de campo son límites conocidos, no nuevas tareas.

Ensayo local disponible: `npm run dev:prediction` desde frontend inicia 5330/5331, comprueba Auth del mismo proyecto y activa banderas solo en los procesos; no modifica .env y rechaza puertos ocupados sin detener otros programas. Puede seguir ejecutándose de la sesión anterior: comprueba antes de iniciar otro. Ctrl+C detiene sus propios procesos. No presupongas que la sesión del navegador continúa vigente.

## Trabajo pendiente, en orden

1. **Completar SIFTS con identidad real y cuota.** La lectura local autenticada del 1 nov mostró P01308:90 (G) → 1TRZ cadena A/autor A:1/interna 1, y 110 (N) → A/autor A:21/interna 21; también hubo lectura real anterior en producción. Falta acreditar la cuota de **20/min** contra la identidad correcta y rechazo de JWT auténtico caducado/manipulado por toda la pasarela. Un token constante inválido dio 401 en Predicción; no equivale a alterar el JWT real ni a probar cuota SIFTS. Coordina una prueba segura con el propietario sin copiar sus credenciales; no des por terminados esos criterios por el visor.
2. **Aislamiento por ID con segunda cuenta.** El propietario dijo que lo revisa él. Ofrécele guion/acompañamiento: A crea proyecto de prueba; B intenta leer, modificar y borrar por ID; rechazo o ningún resultado en los tres. No uses sus credenciales ni crees cuentas por tu cuenta. Las SQL locales y el guardado real con A no certifican esa cadena con B.
3. **Diagnosticar y revisar prosa del asistente.** Solo interpreta cifras calculadas; no genera secuencias ni calcula propiedades. Se publicaron arreglos de signo y Decimal largo, además del rechazo de cantidades verbales no suministradas. El 1 nov, tres lecturas locales con sesión real (variantes 1–3) se rechazaron con `502 assistant-unverified-figure`; no se vio ni inspeccionó el texto descartado. No afirmar tres alucinaciones ni tres respuestas correctas: puede haber error real o falso positivo. Diagnostica con datos públicos y evidencia acotada; no debilites el verificador para conseguir éxito. Después revisa varias salidas aceptadas frente a sus cifras: cantidades, proporciones y ausencia de inferencias sobre función/plegamiento. Documenta cada caso/veredicto. [Casos y cifras](readiness-2026-11-01.md), [contrato y diagnóstico](../../backend/docs/assistant.md). **Avance local del 1 nov** (ver arriba): diagnóstico offline y prompt endurecido; tras publicar con autorización, la próxima lectura real rechazada mostrará en el log el tipo de cifra. Falta comprobar salidas reales aceptadas con el prompt nuevo.
4. **Historial del generador: guardado real pendiente.** El control se observó activado en producción tras la declaración `VITE_GENERATOR_HISTORY=enabled` del 29 oct. Falta guardar una búsqueda con sesión, revisar su recuento y reabrirla. El proyecto de prueba del 1 nov certifica laboratorio/predicción, no historial. No repetir la migración del historial que el propietario declaró aplicada.
5. **TOTP: presentar, no programar todavía.** Cliente `mfaApi.ts`/`assurance.ts` publicado; ninguna pantalla. [Contrato](auth-totp-contract.md), [propuesta](auth-totp-ui-proposal-2026-10-29.md). Las 72 capturas están realmente en `frontend/artifacts/worktree-evidence/worktree-auth-totp/auth-totp-2026-10-29/capturas/`; el directorio corto que cita la propuesta no está en este checkout. Cuatro decisiones del propietario: opción A con aplicación TOTP/de respaldo; códigos de recuperación (experimentales y desactivados por defecto en Auth v2.197.0: recomendación previa, no por ahora); exigir aal2 también en RLS/API; aceptar recuperación por soporte quitando él el factor tras verificar identidad. **Una sesión aal1 sigue valiendo para la API: la pantalla sola no protege los datos.** No extender la delegación antigua a estas decisiones.
6. **Giro de portada: limitado a 30 fps en local.** Elección del propietario del 1 nov; el tope vive en `src/features/structure/config.ts`. Falta mirarlo en una pantalla de 60 Hz y en un teléfono, y publicarlo con la próxima entrega autorizada.
7. **RNF-03 en Analizar sigue sin acreditarse.** Antes de esta nueva entrega, cinco tandas alternadas dieron Inicio p75 2.226–2.264 ms/220 de 220 cargas bajo 2,5 s; Analizar p75 2.526–2.556 ms, solo 11–28 % bajo objetivo. No extrapoles esos LCP a la versión nueva, que no se midió. Usa `scripts/measure-lcp.mjs` y `scripts/lcp-stats.mjs`: dos builds a la vez, orden alternado, 4G lenta/CPU×4, IC95 % sin normalidad y repetición intercambiando puertos. Con 30 pares, efectos de unos 10 ms en Analizar. Candidatos históricos sin adoptar: formatNumber (59 ms) y catálogo español (70.602 bytes). BackboneView ahorró CPU y no LCP; el ensayo posterior JSON.parse de 30 pares tampoco demostró mejora (+3,225 ms, IC95 % [−15,170; +45,415], ruido 89,126 ms). Busca el camino crítico del primer pintado, mide antes/después y no prometas una mejora de LCP por bajar CPU propia. [Último ensayo](performance-continuation-2026-10-29.md).

## Cierre de la próxima sesión

Actualiza este relevo y ambos PROGRESS pertinentes con estado real, cambios, pruebas ejecutadas y cifras exactas, límites y tareas del propietario. Conserva la distinción entre código implementado, publicado, declaración del usuario y verificación real. No vuelvas a abrir como pendientes la migración, las dos variables, la publicación del 1 nov o la predicción/guardado/reapertura con una cuenta ya comprobados.

Evidencia del cierre: `frontend/artifacts/release-2026-11-01/` y `backend/artifacts/release-2026-11-01/`, ignoradas por Git. Conservan capturas, resumen, PDB/portables públicos y validación de igualdad; no JWT. Los informes anteriores conservan contexto histórico y no autorizan operaciones nuevas.
