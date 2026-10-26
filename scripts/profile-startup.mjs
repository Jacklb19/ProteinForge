import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

// Diagnostic sampling is separate from the timing audit: the profiler itself adds overhead.
// Build with `npm run build -- --sourcemap`; maps and profiles remain ignored.
const output = process.env.STARTUP_PROFILE_OUTPUT ?? 'artifacts/quality/startup-profile';
if (!/^artifacts\/quality\/[\w-]+$/.test(output)) throw new Error('Profile output must stay in artifacts/quality.');
const port = Number(process.env.AUDIT_PORT ?? 5310);
const baseURL = `http://127.0.0.1:${String(port)}`;
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
  const context = await browser.newContext({ viewport: { width: 360, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    new PerformanceObserver(list => {
      const entry = list.getEntries().at(-1);
      window.startupLcp = { ms: entry.startTime, element: entry.element?.outerHTML.slice(0, 180) };
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await page.goto(baseURL);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2000);
  const { profile } = await cdp.send('Profiler.stop');
  const { metrics } = await cdp.send('Performance.getMetrics');
  mkdirSync('artifacts/quality', { recursive: true });
  writeFileSync(output + '.cpuprofile', JSON.stringify(profile));
  const maps = new Map(), nodes = new Map(profile.nodes.map(node => [node.id, node])), times = new Map();
  for (let index = 0; index < profile.samples.length; index++) {
    const frame = nodes.get(profile.samples[index]).callFrame;
    let name = frame.functionName, source = frame.url, line = frame.lineNumber;
    if (source.startsWith(baseURL + '/assets/')) {
      const file = 'dist' + new URL(source).pathname + '.map';
      if (existsSync(file)) {
        if (!maps.has(file)) maps.set(file, new SourceMap(JSON.parse(readFileSync(file, 'utf8'))));
        const location = maps.get(file).findOrigin(frame.lineNumber + 1, frame.columnNumber + 1);
        source = location.fileName ?? source;
        line = location.lineNumber ?? line;
        name = location.name ?? name;
      }
    }
    const key = `${source}:${String(line)} ${name}`;
    times.set(key, (times.get(key) ?? 0) + (profile.timeDeltas[index] ?? 0) / 1000);
  }
  const summary = { browser: browser.version(), recordedAt: new Date().toISOString(),
    conditions: { cpuSlowdown: 4, latencyMs: 150, downloadBitsPerSecond: 1_600_000, uploadBitsPerSecond: 750_000 },
    lcp: await page.evaluate(() => window.startupLcp), metrics: metrics.filter(metric => /Duration|Count/.test(metric.name)),
    sampledSelfTimeMs: [...times].sort((a, b) => b[1] - a[1]) };
  writeFileSync(output + '.json', JSON.stringify(summary, null, 2) + '\n');
  console.info(JSON.stringify({ output, lcp: summary.lcp, topSelfTime: summary.sampledSelfTimeMs.slice(0, 12) }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
