import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { spanish } from '../src/i18n/es';
import { interfaceFamily, interfaceFonts, message, openSequenceEditor, residueReader, sequencePanelToggle, setTheme } from './helpers';
import { ROUTES } from '../src/shared/navigation';

const sequence = 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN';

for (const width of [360, 1280]) {
  for (const fallback of [false, true]) {
    test(`editor preserves geometry at ${String(width)}px with ${fallback ? 'fallback' : 'interface'} fonts`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      if (fallback) await page.route('**/*.woff2', (route) => route.abort());
      const chartWorkerReady = page.waitForEvent('worker', { predicate: (worker) => worker.url().includes('profile.worker') });
      await page.goto(ROUTES.analyze);
      await page.evaluate(() => document.fonts.ready);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      // The page opens on the bundled insulin with its editor closed; the panel holds the overlaid editor.
      await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'], exact: true })).toBeVisible();
      await expect(page.locator('#sequence-panel')).toHaveCount(0);
      const input = await openSequenceEditor(page);
      await expect(input).toHaveValue(sequence);
      await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
      const reader = residueReader(page);
      await expect(reader).toBeVisible();
      // Interface figures are tabular through `font-variant-numeric`, as the descriptor values use them.
      const widths = await page.evaluate(async (fonts) => {
        const family = fonts[0]?.family ?? '';
        if (!document.fonts.check(`400 16px "${family}"`)) return null;
        const result = [];
        for (const { weight } of fonts) {
          await document.fonts.load(`${String(weight)} 100px "${family}"`);
          result.push(Array.from('0123456789', (digit) => {
            const probe = document.createElement('span');
            probe.style.cssText = `position:absolute;white-space:pre;font:${String(weight)} 100px "${family}";font-variant-numeric:tabular-nums`;
            probe.textContent = digit.repeat(4);
            document.body.append(probe);
            const measured = probe.getBoundingClientRect().width;
            probe.remove();
            return measured;
          }));
        }
        return result;
      }, interfaceFonts);
      if (!fallback) {
        const chartWorker = await chartWorkerReady;
        await expect.poll(() => chartWorker.evaluate((family) => {
          const workerFonts = (globalThis as unknown as { fonts: FontFaceSet }).fonts;
          return [...workerFonts].some((face) => face.family.replaceAll('"', '') === family && face.status === 'loaded');
        }, interfaceFamily)).toBe(true);
        const documentWidth = await page.evaluate(async (family) => {
          await document.fonts.load(`400 100px "${family}"`);
          const context = document.createElement('canvas').getContext('2d');
          if (!context) throw new Error('Missing canvas context.');
          context.font = `400 100px "${family}"`;
          return context.measureText('0123456789').width;
        }, interfaceFamily);
        expect(await chartWorker.evaluate((family) => {
          const context = new OffscreenCanvas(1, 1).getContext('2d');
          if (!context) throw new Error('Missing worker canvas context.');
          context.font = `400 100px "${family}"`;
          return context.measureText('0123456789').width;
        }, interfaceFamily)).toBeCloseTo(documentWidth, 2);
        expect(widths).not.toBeNull();
        for (const digits of widths ?? []) expect(Math.max(...digits) - Math.min(...digits)).toBeLessThan(0.01);
      }
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(page, theme);
        if (!fallback) {
          await page.screenshot({ path: `artifacts/editor-${theme}-${String(width)}.png` });
          await page.screenshot({ path: `artifacts/editor-full-${theme}-${String(width)}.png`, fullPage: true });
        }
        await input.fill(`${sequence.repeat(12)}?`);
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('.invalid-residue')).toHaveText('?');
        await page.getByRole('tab', { name: spanish['workbench.summary'], exact: true }).click();
        await expect(page.getByText(spanish['descriptors.invalid'])).toBeVisible();
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
        await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
        await expect(reader).toBeVisible();
      }
      await page.locator('#fasta-file').setInputFiles({ name: 'entries.fasta', mimeType: 'text/plain', buffer: Buffer.from(Array.from({ length: 100 }, (_, index) => `>entry-${String(index)}\n${sequence}`).join('\n')) });
      const list = page.getByRole('listbox');
      await expect(list).toBeVisible();
      await list.focus();
      for (let index = 0; index < 12; index++) await list.press('ArrowDown');
      await expect(list.getByRole('option', { selected: true })).toContainText('entry-11');
      expect(await list.getByRole('option', { selected: true }).evaluate((element) => element.getBoundingClientRect().height)).toBe(44);
      await expect(input).toHaveValue(sequence);
      if (!fallback) await page.screenshot({ path: `artifacts/editor-fasta-${String(width)}.png`, fullPage: true });
      await page.locator('#fasta-file').setInputFiles({ name: 'invalid.fasta', mimeType: 'text/plain', buffer: Buffer.from('missing header') });
      await expect(page.locator('.fasta-panel [role="status"]')).toContainText(message('fasta.error', { message: '' }));
      expect(errors).toEqual([]);
    });
  }
}

test('editor empty and scientific warning states remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  const title = page.locator('.subject-summary h2');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['workbench.analyzeTitle']);
  await expect(title).toHaveText(spanish['examples.insulinName']);
  await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
  // The example opens with one residue chosen, so the linked views show what a selection does.
  await expect(residueReader(page).locator('[data-position="96"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#reader-readout')).toContainText(message('profile.readerBridge', { position: 31 }));
  const input = await openSequenceEditor(page);
  await page.getByRole('button', { name: spanish['editor.clear'], exact: true }).click();
  await expect(title).toHaveText(spanish['editor.emptyTitle']);
  await expect(page.locator('.subject-summary .page-meta')).toHaveText(spanish['editor.emptyText']);
  await expect(input).toHaveValue('');
  await expect(sequencePanelToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('button', { name: spanish['projects.save'], exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: spanish['editor.toAlignment'], exact: true })).toHaveCount(0);
  const restore = page.getByRole('button', { name: spanish['editor.restoreExample'] });
  await expect(restore).toBeVisible();
  await input.fill('ACX');
  await expect(title).toHaveText(spanish['editor.ownTitle']);
  await page.getByRole('tab', { name: spanish['workbench.summary'], exact: true }).click();
  await expect(page.getByText(message('descriptors.excludedOne', { count: 1 }))).toBeVisible();
  await page.getByRole('tab', { name: spanish['workbench.profile'], exact: true }).click();
  await expect(page.getByText(message('profile.tooShort', { count: 9 }))).toBeVisible();
  await page.getByRole('radio', { name: '19', exact: true }).check();
  await expect(page.getByText(message('profile.tooShort', { count: 19 }))).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-feedback').trim())).toMatch(/^0(?:ms|s)$/);
  await page.screenshot({ path: 'artifacts/editor-empty-short.png', fullPage: true });
  await restore.click();
  await expect(title).toHaveText(spanish['examples.insulinName']);
  await expect(page.locator('#sequence-panel')).toHaveCount(0);
  await page.getByRole('tab', { name: spanish['workbench.sequence'], exact: true }).click();
  await expect(residueReader(page).locator('[data-position="96"]')).toHaveClass(/is-selected/);
});
