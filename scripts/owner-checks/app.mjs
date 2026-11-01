import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, createServerModuleRunner, loadEnv } from 'vite';
import { OWNER_CHECKS as C } from './config.mjs';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Loads the app modules (app-modules.mjs) through a Vite module runner that stays open, because the
 * app imports its contracts lazily. No port is opened; `close` releases the runner.
 */
export async function loadApp() {
  const server = await createServer({
    configFile: false, root: frontend, logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  try {
    const modules = await runner.import('/scripts/owner-checks/app-modules.mjs');
    return { modules, close: async () => { await runner.close(); await server.close(); } };
  } catch (error) {
    await runner.close(); await server.close();
    throw error;
  }
}

/**
 * Accepts only the documented flags. A rejected argument is never echoed: it could be a password
 * typed in the wrong place.
 */
export function parseArguments(argv, allowed) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const spec = allowed[flag];
    if (!spec) throw new Error(`Argument ${String(index + 1)} is not accepted. Credentials are only read from the hidden prompt.`);
    if (spec.value) {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`Argument ${String(index + 1)} needs a value.`);
      options[spec.name] = value;
      index += 1;
    } else options[spec.name] = true;
  }
  return options;
}

/** Public origins from the app's own readers: the Vite environment, or `--api` for the API base. */
export function resolveTargets(modules, apiOverride) {
  const environment = loadEnv(C.envMode, frontend, 'VITE_');
  const auth = modules.readAuthSettings(environment);
  if (!auth) throw new Error('The frontend environment has no Supabase origin and publishable key.');
  const apiBase = modules.readApiBaseUrl(apiOverride === undefined ? environment : { VITE_API_BASE_URL: apiOverride });
  if (!apiBase) throw new Error(apiOverride === undefined ? 'The frontend environment has no valid API base URL.' : 'The --api value is not an accepted http(s) origin.');
  return { auth, apiBase, singleProcess: isLoopback(apiBase) };
}

/** A loopback API is one local process, so its in-memory budget is the only one. */
export function isLoopback(origin) {
  const host = new URL(origin).hostname;
  return host === 'localhost' || host === '[::1]' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

export const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Waits with a progress line that shows only the remaining time. */
export async function waitSeconds(seconds, label, write = (text) => { process.stdout.write(text); }) {
  let remaining = Math.max(0, Math.ceil(seconds));
  while (remaining > 0) {
    write(`  ${label}: ${String(remaining)} s\n`);
    const step = Math.min(remaining, C.waitReportSeconds);
    await sleep(step * 1000);
    remaining -= step;
  }
}

/** A check project name that marks its purpose and time; it never carries account data. */
export function checkProjectName(purpose, now = new Date()) {
  return `${C.projectNamePrefix} · ${purpose} · ${now.toISOString()}`;
}
