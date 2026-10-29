import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { cpus, platform, release, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { comparePairs, describe, loadsToSeparate, median, verdict } from './lcp-stats.mjs';

// Paired load measurement of two production builds served side by side, so host drift hits both alike.
//   pairs:   cold loads alternating A/B (ABBA order), LCP and long tasks; A = B is the noise calibration.
//   profile: sampled CPU profiles of both builds, self time attributed to source files (needs --sourcemap builds).
// Each build is `vite build --outDir artifacts/lcp-builds/<commit>` from a clean checkout of that commit.
const mode = process.argv[2] ?? 'pairs';
if (!['pairs', 'profile'].includes(mode)) throw new Error('Mode must be pairs or profile.');
const variants = { A: process.env.LCP_A, B: process.env.LCP_B ?? process.env.LCP_A };
for (const [name, directory] of Object.entries(variants)) {
  if (!directory || !/^artifacts\/lcp-builds\/[\w.-]+$/.test(directory)) throw new Error(`LCP_${name} must name a build in artifacts/lcp-builds.`);
  if (!existsSync(`${directory}/index.html`)) throw new Error(`${directory} has no index.html.`);
}
const rounds = Number(process.env.LCP_ROUNDS ?? 20);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error('LCP_ROUNDS must be a positive integer.');
const destinations = (process.env.LCP_ROUTES ?? 'home,analyze').split(',');
const ports = { A: Number(process.env.LCP_PORT_A ?? 5340), B: Number(process.env.LCP_PORT_B ?? 5341) };
const output = process.env.LCP_OUTPUT ?? `artifacts/quality/lcp-${mode}.json`;
if (!/^artifacts\/quality\/[\w.-]+\.json$/.test(output)) throw new Error('LCP_OUTPUT must stay in artifacts/quality.');
// Effects to resolve and the RNF-03 target, in milliseconds.
const EFFECTS = [10, 20, 30, 50, 100];
const LCP_TARGET_MS = 2500;
// Same window as audit-performance.mjs: late paints and Worker-delivered figures can still become the LCP.
const OBSERVATION_MS = 2500;
const PROFILE_MOTION = process.env.LCP_MOTION ?? 'reduce';
// Source files whose self time the profile mode reports; anything else is summed as the rest.
const FOCUS = [
  ['BackboneView', /features\/structure\/(BackboneView\.tsx|backbone\.ts)$/],
  ['HydropathyProfile', /features\/descriptors\/(HydropathyProfile|chartStyle|ResidueReader|PropensityStrips)\.tsx?$/],
  ['ChemistryRibbon', /features\/chemistry\/(SequenceRibbon|ChemistryLegend)\.tsx$/],
];

const navigation = readFileSync('src/shared/navigation.ts', 'utf8');
const route = name => {
  const value = navigation.match(new RegExp('(?<![\\w-])' + name + ":\\s*'([^']+)'"))?.[1];
  if (!value) throw new Error(`Missing route ${name}.`);
  return value;
};

// Lighthouse's mobile "slow 4G": 150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up, CPU ×4; the RNF-03 profile.
const THROTTLE = { latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, cpu: 4 };
const VIEWPORT = { width: 360, height: 900 };

/** Share of host CPU time that was busy between two `os.cpus()` readings, the browser under test included. */
const busy = (before, after) => {
  let idle = 0, total = 0;
  after.forEach((cpu, index) => {
    const previous = before[index]?.times;
    if (!previous) return;
    const spent = Object.keys(cpu.times).reduce((sum, key) => sum + cpu.times[key] - previous[key], 0);
    total += spent;
    idle += cpu.times.idle - previous.idle;
  });
  return total > 0 ? 1 - idle / total : null;
};

const servers = {};
for (const [name, directory] of Object.entries(variants)) {
  servers[name] = await preview({ build: { outDir: directory }, preview: { host: '127.0.0.1', port: ports[name], strictPort: true } });
}
const baseURL = name => `http://127.0.0.1:${String(ports[name])}`;
const fingerprint = directory => createHash('sha256').update(readFileSync(`${directory}/index.html`)).digest('hex');

let browser;
const result = {
  mode, recordedAt: new Date().toISOString(),
  variants: Object.fromEntries(Object.entries(variants).map(([name, directory]) => [name, { directory, indexSha256: fingerprint(directory) }])),
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
  conditions: { rounds, viewport: VIEWPORT, throttle: THROTTLE, serviceWorkers: 'blocked', cache: 'fresh context per load',
    order: 'ABBA: even rounds load A first, odd rounds B first, per route', observationMs: OBSERVATION_MS,
    motion: mode === 'profile' ? PROFILE_MOTION : 'browser default (no reduced motion)',
    note: 'Vite preview over localhost; CDP emulation, not a physical phone. Host busy share includes the measured browser.' },
  loads: [], profiles: [], errors: [],
};

async function open(variant, motion) {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block', ...(motion ? { reducedMotion: motion } : {}) });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(`${variant}: ${error.message}`));
  page.on('request', request => {
    if (new URL(request.url()).origin !== baseURL(variant)) result.errors.push(`${variant}: external request ${request.url()}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: THROTTLE.latency,
    downloadThroughput: THROTTLE.downloadThroughput, uploadThroughput: THROTTLE.uploadThroughput });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpu });
  return { context, page, cdp };
}

async function settle(page, destination) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  if (destination === 'analyze') await expect(page.locator('.descriptor-panel .property')).toHaveCount(5, { timeout: 30_000 });
}

async function load(variant, destination, round) {
  const { context, page } = await open(variant);
  await page.addInitScript(() => {
    const audit = { lcp: null, lcpElement: null, fcp: null, cls: 0, longTasks: [] };
    window.__lcpAudit = audit;
    const describe = element => element ? `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}` : null;
    new PerformanceObserver(list => { const last = list.getEntries().at(-1); audit.lcp = last?.startTime ?? null; audit.lcpElement = describe(last?.element); })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') audit.fcp = entry.startTime; })
      .observe({ type: 'paint', buffered: true });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) audit.cls += entry.value; })
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { audit.longTasks.push(...list.getEntries().map(entry => entry.duration)); })
      .observe({ type: 'longtask', buffered: true });
  });
  const before = cpus();
  await page.goto(baseURL(variant) + route(destination));
  await settle(page, destination);
  await page.waitForTimeout(OBSERVATION_MS);
  const data = await page.evaluate(() => window.__lcpAudit);
  result.loads.push({ variant, destination, round, ...data, hostBusy: busy(before, cpus()),
    totalBlockingMs: data.longTasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0) });
  await context.close();
}

async function profile(variant, destination, round) {
  const { context, page, cdp } = await open(variant, PROFILE_MOTION);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await page.goto(baseURL(variant) + route(destination));
  await settle(page, destination);
  await page.waitForTimeout(2000);
  const { profile: samples } = await cdp.send('Profiler.stop');
  const maps = new Map(), nodes = new Map(samples.nodes.map(node => [node.id, node])), files = new Map();
  for (let index = 0; index < samples.samples.length; index++) {
    const frame = nodes.get(samples.samples[index]).callFrame;
    let source = frame.url || frame.functionName;
    if (source.startsWith(baseURL(variant) + '/assets/')) {
      const map = `${variants[variant]}${new URL(source).pathname}.map`;
      if (existsSync(map)) {
        if (!maps.has(map)) maps.set(map, new SourceMap(JSON.parse(readFileSync(map, 'utf8'))));
        source = maps.get(map).findOrigin(frame.lineNumber + 1, frame.columnNumber + 1).fileName ?? source;
      }
    }
    files.set(source, (files.get(source) ?? 0) + (samples.timeDeltas[index] ?? 0) / 1000);
  }
  const focus = Object.fromEntries(FOCUS.map(([name]) => [name, 0]));
  let scripting = 0, unmapped = 0;
  for (const [source, ms] of files) {
    if (/^\((idle|program|garbage collector)\)$/.test(source)) continue;
    scripting += ms;
    if (source.startsWith(baseURL(variant))) unmapped += ms;
    const match = FOCUS.find(([, pattern]) => pattern.test(source.replaceAll('\\', '/')));
    if (match) focus[match[0]] += ms;
  }
  result.profiles.push({ variant, destination, round, scriptingMs: scripting, focusMs: focus, unmappedMs: unmapped });
  await context.close();
}

try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
  result.browser = browser.version();
  for (let round = 0; round < rounds; round++) {
    for (const destination of destinations) {
      for (const variant of round % 2 === 0 ? ['A', 'B'] : ['B', 'A']) {
        await (mode === 'pairs' ? load : profile)(variant, destination, round);
      }
    }
  }
} finally {
  await browser?.close();
  for (const server of Object.values(servers)) await new Promise(resolve => server.httpServer.close(resolve));
  // Raw rows survive an aborted run; the summary below overwrites this file when the run completes.
  mkdirSync('artifacts/quality', { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}

const summary = { output, mode, variants: result.variants, errors: result.errors, routes: {} };
for (const destination of destinations) {
  if (mode === 'pairs') {
    const rows = variant => result.loads.filter(row => row.variant === variant && row.destination === destination).sort((a, b) => a.round - b.round);
    const lcp = Object.fromEntries(['A', 'B'].map(variant => [variant, describe(rows(variant).map(row => row.lcp))]));
    summary.routes[destination] = {
      lcp,
      rnf03: Object.fromEntries(['A', 'B'].map(variant => [variant, {
        p75: verdict(lcp[variant].p75Interval, LCP_TARGET_MS),
        loadsToSeparateP75: loadsToSeparate(lcp[variant].spread, LCP_TARGET_MS - lcp[variant].p75),
      }])),
      lcpBminusA: comparePairs(rows('A').map((row, index) => [row.lcp, rows('B')[index]?.lcp ?? row.lcp]), EFFECTS),
      blockingBminusA: comparePairs(rows('A').map((row, index) => [row.totalBlockingMs, rows('B')[index]?.totalBlockingMs ?? row.totalBlockingMs]), EFFECTS),
      longestTaskMedian: Object.fromEntries(['A', 'B'].map(variant => [variant, median(rows(variant).map(row => Math.max(0, ...row.longTasks)))])),
      clsMax: Object.fromEntries(['A', 'B'].map(variant => [variant, Math.max(...rows(variant).map(row => row.cls))])),
      lcpElements: Object.fromEntries(['A', 'B'].map(variant => [variant, Object.fromEntries(Object.entries(Object.groupBy(rows(variant), row => row.lcpElement ?? 'none')).map(([element, list]) => [element, list.length]))])),
      hostBusyMedian: median(result.loads.filter(row => row.destination === destination).map(row => row.hostBusy ?? 0)),
    };
  } else {
    const rows = variant => result.profiles.filter(row => row.variant === variant && row.destination === destination).sort((a, b) => a.round - b.round);
    summary.routes[destination] = {
      scriptingMs: Object.fromEntries(['A', 'B'].map(variant => [variant, describe(rows(variant).map(row => row.scriptingMs))])),
      focusMs: Object.fromEntries(FOCUS.map(([name]) => [name, {
        A: describe(rows('A').map(row => row.focusMs[name])),
        B: describe(rows('B').map(row => row.focusMs[name])),
        BminusA: comparePairs(rows('A').map((row, index) => [row.focusMs[name], rows('B')[index]?.focusMs[name] ?? row.focusMs[name]]), EFFECTS),
      }])),
      // Self time left in bundle positions that the source map does not cover; large values mean a build without maps.
      unmappedMs: Object.fromEntries(['A', 'B'].map(variant => [variant, median(rows(variant).map(row => row.unmappedMs))])),
    };
  }
}
result.summary = summary;
mkdirSync('artifacts/quality', { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.info(JSON.stringify(summary, null, 1));
if (result.errors.length) process.exitCode = 1;
