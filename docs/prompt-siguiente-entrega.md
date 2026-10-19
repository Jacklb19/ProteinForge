# Prompt del siguiente sprint — ProteinForge

> Escrito el 19 oct 2026, después de publicar gRPC en producción. Sustituye al relevo anterior (consultable en el historial de Git). Copia desde «Eres el agente…» hasta el final en una conversación nueva.

---

Eres el agente de desarrollo de ProteinForge. Continúa el proyecto existente con trabajo real y verificado: no termines tras presentar un plan ni tras una mejora superficial. Este sprint tiene un objetivo principal (sección propia de Proyectos con tarjetas y vistas previas) y dos secundarios (correo de confirmación y deuda pendiente).

## 1. Contexto

Workspace Windows: `C:\Users\josel\Desktop\U\semestre7\ProgramacionAWeb\ProteinForge`. La carpeta no tiene Git; contiene dos repositorios independientes:
- `frontend/` ([Jacklb19/ProteinForge](https://github.com/Jacklb19/ProteinForge)): React 19, TypeScript estricto, Vite, Workers, Rust/WASM. Producción: https://protein-forge.vercel.app (se publica desde `main`).
- `backend/` ([Jacklb19/Protein_Back](https://github.com/Jacklb19/Protein_Back)): FastAPI + servicios gRPC (connectrpc), Supabase. Producción: https://protein-back.vercel.app (desde `main`).

Lee antes de editar: `AGENTS.md` (raíz y de cada repo), `docs/PROGRESS.md` de ambos (entradas del 15 al 19 oct), `frontend/docs/grpc.md`, `frontend/docs/pantallas.md`, `frontend/docs/diseno-visual.md`, `frontend/docs/projects.md`, `backend/docs/api.md` y las migraciones de `backend/supabase/migrations/`. Revisa `git status`, rama y log en ambos.

Estado vigente (verificado el 19 oct):
- La web habla con la API **solo por gRPC-Web** (`src/features/api/rpc.ts`, código generado en `src/gen/` desde `backend/proto` con `buf.gen.yaml`, ref fija al commit del backend). El backend sirve `AccountService`, `ProjectService` y `ReferenceService` por gRPC-Web, Connect y gRPC nativo, y **conserva REST** (requisito del profesor). `DesignService` (`v1alpha1`) es un borrador sin implementar.
- Producción probada por el usuario con su cuenta: guardar, abrir, renombrar y borrar proyectos y la búsqueda UniProt funcionan.
- Supabase: migraciones `20260928`, `20261012` y `20261019_backfill_profiles` aplicadas por el usuario. Cada proyecto pertenece a una fila de `profiles`.
- CI en verde en ambos repos (frontend: tipos, lint, unitarias, build, E2E; WASM reproducible; backend: pruebas + `buf lint` + código generado al día).
- Los proyectos hoy se listan dentro de **Perfil** (`src/features/projects/ProjectLibrary.tsx`), como una lista simple.

## 2. Reglas que no se negocian

1. **Autoría:** en commits, merges y GitHub solo aparece el propietario (Jacklb19). Nunca líneas `Co-Authored-By`, menciones a agentes o IA. Verifica autor, committer y trailers antes de cada push.
2. **Ramas:** trabaja en `dev` de cada repo. Push a `dev` autorizado. **Merge a `main` (= producción) solo cuando el usuario lo diga explícitamente.**
3. **Interfaz bilingüe:** cada texto visible se escribe en español (`src/i18n/es.ts`) y en inglés (`src/i18n/en.ts`) en el mismo cambio.
4. **Interfaz con aprobación previa:** antes de escribir código de interfaz, presenta **dos propuestas en maquetas PNG** (capturas reales a 360 px y 1280 px, tema claro y oscuro) y espera a que el usuario elija. Sin aprobación no hay código de UI.
5. **Sin valores fijos en el código:** límites, tamaños, rutas, URLs y opciones viven en módulos `config.ts`, tokens de `design-tokens.css` o i18n, tanto en frontend como en backend.
6. **Dependencias nuevas:** solo con visto bueno del usuario y versión fija.
7. **Contratos:** los `.proto` viven en el backend. Cambios solo compatibles (campos nuevos con números nuevos; nunca renumerar ni cambiar tipos). `buf lint` y `buf breaking` contra `main` deben pasar; después regenera Python (`backend`) y TypeScript (`frontend`, actualizando la `ref` de `buf.gen.yaml`).
8. **Accesibilidad y diseño:** contraste AA, objetivos de 44 px, foco visible, sin desbordamiento horizontal a 360 px, movimiento reducido respetado. Dirección visual: mostrar proteínas, no la app; nada de aspecto de plantilla de IA.
9. **Seguridad:** nunca `service_role` ni secretos en el cliente o en commits; no imprimas `.env`. Errores con códigos estables, sin devolver datos del usuario.

## 3. Objetivo principal — sección «Proyectos»

El usuario pide: *los proyectos no deben estar en Perfil sino en su propia sección, bonitos, con tarjetas y vistas previas.*

**Alcance:**
- Nueva sección y ruta propias (por ejemplo `/projects`) en la barra principal y en el menú del móvil, visibles con sesión; sin sesión, una invitación clara a iniciar sesión o crear cuenta. Perfil conserva cuenta, preferencias y datos, con un enlace a Proyectos en lugar de la lista.
- **Tarjetas** con vista previa del contenido científico real, sin inventar datos. Candidatas (decide con las maquetas):
  - cinta de secuencia en miniatura coloreada por química (reutiliza `SequenceRibbon`/`chemistry`),
  - longitud, masa, pI y GRAVY guardados,
  - si hay comparación: identidad y similitud en %, matriz y modo,
  - origen (catálogo / UniProt + accesión) y fecha de actualización relativa y localizada.
- Acciones por tarjeta: abrir (en Analizar o Alinear según el contenido), renombrar, duplicar (crear copia), borrar con confirmación deliberada. Conserva el control de concurrencia (`expected_update_time`, conflicto → `ABORTED`).
- Búsqueda por nombre y orden (recientes / nombre), estado vacío útil, estados de carga y error con las categorías existentes de `ApiError`, paginación con `nextPageToken`.
- Responsive (rejilla de tarjetas en escritorio, una columna en móvil), ambos temas, teclado completo.

**Datos para la vista previa:** hoy `ListProjects` devuelve solo `ProjectSummary` (id, nombre, estado, fechas). Elige y justifica una opción:
- (a) añadir a `ProjectSummary` un mensaje `ProjectPreview` ligero (longitud, masa, pI, GRAVY, identidad, origen y quizá unas decenas de residuos para la cinta), calculado en el servidor desde el snapshot guardado. Cambio compatible del contrato y una consulta/RPC en Supabase que no traiga el snapshot completo; o
- (b) que el cliente pida cada proyecto con `GetProject` (más tráfico, más sencillo).
Recomendación por defecto: (a), sin enviar secuencias completas en la lista. Si requiere una migración nueva, escríbela idempotente con RLS y pruebas en PostgreSQL local (`backend/scripts/test-postgres.ps1`), y **pide al usuario que la aplique**: no apliques migraciones remotas.

**Proceso obligatorio:** auditoría breve → dos propuestas en maqueta → elección del usuario → plan corto → implementación → capturas reales y lista de comprobación → actualizar `docs/pantallas.md`, `docs/projects.md` y `PROGRESS.md`.

## 4. Objetivos secundarios

1. **Correo de confirmación que no llega.** El usuario configuró un SMTP propio en Supabase, pero el correo no llega. No tienes acceso a su proyecto de Supabase: guía al usuario para revisar Supabase → Logs → Auth (errores SMTP como `535`), los datos de Gmail (host `smtp.gmail.com`, puerto 465/587, contraseña de aplicación, remitente igual al usuario), los límites de envío y las URLs de redirección. Documenta el resultado en `frontend/docs/conectar-supabase.md`. Nunca pidas ni manejes contraseñas.
2. **Deuda pendiente si sobra tiempo:**
   - El laboratorio de diseño (`docs/design-lab-roadmap.md`) necesita primero una prueba real de cálculo (forma → secuencia → predicción) y maquetas aprobadas; no escribas su interfaz sin ellas.
   - `DesignService` sigue en borrador; no lo implementes sin esa prueba.

## 5. Verificación antes de entregar

- Frontend: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run check:pwa`, E2E afectadas con `E2E_PORT=5190 E2E_WORKERS=1 node scripts/run-e2e.mjs …` (no edites `src/` mientras corren). Los mocks E2E de la API usan el formato gRPC-Web real (`e2e/rpc.ts`, `src/test/grpcWeb.ts`).
- Backend: `python -m unittest discover -s tests`; con contrato nuevo, `buf lint`, `buf breaking`, `buf generate` y pruebas RPC en `tests/test_rpc.py`.
- Si cambias el paquete WASM: `npm run build:wasm:linux` (Docker), nunca la compilación de Windows.
- CI remota en verde tras el push (lee los runs con la API pública de GitHub; `gh` no está instalado).
- Prueba en navegador real (panel integrado) con capturas a 360 y 1280 px en ambos temas.

## 6. Entrega

Commits pequeños en inglés. Push a `dev` en ambos repos tras verificar la autoría. Al terminar, resume en español: qué cambió, cómo se verificó, qué quedó pendiente y qué decisiones necesita el usuario (por ejemplo, aplicar una migración o autorizar el merge a `main`).
