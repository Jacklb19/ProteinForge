# Relevo de desarrollo — ProteinForge

Actualizado el **23 de octubre de 2026**, tras cerrar localmente el asistente de interpretación. Las instrucciones actuales del propietario y los AGENTS.md prevalecen; este contexto no amplía autorizaciones remotas.

## Lectura y reglas

Raíz sin Git; `frontend/` y `backend/` son repositorios independientes. Leer completo este archivo, los tres AGENTS.md y las últimas entradas de ambos `docs/PROGRESS.md`. Trabajar en `dev`, conservar cambios del propietario y no crear repositorios anidados ni mover `.git`.

Respuestas y documentación en español; código, comentarios y commits en inglés. Autor y committer exclusivamente **Jacklb19 <jose.burbanob@campusucc.edu.co>**, sin coautores, firmas ni menciones a agentes o herramientas en commits, merges o GitHub. Verificar antes de cada commit/publicación.

Interfaz bilingüe: todo texto visible en `src/i18n/es.ts` y `en.ts` en el mismo cambio. Opciones y límites en `config.ts`; medidas en tokens. La interfaz nueva necesita maqueta aprobada; **la del asistente ya está aprobada**, dirección A revisada.

Costo cero y sin tarjeta. No instalar ni ejecutar modelos en Windows. No versionar AGENTS.md, docs/PROGRESS.md, docs/propuestas.md, secretos, .env, temporales ni artifacts. Push, merge, despliegues, SQL remoto, servicios nuevos y gastos requieren autorización expresa actual. **Esta continuación no publica nada.**

## Estado conocido

Producción según el relevo del propietario: frontend `main` **9fc20e8**, backend `main` **9d5528d**, CI y despliegues verdes. No se volvió a consultar GitHub/Vercel en este cierre. Las referencias origin son locales; no se hizo fetch.

Backend `dev` tenía cinco commits locales: `58329a6` asistente, `569ce52` documentación y `049fd47`, `63d9dcd`, `9f3a044` correcciones. Esta continuación solo añade documentación backend; no modifica ni repite sus pruebas de código. La evidencia anterior es **70 pruebas en total, con 12 SQL omitidas sin base**.

Frontend `dev` tenía tres commits de documentación (`856075d`, `fc7b6b8`, `220d352`) y la implementación sin confirmar. Se cerró en cuatro commits pequeños:

- `7a9ce42`: cliente RPC, contrato generado y textos español/inglés.
- `431d315`: sección de lectura e integración en Analizar/Laboratorio.
- `bdc59b1`: pruebas de vigencia, recálculo y respuestas canceladas tardías.
- `cb90ea9`: ocho E2E del asistente, incluido reemplazo del conjunto de laboratorio.

La documentación de cierre y NVIDIA se confirma aparte; consultar HEAD y progreso para sus hashes finales. Autoría exclusiva verificada. Sin cambios de código pendientes al cerrar.

## Asistente implementado, todavía sin publicar

[Uso frontend](assistant.md), [decisión visual aprobada](assistant-ui-proposal.md), [contrato backend](../../backend/docs/assistant.md).

Sección **Lectura de los resultados** al pie de Analizar y Laboratorio. Petición deliberada con sesión a `AssistantService/Interpret`; Groq `openai/gpt-oss-120b` escribe prosa breve. El propietario aceptó el envío del contexto. **El frontend solo envía cifras etiqueta/valor/unidad, nunca la secuencia.** Las lista junto al texto con modelo/proveedor/fecha.

Cambiar cifras o idioma retira la lectura. No se puede leer mientras los descriptores se recalculan; abrir otro conjunto del laboratorio invalida la lectura aunque reutilice los IDs. Los borradores editados no envían cifras de la predicción anterior. Una respuesta cancelada tardía no sustituye a la nueva. No hay chat, historial, persistencia ni exportación de lecturas.

Backend REST y RPC comparten dominio; 1–80 hechos, español/inglés, presupuesto por identidad y proceso (6/min por omisión). La comprobación numérica admite datos/redondeos, enteros hasta 20 y cotas del glosario 40/50/70/90/100. **No garantiza corrección semántica completa ni ausencia de alucinaciones.** No se envía el token del usuario a Groq.

`GROQ_API_KEY` existe en backend/.env según la comprobación anterior, sin mostrarla. No se ha comprobado su presencia en Vercel ni retención cero en la cuenta. La clave local no viaja con Git.

## Verificación local del 23 oct

- Tipos, lint y build correctos. **357 unitarias / 66 archivos**, cobertura 84,50 / 75,14 / 81,91 / 87,67; mínimos intactos.
- Primera batería afectada: 30 correctas y 2 omitidas por no indicar los ZIP. Batería final: **33/33 sin omisiones**, con los ZIP reales de campaña y restricciones, Chrome local y un trabajador. Archivos: assistant, laboratory, editor-design, projects y reports.
- PWA correcta: 47 recursos, fuentes, Workers/WASM, laboratorio/cuaderno y exportaciones sin conexión. Permanecen avisos previos de Vite sobre cargador futuro y chunks grandes.
- Cuatro capturas del asistente 360/1280, claro/oscuro, revisadas; AA automático en las E2E. Auth/RPC/textos simulados; no equivale a integración autenticada con Groq en producción.
- `npx buf generate ../backend/proto` deja los clientes sin diferencias. El generador añade una línea final vacía al stub nuevo; no editar a mano el código generado.
- El primer intento E2E y la primera PWA se bloquearon por localhost dentro del aislamiento; ambos completaron después con permisos de ejecución local. No se cambiaron flags de seguridad ni umbrales.
- **5296 libre**, comprobado; no había Uvicorn que cerrar. Otros servidores ajenos se conservan.

## Publicación: orden obligatorio tras autorización

**No publicar el frontend todavía con su pin actual.** CI ejecuta `npx buf generate` desde el commit backend de `buf.gen.yaml`: **5b6c4505c77293e1f4798e0bd86932e13c11600f**, que no contiene el asistente.

1. Obtener autorización de push de `dev` y merge/push de `main` de ambos repositorios. Auditar identidad, trailers, árboles y referencias remotas.
2. Publicar backend primero, esperar CI y despliegue, comprobar REST/Connect/gRPC-Web/CORS. El propietario configura la clave de Groq en Vercel si falta; no pedir ni mostrar su valor.
3. Fijar `frontend/buf.gen.yaml` al commit backend publicado con AssistantService. Ejecutar `npx buf generate`, revisar y confirmar el cambio.
4. Publicar frontend después; verificar CI/despliegue y la lectura real con el alcance de sesión/datos autorizado.

No requiere SQL nuevo. La migración del laboratorio ya fue aplicada por el propietario; **no repetirla**.

## Laboratorio y decisiones pendientes

[Activación real del 22 oct](laboratory-activation.md): guardado/apertura/edición/copia/conflicto/borrado probados en producción con proyectos de prueba ya eliminados. La segunda cuenta no ve proyectos de la primera; lectura directa por ID con esa sesión sigue sin autorización/prueba. No forzar escrituras ni repetir datos reales por iniciativa propia.

**NVIDIA:** leídos completos los API Trial Terms of Service de nueve páginas, versión 19 septiembre 2025, enlazados en RFdiffusion/ProteinMPNN. Secciones 1.2/1.4 limitan a evaluación interna y excluyen producción del servicio/resultados. Según FAQ oficial, servir usuarios reales es producción aunque la web no cobre. Además, la ficha de ESMFold marca el endpoint como Deprecated. [Fuentes, cláusulas y recomendación](app-inference-proposal.md). Recomendación pendiente del propietario: cualquier ensayo futuro solo interno suyo, con datos públicos; eso no autoriza aún integración, cuentas, claves ni llamadas. No prometer la cadena alojada como disponible. La licencia de los modelos es distinta de la del servicio.

Siguen abiertas [forma de novo](de-novo-proposal.md), [inferencia desde la app](app-inference-proposal.md) y [persistencia de predicciones](prediction-storage-proposal.md). Colab sigue siendo manual; no alojar un servicio detrás de él. No hay ejecutor ni DesignService implementado. RTX 4060 8 GB: ESMFold alcanzó 7,91 GiB con 76 residuos en el ensayo anterior; no volver a instalar modelos en Windows.

## Entorno

Frontend preview habitual 5187; 5173 pertenece a otro proyecto. E2E 5190, un trabajador. API local habitual 5296 (libre al cierre); 8000 es otra herramienta.

Frontend: `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run check:pwa`. Vitest Windows con TEMP/TMP bajo frontend/tmp/vitest. No editar src mientras corren E2E. Backend: `.venv/Scripts/python.exe -m unittest discover -s tests -v`; SQL local mediante scripts/test-postgres.ps1. gh no instalado; no extraer credenciales para acceder a logs.

Al cerrar distinguir implementado, probado localmente, comprobado en producción y pendiente de decisión. No crear otro chat ni repositorio por cuenta propia.
