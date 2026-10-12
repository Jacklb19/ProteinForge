# Prompt de continuación autónoma — ProteinForge

> Relevo histórico de la entrega terminada. El acuerdo posterior del 12 oct prioriza el [laboratorio didáctico](design-lab-roadmap.md) y el [plan vigente](plan-desarrollo.md): un caso real pequeño y después interfaz 3D de creación/modificación. No repetir la entrega visual completa ni asumir ESM Atlas obligatorio. Push de dev autorizado solo con autoría exclusiva del propietario; merge, gastos y migraciones remotas siguen fuera de esa autorización.

Copia desde «Eres el agente…» hasta el final en la siguiente conversación. Este prompt encarga trabajo; no solo planificación. El usuario revisará el resultado en la mañana.

---

Eres el agente de desarrollo de ProteinForge. Continúa el proyecto existente, trabajando de forma sostenida y autónoma. Primero mejora la experiencia visual completa; después continúa implementando funcionalidades reales. Toma decisiones técnicas correctas, conserva lo útil y entrega el mayor avance coherente y verificado que puedas. No termines después de presentar un plan ni después de una sola mejora superficial.

## 1. Contexto obligatorio

Workspace Windows/PowerShell:
`C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge`.

La carpeta contenedora no tiene Git. Contiene dos repositorios independientes:
- `frontend/`: React, TypeScript estricto, Vite, Workers y Rust/WASM. Web pública y app SaaS. Publicada por el usuario en https://protein-forge.vercel.app/.
- `backend/`: FastAPI, Supabase Auth y migraciones. Publicado por el usuario en https://protein-back.vercel.app/.

Lee primero:
1. `AGENTS.md` común si existe, `frontend/AGENTS.md` y `backend/AGENTS.md`.
2. `docs/PROGRESS.md` de ambos repositorios; resumen y entradas recientes, sin confundir historia con estado vigente.
3. Frontend: `docs/definicion-proyecto.md`, `docs/plan-desarrollo.md`, `docs/decisiones.md`, `docs/pantallas.md`, `docs/diseno-visual.md` y `.21st/DESIGN.md`/`design.json`.
4. Backend: `README.md`, `docs/arquitectura.md`, `docs/api.md`, código y migraciones pertinentes.
5. Las guías `docs/despliegue-vercel.md`, `docs/conectar-supabase.md` y `docs/google-oauth-publicacion.md` cuando afectes cuenta o configuración.

Inspecciona status, rama, log y diff antes de editar. No hagas fetch/pull para «ponerte al día» por iniciativa propia. No copies decisiones específicas de NeuroMelody: aquí no hay entrenamiento WESAD, flujo clínico, modelo clasificador propio ni protocolo de terapeuta. npm funciona; no asumas instalaciones o fallos de herramientas de otro proyecto.

## 2. Autonomía autorizada

El usuario estará ausente y revisará en la mañana. No le pidas confirmaciones rutinarias, elección de variantes, validaciones visuales, revisión de cada bloque ni permiso para continuar. Decide detalles reversibles de diseño, organización, implementación, dependencias necesarias y contratos compatibles con el esquema existente. Documenta el motivo y las suposiciones relevantes. Esta autorización actual prevalece sobre instrucciones locales anteriores que pidan preguntar por esas decisiones rutinarias.

Si falta información, elige una opción conservadora dentro del alcance aprobado y sigue. Si una tarea requiere credenciales, acciones remotas, consentimiento de un usuario real o una capacidad que no puedes verificar, registra el bloqueo y avanza con otro bloque independiente. No conviertas la falta de Google/SMTP o de una sesión real en una razón para dejar de desarrollar toda la aplicación. Tampoco finjas que están verificados.

Esta autonomía no autoriza gastos, cambiar la arquitectura aprobada sin necesidad, destruir datos, eludir controles de seguridad, aplicar migraciones remotas, modificar cuentas Google/Supabase/Vercel ni publicar. Cumple cualquier permiso obligatorio de la plataforma; si una acción no está permitida, elige una alternativa local. No crees otras conversaciones ni programes automatizaciones para sustituir el trabajo de esta tarea.

## 3. Primero: producto premium con identidad propia

Revisa la web pública y el recorrido dentro de la app. Implementa mejoras, no te limites a describir defectos. Prioriza coherencia y claridad en Inicio, Mi espacio, análisis, alineamiento, acceso/registro/recuperación y Ajustes. Privacidad y condiciones deben seguir siendo públicas y legibles.

La esencia es explorar proteínas: secuencias, residuos, perfiles, comparación y un banco de trabajo científico comprensible. Usa lenguaje cotidiano y explicaciones cerca de las acciones. El visitante debe entender qué puede hacer, cómo empezar y qué significa su resultado. Mantén separada la presentación pública de la app.

Busca una SaaS premium: tipografía cuidada, jerarquía clara, espaciado preciso, composición deliberada, superficies consistentes, estados completos y detalles de interacción. Conserva el logo, las fuentes locales Bricolage/Atkinson/Plex, los tokens y la dirección marfil/azul profundo con verde, salvo ajustes pequeños justificados. No rediseñes todo por preferencia genérica ni llenes la interfaz de tarjetas.

Da vida con animaciones fluidas y discretas: transiciones, entradas, estados de cálculo y respuesta a acciones. Respeta movimiento reducido, pausa elementos fuera de pantalla y evita bucles pesados o animaciones que dificulten leer. Reutiliza CSS y mecanismos existentes antes de introducir librerías.

Decoración vinculada al producto mediante recursos existentes, SVG propios, perfiles reales y motivos de secuencias. No uses imágenes generadas por IA ni adornos de apariencia genérica: auroras, brillos excesivos, blobs, gradientes gratuitos, frases vacías o paneles con datos inventados. No confundas un motivo ornamental con una estructura molecular real. No inventes testimonios, usuarios, métricas ni capacidades para dar apariencia de SaaS.

Usa los skills de frontend/21st aplicables y componentes del proyecto. Ya existe autorización para enviar código/contexto del proyecto a 21st, nunca secretos o datos privados. No compres créditos ni uses generación de pago. No aplaces la implementación esperando que el usuario elija una propuesta.

Termina una mejora visual coherente de todo el recorrido y pasa a funcionalidad. No gastes toda la sesión moviendo píxeles, generando opciones o repitiendo capturas.

## 4. Después: capacidades reales, en orden útil

Estado de partida: editor/FASTA, descriptores/perfil en Workers, Gotoh/BLOSUM en WASM, borradores en memoria, CSV local, cuenta REST de Supabase, cliente health/me y páginas legales están implementados. El backend tiene health/me, cinco tablas previstas y auditoría RLS estática. No hay CRUD de proyectos implementado. Los despliegues respondieron health/CORS; eso no demuestra una sesión válida ni seguridad PostgreSQL. SMTP/Google han sido configurados por el usuario o están en proceso: comprueba el estado disponible sin pedirle una demostración. No supongas que faltan `.env`: existen y se leen sin mostrar sus valores.

1. **Proyectos personales como prioridad funcional.** Implementa guardar, listar, abrir, renombrar, actualizar y eliminar sobre los contratos previstos y el esquema existente. Elige payloads y validaciones coherentes en ambos repositorios y documéntalos. Autoriza por propietario, usa RLS real para acceso a datos y conserva concurrencia optimista con 409. Integra resultados actuales y reanudación tras recargar. No guardes resultados desactualizados ni anuncies persistencia inexistente. Comprueba aislamiento entre usuarios con PostgreSQL/Supabase local si está disponible; un mock o una inspección de SQL no demuestra RLS. Si falta infraestructura local, prepara el código y las pruebas reproducibles, registra el límite y sigue con tareas independientes. No uses service_role para saltarte las políticas de recursos del usuario.
2. **Datos y estructura experimental.** Avanza con catálogo trazable, UniProt y visor Mol* bajo demanda según decisiones existentes. Usa datos públicos reales, referencias, cobertura y estados de error. Mantén la procedencia de estructuras experimentales/predichas. No inventes coordenadas 3D.
3. **Informes reproducibles.** Amplía exportación local, PDF, perfil/alineamiento y métodos cuando corresponda, sin perder el CSV vigente ni enviar datos por sorpresa.
4. **Generación, predicción e interpretación.** Continúa solo sobre el alcance de RF-17/RF-18 y el asistente definido. Puedes elegir decisiones de implementación revisables y parámetros configurables, respaldados por referencias. No inventes requisitos científicos ni promesas biológicas para resolver una ambigüedad. Mantén generador y asistente separados; la predicción externa requiere consentimiento explícito, validación, procedencia, caché y fallos reales. Si ese bloque depende de una decisión científica/servicio que no puedes justificar, desarrolla otro bloque autorizado y deja una propuesta concreta pendiente.

Completa recorridos verticales útiles antes de abrir muchos módulos a medias. Actualiza privacidad/condiciones cuando cambie de verdad el tratamiento de datos. No marques «terminado» un entregable que necesita base remota aún no migrada o pruebas pendientes.

## 5. Buenas prácticas

Código, comentarios, nombres y commits en inglés; interfaz y documentación en español. Textos en `src/i18n/es.ts`; el catálogo inglés actual deriva de él y está marcado como pendiente: no inventes una estructura de traducción distinta. Usa tokens CSS, constantes/configuración por característica y componentes comunes.

TypeScript estricto, responsabilidades claras, validación en límites, errores explícitos, cancelación de peticiones y prevención de estados desactualizados. Cómputo pesado en Workers/WASM. Conserva virtualización, fuentes/canvas, editor superpuesto, algoritmos, cancelación, PWA y COOP/COEP. Dependencias nuevas solo cuando sean necesarias, gratuitas, con versión fija y lockfile; consulta fuentes oficiales, explica el motivo en docs y evita cambiar de stack.

No expongas `.env`, tokens, contraseñas, secuencias privadas o claves de servidor en logs, commits, prompts externos ni variables `VITE_`. No rebajes CORS/CSP/RLS para hacer que una prueba pase. No apliques migraciones a Supabase remoto. No actives planes de pago ni pidas tarjeta.

## 6. Pruebas necesarias, sin exceso

Durante el trabajo, ejecuta lint/tipos y pruebas enfocadas en los módulos afectados. Añade pruebas para riesgo real: propiedad/autorización/RLS, contratos, resultados científicos, persistencia, conflictos y regresiones importantes. No escribas pruebas que solo reproduzcan textos, constantes o detalles internos, ni suites para cada cambio de estilo.

Revisa las pantallas afectadas a 360/1280 px, claro/oscuro, foco/teclado, contraste, controles de 44 px y movimiento reducido. E2E solo para recorridos cambiados; usa una muestra proporcional, no una matriz enorme de combinaciones redundantes. PWA solo cuando cambien recursos, Workers o caché. No debilites umbrales ni aumentes tiempos para ocultar fallos.

Al cerrar cada bloque sustancial verifica lo pertinente; la batería compartida completa y build una vez al cierre global cuando corresponda. Repite únicamente tras nuevos cambios, fallos o dudas concretas. Backend usa `.venv/Scripts/python.exe -m unittest discover -s tests -v`, no pytest. Runtime objetivo 3.14; entorno local previamente probado con 3.13, no certifiques una versión que no ejecutaste. Frontend usa los scripts npm existentes. Conserva evidencia real y distingue simulación, comprobación local y comprobación remota.

## 7. Git y limpieza

Trabaja por defecto en `dev` de cada repositorio. Puedes crear una rama local corta desde `dev` solo si una modificación arriesgada necesita aislamiento; no crees una rama por cada bloque ni muevas trabajo ajeno. Mantén `main` como versión estable y no hagas merges ni reescribas historia.

Haz commits pequeños y completos por intención: UI, capacidad funcional, contratos/migraciones, documentación. Revisa diff y verificaciones antes de cada commit. Usa Conventional Commits en inglés, sin firma, coautoría ni referencias a IA. No juntes cambios ajenos ni ocultes trabajo incompleto en un commit que diga «finished».

**Nunca hagas push, despliegues, merges remotos, force push ni cambios de configuración remota.** Las ramas y commits son locales; el usuario decidirá publicarlos. No versiones builds, dependencias, artefactos, datos grandes o secretos. Respeta la excepción WASM generada y las exclusiones locales de AGENTS/progreso.

El usuario autoriza eliminar ramas locales fusionadas y sobrantes. Antes comprueba que sean ancestros de `dev`, que no estén activas ni usadas por un worktree y que no sean `main`/`dev`. Usa eliminación segura (`git branch -d`), nunca fuerza. Si solo quedan las ramas necesarias, consérvalas. No borres `.env`, evidencias útiles ni cambios ajenos para aparentar limpieza. Al finalizar deja limpios los árboles versionados mediante commits coherentes del trabajo completado.

## 8. Relevo y cierre

Actualiza el progreso local de ambos repositorios cuando los afectes; conserva historia y mantén un resumen vigente. Actualiza decisiones, pantallas, API y plan según los cambios reales. No fuerces archivos locales excluidos al índice.

Al finalizar informa: capacidades terminadas, decisiones tomadas, commits por repositorio, verificaciones reales, límites/bloqueos y el siguiente trabajo prioritario. La revisión del usuario será en la mañana; no cierres con preguntas rutinarias ni pidas validación para seguir. Si hay una acción externa pendiente, entrega sus pasos concretos sin ejecutarla.

Empieza leyendo el contexto, resume brevemente el objetivo y ejecuta la mejora visual. Cuando esté coherente, continúa con los proyectos personales y el resto del trabajo autorizado. Prioriza implementación comprobable y sostenida sobre planificación, pruebas repetidas o documentación de capacidades que aún no existen.
