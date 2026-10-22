import { spawn } from 'node:child_process';
import { createServer, loadEnv } from 'vite';

// Every API and identity request in the suite is answered by route mocks. When a checkout has no
// .env (CI, a fresh clone), these placeholder public values enable the signed-in flows; the
// reserved .invalid domain guarantees that an unmocked request can never reach a real service.
const E2E_PUBLIC_ENV = {
  VITE_SUPABASE_URL: 'https://e2e-project.supabase.invalid',
  VITE_SUPABASE_ANON_KEY: 'e2e-public-anon-key',
  VITE_API_BASE_URL: 'https://api.e2e.invalid',
};
const configured = loadEnv('development', process.cwd(), 'VITE_');
for (const [name, value] of Object.entries(E2E_PUBLIC_ENV)) {
  if (!configured[name]?.trim()) process.env[name] = value;
}

// The port is configurable; when it is busy Vite moves to the next free one and the URL is passed on.
const host = process.env.E2E_HOST ?? '127.0.0.1';
const port = Number(process.env.E2E_PORT ?? 5173);

// Scan every application module, including lazy routes and Workers, so dependencies are bundled once.
// A dependency discovered later makes Vite re-bundle and reload the page, aborting the navigation of
// whichever test happens to be running.
const server = await createServer({ optimizeDeps: {
  entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**', '!src/gen/**/*_connect.ts'],
  include: ['zod'],
}, server: {
  host, port, strictPort: false,
  warmup: { clientFiles: ['./src/features/*/*.worker.ts', './src/main.tsx'] },
  watch: { ignored: ['**/coverage/**', '**/artifacts/**', '**/test-results/**'] },
} });
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === 'string') throw new Error('The E2E server did not report its port.');
const baseUrl = `http://${host}:${String(address.port)}`;

// A cold dev server transforms hundreds of modules on the first page load, which can exceed a test's
// budget. Request the whole module graph once, static and dynamic imports alike, before any test runs.
const MODULE_REFERENCE = /(?:from\s*|import\s*\(?\s*|new URL\(\s*)["'](\/(?:src|node_modules|@id|@fs|@vite)[^"'?]*(?:\?[^"']*)?)["']/g;
const ENTRIES = ['/', '/src/main.tsx'];
const pending = [...ENTRIES];
const visited = new Set(pending);
while (pending.length > 0) {
  const batch = pending.splice(0, 16);
  await Promise.all(batch.map(async (path) => {
    // Only the two entries must exist. A text that merely looks like a module path is skipped: warming
    // is an optimisation, and failing the whole suite over one of them would be worse than a cold start.
    const response = await fetch(`${baseUrl}${path}`).catch(() => null);
    if (!response?.ok) {
      if (ENTRIES.includes(path)) throw new Error(`Warming ${path} failed with HTTP ${String(response?.status ?? 0)}.`);
      return;
    }
    const text = await response.text();
    for (const [, reference] of text.matchAll(MODULE_REFERENCE)) {
      if (!visited.has(reference)) { visited.add(reference); pending.push(reference); }
    }
  }));
}

const runner = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, E2E_BASE_URL: baseUrl },
});

const exitCode = await new Promise((resolve) => {
  runner.once('exit', (code) => { resolve(code ?? 1); });
  runner.once('error', () => { resolve(1); });
});
await server.close();
process.exitCode = exitCode;
