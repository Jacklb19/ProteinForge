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

// Prebundle the FASTA worker dependency and transform worker modules before the first test needs them.
const server = await createServer({ optimizeDeps: { include: ['zod'] }, server: {
  host, port, strictPort: false,
  warmup: { clientFiles: ['./src/features/*/*.worker.ts', './src/main.tsx'] },
  watch: { ignored: ['**/coverage/**', '**/artifacts/**', '**/test-results/**'] },
} });
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === 'string') throw new Error('The E2E server did not report its port.');

const runner = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, E2E_BASE_URL: `http://${host}:${String(address.port)}` },
});

const exitCode = await new Promise((resolve) => {
  runner.once('exit', (code) => { resolve(code ?? 1); });
  runner.once('error', () => { resolve(1); });
});
await server.close();
process.exitCode = exitCode;
