import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

// Run against a production build (`npm run build`), with one isolated browser and no owner session.
// Numbers describe this host and explicit emulation, never certified mobile hardware or field INP.
const samples = Number(process.env.AUDIT_SAMPLES ?? 7);
if (!Number.isInteger(samples) || samples < 1) throw new Error('AUDIT_SAMPLES must be a positive integer.');
const output = process.env.AUDIT_OUTPUT ?? 'artifacts/quality/performance.json';
if (!/^artifacts\/quality\/[\w.-]+\.json$/.test(output)) throw new Error('AUDIT_OUTPUT must stay in artifacts/quality.');
const phases = new Set((process.env.AUDIT_PHASES ?? 'loads,interactions').split(','));
const destinations = (process.env.AUDIT_ROUTES ?? 'home,analyze').split(',');
const port = Number(process.env.AUDIT_PORT ?? 5310);
const baseURL = `http://127.0.0.1:${String(port)}`;
const navigation = readFileSync('src/shared/navigation.ts', 'utf8');
const route = name => {
  const value = navigation.match(new RegExp('(?<![\\w-])' + name + ":\\s*'([^']+)'"))?.[1];
  if (!value) throw new Error(`Missing route ${name}.`);
  return value;
};

// Lighthouse's mobile "slow 4G" profile: 150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up, CPU ×4.
const PROFILES = {
  native: null,
  '4g-cpu4': { latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, cpu: 4 },
  'cpu4': { cpu: 4 },
};
const MOBILE = { width: 360, height: 900 };
const DESKTOP = { width: 1280, height: 900 };

const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
let browser;
const result = {
  recordedAt: new Date().toISOString(),
  build: { indexSha256: createHash('sha256').update(readFileSync('dist/index.html')).digest('hex') },
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
  conditions: { samples, mobile: MOBILE, desktop: DESKTOP, serviceWorkers: 'blocked', cache: 'fresh context per cold load',
    profiles: PROFILES, motion: 'browser default (no reduced motion)',
    events: { durationThresholdMs: 16, note: 'Event Timing reports interactions of 16 ms or more, rounded to 8 ms. An absent entry is counted as 16 ms, an upper bound.' },
    note: 'Vite preview over localhost, without deployed CDN/TLS; CDP emulation, not physical mobile hardware or field INP.' },
  loads: [], interactions: [], errors: [],
};

async function observe(page) {
  await page.addInitScript(() => {
    const audit = { lcp: null, lcpElement: null, fcp: null, cls: 0, shifts: [], longTasks: [], events: [], since: 0 };
    window.__qualityAudit = audit;
    const describe = element => element ? `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? '.' + element.className.trim().split(/\s+/).join('.') : ''}` : null;
    for (const [type, receive, options] of [
      ['largest-contentful-paint', entries => { const last = entries.at(-1); audit.lcp = last?.startTime ?? null; audit.lcpElement = describe(last?.element); }, {}],
      ['paint', entries => { for (const entry of entries) if (entry.name === 'first-contentful-paint') audit.fcp = entry.startTime; }, {}],
      ['layout-shift', entries => { for (const entry of entries) if (!entry.hadRecentInput) { audit.cls += entry.value;
        audit.shifts.push({ start: entry.startTime, value: entry.value, sources: entry.sources.map(source => describe(source.node)) }); } }, {}],
      ['longtask', entries => { audit.longTasks.push(...entries.map(e => ({ start: e.startTime, duration: e.duration }))); }, {}],
      ['event', entries => { audit.events.push(...entries.filter(e => e.interactionId && e.startTime >= audit.since).map(e => ({ name: e.name, duration: e.duration,
        inputDelayMs: e.processingStart - e.startTime, processingMs: e.processingEnd - e.processingStart, id: e.interactionId }))); }, { durationThreshold: 16 }],
    ]) {
      if (PerformanceObserver.supportedEntryTypes.includes(type)) {
        new PerformanceObserver(list => receive(list.getEntries())).observe({ type, buffered: true, ...options });
      }
    }
  });
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).origin !== baseURL) result.errors.push(`External request: ${request.url()}`);
  });
}

async function throttle(context, page, name) {
  const profile = PROFILES[name];
  if (!profile) return;
  const cdp = await context.newCDPSession(page);
  if (profile.latency) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latency,
      downloadThroughput: profile.downloadThroughput, uploadThroughput: profile.uploadThroughput });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
}

const median = values => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const p75 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .75) - 1];

async function load(profile, destination, sample) {
  const context = await browser.newContext({ viewport: MOBILE, serviceWorkers: 'block' });
  const page = await context.newPage();
  await observe(page);
  await throttle(context, page, profile);
  const started = performance.now();
  await page.goto(baseURL + route(destination));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  if (destination === 'analyze') await expect(page.locator('.descriptor-panel .property')).toHaveCount(5, { timeout: 30_000 });
  const readyMs = performance.now() - started;
  // Fixed observation window for late paints and worker-delivered content; no input before LCP.
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => ({ ...window.__qualityAudit,
    navigation: (({ responseStart, domContentLoadedEventEnd, loadEventEnd }) => ({ ttfb: responseStart, domContentLoaded: domContentLoadedEventEnd, load: loadEventEnd }))(performance.getEntriesByType('navigation')[0]),
    resources: performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, type: e.initiatorType, bytes: e.transferSize,
      decodedBytes: e.decodedBodySize, start: e.startTime, end: e.responseEnd })) }));
  delete data.events;
  const blocking = data.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
  result.loads.push({ profile, destination, sample, readyMs, totalBlockingMs: blocking, ...data });
  await context.close();
}

/** One measured action: Event Timing grouped by interaction and the long tasks around it. */
async function measure(page, profile, name, action, ready, expected = 1) {
  await page.evaluate(() => { window.__qualityAudit.events = []; window.__qualityAudit.longTasks = []; window.__qualityAudit.since = performance.now(); });
  const started = performance.now();
  await action();
  await ready();
  const elapsedMs = performance.now() - started;
  // Event Timing entries arrive after the next paint; wait for delivery before reading them.
  await page.waitForTimeout(300);
  const data = await page.evaluate(() => ({ events: window.__qualityAudit.events, longTasks: window.__qualityAudit.longTasks }));
  const groups = new Map();
  for (const event of data.events) {
    const current = groups.get(event.id);
    if (!current || event.duration > current.duration) groups.set(event.id, event);
  }
  result.interactions.push({ profile, name, elapsedMs, expected, interactions: [...groups.values()], longTasks: data.longTasks });
}

async function interactions(profile, sample) {
  const context = await browser.newContext({ viewport: DESKTOP, serviceWorkers: 'block' });
  const page = await context.newPage();
  await observe(page);
  await page.goto(baseURL + route('home'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await throttle(context, page, profile);
  const tools = page.locator('#tools');
  await tools.scrollIntoViewIfNeeded();
  for (const tab of ['compare', 'design', 'laboratory', 'analyze']) {
    await measure(page, profile, 'public-tool-tab', () => page.locator(`#public-tools-${tab}-tab`).click(),
      () => expect(page.locator(`#public-tools-${tab}-panel`)).toBeVisible());
  }
  await page.evaluate(() => { window.scrollTo(0, 0); });
  const preferences = page.locator('.site-bar .preferences-menu');
  await measure(page, profile, 'preferences-open', () => preferences.locator('summary').click(),
    () => expect(preferences).toHaveAttribute('open', ''));
  const theme = sample % 2 === 0 ? 'dark' : 'light';
  await measure(page, profile, 'theme-change', () => preferences.locator(`input[value="${theme}"]`).check({ force: true }),
    () => expect(page.locator('html')).toHaveAttribute('data-theme', theme));
  await preferences.locator('summary').click();

  await page.goto(baseURL + route('analyze'));
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5, { timeout: 30_000 });
  for (const label of ['collapse', 'expand']) {
    await measure(page, profile, 'sidebar-toggle', () => page.locator('.sidebar-toggle').click(),
      () => expect(page.locator('.workspace')).toHaveAttribute('data-compact', label === 'collapse' ? 'true' : 'false'));
  }
  for (const view of ['sequence', 'profile', 'structure', 'summary']) {
    await measure(page, profile, 'analysis-view', () => page.locator(`#analysis-${view}-tab`).click(),
      () => expect(page.locator(`#analysis-${view}-tab`)).toHaveAttribute('aria-selected', 'true'));
  }
  await page.locator('button[aria-controls="sequence-panel"]').click();
  const editor = page.locator('#sequence-input');
  await editor.click();
  await editor.press('Control+End');
  await measure(page, profile, 'sequence-typing', () => editor.pressSequentially('ACDEFGHIKLMNPQRSTVWY'),
    () => expect(editor).toHaveValue(/ACDEFGHIKLMNPQRSTVWY\s*$/), 20);

  await page.setViewportSize(MOBILE);
  const menuButton = page.locator('.workspace-bar button[aria-controls]');
  await measure(page, profile, 'menu-open', () => menuButton.click(), () => expect(page.locator('dialog.workspace-sheet')).toBeVisible());
  await measure(page, profile, 'menu-close', () => page.keyboard.press('Escape'), () => expect(page.locator('dialog.workspace-sheet')).toBeHidden());
  await page.setViewportSize(DESKTOP);

  await page.goto(baseURL + route('generate'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await measure(page, profile, 'generator-search', () => page.getByRole('button', { name: 'Buscar y comparar' }).click(),
    () => expect(page.getByRole('heading', { name: 'Candidatos y comparación' })).toBeVisible({ timeout: 60_000 }));

  await page.goto(baseURL + route('laboratory'));
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(3, { timeout: 30_000 });
  await measure(page, profile, 'laboratory-position', () => page.locator('[data-position="2"]').click(),
    () => expect(page.locator('.lab-inspector select')).toBeVisible());
  const variant = page.locator('.lab-variant-picker button').nth(1);
  await measure(page, profile, 'laboratory-variant', () => variant.click(), () => expect(variant).toHaveAttribute('aria-pressed', 'true'));
  await measure(page, profile, 'laboratory-view', () => page.locator('#laboratory-comparison-tab').click(),
    () => expect(page.locator('#laboratory-comparison-panel')).toBeVisible());
  await context.close();
}

try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
  result.browser = browser.version();
  // Alternate routes inside each round so slow drift of the host affects both alike.
  if (phases.has('loads')) {
    for (let sample = 0; sample < samples; sample++) {
      for (const profile of ['4g-cpu4', 'native']) for (const destination of destinations) await load(profile, destination, sample);
    }
  }
  if (phases.has('interactions')) {
    for (let sample = 0; sample < Math.min(samples, 5); sample++) for (const profile of ['cpu4', 'native']) await interactions(profile, sample);
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  mkdirSync('artifacts/quality', { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}

const summary = { output, errors: result.errors, loads: [], interactions: [] };
for (const profile of ['4g-cpu4', 'native']) for (const destination of ['home', 'analyze']) {
  const rows = result.loads.filter(row => row.profile === profile && row.destination === destination);
  if (!rows.length) continue;
  const elements = Object.entries(Object.groupBy(rows, row => row.lcpElement ?? 'none')).map(([element, list]) => `${element} ×${String(list.length)}`);
  summary.loads.push({ profile, destination, lcpMedianMs: median(rows.map(row => row.lcp)), lcpP75Ms: p75(rows.map(row => row.lcp)),
    fcpMedianMs: median(rows.map(row => row.fcp)), clsMax: Math.max(...rows.map(row => row.cls ?? 0)), tbtMedianMs: median(rows.map(row => row.totalBlockingMs)),
    maxTaskMs: Math.max(0, ...rows.flatMap(row => row.longTasks.map(task => task.duration))),
    bytesMedian: median(rows.map(row => row.resources.reduce((sum, resource) => sum + resource.bytes, 0))), lcpElements: elements });
}
for (const profile of ['cpu4', 'native']) for (const name of new Set(result.interactions.map(row => row.name))) {
  const rows = result.interactions.filter(row => row.profile === profile && row.name === name);
  if (!rows.length) continue;
  // Interactions below the 16 ms threshold leave no entry; each missing one counts as 16 ms.
  const durations = rows.flatMap(row => [...row.interactions.map(event => event.duration),
    ...Array.from({ length: Math.max(0, (row.expected ?? 1) - row.interactions.length) }, () => 16)]);
  summary.interactions.push({ profile, name, actions: rows.length, interactions: durations.length, p75Ms: p75(durations), maxMs: Math.max(...durations),
    elapsedMedianMs: Math.round(median(rows.map(row => row.elapsedMs))), longestTaskMs: Math.max(0, ...rows.flatMap(row => row.longTasks.map(task => task.duration))) });
}
console.info(JSON.stringify(summary, null, 1));
if (result.errors.length) process.exitCode = 1;
