import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';

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
  const offlineIcon = await page.evaluate(async () => {
    const cached = await caches.match('/app-icon.svg', { ignoreSearch: true });
    const response = await fetch('/app-icon.svg');
    const source = await response.text();
    return !!cached && response.ok && response.headers.get('content-type')?.includes('image/svg+xml')
      && source.includes('#9a3e16') && !source.includes('{{');
  });
  if (!offlineIcon) throw new Error('Generated application icon is unavailable offline.');
  process.stdout.write('Generated icon verified in precache after offline reload.\n');
  const fonts = await page.evaluate(async () => {
    const paths = ['plex-sans-regular', 'plex-sans-semibold', 'plex-sans-bold', 'plex-mono-regular'];
    const result = [];
    for (const name of paths) {
      const url = `/fonts/${name}.woff2`;
      const cached = await caches.match(url, { ignoreSearch: true });
      const response = await fetch(url);
      const data = new Uint8Array(await response.arrayBuffer());
      if (!cached || !response.ok || String.fromCharCode(...data.slice(0, 4)) !== 'wOF2') {
        throw new Error(`Offline font unavailable: ${name}`);
      }
      result.push({ name, bytes: data.length });
    }
    await Promise.all([document.fonts.load('400 16px "IBM Plex Sans"'), document.fonts.load('600 16px "IBM Plex Sans"'), document.fonts.load('700 16px "IBM Plex Sans"'), document.fonts.load('400 16px "IBM Plex Mono"')]);
    return result;
  });
  process.stdout.write(`Offline reload and precached WOFF2 verified: ${JSON.stringify(fonts)}\n`);
  const chartWorker = page.workers().find((worker) => worker.url().includes('profile.worker'));
  if (!chartWorker) throw new Error('Offline profile worker is missing.');
  await expect.poll(() => chartWorker.evaluate(() => [...self.fonts].some((face) =>
    face.family.replaceAll('"', '') === 'IBM Plex Sans' && face.status === 'loaded'))).toBe(true);
  process.stdout.write('Plex Sans loaded in the profile worker after offline reload.\n');
  await page.goto(baseURL + '/alignment');
  await page.getByRole('textbox', { name: 'Primera secuencia' }).fill('ACDEFGHIK');
  await page.getByRole('textbox', { name: 'Segunda secuencia' }).fill('ACDEFGHIK');
  await page.getByRole('button', { name: 'Alinear' }).click();
  await page.getByRole('heading', { name: 'Resultado del alineamiento' }).waitFor();
  if (!await page.evaluate(() => crossOriginIsolated)) throw new Error('Offline navigation lost cross-origin isolation.');
  process.stdout.write('Offline navigation, alignment workers, and cross-origin isolation verified.\n');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => { server.httpServer.close((error) => error ? reject(error) : resolve()); });
}
