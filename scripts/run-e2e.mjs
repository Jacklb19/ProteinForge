import { spawn } from 'node:child_process';
import { createServer } from 'vite';

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
