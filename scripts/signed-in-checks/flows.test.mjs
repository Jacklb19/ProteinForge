import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as modules from './app-modules.mjs';
import { gatewayCheck, generatorHistoryCheck, isolationCheck } from './checks.mjs';
import { OWNER_CHECKS as C } from './config.mjs';
import { exitCode, renderTable, VERDICTS } from './outcome.mjs';
import { createContext } from './session.mjs';
import { GetMeResponseSchema } from '../../src/gen/proteinforge/account/v1/account_service_pb';
import {
  CreateProjectRequestSchema, CreateProjectResponseSchema, DeleteProjectRequestSchema, DeleteProjectResponseSchema, GetProjectRequestSchema,
  GetProjectResponseSchema, ListProjectsRequestSchema, ListProjectsResponseSchema, ProjectStatus, UpdateProjectRequestSchema, UpdateProjectResponseSchema,
} from '../../src/gen/proteinforge/project/v1/project_service_pb';
import { GetEntryRequestSchema, GetEntryResponseSchema, GetResidueMappingRequestSchema, GetResidueMappingResponseSchema } from '../../src/gen/proteinforge/reference/v1/reference_service_pb';

/**
 * An in-memory stand-in for the API (gRPC-Web and REST), Supabase REST and Supabase Auth. It owns
 * projects per subject, counts the reference budget and refuses unknown tokens. Every token here is
 * fake; no real service is contacted.
 */
const API = 'http://127.0.0.1:5331';
const SUPABASE = 'http://127.0.0.1:54321';
const targets = { apiBase: API, auth: { url: SUPABASE, anonKey: 'test-publishable-key' }, singleProcess: true };

function fakeJwt(sub, exp) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, exp, email: `${sub}@example.test` })}.${Buffer.alloc(32, sub.length).toString('base64url')}`;
}

function frame(flag, bytes) {
  const out = new Uint8Array(5 + bytes.length);
  out[0] = flag;
  new DataView(out.buffer).setUint32(1, bytes.length);
  out.set(bytes, 5);
  return out;
}
const grpcHeaders = { 'Content-Type': 'application/grpc-web+proto' };
function grpcOk(schema, init) {
  const body = toBinary(schema, create(schema, init));
  const trailer = new TextEncoder().encode('grpc-status: 0\r\n');
  const data = frame(0x00, body);
  const all = new Uint8Array(data.length + 5 + trailer.length);
  all.set(data); all.set(frame(0x80, trailer), data.length);
  return new Response(all, { status: 200, headers: grpcHeaders });
}
const grpcError = (code, message) => new Response(null, { status: 200, headers: { ...grpcHeaders, 'grpc-status': String(code), 'grpc-message': message } });
const json = (status, value) => new Response(value === undefined ? null : JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

function createMock({ leaks = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const state = {
    tokens: new Map(), projects: new Map(), budget: new Map(), logouts: [], requests: 0, expired: new Set(), clock: Date.now(),
  };
  const issue = (sub, exp = now + 3600) => { const token = fakeJwt(sub, exp); state.tokens.set(token, sub); return token; };
  const subjectOf = (headers) => {
    const token = (headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    return state.expired.has(token) ? null : state.tokens.get(token) ?? null;
  };
  const tick = () => { state.clock += 1000; return timestampFromDate(new Date(state.clock)); };
  const runs = (workspace) => workspace?.generatorHistory ? JSON.parse(workspace.generatorHistory.documentJson).runs.length : 0;
  const summary = (id, p) => ({ id, name: p.name, status: ProjectStatus.DRAFT, createTime: p.createTime, updateTime: p.updateTime, preview: { sequenceLength: 0, sequencePrefix: '', excluded: 0, generatorRuns: runs(p.workspace) } });
  const message = (id, p) => ({ summary: summary(id, p), activeSequence: p.activeSequence, workspace: p.workspace });
  const owned = (id, sub) => { const p = state.projects.get(id); return p && p.owner === sub ? p : null; };

  function rpc(method, body, sub, token) {
    const decode = (schema) => fromBinary(schema, body.subarray(5));
    if (!sub && !(leaks.tamperedInterpret && method === 'AssistantService/Interpret' && token)) return grpcError(16, 'invalid-token');
    switch (method) {
      case 'AccountService/GetMe': return grpcOk(GetMeResponseSchema, { id: sub, email: `${sub}@example.test` });
      case 'ProjectService/ListProjects': {
        const { query } = decode(ListProjectsRequestSchema);
        const projects = [...state.projects].filter(([, p]) => p.owner === sub && p.name.includes(query)).map(([id, p]) => summary(id, p));
        return grpcOk(ListProjectsResponseSchema, { projects, queryApplied: true });
      }
      case 'ProjectService/GetProject': {
        const { id } = decode(GetProjectRequestSchema);
        const p = owned(id, sub);
        return p ? grpcOk(GetProjectResponseSchema, { project: message(id, p) }) : grpcError(5, 'project-not-found');
      }
      case 'ProjectService/CreateProject': {
        const request = decode(CreateProjectRequestSchema);
        if (!request.name) return grpcError(3, 'validation');
        const id = crypto.randomUUID();
        const time = tick();
        state.projects.set(id, { owner: sub, name: request.name, activeSequence: request.activeSequence, workspace: request.workspace, createTime: time, updateTime: time });
        return grpcOk(CreateProjectResponseSchema, { project: message(id, state.projects.get(id)) });
      }
      case 'ProjectService/UpdateProject': {
        const request = decode(UpdateProjectRequestSchema);
        const p = owned(request.id, sub);
        if (!p) return grpcError(request.name ? 5 : 3, request.name ? 'project-not-found' : 'validation');
        Object.assign(p, { name: request.name, activeSequence: request.activeSequence, workspace: request.workspace, updateTime: tick() });
        return grpcOk(UpdateProjectResponseSchema, { project: message(request.id, p) });
      }
      case 'ProjectService/DeleteProject': {
        const request = decode(DeleteProjectRequestSchema);
        const p = owned(request.id, sub);
        if (!p) return grpcError(5, 'project-not-found');
        if (!request.expectedUpdateTime || timestampDate(request.expectedUpdateTime).getTime() !== timestampDate(p.updateTime).getTime()) return grpcError(10, 'project-conflict');
        state.projects.delete(request.id);
        return grpcOk(DeleteProjectResponseSchema, {});
      }
      case 'ReferenceService/GetEntry': case 'ReferenceService/GetResidueMapping': {
        const mapping = method.endsWith('Mapping');
        const request = decode(mapping ? GetResidueMappingRequestSchema : GetEntryRequestSchema);
        if (request.accession !== C.quota.accession) return grpcError(3, 'validation');
        const used = state.budget.get(sub) ?? 0;
        if (used >= C.quota.limit) return grpcError(8, C.quota.ownBudgetDetail);
        state.budget.set(sub, used + 1);
        return mapping ? grpcOk(GetResidueMappingResponseSchema, {}) : grpcOk(GetEntryResponseSchema, { entry: { sequenceVersion: 1 } });
      }
      default: return grpcError(3, 'validation');
    }
  }

  function rest(method, url, sub) {
    if (!sub) return json(401, { detail: 'invalid-token' });
    const match = url.pathname.match(/^\/v1\/projects\/([^/]+)$/);
    if (match) {
      const p = owned(match[1], sub);
      if (!p) return json(404, { detail: 'project-not-found' });
      return method === 'GET' ? json(200, { id: match[1], name: p.name }) : json(422, { detail: 'validation' });
    }
    if (url.pathname === C.rest.me) return json(200, { id: sub, email: `${sub}@example.test` });
    if (url.pathname === C.rest.projects && method === 'GET') return json(200, { items: [] });
    return json(422, { detail: 'validation' });
  }

  function supabase(method, url, body, sub) {
    if (!sub) return json(401, { code: 'PGRST301' });
    const path = url.pathname.slice(C.supabaseRest.base.length);
    if (path === C.supabaseRest.table) {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const p = owned(id, sub) ?? (leaks.supabaseRead && method === 'GET' ? state.projects.get(id) : null);
      return json(200, p ? [{ id }] : []);
    }
    if (path === C.supabaseRest.documentRpc) return json(200, owned(body.p_id, sub) ? { id: body.p_id } : null);
    return json(400, { code: 'PT404', message: 'Project not found' });
  }

  async function fetchMock(input, init = {}) {
    state.requests += 1;
    const url = new URL(typeof input === 'string' ? input : input.url);
    const headers = new Headers(init.headers);
    const sub = subjectOf(headers);
    const token = headers.get('Authorization');
    const body = init.body instanceof Uint8Array ? init.body : typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (url.origin === API && url.pathname.startsWith('/proteinforge.')) return rpc(url.pathname.split('.v1.')[1], body, sub, token);
    if (url.origin === API) return rest(init.method ?? 'GET', url, sub);
    if (url.origin === SUPABASE && url.pathname.startsWith(C.supabaseRest.base)) return supabase(init.method ?? 'GET', url, body, sub);
    if (url.pathname === `${modules.AUTH_BASE_PATH}${modules.AUTH_ENDPOINTS.logout}`) {
      state.logouts.push({ scope: url.searchParams.get('scope'), accepted: Boolean(sub) });
      return sub ? new Response(null, { status: 204 }) : json(401, { error_code: 'bad_jwt' });
    }
    if (url.pathname === `${modules.AUTH_BASE_PATH}${modules.AUTH_ENDPOINTS.token}`) {
      const subject = [...state.tokens.entries()].find(([, value]) => `refresh-${value}` === body.refresh_token)?.[1];
      if (!subject) return json(400, { error_code: 'refresh_token_not_found' });
      return json(200, { access_token: issue(subject), refresh_token: `refresh-${subject}`, expires_in: 3600, token_type: 'bearer', user: { id: subject, email: `${subject}@example.test` } });
    }
    return new Response(null, { status: 599 });
  }
  return { state, issue, fetchMock };
}

/** Builds a context over the mock: the prompt hands out fake sessions, waits are instant. */
function harness(mock, { exp, onWait = () => {} } = {}) {
  const rows = []; const sessions = []; const output = [];
  const issued = [];
  const subjects = ['subject-a', 'subject-b'];
  const prompt = async () => {
    const sub = subjects[issued.length];
    const token = mock.issue(sub, exp);
    issued.push(token);
    return { accessToken: token, refreshToken: `refresh-${sub}`, expiresAt: exp ?? Math.floor(Date.now() / 1000) + 3600, user: { id: sub, email: `${sub}@example.test` } };
  };
  const context = createContext({ modules, targets, rows, sessions, write: (text) => output.push(text), prompt, wait: async (seconds, label) => { onWait(label, issued); } });
  const finish = async () => {
    for (const session of sessions) await session.close();
    return { rows, table: renderTable(rows), output: output.join('\n'), issued };
  };
  return { context, finish };
}

function expectNoSecrets({ table, output, issued }) {
  for (const token of issued) for (const part of token.split('.').slice(1)) {
    expect(table).not.toContain(part);
    expect(output).not.toContain(part);
  }
  expect(table).not.toContain('@example.test');
  expect(output).not.toContain('@example.test');
}

const verdictOf = (rows, check) => rows.find((row) => row.check === check)?.verdict;

describe('owner checks over a mocked deployment', () => {
  let mock;
  beforeEach(() => { mock = createMock(); vi.stubGlobal('fetch', mock.fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('certifies isolation when every path refuses account B, and cleans up', async () => {
    const { context, finish } = harness(mock);
    await isolationCheck(context);
    const result = await finish();
    expect(result.rows.filter((row) => row.verdict !== VERDICTS.pass)).toEqual([]);
    expect(result.rows.length).toBeGreaterThanOrEqual(16);
    expect(mock.state.projects.size).toBe(0);
    expect(mock.state.logouts).toEqual([{ scope: C.logoutScope, accepted: true }, { scope: C.logoutScope, accepted: true }]);
    expectNoSecrets(result);
  });

  it('fails isolation when Supabase REST shows the row to account B', async () => {
    mock = createMock({ leaks: { supabaseRead: true } });
    vi.stubGlobal('fetch', mock.fetchMock);
    const { context, finish } = harness(mock);
    await isolationCheck(context);
    const { rows } = await finish();
    expect(verdictOf(rows, 'B reads the row (Supabase REST)')).toBe(VERDICTS.fail);
    expect(exitCode(rows)).toBe(1);
    expect(mock.state.projects.size).toBe(0);
  });

  it('refuses to compare an account with itself', async () => {
    const { context, finish } = harness(mock);
    const prompt = context.signIn;
    let first = null;
    context.signIn = async (label) => (first ??= await prompt(label));
    await expect(isolationCheck(context)).rejects.toThrow(/same account/);
    await finish();
  });

  it('certifies refused tampered and expired tokens and the quota on every gateway method', async () => {
    const { context, finish } = harness(mock, {
      exp: Math.floor(Date.now() / 1000) - 1,
      onWait: (label, issued) => { if (label === 'until expiry') mock.state.expired.add(issued[0]); },
    });
    await gatewayCheck(context, {});
    const result = await finish();
    expect(result.rows.filter((row) => row.verdict !== VERDICTS.pass)).toEqual([]);
    const probes = result.rows.filter((row) => row.check.startsWith('expired token refused: '));
    expect(probes).toHaveLength(22);
    expect(verdictOf(result.rows, `reference quota ${String(C.quota.limit)}/min, call ${String(C.quota.limit + 1)} (SIFTS) refused`)).toBe(VERDICTS.pass);
    expect(verdictOf(result.rows, 'SIFTS mapping answers the signed-in identity')).toBe(VERDICTS.pass);
    // The expired session is refreshed only to close it.
    expect(mock.state.logouts).toEqual([{ scope: C.logoutScope, accepted: true }]);
    expectNoSecrets(result);
  });

  it('fails a gateway method that lets a tampered token through to validation', async () => {
    mock = createMock({ leaks: { tamperedInterpret: true } });
    vi.stubGlobal('fetch', mock.fetchMock);
    const { context, finish } = harness(mock);
    await gatewayCheck(context, { skipExpired: true });
    const { rows } = await finish();
    expect(verdictOf(rows, 'tampered token refused: rpc AssistantService/Interpret')).toBe(VERDICTS.fail);
    expect(verdictOf(rows, 'expired token refused')).toBe(VERDICTS.skipped);
  });

  it('saves, counts, reopens and deletes a generator search', async () => {
    const { context, finish } = harness(mock);
    await generatorHistoryCheck(context);
    const result = await finish();
    expect(result.rows.map((row) => [row.check, row.verdict])).toEqual([
      ['search saved to a new check project', VERDICTS.pass],
      ['project list counts 1 saved search', VERDICTS.pass],
      ['reopened history verifies (document and run hashes)', VERDICTS.pass],
      ['reopened search equals the saved export', VERDICTS.pass],
      ['check project deleted and gone', VERDICTS.pass],
    ]);
    expect(mock.state.projects.size).toBe(0);
    expectNoSecrets(result);
    expect(result.table).not.toMatch(/[ACDEFGHIKLMNPQRSTVWY]{20}/);
  });
});
