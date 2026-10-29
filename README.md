# ProteinForge — frontend

Banco académico con editor/FASTA, descriptores/perfiles, Gotoh Rust/WASM, referencias UniProt, selección sincronizada secuencia/estructura, visor experimental Mol*, informes locales PDF/JSON/CSV, búsqueda reproducible de candidatos y laboratorio didáctico. Todo eso está publicado, junto con cuentas, Proyectos y el asistente de interpretación; el historial de búsquedas en Proyectos también, oculto hasta activar `VITE_GENERATOR_HISTORY`. En `dev` está integrada además la pasada de rendimiento y accesibilidad del 27 de octubre, sin publicar: LCP por debajo de 2,5 s en 4G lenta simulada, con tareas de carga largas aún pendientes de las propuestas de arquitectura. El modelado 3D se hace con un cuaderno manual de Colab y sus resultados se importan; no hay predicción desde la aplicación ni validación biológica. [Estado y evidencia](docs/plan-desarrollo.md).

## Repositorios y carpetas

```text
ProteinForge/       # carpeta local, sin Git
├── frontend/       # este repositorio
└── backend/        # repositorio independiente
```

Frontend: [Jacklb19/ProteinForge](https://github.com/Jacklb19/ProteinForge). Backend: [Jacklb19/Protein_Back](https://github.com/Jacklb19/Protein_Back). Cada uno tiene su propio `.git`, `main`, `dev` y despliegue Vercel. Abrir esta carpeta como proyecto; ejecutar comandos desde aquí. Moverla completa conserva historial y remoto.

## Desarrollo local

Node fijado en [.nvmrc](.nvmrc); dependencias con versiones exactas en package/lockfile. No es necesario reconstruir Rust para iniciar: el paquete WASM generado está versionado.

```bash
npm ci
npm run dev
```

Servidor Vite en `http://localhost:5173` con COOP/COEP. Rutas en `src/shared/navigation.ts`: Inicio/Analizar/Alinear/Diseñar/Biblioteca/Perfil, identidad y páginas legales. `.env.example` enumera variables públicas; Auth requiere URL/clave pública y proyectos/UniProt requieren VITE_API_BASE_URL. Sin secretos del servidor en cliente. [Pantallas](docs/pantallas.md), [proyectos](docs/projects.md), [referencias](docs/references.md), [informes](docs/reports.md), [candidatos](docs/candidates.md).

## Verificación

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Pruebas específicas durante desarrollo: `npm run test -- src/features/alignment/wasm.test.ts`. Antes de cambios amplios, `npm run test:coverage`. E2E del recorrido afectado: `npm run test:e2e -- e2e/alignment.spec.ts`; requiere Chromium o Chrome local. `npm run check:pwa` verifica el build sin conexión; `PWA_CHECK_PORT` permite usar otro puerto si 4173 está ocupado.

Rust se fija en `rust-toolchain.toml`; wasm-pack 0.15.0 y wasm-bindgen 0.2.129. Para cambios del núcleo:

```bash
npm run build:wasm
npm run check:wasm
```

`build:wasm` reasigna la ruta de Cargo a `/cargo`, porque el binario guarda rutas de origen. El paquete que se versiona se construye en Linux, como en CI: `npm run build:wasm:linux` (Docker con `node:24`, Rust 1.91.1 y wasm-pack 0.15.0; quita el `.gitignore` generado). Una construcción en Windows funciona pero escribe rutas con `\` y no coincide byte a byte. CI reconstruye y compara. `target/` no se versiona.

`scripts/generate_alignment_references.py` regenera fixtures con Biopython fijado en `requirements-reference.txt`; es una herramienta científica del frontend, no el backend. `node scripts/benchmark-alignment.mjs` compara ambos núcleos y escribe resultados locales en `artifacts/`.

## Arquitectura y límites

El cálculo pesado ocurre en Workers; el alineamiento usa WASM con máximo de 5.000 residuos por secuencia. FASTA admite 5.000.000 bytes. PWA precachea recursos locales. La cobertura V8 no mide internamente Rust. La interfaz es bilingüe español/inglés. La compatibilidad verificada abarca Chromium 156, Firefox 155 y WebKit 26.6 en Windows, con la batería sin conexión completa en Chromium y WebKit; Safari en dispositivo real, lectores de pantalla y las mediciones de rendimiento de campo quedan como límites documentados.

El backend es propietario de migraciones Supabase y su prueba de RLS. Este frontend se puede clonar, probar y construir sin el backend. `VITE_API_BASE_URL` habilita los proyectos y la consulta de UniProt; sin ella no se hace ninguna petición a la API. La web habla con la API por gRPC-Web (clientes generados en `src/gen/` desde los contratos del backend; ver [gRPC](docs/grpc.md)); el backend conserva además sus rutas REST. La sesión se envía solo al servidor configurado, sin redirecciones ni cookies. Para publicación, añadir únicamente el origen concreto de la API a `connect-src` de la CSP; no se amplían orígenes antes de conocer la URL. Configurar CORS en el backend con el origen exacto del frontend.

El generador local y el [laboratorio didáctico](docs/laboratory.md) están implementados. Este permite explorar resultados guardados, editar/proteger posiciones y conservar variantes; una edición invalida la estructura asociada hasta nueva predicción. Por decisión del 28 de octubre, el cálculo estructural desde la app queda aplazado hasta que exista un ejecutor gratuito cuyos términos lo permitan, y el diseño de forma nueva queda fuera del alcance de la asignatura; ambas propuestas se conservan. El asistente solo interpreta. Descriptores y predicciones no demuestran función biológica ni novedad experimental.

## Documentación y despliegue

- [Definición vigente](docs/definicion-proyecto.md)
- [Decisiones](docs/decisiones.md)
- [Pantallas](docs/pantallas.md)
- [Diseño](docs/diseno-visual.md) y [fuentes](docs/font-provenance.md)
- [Estado y plan de desarrollo](docs/plan-desarrollo.md): capacidades actuales, orden de entregables y configuración que debe aportar el responsable del proyecto
- [Relevo de desarrollo](docs/prompt-siguiente-entrega.md): estado publicado, decisiones vigentes y copias de trabajo
- [Rendimiento y accesibilidad](docs/performance-2026-10-27.md) y [calidad](docs/quality-s7.md): mediciones, límites y propuestas abiertas
- [Archivo histórico](docs/archive/README.md)
- [Laboratorio de diseño y alojamiento](docs/design-lab-roadmap.md): alcance acordado, modelos, primera prueba, hardware y precios consultados

Vercel importa únicamente este repositorio con preset Vite; el backend usa otro proyecto. Producción desde `main`: [frontend](https://protein-forge.vercel.app/) y [backend](https://protein-back.vercel.app/), con CI y despliegue correctos en la publicación del 27 de octubre (frontend `84f9da5`, backend `18d9444`). Lo que hay en `dev` por encima de `main` no está publicado. El usuario controla publicación, variables de entorno y cambios remotos; la organización local no cambia el despliegue existente.
