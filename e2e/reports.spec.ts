import { expect, test } from './test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { REPORT_FIRST_SAVE_KEY_PREFIX } from '../src/features/reports/storage/config';
import { ReportKind } from '../src/gen/proteinforge/report/v1/report_service_pb';
import { alignmentInputs, alignmentVerdict, assertFits, message, navigationLink, openExportMenu, setTheme, signInWithEmptyAccount, TEST_ACCOUNT } from './helpers';
import { mockReportStorage, storedFile } from './reportStorage';
import { GRPC_CODES } from './rpc';

test('report choices support keyboard, touch targets and AA in both themes and widths', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.analyze);
    await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
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
  // The session only lists the account's projects and saved reports; the reports themselves send nothing anywhere.
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.hostname.match(/^(localhost|127\.0\.0\.1)$/) && !/\.(ProjectService\/ListProjects|ReportService\/ListReports)$/.test(url.pathname)) outbound.push(request.url());
  });
  await page.goto(ROUTES.analyze);
  // The page opens on the bundled insulin, already analyzed.
  await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'], exact: true })).toBeVisible();
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

/** Signed in with no projects; ReportService and Storage answer locally, every other address is reported. */
async function signedInWithReports(page: Page, options: Parameters<typeof mockReportStorage>[1] = {}) {
  const outbound: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!/^(localhost|127\.0\.0\.1)$/.test(url.hostname) && !url.hostname.endsWith('.invalid')) outbound.push(request.url());
  });
  await signInWithEmptyAccount(page);
  const storage = await mockReportStorage(page, options);
  await page.goto(ROUTES.analyze);
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  return { storage, outbound };
}

test('saving to the account asks once, shows progress, lands in Projects and is removed deliberately', async ({ page }) => {
  const { storage, outbound } = await signedInWithReports(page);
  const popover = await openExportMenu(page);
  const save = popover.getByRole('group', { name: spanish['report.saveToAccount'] });
  await expect(popover.getByRole('group', { name: spanish['report.downloadGroup'] }).getByRole('button', { name: spanish['report.pdf'], exact: true })).toBeVisible();
  await expect(save.getByText(spanish['report.destinationNone'])).toBeVisible();
  await expect(save.getByText(message('report.usage', { count: '0', max: '20', used: '0 KB', limit: '25 MB' }))).toBeVisible();
  // The properties CSV stays a local download: it is not one of the formats offered for saving.
  await expect(save.getByRole('radio')).toHaveCount(3);
  // As in every segmented control, the transparent radio covers its label and takes the click.
  const json = save.getByRole('radio', { name: spanish['report.formatJson'], exact: true });
  await json.click();
  await expect(json).toBeChecked();
  await save.getByRole('button', { name: spanish['report.saveToAccount'] }).click();
  await expect(save.getByText(spanish['report.firstSaveTitle'])).toBeVisible();
  await expect(save.getByRole('button', { name: spanish['projects.cancel'] })).toBeFocused();
  await save.getByRole('button', { name: spanish['report.saveToAccount'] }).click();
  await expect(save.getByText(message('report.saved', { format: spanish['report.json'] }))).toBeVisible();
  await expect(save.getByRole('link', { name: spanish['report.viewInProjects'] })).toBeFocused();
  expect(storage.uploads).toEqual([expect.objectContaining({ contentType: 'application/json' })]);
  // Once told in this browser and account, the next save starts at once.
  await save.getByRole('button', { name: spanish['report.saveToAccount'] }).click();
  await expect.poll(() => storage.uploads.length).toBe(2);
  await expect(save.getByText(spanish['report.firstSaveTitle'])).toHaveCount(0);
  await expect(save.getByText(message('report.saved', { format: spanish['report.json'] }))).toBeVisible();
  await save.getByRole('link', { name: spanish['report.viewInProjects'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.projects}$`));
  const unlinked = page.getByRole('region', { name: spanish['report.unlinkedTitle'] });
  await expect(unlinked.getByRole('listitem')).toHaveCount(2);
  // Two insulin JSON reports; their exact size follows the report, the units do not.
  await expect(unlinked.locator('.report-usage')).toHaveText(/^2 de 20 informes · [\d,]+ KB de 25 MB$/);
  const downloadPromise = page.waitForEvent('download');
  await unlinked.getByRole('button', { name: /^Descargar Informe reproducible JSON del/ }).first().click();
  expect((await downloadPromise).suggestedFilename()).toBe('proteinforge-report.json');
  await unlinked.getByRole('button', { name: /^Quitar Informe reproducible JSON del/ }).first().click();
  await expect(unlinked.getByRole('button', { name: spanish['report.keep'] })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(unlinked.getByRole('button', { name: /^Quitar Informe reproducible JSON del/ }).first()).toBeFocused();
  await unlinked.getByRole('button', { name: /^Quitar Informe reproducible JSON del/ }).first().click();
  await unlinked.getByRole('button', { name: spanish['report.remove'], exact: true }).click();
  await expect(unlinked.getByRole('listitem')).toHaveCount(1);
  expect(storage.deleted).toHaveLength(1);
  expect(outbound).toEqual([]);
});

test('the save group keeps 44 px targets, fits and passes AA at 360 and 1280 px in both themes', async ({ page }) => {
  await signedInWithReports(page);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      const popover = await openExportMenu(page);
      await expect(popover.getByRole('group', { name: spanish['report.saveToAccount'] }).getByRole('button', { name: spanish['report.saveToAccount'] })).toBeVisible();
      await assertFits(page);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(audit.violations, JSON.stringify(audit.violations)).toEqual([]);
      // Escape closes the menu and returns to Export.
      await page.keyboard.press('Escape');
      await expect(popover).toBeHidden();
      await expect(page.locator('details.toolbar-menu > summary')).toBeFocused();
    }
  }
});

test('a full account offers no save, and a failed reservation saves nothing and can be retried', async ({ page }) => {
  const full = Array.from({ length: 20 }, (_, index) => storedFile(`00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, '', ReportKind.PDF, `report ${String(index)}`));
  await signedInWithReports(page, { reports: full });
  let popover = await openExportMenu(page);
  let save = popover.getByRole('group', { name: spanish['report.saveToAccount'] });
  await expect(save.getByRole('alert')).toHaveText(message('report.quotaCount', { max: '20' }));
  await expect(save.getByRole('button', { name: spanish['report.saveToAccount'] })).toHaveCount(0);
  await expect(save.getByRole('link', { name: spanish['report.chooseToRemove'] })).toHaveAttribute('href', ROUTES.projects);

  const other = await page.context().newPage();
  await other.addInitScript(({ key }) => { localStorage.setItem(key, 'seen'); }, { key: `${REPORT_FIRST_SAVE_KEY_PREFIX}${TEST_ACCOUNT.id}` });
  await signInWithEmptyAccount(other);
  const storage = await mockReportStorage(other, { refuseReserve: { code: GRPC_CODES.unavailable, message: 'reports-storage-error' } });
  await other.goto(ROUTES.analyze);
  await expect(other.locator('.descriptor-panel .property')).toHaveCount(5);
  popover = await openExportMenu(other);
  save = popover.getByRole('group', { name: spanish['report.saveToAccount'] });
  await save.getByRole('button', { name: spanish['report.saveToAccount'] }).click();
  await expect(save.getByRole('alert')).toHaveText(spanish['report.saveError']);
  await expect(save.getByRole('button', { name: spanish['report.retry'] })).toBeFocused();
  expect(storage.uploads).toEqual([]);
  await other.close();
});

test('an opened report whose bytes changed is closed and explained', async ({ page }) => {
  await signedInWithReports(page, { reports: [storedFile('00000000-0000-4000-8000-000000000101', '', ReportKind.PDF, '%PDF-1.4 saved')], tamper: true });
  await page.goto(ROUTES.projects);
  const unlinked = page.getByRole('region', { name: spanish['report.unlinkedTitle'] });
  const popupPromise = page.waitForEvent('popup');
  await unlinked.getByRole('button', { name: /^Abrir Informe PDF del/ }).click();
  const popup = await popupPromise;
  await expect(unlinked.getByRole('alert')).toHaveText(spanish['report.hashMismatch']);
  await expect.poll(() => popup.isClosed()).toBe(true);
});
