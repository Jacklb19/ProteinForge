# Relevo de desarrollo — ProteinForge

Actualizado el **22 de octubre de 2026**, al cerrar un bloque local de correcciones, rendimiento y propuestas. Sustituye el relevo anterior, conservado en Git. Las instrucciones actuales del propietario y los AGENTS.md aplicables prevalecen; este contexto no amplía autorizaciones remotas.

---

Continúa desde el estado existente. Implementa y verifica el siguiente bloque local autorizado; no rehagas lo terminado, no detengas todo por un pendiente externo y no inventes autorizaciones.

## Workspace y lectura

Ruta: C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge. Raíz sin Git; `frontend/` y `backend/` tienen repositorios independientes. Trabaja en `dev` de cada uno, conserva los cambios del propietario, no muevas `.git` ni añadas repositorios anidados.

Lee completo este archivo, AGENTS.md de raíz y de ambos repositorios, las últimas entradas de **docs/PROGRESS.md de ambos** y revisa rama/status/log. Después, según lo que vayas a tocar: frontend `docs/plan-desarrollo.md`, `docs/laboratory.md`, `docs/laboratory-projects.md`, `docs/pantallas.md` y `docs/diseno-visual.md`; backend `docs/api.md`, `docs/uniprot.md`, `docs/project-persistence.md` y `docs/arquitectura.md`.

Algunos documentos conservan párrafos históricos «local», «sin publicar» o «migración pendiente». El progreso más reciente y este relevo corrigen esos estados; no reabras entregas completadas por leer una captura antigua.

## Reglas vigentes

Responde en español; código, comentarios y commits en inglés. Autor y committer exclusivamente **Jacklb19 <jose.burbanob@campusucc.edu.co>**, sin coautores, firmas ni menciones a agentes o IA en commits, merges o GitHub. Commits pequeños y revisados; comprueba identidades y trailers antes de publicar.

Interfaz bilingüe: español e inglés juntos en `src/i18n/es.ts` y `en.ts`. Conserva tokens, química de residuos, foco/teclado, 44 px y la matriz 360/1280 en ambos temas. A · Mesa de estructura, Proyectos y el formulario de guardado ya están aprobados. Una interfaz sustancialmente nueva necesita propuesta maquetada y elección del propietario.

Costo cero, sin tarjeta. No instales ni ejecutes Torch, ProteinMPNN, ESMFold u otros modelos en Windows; las inferencias comprobadas fueron en Colab T4. No versiones AGENTS.md, docs/PROGRESS.md, docs/propuestas.md, secretos, `.env`, temporales, artefactos ni modelos.

## Estado publicado

Publicación del 21 oct completada y verificada; **no hay nada nuevo publicado desde entonces**.

- Frontend: https://protein-forge.vercel.app — `main` cc8990d81b9d119d013de9d22b8e2614753078c8.
- Backend: https://protein-back.vercel.app — `main` cc64b4e3093bb30779062f00ce8894e4805fca9c.
- Migraciones aplicadas por el propietario, incluida `20261021000000_laboratory_projects.sql`. **No pedir repetirlas.**

Lo que está en producción: laboratorio en `/generate/lab`, colección en `/projects`, CRUD de proyectos por gRPC-Web con REST conservado, UniProt autenticado, cuentas con correo y Google. `DesignService v1alpha1` sigue siendo borrador sin ejecutor.

El 22 oct se comprobó con la cuenta del propietario que «Abrir comparación» recupera la alineación humana/bovina con sus parámetros (Global/BLOSUM80, 88/110, identidad 80 %, similitud 81,8 %, puntuación 733). Eso acredita lectura/apertura autenticada real, **no** CRUD completo del laboratorio, aislamiento de dos propietarios ni conflictos de dos pestañas.

## Terminado en el bloque local del 22 oct (sin publicar)

Catorce commits en frontend `dev` y seis en backend `dev`, todos con autoría exclusiva del propietario.

- **Corregido**: tras recargar, «Abrir laboratorio» de un proyecto guardado se quedaba en Proyectos (3 de 4 veces) porque la carga del ejemplo integrado se tomaba por trabajo nuevo del usuario. `LabState.replaceable` distingue ahora lo que no pierde trabajo. 5 de 5 correctas después.
- **Corregido**: si el archivo del cliente de Proyectos no se podía descargar, el proveedor quedaba bloqueado para toda la sesión sin avisar. Ahora informa, libera el bloqueo y reintenta.
- **CI de navegador**: reproducido en contenedor Linux limpio con `CI=true`; con dos trabajadores fallaban alineamiento, biblioteca y perfil por falta de CPU. Ahora CI usa un trabajador y `run-e2e.mjs` precalienta el grafo de módulos. **Contenedor en verde: 87 correctos, 0 fallos.** No se debilitó ninguna aserción ni tiempo. La causa exacta de la ejecución remota 39721928591 sigue sin log.
- **Rendimiento**: pantallas secundarias y cliente de Proyectos fuera de la primera carga; paquete de entrada de 743 kB a 492 kB (gzip 226 → 151).
- **Nuevo estado**: si una pantalla no puede mostrarse, se dice en ambos idiomas y se ofrece recargar, en vez de quedar en blanco.
- **Backend**: presupuesto de consultas a UniProt por identidad (`UNIPROT_REQUESTS_PER_MINUTE`, 20 por omisión), compartido entre REST y gRPC-Web, que responde 429 antes de llamar al proveedor y solo se gasta con consultas válidas. Contadores por proceso, no cuota global.
- **Legibilidad**: laboratorio, generador, biblioteca y colección dejan de tener líneas JSX de hasta 1.600 caracteres; el laboratorio delega en `LabInspector` y `LabVariantsTable`, con el mismo marcado.
- **Plurales**: siete textos tienen forma singular en ambos catálogos.

## Decisiones que te esperan

Cuatro propuestas escritas, ninguna implementada ni autorizada. Cada una termina en la decisión concreta que se pide:

1. [Forma de novo en Colab](de-novo-proposal.md): monómero de 60–100 residuos, tres sesiones de dos horas, RFdiffusion + cuaderno actual, criterios RMSD < 2 Å, pLDDT > 80, pTM > 0,7 y reproducibilidad. Licencias: el README de RFdiffusion declara BSD para el código pero no para los pesos; el `LICENSE.md` de Foundry no se pudo leer el 22 oct.
2. [Inferencia desde la aplicación](app-inference-proposal.md): ejecutor, contrato de `DesignService`, consentimiento y prueba exigida. Un túnel sobre Colab gratuito queda descartado por sus condiciones.
3. [RF-18 y persistencia](prediction-storage-proposal.md): proveedor, dónde se guarda, retención y cuotas.
4. [Asistente de interpretación](assistant-proposal.md): resumen determinista local frente a Groq.

Mientras no haya acuerdo, el recorrido manual (laboratorio → cuaderno → Colab → importar ZIP validado) sigue siendo el camino comprobado.

## Siguiente desarrollo

1. Audita brevemente el estado y completa un bloque local con requisitos definidos. No dediques otra conversación entera a planificar ni a rehacer Proyectos, laboratorio, correo o inglés.
2. Corrige defectos **reproducidos** y verifica los recorridos afectados. No cambies contrato ni semántica de guardado por un fallo no reproducido.
3. Siguen preparados los casos reales de [activación](laboratory-activation.md): crear, abrir, editar, renombrar, copiar y borrar, recarga, dos pestañas y dos propietarios. Crear o borrar datos reales requiere alcance específico y la sesión del propietario; avanza localmente si no está disponible.
4. Publicar (push, merge, despliegue), SQL remoto, servicios nuevos o gastos necesitan autorización expresa del propietario para esta entrega.

## Evidencia y reproducción

Frontend: 348 unitarias en 64 archivos; cobertura ≈84 % statements / 74 % branches / 82 % functions / 88 % lines, mínimo 70 % intacto. Tipos, lint, build y `check:pwa` correctos. Chrome local: batería completa 87 correctos, 2 omitidos, 0 fallos, y repeticiones dirigidas. Contenedor Linux con `CI=true`: 87 correctos, 2 omitidos, 0 fallos. Auth y RPC simulados; no hay sesión real ni otros navegadores certificados.

Backend: 61 pruebas (12 SQL omitidas sin base). Las 12 pruebas SQL reales con PostgreSQL 18 temporal siguen siendo válidas y no se repitieron porque este bloque no toca esquema, políticas ni acceso a datos.

Comandos: frontend `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run check:pwa`; E2E `E2E_PORT=5190 E2E_WORKERS=1 node scripts/run-e2e.mjs --reporter=line`. Backend `.venv/Scripts/python.exe -m unittest discover -s tests -v`; SQL real con `scripts/test-postgres.ps1`. Para reproducir el CI de navegador: contenedor `node:24` con `CI=true`, clon de `dev`, `npm ci`, `npx playwright install --with-deps chromium` y `npm run test:e2e`.

Windows: Vitest necesita `TEMP`/`TMP` bajo `frontend/tmp/vitest`; Chrome y el servidor de vista previa necesitan ejecutarse fuera del aislamiento para alcanzar localhost, con permiso y sin cambiar flags de seguridad.

Al cerrar, distingue siempre implementado, probado localmente, comprobado en producción y pendiente de decisión. No crees otro repositorio ni otra conversación por cuenta propia.
