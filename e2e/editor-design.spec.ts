import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const sequence = 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN';

for (const width of [360, 1280]) {
  for (const fallback of [false, true]) {
    test(`editor preserves geometry at ${String(width)}px with ${fallback ? 'fallback' : 'Plex'} fonts`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      if (fallback) await page.route('**/*.woff2', (route) => route.abort());
      const chartWorkerReady = page.waitForEvent('worker', { predicate: (worker) => worker.url().includes('profile.worker') });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const input = page.getByRole('textbox', { name: /secuencia de aminoácidos/i });
      await input.fill(sequence);
      await expect(page.getByRole('table')).toBeVisible();
      const widths = await page.evaluate(async () => {
        if (!document.fonts.check('400 16px "IBM Plex Sans"')) return null;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Missing canvas context.');
        const result = [];
        for (const weight of [400, 600, 700]) {
          await document.fonts.load(`${String(weight)} 100px "IBM Plex Sans"`);
          context.font = `${String(weight)} 100px "IBM Plex Sans"`;
          result.push(Array.from('0123456789', (digit) => context.measureText(digit).width));
        }
        return result;
      });
      if (!fallback) {
        const chartWorker = await chartWorkerReady;
        await expect.poll(() => chartWorker.evaluate(() => {
          const workerFonts = (globalThis as unknown as { fonts: FontFaceSet }).fonts;
          return [...workerFonts].some((face) => face.family.replaceAll('"', '') === 'IBM Plex Sans' && face.status === 'loaded');
        })).toBe(true);
        expect(await chartWorker.evaluate(() => {
          const context = new OffscreenCanvas(1, 1).getContext('2d');
          if (!context) throw new Error('Missing worker canvas context.');
          context.font = '400 100px "IBM Plex Sans"';
          return context.measureText('0123456789').width;
        })).toBe(600);
        expect(widths).not.toBeNull();
        for (const digits of widths ?? []) expect(Math.max(...digits) - Math.min(...digits)).toBeLessThan(0.01);
      }
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        if (!fallback) {
          await page.screenshot({ path: `artifacts/editor-v2-${theme}-${String(width)}.png` });
          await page.screenshot({ path: `artifacts/editor-v2-full-${theme}-${String(width)}.png`, fullPage: true });
        }
        await input.fill(`${sequence.repeat(12)}?`);
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('.invalid-residue')).toHaveText('?');
        await expect(page.getByText('Los resultados están desactualizados. Corrige las posiciones inválidas para recalcular.')).toBeVisible();
        const geometry = await page.evaluate(() => {
          const textarea = document.querySelector<HTMLTextAreaElement>('#sequence-input');
          const overlay = document.querySelector<HTMLElement>('.editor-highlight');
          if (!textarea || !overlay) throw new Error('Missing editor layers.');
          const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'padding', 'borderWidth', 'width', 'height'] as const;
          return { layers: properties.map((key) => [getComputedStyle(textarea)[key], getComputedStyle(overlay)[key]]), overflow: document.body.scrollWidth - innerWidth };
        });
        for (const pair of geometry.layers) expect(pair[0]).toBe(pair[1]);
        expect(geometry.overflow).toBeLessThanOrEqual(0);
        await input.evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')); });
        expect(await page.locator('.editor-highlight').evaluate((element) => element.scrollTop)).toBe(await input.evaluate((element) => element.scrollTop));
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
        await input.fill(sequence);
        await expect(input).toHaveAttribute('aria-invalid', 'false');
        await expect(page.getByRole('table')).toBeVisible();
      }
      await page.locator('#fasta-file').setInputFiles({ name: 'entries.fasta', mimeType: 'text/plain', buffer: Buffer.from(Array.from({ length: 100 }, (_, index) => `>entry-${String(index)}\n${sequence}`).join('\n')) });
      const list = page.getByRole('listbox');
      await expect(list).toBeVisible();
      await list.focus();
      for (let index = 0; index < 12; index++) await list.press('ArrowDown');
      await expect(list.getByRole('option', { selected: true })).toContainText('entry-11');
      expect(await list.getByRole('option', { selected: true }).evaluate((element) => element.getBoundingClientRect().height)).toBe(44);
      await expect(input).toHaveValue(sequence);
      if (!fallback) await page.screenshot({ path: `artifacts/editor-v2-fasta-${String(width)}.png`, fullPage: true });
      await page.locator('#fasta-file').setInputFiles({ name: 'invalid.fasta', mimeType: 'text/plain', buffer: Buffer.from('missing header') });
      await expect(page.locator('.fasta-panel [role="status"]')).toContainText('Error:');
      expect(errors).toEqual([]);
    });
  }
}

test('editor empty and scientific warning states remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Escribe una secuencia válida para iniciar el análisis.')).toBeVisible();
  await page.getByRole('textbox', { name: /secuencia de aminoácidos/i }).fill('ACX');
  await expect(page.getByText(/Se necesitan al menos 9 residuos/)).toBeVisible();
  await expect(page.getByText(/1 residuo U, O, B, Z o X excluido/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Ventana de residuos' }).selectOption('19');
  await expect(page.getByText(/Se necesitan al menos 19 residuos/)).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-feedback').trim())).toBe('0ms');
  await page.screenshot({ path: 'artifacts/editor-v2-empty-short.png', fullPage: true });
});
