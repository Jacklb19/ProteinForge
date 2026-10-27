import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { alignmentInputs, alignmentVerdict, chooseTheme, examplePairTitle, figureValue, message, setTheme } from './helpers';
import { spanish } from '../src/i18n/es';
import { BLOCK_COLUMNS, BLOCK_COLUMNS_NARROW, GAP_EXTEND, GAP_OPEN, MAX_ALIGNMENT_RESIDUES } from '../src/features/alignment/config';
import { ROUTES } from '../src/shared/navigation';

const RESIDUES = 'ACDEFGHIKLMNPQRSTVWY';
const running = message('alignment.running', { percent: '' });

test('aligns with progress, supports cancellation, and displays reproducible metrics', async ({ page }) => {
  await page.goto(ROUTES.alignment);
  const { first, second } = alignmentInputs(page);
  const start = page.getByRole('button', { name: spanish['alignment.start'], exact: true });
  const status = page.locator('.alignment-inputs').getByRole('status');
  const result = page.getByRole('heading', { name: spanish['alignment.result'] });

  // The page opens on the two bundled insulins, already aligned by the real worker.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(examplePairTitle);
  await expect(page.getByRole('textbox', { name: spanish['library.insulin'], exact: true })).toHaveValue(/^MALWMRLL/);
  await expect(page.getByRole('textbox', { name: spanish['library.bovineInsulin'], exact: true })).not.toBeEmpty();
  await expect(alignmentVerdict(page)).toHaveText(new RegExp(`^${message('alignment.verdict', { count: '\\d+', total: '\\d+' })}$`));

  await first.fill('A'.repeat(MAX_ALIGNMENT_RESIDUES));
  await second.fill('A'.repeat(MAX_ALIGNMENT_RESIDUES));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['alignment.title']);
  await expect(page.getByText(spanish['alignment.stale'])).toBeVisible();
  await start.click();
  await expect(status).toContainText(running);
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(start).toBeDisabled();
  await page.getByRole('button', { name: spanish['alignment.cancel'], exact: true }).press('Enter');
  await expect(status).toContainText(spanish['alignment.cancelled']);
  await expect(result).toHaveCount(0);
  await expect(alignmentVerdict(page)).toHaveCount(0);

  await first.fill(RESIDUES);
  await second.fill(RESIDUES);
  await expect(page.getByRole('textbox', { name: spanish['alignment.first'], exact: true })).toHaveValue(RESIDUES);
  await expect(page.getByRole('textbox', { name: spanish['alignment.second'], exact: true })).toHaveValue(RESIDUES);
  await start.click();
  await expect(result).toBeAttached();
  await expect(alignmentVerdict(page)).toHaveText(message('alignment.verdict', { count: 20, total: 20 }));
  await expect(figureValue(page, spanish['alignment.identity'])).toHaveText(/^100\s?%$/);
  await expect(figureValue(page, spanish['alignment.similarity'])).toHaveText(/^100\s?%$/);
  await expect(figureValue(page, spanish['alignment.gaps'])).toHaveText('0');
  await expect(page.getByText(message('alignment.parameters', {
    matrix: 'BLOSUM62', mode: spanish['alignment.global'], open: GAP_OPEN, extend: String(GAP_EXTEND).replace('.', ','), ends: spanish['alignment.freeEnds'],
  }))).toBeVisible();
  await expect(page.locator('.alignment-map')).toBeVisible();
  const block = page.locator('.alignment-block');
  await expect(block).toHaveCount(1);
  await expect(block.locator('.alignment-block-head')).toContainText(message('alignment.columns', { start: 1, end: 20 }));
  await expect(block.locator('.alignment-grid')).toHaveAttribute('aria-hidden', 'true');
  await expect(block.locator('.alignment-column')).toHaveCount(20);
  expect(await block.locator('pre.visually-hidden').evaluate((element) => element.textContent)).toBe(`${RESIDUES}\n${'|'.repeat(20)}\n${RESIDUES}`);
});

test('alignment remains accessible at mobile and desktop widths', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(ROUTES.alignment);
      await chooseTheme(page, theme);
      await expect(alignmentVerdict(page)).toBeVisible();
      const { first, second } = alignmentInputs(page);
      await first.fill(RESIDUES.repeat(8));
      await second.fill(RESIDUES.repeat(8));
      await page.getByRole('button', { name: spanish['alignment.start'], exact: true }).click();
      await expect(alignmentVerdict(page)).toHaveText(message('alignment.verdict', { count: 160, total: 160 }));
      const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const blocks = page.getByRole('region', { name: spanish['alignment.blocksRegion'] });
      const columns = width === 360 ? BLOCK_COLUMNS_NARROW : BLOCK_COLUMNS;
      await expect(blocks.locator('.alignment-block-head').first()).toContainText(message('alignment.columns', { start: 1, end: columns }));
      await expect(blocks.locator('.alignment-block').first().locator('.alignment-column')).toHaveCount(columns);
      // Blocks fit the width, so the region never scrolls sideways; on phones it scrolls down with the keyboard.
      expect(await blocks.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
      if (width === 360) {
        await blocks.focus();
        await blocks.press('ArrowDown');
        await expect.poll(() => blocks.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      await page.screenshot({ path: `artifacts/alignment-${theme}-${String(width)}.png`, fullPage: true });
    }
  }
});

test('alignment empty, invalid and length limit states remain explicit', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(ROUTES.alignment);
      await setTheme(page, theme);
      await expect(alignmentVerdict(page)).toBeVisible();
      const { first, second } = alignmentInputs(page);
      const start = page.getByRole('button', { name: spanish['alignment.start'], exact: true });
      const status = page.locator('.alignment-inputs').getByRole('status');
      await first.fill('');
      await second.fill('');
      await start.click();
      await expect(status).toContainText(spanish['alignment.empty']);
      await first.fill('AC-');
      await second.fill('AC');
      await start.click();
      await expect(status).toContainText(spanish['alignment.invalid']);
      await first.fill('A'.repeat(MAX_ALIGNMENT_RESIDUES + 1));
      await start.click();
      await expect(status).toContainText(message('alignment.limit', { count: '5.000' }));
      await expect(page.getByRole('progressbar')).toHaveCount(0);
      await page.screenshot({ path: `artifacts/alignment-limit-${theme}-${String(width)}.png`, fullPage: true });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
    }
  }
});
