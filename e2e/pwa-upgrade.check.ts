import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { build } from 'vite';
import { grpcWebBody, grpcWebRequest } from '../src/test/grpcWeb';
import { CreateProjectRequestSchema, CreateProjectResponseSchema, UpdateProjectRequestSchema, UpdateProjectResponseSchema, GetProjectResponseSchema, ListProjectsResponseSchema, ProjectStatus } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { GetMeResponseSchema, GetStatusResponseSchema } from '../src/gen/proteinforge/account/v1/account_service_pb';
import { timestampFromIso } from '../src/features/api/timestamps';
import { SESSION_STORAGE_KEY } from '../src/features/auth/config';
import { PROJECT_POINTER_PREFIX } from '../src/features/projects/config';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const owner = { id: '00000000-0000-4000-8000-000000000001', email: 'upgrade@example.invalid' };
const projectId = '00000000-0000-4000-8000-000000000026';
const token = 'local-pwa-upgrade-token';
const stamp = timestampFromIso('2026-10-26T12:00:00Z');

test('an installed pre-CORP PWA updates without clearing its profile or saved workspace', async ({ browser }) => {
  test.setTimeout(300_000); // Two production builds precede the single transition; assertions keep their normal limits.
  const root = process.cwd();
  const revision = process.env.PWA_UPGRADE_BEFORE_REVISION ?? 'a5de1cf';
  const current = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const original = execFileSync('git', ['rev-parse', revision], { encoding: 'utf8' }).trim();
  const output = resolve(process.env.PWA_UPGRADE_OUTPUT ?? `artifacts/quality/pwa-upgrade-${String(Date.now())}`);
  const source = resolve(root, 'tmp', `pwa-before-${String(Date.now())}`);
  const checkpoint = (message: string): void => { process.stdout.write(message + '\n'); };
  mkdirSync(output, { recursive: true });
  mkdirSync(source, { recursive: true });
  const archive = resolve(output, 'before-source.tar');
  execFileSync('git', ['archive', '--format=tar', '--output', archive, original]);
  for (const entry of execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)) {
    const target = resolve(source, entry);
    if (!target.startsWith(source + sep)) throw new Error(`Archive path outside the source directory: ${entry}`);
  }
  execFileSync('tar', ['-xf', archive, '-C', source]);
  checkpoint('Archived previous tracked source without changing the checkout.');
  const port = Number(process.env.PWA_UPGRADE_PORT ?? 5316);
  const origin = `http://127.0.0.1:${String(port)}`;
  // Only public fictitious settings; every configured service is this local fixture.
  process.env.VITE_SUPABASE_URL = origin;
  process.env.VITE_SUPABASE_ANON_KEY = 'local-public-key';
  process.env.VITE_API_BASE_URL = origin;
  const beforeDir = resolve(output, 'before');
  const afterDir = resolve(output, 'after');
  if (process.env.PWA_UPGRADE_REUSE_BUILDS !== '1') {
    await build({ root: source, configFile: resolve(source, 'vite.config.ts'), build: { outDir: beforeDir, emptyOutDir: false } });
    await build({ root, build: { outDir: afterDir, emptyOutDir: false } });
  } else {
    const previous = JSON.parse(readFileSync(resolve(output, 'result.json'), 'utf8')) as { original: string; current: string; beforeSwSha256: string; afterSwSha256: string };
    expect({ original, current }).toEqual({ original: previous.original, current: previous.current });
    expect(hash(readFileSync(resolve(beforeDir, 'sw.js')))).toBe(previous.beforeSwSha256);
    expect(hash(readFileSync(resolve(afterDir, 'sw.js')))).toBe(previous.afterSwSha256);
  }
  const beforeSw = readFileSync(resolve(beforeDir, 'sw.js'), 'utf8');
  const afterSw = readFileSync(resolve(afterDir, 'sw.js'), 'utf8');
  checkpoint('Both production builds are ready.');
  expect(hash(beforeSw)).not.toBe(hash(afterSw));
  const resources = (script: string): string[] => [...script.matchAll(/url:"(assets\/[^" ]+(?:\.wasm|\.worker-[^" ]+\.js))"/g)].map(match => '/' + match[1]);
  const shared = resources(beforeSw).filter(url => resources(afterSw).includes(url));
  expect(shared.some(url => url.includes('descriptors.worker-'))).toBe(true);
  expect(shared.some(url => url.endsWith('.wasm'))).toBe(true);
  let phase: 'before' | 'after' = 'before';
  let stored: Parameters<typeof grpcWebBody<typeof GetProjectResponseSchema>>[1]['project'];
  let writes = 0;
  const requests: { phase: string; path: string; status: number }[] = [];
  const server = createServer((request, response) => { void (async () => {
    const path = new URL(request.url ?? '/', origin).pathname;
    const reply = (status: number, body: Buffer | Uint8Array, type: string): void => {
      requests.push({ phase, path, status });
      response.statusCode = status;
      response.setHeader('Content-Type', type);
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      if (phase === 'after') response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      response.end(body);
    };
    try {
      if (path.startsWith('/proteinforge.')) {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
        const body = Buffer.concat(chunks);
        if (path.endsWith('/GetStatus')) { reply(200, grpcWebBody(GetStatusResponseSchema, { status: 'ok', version: 'local-upgrade', identityConfigured: true }), 'application/grpc-web+proto'); return; }
        expect(request.headers.authorization).toBe(`Bearer ${token}`);
        if (path.endsWith('/GetMe')) { reply(200, grpcWebBody(GetMeResponseSchema, owner), 'application/grpc-web+proto'); return; }
        if (path.endsWith('/ListProjects')) { reply(200, grpcWebBody(ListProjectsResponseSchema, { queryApplied: true, projects: [] }), 'application/grpc-web+proto'); return; }
        if (path.endsWith('/GetProject')) { reply(200, grpcWebBody(GetProjectResponseSchema, { project: stored }), 'application/grpc-web+proto'); return; }
        const update = path.endsWith('/UpdateProject');
        if (update || path.endsWith('/CreateProject')) {
          const payload = update ? grpcWebRequest(UpdateProjectRequestSchema, body) : grpcWebRequest(CreateProjectRequestSchema, body);
          writes++;
          stored = { summary: { id: projectId, name: payload.name, status: ProjectStatus.DRAFT, createTime: stamp, updateTime: stamp }, activeSequence: payload.activeSequence, workspace: payload.workspace };
          reply(200, update ? grpcWebBody(UpdateProjectResponseSchema, { project: stored }) : grpcWebBody(CreateProjectResponseSchema, { project: stored }), 'application/grpc-web+proto'); return;
        }
        throw new Error(`Unexpected local RPC: ${path}`);
      }
      const directory = phase === 'before' ? beforeDir : afterDir;
      const target = resolve(directory, '.' + decodeURIComponent(path));
      if (!target.startsWith(directory + sep) && target !== directory) { reply(403, Buffer.from('Forbidden'), 'text/plain'); return; }
      const file = existsSync(target) && statSync(target).isFile() ? target : resolve(directory, 'index.html');
      response.setHeader('Cache-Control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
      const bytes = readFileSync(file);
      const etag = '"' + hash(bytes) + '"';
      response.setHeader('ETag', etag);
      reply(request.headers['if-none-match'] === etag ? 304 : 200, request.headers['if-none-match'] === etag ? Buffer.alloc(0) : bytes, mime[extname(file)] ?? 'application/octet-stream');
    } catch (error) {
      reply(500, Buffer.from(String(error)), 'text/plain');
    }
  })(); });
  await new Promise<void>((resolveReady, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveReady); });
  checkpoint('Local same-origin server is listening.');
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  checkpoint('One independent browser context is ready.');
  const errors: { phase: string; message: string }[] = [];
  const external: string[] = [];
  const stages: Record<string, unknown> = {};
  const watch = (page: import('@playwright/test').Page): void => {
    page.on('pageerror', error => errors.push({ phase, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ phase, message: message.text() }); });
  };
  context.on('request', request => { if (request.url().startsWith('http') && new URL(request.url()).origin !== origin) external.push(request.url()); });
  const cacheState = async (page: import('@playwright/test').Page) => page.evaluate(async (urls) => {
    const result = [];
    for (const url of urls) {
      const response = await caches.match(url, { ignoreSearch: true });
      result.push({ url, cached: !!response, corp: response?.headers.get('cross-origin-resource-policy') ?? null, bytes: response ? (await response.arrayBuffer()).byteLength : null });
    }
    return result;
  }, shared);
  const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(3);
  try {
    // Install once, then reload under the old active controller before editing.
    let page = await context.newPage(); watch(page);
    await page.goto(origin);
    checkpoint('Previous landing document loaded.');
    await page.waitForFunction(async () => { await navigator.serviceWorker.ready; return true; });
    checkpoint('Previous service worker installed.');
    await page.evaluate(({ key, session }) => { localStorage.setItem(key, JSON.stringify(session)); }, { key: SESSION_STORAGE_KEY, session: { accessToken: token, refreshToken: 'local-refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600, user: owner } });
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.locator(`.site-nav a[href="${ROUTES.analyze}"]`).first().click();
    checkpoint('Previous PWA reopened under its existing controller.');
    await expect(page.locator('.descriptor-panel [data-state="current"]')).toBeAttached();
    await page.getByRole('button', { name: spanish['editor.inputTitle'], exact: true }).click();
    await page.locator('#sequence-input').fill(sequence);
    await page.locator('input[value="19"]').check();
    await expect(page.locator('.descriptor-panel [data-state="current"]')).toBeAttached();
    stages.before = { isolated: await page.evaluate(() => crossOriginIsolated), cache: await cacheState(page) };
    expect((stages.before as { isolated: boolean }).isolated).toBe(true);
    expect((stages.before as { cache: { corp: string | null; cached: boolean }[] }).cache.every(item => item.cached && item.corp === null)).toBe(true);
    await page.getByRole('button', { name: spanish['projects.save'], exact: true }).click();
    await page.locator('#project-name').fill('Prueba local de actualización');
    await page.getByRole('button', { name: spanish['projects.create'], exact: true }).click();
    await expect(page.locator('.project-feedback')).toContainText(spanish['projects.saved']);
    phase = 'after';
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); if (!registration) throw new Error('Missing existing registration'); await registration.update(); });
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed');
    checkpoint('Replacement service worker is waiting normally.');
    await page.getByRole('button', { name: spanish['editor.inputTitle'], exact: true }).click();
    await expect(page.locator('#sequence-input')).toHaveValue(sequence);
    await page.locator('#sequence-input').fill(sequence + 'W');
    await page.locator('input[value="9"]').check();
    await expect(page.locator('.descriptor-panel [data-state="current"]')).toBeAttached();
    await expect(page.locator('#sequence-input')).toHaveValue(sequence + 'W');
    stages.waiting = { cache: await cacheState(page), draft: await page.locator('#sequence-input').inputValue(), waiting: true };
    await page.getByRole('button', { name: spanish['projects.save'], exact: true }).click();
    await page.getByRole('button', { name: spanish['projects.update'], exact: true }).click();
    await expect.poll(() => writes).toBe(2);
    await expect(page.locator('.project-feedback')).toContainText(spanish['projects.saved']);
    const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).sort()));
    expect(storage[`${PROJECT_POINTER_PREFIX}${owner.id}`]).toBe(projectId);
    // No skipWaiting, unregister, cache deletion, or profile recreation: all old clients close normally.
    await page.close();
    // Model a closed application between launches. Opening probe clients while activation is pending can keep the old controller alive.
    await pause(1_000);
    const currentEntry = readFileSync(resolve(afterDir, 'index.html'), 'utf8').match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
    if (!currentEntry) throw new Error('Missing current entry chunk');
    page = await context.newPage(); watch(page);
    await page.goto(origin + ROUTES.analyze);
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!navigator.serviceWorker.controller && registration?.active?.state === 'activated' && registration.waiting === null;
    });
    checkpoint('Current PWA reopened after normal activation.');
    await expect(page.locator(`script[src="${currentEntry}"]`)).toBeAttached();
    await expect(page.locator('.descriptor-panel [data-state="current"]')).toBeAttached();
    await page.getByRole('button', { name: spanish['editor.inputTitle'], exact: true }).click();
    await expect(page.locator('#sequence-input')).toHaveValue(sequence + 'W');
    await expect(page.locator('input[value="9"]')).toBeChecked();
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).sort()))).toEqual(storage);
    stages.activated = { isolated: await page.evaluate(() => crossOriginIsolated), cache: await cacheState(page), draft: await page.locator('#sequence-input').inputValue(), storageUnchanged: true, currentEntry };
    expect((stages.activated as { isolated: boolean }).isolated).toBe(true);
    // New computations exercise retained precache entries after the online update; WebKit offline remains a separate known limitation.
    await page.locator('#sequence-input').fill(sequence + 'WW');
    await expect(page.locator('.descriptor-panel [data-state="current"]')).toBeAttached();
    await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
    await page.locator(`.site-nav a[href="${ROUTES.alignment}"]`).first().click();
    await expect(page.locator('.verdict')).toBeVisible();
    await page.locator('#alignment-first').fill('ACDEFGHIK');
    await page.locator('#alignment-second').fill('ACDEFGHIK');
    await page.getByRole('button', { name: spanish['alignment.start'], exact: true }).click();
    await expect(page.locator('.verdict')).toContainText('9 de 9');
    const wasmUrl = shared.find(url => url.endsWith('.wasm'));
    if (!wasmUrl) throw new Error('Missing shared WASM URL');
    const wasm = await page.evaluate(async (url) => [...new Uint8Array(await (await fetch(url)).arrayBuffer())], wasmUrl);
    expect(Buffer.from(wasm)).toEqual(readFileSync(resolve(root, 'rust/alignment/pkg/proteinforge_alignment_bg.wasm')));
    await page.locator(`.site-nav a[href="${ROUTES.analyze}"]`).first().click();
    await page.getByRole('button', { name: spanish['editor.inputTitle'], exact: true }).click();
    await expect(page.locator('#sequence-input')).toHaveValue(sequence + 'WW');
    stages.postUpgrade = { descriptors: 5, alignment: '9 de 9', wasmBytes: wasm.length, wasmSha256: hash(Buffer.from(wasm)), draftPreservedAcrossRoutes: true };
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: resolve(output, 'after-upgrade.png'), fullPage: true });
  } finally {
    writeFileSync(resolve(output, 'result.json'), JSON.stringify({ original, current, browser: browser.version(), origin, beforeSwSha256: hash(beforeSw), afterSwSha256: hash(afterSw), shared, stages, errors, external, writes, requests }, null, 2));
    await context.close();
    await new Promise<void>((done, reject) => server.close(error => { if (error) reject(error); else done(); }));
  }
});
