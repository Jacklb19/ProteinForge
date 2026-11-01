import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer as createSocketServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, loadEnv } from 'vite';
import { LOCAL_PREDICTION as C } from './local-prediction-config.mjs';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const backend = path.resolve(frontend, '../backend');
const python = path.join(backend, C.pythonPaths[process.platform] ?? C.pythonPaths.other);
const origin = port => `http://${C.host}:${String(port)}`;
const frontendUrl = origin(C.frontendPort), backendUrl = origin(C.backendPort);
let api = null, web = null, stopping = false;

async function freePort(port) {
  const socket = createSocketServer();
  await new Promise((resolve, reject) => {
    socket.once('error', () => reject(new Error(`Local port ${String(port)} is already occupied; no process was stopped.`)));
    socket.listen(port, C.host, () => socket.close(resolve));
  });
}

function checkIdentitySettings() {
  if (!existsSync(python)) throw new Error('The sibling backend Python environment is missing.');
  const env = loadEnv('development', frontend, 'VITE_');
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  if (!url || !env.VITE_SUPABASE_ANON_KEY?.trim()) throw new Error('Frontend identity settings are missing.');
  // Only booleans and an origin fingerprint cross this child-process boundary.
  const check = "import hashlib,json;from app.config import load_settings;s=load_settings();print(json.dumps({'identity':s.identity_enabled,'originHash':hashlib.sha256(s.supabase_url.encode()).hexdigest()}))";
  let result;
  try { result = JSON.parse(execFileSync(python, ['-c', check], { cwd: backend, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], windowsHide: true })); }
  catch { throw new Error('Backend configuration could not be checked; captured diagnostics are not displayed.'); }
  if (!result.identity || createHash('sha256').update(url).digest('hex') !== result.originHash) {
    throw new Error('Frontend and backend identity settings do not point to the same Supabase project.');
  }
}

async function stop() {
  if (stopping) return;
  stopping = true;
  await web?.close();
  // This handle belongs exclusively to the Python child created below.
  if (api && api.exitCode === null) api.kill();
}

async function ready() {
  const deadline = Date.now() + C.startupTimeoutMs;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error('The local backend stopped during startup.');
    try {
      const response = await fetch(backendUrl + C.healthPath, { signal: AbortSignal.timeout(C.requestTimeoutMs) });
      const status = await response.json();
      if (response.ok && status.status === 'ok' && status.identity === true) return;
    } catch { /* Startup may still be binding its local socket. */ }
    await new Promise(resolve => setTimeout(resolve, C.pollIntervalMs));
  }
  throw new Error('The local backend did not become ready within the configured startup budget.');
}

process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
try {
  checkIdentitySettings();
  await freePort(C.frontendPort);
  await freePort(C.backendPort);
  api = spawn(python, ['-m','uvicorn','app.main:app','--host',C.host,'--port',String(C.backendPort),'--no-access-log'], {
    cwd: backend, windowsHide: true, stdio: ['ignore','inherit','inherit'],
    env: { ...process.env, FOLDING_ENABLED: C.enabledValue, ALLOWED_ORIGINS: frontendUrl },
  });
  api.once('error', () => { process.exitCode = 1; void stop(); });
  api.once('exit', () => { if (!stopping) { process.exitCode = 1; void stop(); } });
  await ready();
  Object.assign(process.env, { VITE_API_BASE_URL: backendUrl, VITE_STRUCTURE_PREDICTION: C.enabledValue });
  web = await createServer({ root: frontend, server: {
    host: C.host, port: C.frontendPort, strictPort: true,
    watch: { ignored: ['**/artifacts/**','**/coverage/**','**/tmp/**'] },
    warmup: { clientFiles: ['./src/features/design-lab/import.worker.ts','./src/features/design-lab/prediction.worker.ts','./src/main.tsx'] },
  } });
  await web.listen();
  console.log(JSON.stringify({ frontend: frontendUrl, backend: backendUrl, identityConfigured: true, identityProjectMatches: true, prediction: 'enabled for this local process', stop: 'Ctrl+C' }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local prediction startup failed.');
  process.exitCode = 1;
  await stop();
}
