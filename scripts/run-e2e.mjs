import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const server = await createServer({ server: {
  host: '127.0.0.1', port: 5173, strictPort: true,
  watch: { ignored: ['**/coverage/**', '**/artifacts/**', '**/test-results/**'] },
} });
await server.listen();

const runner = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
});

const exitCode = await new Promise((resolve) => {
  runner.once('exit', (code) => { resolve(code ?? 1); });
  runner.once('error', () => { resolve(1); });
});
await server.close();
process.exitCode = exitCode;
