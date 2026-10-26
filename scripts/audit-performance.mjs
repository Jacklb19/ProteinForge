import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

// Run against a production build, with one isolated browser and no owner session.
// Numbers describe this host and explicit emulation, never certified four-core hardware or field INP.
const samples = Number(process.env.AUDIT_SAMPLES ?? 5);
if (!Number.isInteger(samples) || samples < 1) throw new Error('AUDIT_SAMPLES must be a positive integer.');
const output = process.env.AUDIT_OUTPUT ?? 'artifacts/quality/performance.json';
if (!/^artifacts\/quality\/[\w.-]+\.json$/.test(output)) throw new Error('AUDIT_OUTPUT must stay in artifacts/quality.');
const port = Number(process.env.AUDIT_PORT ?? 5310);
const baseURL = `http://127.0.0.1:${String(port)}`;
const navigation = readFileSync('src/shared/navigation.ts', 'utf8');
const route = name => {
  const value = navigation.match(new RegExp('(?<![\\w-])' + name + ":\\s*'([^']+)'"))?.[1];
  if (!value) throw new Error(`Missing route ${name}.`);
  return value;
};
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
let browser;
const result = {
  recordedAt: new Date().toISOString(),
  build: { indexSha256: createHash('sha256').update(readFileSync('dist/index.html')).digest('hex') },
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
  conditions: { samples, viewport: { width: 360, height: 900 }, serviceWorkers: 'blocked', cache: 'fresh context per cold load',
    interactions: { profile: 'native', eventDurationThresholdMs: 16, note: 'Absent Event Timing entries are not zero latency; synthetic laboratory sample, not field INP.' },
    throttled: { downloadBitsPerSecond: 1_600_000, uploadBitsPerSecond: 750_000, latencyMs: 150, cpuSlowdown: 4 },
    note: 'Vite preview over localhost, without deployed CDN/TLS; CDP emulation, not physical mobile/four-core hardware or field INP.' },
  loads: [], alignments: [], navigation: [], interactions: [], errors: [],
};

async function observe(page) {
  await page.addInitScript(() => {
    const audit = { lcp: null, longTasks: [], events: [], eventSince: 0 };
    window.__qualityAudit = audit;
    for (const [type, receive, options] of [
      ['largest-contentful-paint', entries => { audit.lcp = entries.at(-1)?.startTime ?? null; }, {}],
      ['longtask', entries => { audit.longTasks.push(...entries.map(e => ({ start: e.startTime, duration: e.duration }))); }, {}],
      ['event', entries => { audit.events.push(...entries.filter(e => e.interactionId && e.startTime >= audit.eventSince).map(e => ({ name: e.name, duration: e.duration,
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

async function snapshot(page) {
  return page.evaluate(() => ({ ...window.__qualityAudit,
    resources: performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, bytes: e.transferSize,
      encodedBytes: e.encodedBodySize, decodedBytes: e.decodedBodySize, duration: e.duration })),
    isolated: crossOriginIsolated, hardwareConcurrency: navigator.hardwareConcurrency,
    eventTimingSupported: PerformanceObserver.supportedEntryTypes.includes('event'),
  }));
}

try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
  result.browser = browser.version();
  for (const profile of ['native', '4g-cpu4']) {
    for (const destination of ['home', 'analyze']) {
      for (let sample = 0; sample < samples; sample++) {
        const context = await browser.newContext({ viewport: result.conditions.viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const page = await context.newPage();
        await observe(page);
        if (profile !== 'native') {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        }
        const started = performance.now();
        await page.goto(baseURL + route(destination));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (destination === 'analyze') await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
        const readyMs = performance.now() - started;
        // Fixed observation window, including late paints/worker-delivered content; no user input before LCP.
        await page.waitForTimeout(2000);
        result.loads.push({ profile, destination, sample, readyMs, ...await snapshot(page) });
        await context.close();
      }
    }
  }
  const context = await browser.newContext({ viewport: result.conditions.viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await observe(page);
  await page.goto(baseURL + route('alignment'));
  await expect(page.locator('.verdict')).toBeVisible();
  for (let sample = 0; sample < samples; sample++) {
    const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(100);
    await page.locator('#alignment-first').fill(sequence);
    await page.locator('#alignment-second').fill(sequence);
    await page.evaluate(() => { window.__qualityAudit.longTasks = []; window.__qualityAudit.events = []; window.__qualityAudit.eventSince = performance.now(); });
    const started = performance.now();
    await page.locator('.alignment-actions .button-primary').click();
    await expect(page.locator('.verdict')).toContainText('2.000 de 2.000');
    result.alignments.push({ sample, elapsedMs: performance.now() - started, ...await snapshot(page) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const destination of ['home', 'analyze', 'alignment']) {
    const target = route(destination);
    await page.evaluate(() => { window.__qualityAudit.events = []; window.__qualityAudit.eventSince = performance.now(); window.__qualityAudit.longTasks = []; });
    const started = performance.now();
    await page.locator(`header .site-nav a[href="${target}"]`).click();
    await expect(page).toHaveURL(baseURL + target);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const elapsedMs = performance.now() - started;
    await page.waitForTimeout(250);
    result.navigation.push({ destination, elapsedMs, ...await snapshot(page) });
  }
  await page.goto(baseURL + route('analyze'));
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  await page.setViewportSize({ width: 360, height: 900 });
  async function interaction(name, sample, action, ready) {
    await page.evaluate(() => { window.__qualityAudit.events = []; window.__qualityAudit.eventSince = performance.now(); window.__qualityAudit.longTasks = []; });
    const started = performance.now();
    await action(); await ready();
    const elapsedMs = performance.now() - started;
    // Event Timing is delivered asynchronously; durations below its 16 ms threshold can be absent.
    await page.waitForTimeout(250);
    const data = await snapshot(page);
    const groups = new Map();
    for (const event of data.events) groups.set(event.id, Math.max(groups.get(event.id) ?? 0, event.duration));
    result.interactions.push({ name, sample, elapsedMs, eventDurationsMs: [...groups.values()], ...data });
  }
  for (let sample = 0; sample < samples; sample++) {
    await interaction('menu-open', sample, () => page.locator('button[aria-controls="site-menu"]').click(),
      () => expect(page.locator('#site-menu')).toBeVisible());
    const theme = sample % 2 === 0 ? 'dark' : 'light';
    await interaction('theme-change', sample, () => page.locator(`#site-menu input[value="${theme}"]`).check(),
      () => expect(page.locator('html')).toHaveAttribute('data-theme', theme));
    await interaction('menu-close', sample, () => page.locator('#site-menu .menu-sheet-head button').click(),
      () => expect(page.locator('#site-menu')).toBeHidden());
    const windowSize = sample % 2 === 0 ? '19' : '9';
    await interaction('profile-window', sample, () => page.locator(`input[value="${windowSize}"]`).check(),
      () => expect(page.locator(`input[value="${windowSize}"]`)).toBeChecked());
  }
  await page.locator('button[aria-controls="sequence-panel"]').click();
  const editor = page.locator('#sequence-input');
  for (let sample = 0; sample < samples; sample++) {
    await editor.fill('');
    await expect(page.locator('.descriptor-panel .property')).toHaveCount(0);
    await interaction('sequence-typing-20', sample, () => editor.pressSequentially('ACDEFGHIKLMNPQRSTVWY'),
      () => expect(editor).toHaveValue('ACDEFGHIKLMNPQRSTVWY'));
  }
  await context.close();
} finally {
  await browser?.close();
  await server.httpServer.close();
  mkdirSync('artifacts/quality', { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}
const p75 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .75) - 1];
for (const profile of ['native', '4g-cpu4']) for (const destination of ['home', 'analyze']) {
  const rows = result.loads.filter(row => row.profile === profile && row.destination === destination);
  console.info(JSON.stringify({ profile, destination, lcpP75Ms: p75(rows.map(row => row.lcp)),
    maxTaskMs: Math.max(0, ...rows.flatMap(row => row.longTasks.map(task => task.duration))),
    bytes: rows[0]?.resources.reduce((sum, resource) => sum + resource.bytes, 0) }));
}
console.info(JSON.stringify({ alignmentP75Ms: p75(result.alignments.map(row => row.elapsedMs)), errors: result.errors, output }));
for (const name of new Set(result.interactions.map(row => row.name))) {
  const rows = result.interactions.filter(row => row.name === name);
  const durations = rows.flatMap(row => row.eventDurationsMs);
  console.info(JSON.stringify({ interaction: name, samples: rows.length, reportedInteractionCount: durations.length,
    reportedP75Ms: durations.length ? p75(durations) : null, reportedMaxMs: durations.length ? Math.max(...durations) : null }));
}
if (result.errors.length) process.exitCode = 1;
