import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { alignmentInputs, alignmentVerdict, assertFits, message, navigationLink, openExportMenu } from './helpers';

test('report choices support keyboard, touch targets and AA in both themes and widths', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.analyze);
    await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const summary = page.locator('details.toolbar-menu > summary');
      await summary.focus();
      await summary.press('Enter');
      const choices = page.locator('.toolbar-popover');
      await expect(choices.getByRole('button', { name: spanish['report.pdf'], exact: true })).toBeEnabled();
      await page.keyboard.press('Tab');
      await expect(choices.getByRole('button').first()).toBeFocused();
      await assertFits(page);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(audit.violations, JSON.stringify(audit.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/quality/reports-${String(width)}-${theme}.png`, fullPage: true });
      await summary.focus();
      await summary.press('Enter');
      await expect(choices).toBeHidden();
      await expect(summary).toBeFocused();
    }
  }
});

test('PDF, JSON and profile/alignment CSV are generated locally from the current scientific snapshot', async ({ page }) => {
  const outbound: string[] = [];
  page.on('request', (request) => { if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) outbound.push(request.url()); });
  await page.goto(ROUTES.analyze);
  // The page opens on the bundled insulin, already analyzed.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['examples.insulinName']);
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  let popover = await openExportMenu(page);
  for (const option of ['report.pdf', 'report.json', 'report.profileCsv', 'report.download'] as const) {
    await expect(popover.getByRole('button', { name: spanish[option], exact: true })).toBeVisible();
  }
  // No comparison has been computed in this visit, so its export is not offered.
  await expect(popover.getByRole('button', { name: spanish['report.alignmentCsv'] })).toHaveCount(0);
  const pdfPromise = page.waitForEvent('download');
  await popover.getByRole('button', { name: spanish['report.pdf'], exact: true }).click();
  const pdf = await pdfPromise; await pdf.saveAs('artifacts/proteinforge-report.pdf');
  expect(readFileSync('artifacts/proteinforge-report.pdf').subarray(0, 5).toString()).toBe('%PDF-');
  const jsonPromise = page.waitForEvent('download');
  await popover.getByRole('button', { name: spanish['report.json'] }).click();
  const json = await jsonPromise; await json.saveAs('artifacts/proteinforge-report.json');
  const report = JSON.parse(readFileSync('artifacts/proteinforge-report.json', 'utf8')) as { sequence: string; sequenceSha256: string; source: { accession: string } | null; descriptors: { length: number; massDa: number }; profile: { window: number; points: unknown[] }; alignment: unknown };
  expect(report.sequence.length).toBe(110); expect(report.descriptors.length).toBe(110); expect(report.descriptors.massDa).toBeCloseTo(11980.907, 1);
  expect(report.sequenceSha256).toMatch(/^[0-9a-f]{64}$/); expect(report.profile.points).toHaveLength(102); expect(report.alignment).toBeNull();
  expect(report.source?.accession).toBe('P01308');
  const profilePromise = page.waitForEvent('download');
  await popover.getByRole('button', { name: spanish['report.profileCsv'] }).click();
  const profile = await profilePromise; await profile.saveAs('artifacts/proteinforge-profile.csv');
  expect(readFileSync('artifacts/proteinforge-profile.csv', 'utf8')).toContain(report.sequenceSha256);
  await navigationLink(page, spanish['nav.alignment']).click();
  await expect(alignmentVerdict(page)).toBeVisible();
  const { first, second } = alignmentInputs(page);
  await first.fill('ACD');
  await second.fill('ACE');
  await page.getByRole('button', { name: spanish['alignment.start'], exact: true }).click();
  await expect(alignmentVerdict(page)).toHaveText(message('alignment.verdict', { count: 2, total: 3 }));
  await expect(page.getByText(spanish['alignment.stale'])).toHaveCount(0);
  popover = await openExportMenu(page);
  const alignmentPromise = page.waitForEvent('download');
  await popover.getByRole('button', { name: spanish['report.alignmentCsv'] }).click();
  const alignment = await alignmentPromise; await alignment.saveAs('artifacts/proteinforge-alignment.csv');
  expect(readFileSync('artifacts/proteinforge-alignment.csv', 'utf8')).toContain('"BLOSUM62","global","10","0.5","free"');
  await second.fill('AAAA');
  popover = await openExportMenu(page);
  await popover.getByRole('button', { name: spanish['report.alignmentCsv'] }).click();
  await expect(popover.getByRole('status')).toContainText(spanish['report.stale']);
  expect(outbound).toEqual([]);
});
