import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { webkit, chromium } from '@playwright/test';
import { preview } from 'vite';

// Separates the product from the engine: the same offline steps run against the production build
// and against a minimal control site whose Service Worker only answers from its own cache.
// Run after `npm run build`; WebKit must be installed (`npx playwright install webkit`).
const port = Number(process.env.PROBE_PORT ?? 5316);
const output = process.env.PROBE_OUTPUT ?? 'artifacts/quality/webkit-offline-probe.json';
if (!/^artifacts\/quality\/[\w.-]+\.json$/.test(output)) throw new Error('PROBE_OUTPUT must stay in artifacts/quality.');
const engines = (process.env.PROBE_BROWSERS ?? 'webkit,chromium').split(',');
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const CONTROL_PAGE = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Control</title><h1>Control</h1>'
  + '<script>navigator.serviceWorker.register("/sw.js")</script></html>';
const CONTROL_WORKER = `
self.addEventListener('install', event => { event.waitUntil(caches.open('control').then(cache => cache.addAll(['/']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { event.respondWith(caches.match(event.request).then(hit => hit ?? fetch(event.request))); });
`;

/** Minimal site; `isolated` adds the same cross-origin isolation headers as the product. */
function controlServer(listen, isolated) {
  const server = createServer((request, response) => {
    const headers = isolated ? { ...isolation } : {};
    if (request.url === '/sw.js') response.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' }).end(CONTROL_WORKER);
    else if (request.url === '/') response.writeHead(200, { ...headers, 'Content-Type': 'text/html' }).end(CONTROL_PAGE);
    else response.writeHead(404, headers).end();
  });
  return new Promise(resolve => { server.listen(listen, '127.0.0.1', () => { resolve(server); }); });
}

const close = server => new Promise(resolve => { server.close(() => { resolve(); }); server.closeAllConnections?.(); });

/** A site that can be taken down and brought back, so a real outage replaces offline emulation. */
function site(name, listen, start) {
  let server = null;
  return { name, url: `http://127.0.0.1:${String(listen)}`,
    up: async () => { server ??= await start(); },
    down: async () => { if (server) await close(server); server = null; } };
}

/** Installs the worker, waits for control, goes offline and tries each way of opening the page again. */
async function probe(engine, target) {
  const baseURL = target.url;
  const browser = await engine.launch(engine === chromium ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) } : {});
  const steps = [];
  const attempt = async (name, action) => {
    try { const detail = await action(); steps.push({ name, ok: true, detail }); } catch (error) { steps.push({ name, ok: false, error: String(error.message).split('\n')[0] }); }
  };
  try {
    for (const mode of ['reload', 'goto', 'location.reload', 'in-page fetch', 'server stopped: reload', 'server stopped: fetch']) {
      await target.up();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(baseURL + '/');
      await page.waitForFunction(async () => { await navigator.serviceWorker.ready; return true; });
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      if (mode.startsWith('server stopped')) await target.down(); else await context.setOffline(true);
      if (mode === 'server stopped: reload') {
        await attempt(mode, async () => { await page.reload(); return page.evaluate(() => ({ title: document.title, controlled: navigator.serviceWorker.controller !== null, isolated: crossOriginIsolated })); });
      }
      if (mode === 'server stopped: fetch') await attempt(mode, () => page.evaluate(async () => (await fetch('/')).status));
      if (mode === 'reload') await attempt(mode, async () => (await page.reload())?.status() ?? null);
      if (mode === 'goto') await attempt(mode, async () => (await page.goto(baseURL + '/'))?.status() ?? null);
      if (mode === 'location.reload') {
        await attempt(mode, async () => {
          await Promise.all([page.waitForEvent('load'), page.evaluate(() => { location.reload(); })]);
          return page.evaluate(() => document.title);
        });
      }
      if (mode === 'in-page fetch') await attempt(mode, () => page.evaluate(async () => (await fetch('/')).status));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return { browser: engine.name(), steps };
}

const result = { recordedAt: new Date().toISOString(), platform: process.platform, sites: [] };
const targets = [
  site('product', port, async () => (await preview({ preview: { host: '127.0.0.1', port, strictPort: true } })).httpServer),
  site('control', port + 1, () => controlServer(port + 1, false)),
  site('control-isolated', port + 2, () => controlServer(port + 2, true)),
];
try {
  for (const name of engines) {
    const engine = name === 'webkit' ? webkit : chromium;
    for (const target of targets) result.sites.push({ site: target.name, ...await probe(engine, target) });
  }
} finally {
  for (const target of targets) await target.down();
}
mkdirSync('artifacts/quality', { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
for (const site of result.sites) {
  console.info(`${site.browser} ${site.site}: ${site.steps.map(step => `${step.name} ${step.ok ? 'ok' : 'FAIL (' + step.error + ')'}`).join('; ')}`);
}
