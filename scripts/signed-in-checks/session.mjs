import { loadApp, parseArguments, resolveTargets, waitSeconds } from './app.mjs';
import { OWNER_CHECKS as C } from './config.mjs';
import { expectTrue, exitCode, httpOutcome, renderTable, rpcFailure, rpcSuccess, transportFailure } from './outcome.mjs';
import { signInHidden, safeCode } from './prompt.mjs';

/**
 * Shared run harness: loads the app, resolves the public origins, opens sessions at the hidden
 * prompt, prints only the result table and always closes the sessions it opened.
 */
export async function runCheck(title, allowed, body) {
  const write = (text) => { process.stdout.write(`${text}\n`); };
  const rows = [];
  const sessions = [];
  let app = null;
  // Ctrl+C during a wait still closes this script's sessions before leaving.
  process.once('SIGINT', () => {
    void Promise.allSettled(sessions.map((session) => session.close())).then(() => app?.close()).finally(() => { process.exit(130); });
  });
  try {
    const options = parseArguments(process.argv.slice(2), { '--api': { name: 'api', value: true }, ...allowed });
    app = await loadApp();
    const targets = resolveTargets(app.modules, options.api);
    write(`${title}\nAPI: ${targets.apiBase}${targets.singleProcess ? ' (local process)' : ''}\n`);
    const context = createContext({ modules: app.modules, targets, rows, sessions, write });
    await body(context, options);
  } catch (error) {
    // Only messages written by these scripts are shown; any other error is reduced to its name and code.
    const own = error instanceof Error && error.constructor === Error && error.message;
    write(`\nStopped: ${own ? error.message : `${error instanceof Error ? error.name : 'unexpected failure'} (${safeCode(error)})`}`);
    rows.push({ check: 'Run completed', verdict: 'FAIL', observed: 'stopped early' });
  } finally {
    for (const session of sessions) await session.close();
    await app?.close();
  }
  write(`\n${renderTable(rows)}\n`);
  process.exitCode = exitCode(rows);
}

/**
 * Everything a check body uses. `prompt` and `wait` are replaceable so that tests can drive a body
 * over mocks without a terminal or real waits.
 */
export function createContext({ modules, targets, rows, sessions, write, prompt = signInHidden, wait = waitSeconds }) {
  const authApi = modules.createAuthApi(targets.auth);
  const authRequest = modules.createAuthRequest(targets.auth);
  const restBase = `${targets.auth.url}${C.supabaseRest.base}`;

  /** Ends only this script's session (scope=local), refreshing first if its access token expired. */
  function track(label, session) {
    const state = { session, closed: false };
    sessions.push({
      close: async () => {
        if (state.closed) return;
        state.closed = true;
        try {
          const current = Date.now() / 1000 < state.session.expiresAt ? state.session : await authApi.refresh(state.session.refreshToken);
          await authRequest(`${modules.AUTH_ENDPOINTS.logout}?scope=${C.logoutScope}`, { method: 'POST', accessToken: current.accessToken });
        } catch (error) {
          write(`${label}: the script session could not be closed (${safeCode(error)}); it ends on its own when the refresh token expires.`);
        }
      },
    });
    return state;
  }

  return {
    modules, targets, write, wait,
    record(check, result) { rows.push({ check, ...result }); return result; },
    /** Signs in at the hidden prompt and confirms the API accepts the session. Returns the token holder. */
    async signIn(label) {
      const holder = track(label, await prompt(authApi, label));
      try { await modules.createProteinForgeApi(targets.apiBase).me(holder.session.accessToken); }
      catch (error) { throw new Error(`${label}: the API did not accept the new session (${safeCode(error)}); check that --api uses the same Supabase project.`); }
      return holder;
    },
    /** One gRPC-Web call; resolves to an outcome, never throws. */
    async rpc(call) {
      try { await call(); return rpcSuccess(); } catch (error) { return rpcFailure(error, modules.Code); }
    },
    /** One call through the app's own client (ApiError categories); resolves to an outcome. */
    async app(call) {
      try { return { outcome: rpcSuccess('app'), value: await call() }; } catch (error) { return { outcome: rpcFailure(error, modules.Code), value: null }; }
    },
    /** One REST call to the API with a bearer token; keeps only status, stable detail and row count. */
    async rest(method, path, token, body) {
      return http('api-rest', `${targets.apiBase}${path}`, method, { Authorization: `Bearer ${token}` }, body);
    },
    /** One PostgREST call as the given user (publishable key plus that user's JWT, like the API). */
    async supabase(method, path, token, body) {
      return http('supabase', `${restBase}${path}`, method, { apikey: targets.auth.anonKey, Authorization: `Bearer ${token}`, Prefer: 'return=representation' }, body);
    },
  };
}

async function http(transport, url, method, headers, body) {
  try {
    const response = await fetch(url, {
      method, redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(C.requestTimeoutMs),
    });
    return httpOutcome(transport, response.status, await response.text());
  } catch {
    return transportFailure(transport);
  }
}

/** The empty workspace the app gives a new project (ProjectProvider EMPTY_WORKSPACE): no sequence at all. */
export function emptyWorkspace(modules) {
  return { schemaVersion: 1, profileWindow: modules.DEFAULT_HYDROPATHY_WINDOW, source: null, descriptors: null, alignment: { first: '', second: '', matrix: modules.DEFAULT_MATRIX, mode: modules.DEFAULT_MODE, result: null } };
}

/** A deletes its check project (using the latest version) and confirms it is gone. */
export async function deleteCheckProject(context, projects, project, token, name) {
  const { record, write } = context;
  const latest = await context.app(() => projects.open(project.id, token()));
  const updatedAt = latest.value?.updatedAt ?? project.updatedAt;
  const removed = await context.app(() => projects.remove(project.id, updatedAt, token()));
  const gone = await context.app(() => projects.open(project.id, token()));
  const ok = removed.outcome.status === 'OK' && gone.outcome.status === 'not-found';
  record('check project deleted and gone', expectTrue(ok, `delete ${removed.outcome.status}, reopen ${gone.outcome.status}`));
  if (!ok) write(`Delete the leftover project by hand in Proyectos: «${name}».`);
}
