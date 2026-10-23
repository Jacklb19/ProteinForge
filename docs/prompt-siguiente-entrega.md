# Relevo de desarrollo — ProteinForge

Actualizado el **23 de octubre de 2026**, a mitad de la implementación del asistente de interpretación. Sustituye al relevo anterior, conservado en Git. Las instrucciones actuales del propietario y los AGENTS.md aplicables prevalecen; este contexto no amplía autorizaciones remotas.

---

Continúa desde el estado existente. Hay trabajo **sin confirmar** en el frontend: léelo antes de tocar nada.

## Workspace y lectura

Ruta: `C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge`. Raíz sin Git; `frontend/` y `backend/` tienen repositorios independientes. Trabaja en `dev` de cada uno, conserva los cambios del propietario, no muevas `.git` ni añadas repositorios anidados.

Lee completo este archivo, `AGENTS.md` de la raíz y de ambos repositorios, y las últimas entradas de `docs/PROGRESS.md` de los dos. Después, según lo que toques: frontend `docs/assistant-ui-proposal.md`, `docs/laboratory-activation.md`, `docs/diseno-visual.md`, `docs/pantallas.md`; backend `docs/assistant.md`, `docs/api.md`, `docs/arquitectura.md`.

## Reglas vigentes

Responde en español; código, comentarios y commits en inglés. Autor y committer exclusivamente **Jacklb19 <jose.burbanob@campusucc.edu.co>**, sin coautores, firmas ni menciones a agentes o IA en commits, merges o GitHub; compruébalo antes de cada commit y antes de publicar.

Interfaz bilingüe: cada texto visible va a `src/i18n/es.ts` y `en.ts` en el mismo cambio. Nada quemado en código: opciones, límites y medidas van a `config.ts` de cada característica o a `design-tokens.css`. Una interfaz sustancialmente nueva necesita maqueta aprobada por el propietario antes de programarse; la del asistente **ya está aprobada** (dirección A, revisada).

Costo cero, sin tarjeta. No instales ni ejecutes Torch, ProteinMPNN, ESMFold ni otros modelos en Windows. No versiones `AGENTS.md`, `docs/PROGRESS.md`, `docs/propuestas.md`, secretos, `.env`, temporales ni `artifacts/`.

**Publicar (push, merge, despliegue), SQL remoto, servicios nuevos o gastos necesitan autorización expresa del propietario, pedida en el momento.**

## Estado publicado

- Frontend: <https://protein-forge.vercel.app> — `main` **9fc20e8**, `dev` **3c7c1cf**.
- Backend: <https://protein-back.vercel.app> — `main` **9d5528d**, `dev` **16b5c7a**.
- CI en verde en las cuatro ramas y Vercel desplegado. Migraciones ya aplicadas por el propietario, incluida `20261021000000_laboratory_projects.sql`. **No pedir repetirlas.**

## Hecho el 22–23 oct

**Recorrido real del laboratorio en producción** con las cuentas del propietario. Seis de siete casos correctos; «dos propietarios» quedó correcto solo en parte (B no ve ni encuentra los proyectos de A; falta la lectura directa por ID con sesión de B, que el propietario no ha autorizado). Todos los proyectos «Prueba» se borraron. Detalle en `frontend/docs/laboratory-activation.md`. De ahí salieron dos defectos de interfaz, corregidos y **ya publicados** (`89696dd`, `6334fc7`, `3c7c1cf`).

**Asistente de interpretación**, decidido por el propietario: opción B de `assistant-proposal.md`, con Groq y `openai/gpt-oss-120b`; acepta expresamente que los datos salgan al proveedor. `GROQ_API_KEY` ya existe en `backend/.env` (solo se comprobó que está; no se mostró).

## Sin publicar: backend, 5 commits en `dev`

`58329a6` feat(assistant), `569ce52` docs, `049fd47`, `63d9dcd`, `9f3a044` fix.

`POST /v1/assistant/interpret` y `proteinforge.assistant.v1.AssistantService/Interpret`, equivalentes y sobre la misma función de dominio. Recibe tema (`analysis`/`alignment`/`laboratory`/`candidates`), idioma, 1–80 datos etiqueta/valor/unidad y secuencia opcional; devuelve texto, modelo, proveedor y fecha. Presupuesto por identidad `ASSISTANT_REQUESTS_PER_MINUTE` (6). El prompt lleva reglas y un glosario de las medidas, y la API **verifica cada cifra** del texto: si cita una que no estaba en los datos, se descarta con 502 `assistant-unverified-figure`. Contrato y límites en `backend/docs/assistant.md`. **70 pruebas en verde** (12 SQL omitidas sin base). Buf lint y breaking contra `main` correctos.

Tres defectos encontrados con llamadas reales a Groq y ya corregidos: el verificador tumbaba el umbral 40 que enseña el propio glosario; el modelo extendía los descriptores a solubilidad y agregación; y el texto llegaba como dos párrafos densos.

## Sin publicar: frontend, 2 commits + **trabajo sin confirmar**

Commits: `856075d` y `fc7b6b8`, los dos de documentación (`docs/assistant-ui-proposal.md`).

**Sin confirmar en el árbol de trabajo** (esto es lo primero que hay que cerrar):

- `src/features/assistant/`: `config.ts`, `assistantApi.ts`, `facts.ts`, `useReading.ts`, `ReadingSection.tsx`, `Reading.test.tsx`.
- `src/gen/proteinforge/assistant/`: cliente generado con `npx buf generate ../backend/proto`.
- `e2e/assistant.spec.ts` nuevo.
- Modificados: `src/features/editor/EditorPage.tsx`, `src/features/design-lab/DesignLabPage.tsx` y su `.test.tsx` (ahora envuelve `AuthContext`), `src/i18n/es.ts` y `en.ts`, `src/index.css`, `src/design-tokens.css`, `src/test/grpcWeb.ts` (añade `resourceExhausted: 8`).

Qué hace: un bloque **Lectura de los resultados** al pie de Analizar y del Laboratorio. Envía solo las cifras que la pantalla ya muestra, con sus etiquetas y su formato de idioma; **nunca la secuencia**. Al lado del texto lista «Cifras que se enviaron», para contrastar la lectura con los datos. Una lectura pertenece a su revisión: si cambian las cifras o el idioma, deja de mostrarse. En el laboratorio, un borrador editado no manda las cifras de la predicción anterior.

Verificado: tipos, lint, **355 unitarias en 65 archivos** (cobertura 84,5 / 75,06 / 81,91 / 87,67), build, y **las 7 E2E de `assistant.spec.ts` en verde**, con AA y 360/1280 en ambos temas. Capturas en `artifacts/assistant-reading-{360,1280}-{light,dark}.png`.

### Lo siguiente, en orden

1. **Ejecutar las E2E de los recorridos afectados**, que quedó a medias: `E2E_PORT=5190 E2E_WORKERS=1 node scripts/run-e2e.mjs e2e/assistant.spec.ts e2e/laboratory.spec.ts e2e/editor-design.spec.ts e2e/projects.spec.ts e2e/reports.spec.ts --reporter=line`. Solo se comprobó `assistant.spec.ts`; **las demás no**.
2. Confirmar el trabajo del frontend en commits pequeños (cliente y módulo, interfaz y textos, pruebas, E2E) con la autoría verificada.
3. Actualizar `frontend/docs/` con lo implementado y añadir entrada a `docs/PROGRESS.md` de ambos repositorios.
4. Pedir autorización para publicar.

### Aviso importante sobre CI del frontend

El paso «Check generated RPC code is current» ejecuta `npx buf generate`, que lee `buf.gen.yaml` y genera **desde el commit del backend fijado ahí** (`5b6c4505c77293e1f4798e0bd86932e13c11600f`), que **no tiene** el contrato del asistente. Con los stubs nuevos dentro, ese paso fallaría.

Por eso, al publicar: **primero el backend** (push de `dev` y merge a `main`), después **repinchar `buf.gen.yaml`** al commit nuevo del backend, **regenerar** con `npx buf generate` y confirmar ese cambio, y solo entonces publicar el frontend. Sin esa secuencia, CI del frontend se pone en rojo.

## Decisiones abiertas

1. **NVIDIA.** Sus API alojadas de RFdiffusion, ProteinMPNN y ESMFold son gratuitas, pero el FAQ oficial dice que el acceso del Programa de Desarrolladores es «for prototyping, research, development and testing purposes only» y define producción como cualquier uso que no sea desarrollo, pruebas, investigación o evaluación, «including activity serving real end-users»; producción exige licencia de NVIDIA AI Enterprise, de pago. El propietario pregunta si vale porque la web es solo de investigación y no se vende: **el criterio de NVIDIA no es el dinero sino servir a usuarios reales**, así que una web pública abierta encaja en producción aunque sea académica. Sin resolver: leer los *API Trial Terms of Service* completos (no se pudieron descargar; el enlace está en cada ficha de modelo de build.nvidia.com) y decidir si se limita la inferencia al propietario. Entrar al programa es gratis y basta un correo; no consta verificación de identidad ni tarjeta.
2. **GPU gratuita**: no existe ninguna que se pueda dejar encendida detrás de la web. Kaggle (30 h/semana), Baidu AI Studio (100 h/mes, V100 32 GB), Alibaba PAI-DSW, Hugging Face ZeroGPU (5 min/día gratis) son cuadernos interactivos, como Colab. SageMaker Studio Lab cerró a usuarios nuevos.
3. Siguen abiertas, sin implementar: [forma de novo en Colab](de-novo-proposal.md), [inferencia desde la aplicación](app-inference-proposal.md) y [persistencia de predicciones](prediction-storage-proposal.md). El propietario quiere inferencia inmediata desde la app; las únicas vías reales siguen siendo su PC (RTX 4060 de 8 GB, al límite: ESMFold marcó 7,91 GiB con 76 residuos) o GPU de pago.

## Entorno local

Puerto 5173 ocupado por otro proyecto. Vista previa del frontend en **5187** (`.claude/launch.json`), E2E en **5190** con un trabajador. API local en **5296** (`frontend-local-api`); el 8000 lo ocupa otra herramienta.

**Puede haber quedado un `uvicorn` corriendo en 5296**: compruébalo y ciérralo si no lo necesitas.

Comandos: frontend `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run check:pwa`. Backend `.venv/Scripts/python.exe -m unittest discover -s tests -v`; SQL real con `scripts/test-postgres.ps1`. Vitest en Windows necesita `TEMP`/`TMP` bajo `frontend/tmp/vitest`. `gh` no está instalado: usa `git` y la API pública de GitHub con `curl`. No edites `src/` mientras corren las E2E.

Para maquetas: `python -m http.server 5291` desde `frontend/` y `node artifacts/<carpeta>/render.mjs http://127.0.0.1:5291 artifacts/<carpeta>`, que usa el Chrome del sistema. El navegador integrado no abre `file://` ni localhost propio; para maquetar sobre la app real, inyecta el bloque con JavaScript en producción y captura.

Al cerrar, distingue siempre implementado, probado localmente, comprobado en producción y pendiente de decisión. No crees otro repositorio ni otra conversación por cuenta propia.
