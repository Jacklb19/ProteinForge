import { readFileSync } from 'node:fs';
import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';

const tokens = readFileSync(new URL('../src/design-tokens.css', import.meta.url), 'utf8');
const accent = tokens.match(/(?<![\w-])--accent-brand:\s*([^;]+);/)?.[1]?.trim();
if (!accent) throw new Error('The accent design token is missing.');
const { files: fonts } = JSON.parse(readFileSync(new URL('../public/fonts/provenance.json', import.meta.url), 'utf8'));
const chartFamily = fonts.find((font) => font.role === 'interface')?.family;
// Routes come from the navigation catalog so this script never hard-codes a path.
const navigation = readFileSync(new URL('../src/shared/navigation.ts', import.meta.url), 'utf8');
const route = (name) => {
  const value = navigation.match(new RegExp('(?<![\\w-])' + name + ":\\s*'([^']+)'"))?.[1];
  if (!value) throw new Error(`The route ${name} is missing from the navigation catalog.`);
  return value;
};

const port = Number(process.env.PWA_CHECK_PORT ?? 4173);
const baseURL = 'http://127.0.0.1:' + String(port);
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  const offlineIcon = await page.evaluate(async (expectedAccent) => {
    const cached = await caches.match('/app-icon.svg', { ignoreSearch: true });
    const response = await fetch('/app-icon.svg');
    const source = await response.text();
    return !!cached && response.ok && response.headers.get('content-type')?.includes('image/svg+xml')
      && source.includes(expectedAccent) && !source.includes('{{');
  }, accent);
  if (!offlineIcon) throw new Error('Generated application icon is unavailable offline.');
  process.stdout.write('Generated icon verified in precache after offline reload.\n');
  const cachedFonts = await page.evaluate(async (manifest) => {
    const result = [];
    for (const { file: name, family, weight } of manifest) {
      const url = `/fonts/${name}`;
      const cached = await caches.match(url, { ignoreSearch: true });
      const response = await fetch(url);
      const data = new Uint8Array(await response.arrayBuffer());
      if (!cached || !response.ok || String.fromCharCode(...data.slice(0, 4)) !== 'wOF2') {
        throw new Error(`Offline font unavailable: ${name}`);
      }
      await document.fonts.load(`${String(weight)} 16px "${family}"`);
      result.push({ name, bytes: data.length });
    }
    return result;
  }, fonts);
  process.stdout.write(`Offline reload and precached WOFF2 verified: ${JSON.stringify(cachedFonts)}\n`);
  await page.goto(baseURL + route('analyze'));
  await page.waitForEvent('worker', { predicate: (worker) => worker.url().includes('profile.worker') }).catch(() => undefined);
  const chartWorker = page.workers().find((worker) => worker.url().includes('profile.worker'));
  if (!chartWorker) throw new Error('Offline profile worker is missing.');
  await expect.poll(() => chartWorker.evaluate((family) => [...self.fonts].some((face) =>
    face.family.replaceAll('"', '') === family && face.status === 'loaded'), chartFamily)).toBe(true);
  process.stdout.write(`${chartFamily} loaded in the profile worker after offline reload.\n`);
  await page.goto(baseURL + route('alignment'));
  await page.getByRole('textbox', { name: 'Primera secuencia' }).fill('ACDEFGHIK');
  await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill('ACDEFGHIK');
  await page.getByRole('button', { name: 'Alinear' }).click();
  await page.getByRole('heading', { name: 'Resultado del alineamiento' }).waitFor();
  if (!await page.evaluate(() => crossOriginIsolated)) throw new Error('Offline navigation lost cross-origin isolation.');
  process.stdout.write('Offline navigation, alignment workers, and cross-origin isolation verified.\n');
  await page.goto(baseURL + route('generate'));
  await page.getByLabel('Evaluaciones por método').fill('100');
  await page.getByRole('button', { name: 'Buscar y comparar' }).click();
  await page.getByRole('heading', { name: 'Candidatos y comparación' }).waitFor();
  await page.getByRole('button', { name: 'Analizar candidato' }).first().click();
  await page.locator('.analysis-ready').waitFor();
  await page.getByText('Exportar informe', { exact: true }).click();
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Informe PDF', exact: true }).click();
  const report = await reportDownload;
  if (await report.failure()) throw new Error('Offline PDF generation failed.');
  // Inspect actual precache entries; the large online viewer must stay demand-loaded.
  const viewerCached = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      if ((await cache.keys()).some((request) => request.url.includes('molstarRuntime-'))) return true;
    }
    return false;
  });
  if (viewerCached) throw new Error('The online Mol* engine was unexpectedly precached.');
  process.stdout.write('Offline candidate Worker and PDF export verified; Mol* engine excluded from precache.\n');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => { server.httpServer.close((error) => error ? reject(error) : resolve()); });
}
