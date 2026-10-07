# ProteinForge — frontend

Banco de trabajo académico para analizar secuencias proteicas, comparar alineamientos y explorar candidatos bajo condiciones definidas. Editor, FASTA, descriptores, perfil, temas y alineamiento Rust/WASM están implementados. Catálogo, UniProt, visor 3D, generación, predicción externa, proyectos e informes siguen pendientes.

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

Servidor Vite en `http://localhost:5173` con COOP/COEP. Rutas actuales: `/`, `/alignment`, `/settings`. El archivo `.env.example` enumera variables públicas sin valores. No se incluye ningún secreto en el cliente.

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

Eliminar el `.gitignore` que wasm-pack genera dentro de `rust/alignment/pkg/` antes de confirmar el paquete. CI lo reconstruye y compara. `target/` no se versiona.

`scripts/generate_alignment_references.py` regenera fixtures con Biopython fijado en `requirements-reference.txt`; es una herramienta científica del frontend, no el backend. `node scripts/benchmark-alignment.mjs` compara ambos núcleos y escribe resultados locales en `artifacts/`.

## Arquitectura y límites

El cálculo pesado ocurre en Workers; el alineamiento usa WASM con máximo de 5.000 residuos por secuencia. FASTA admite 5.000.000 bytes. PWA precachea recursos locales. La cobertura V8 no mide internamente Rust. Inglés completo, auditoría de otros navegadores y rendimiento externo pendientes.

El backend es propietario de migraciones Supabase y su prueba de RLS. Este frontend debe poder clonarse, probarse y construirse sin tener el backend al lado. `VITE_API_BASE_URL` conectará con la API al implementarla; CORS y orígenes CSP se ajustarán entonces.

Predicción externa y generación están aprobadas como ampliación, aún sin implementar. El asistente solo interpreta. Descriptores y estructuras predichas no demuestran función biológica ni novedad experimental.

## Documentación y despliegue

- [Definición vigente](docs/definicion-proyecto.md)
- [Decisiones](docs/decisiones.md)
- [Pantallas](docs/pantallas.md)
- [Diseño](docs/diseno-visual.md) y [fuentes](docs/font-provenance.md)
- [Archivo histórico](docs/archive/README.md)

Vercel importa únicamente este repositorio con preset Vite; el backend usa otro proyecto. Configurar producción desde `main` y desarrollo desde `dev` según corresponda. URLs efectivas pendientes de registrar. El usuario controla publicación y cambios remotos; la organización local no cambia el despliegue existente.
