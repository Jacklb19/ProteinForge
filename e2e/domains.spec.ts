import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { english } from '../src/i18n/en';
import { fillMessage } from '../src/i18n/message';
import { ROUTES } from '../src/shared/navigation';
import { PREFERENCES_STORAGE_KEY } from '../src/preferences/config';
import type { DomainCatalog, DomainEntry } from '../src/features/domains/catalog';
import { assertFits, message, setTheme } from './helpers';

const catalog = JSON.parse(readFileSync('src/features/domains/catalog.json', 'utf8')) as DomainCatalog;
const sh3 = catalog.domains.filter((domain) => domain.kind === 'sh3');
const [first, second] = sh3;
if (!first || !second) throw new Error('The catalogue needs two SH3 parts.');
const stretch = (domain: DomainEntry): string => message('domains.stretch', { kind: message('domains.kindSh3'), start: String(domain.feature.start), end: String(domain.feature.end) });

/** Library opens on the example structure, so its coordinates are served before navigating. */
async function serveStructure(page: Page): Promise<void> {
  await page.route('https://models.rcsb.org/**', (route) => route.fulfill({
    path: 'e2e/fixtures/1TRZ.bcif', contentType: 'application/octet-stream',
    headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' },
  }));
}

async function openDomains(page: Page, tab: string, tray: string): Promise<Locator> {
  await page.goto(ROUTES.library);
  // The tabs follow the arrow keys: End reaches the last one, the documented domains.
  await page.getByRole('tab', { selected: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel', { name: tab });
  await expect(panel.getByRole('complementary', { name: tray })).toBeVisible();
  return panel;
}

for (const width of [360, 1280]) {
  test(`documented domains at ${String(width)}px: filters, keyboard assembly, both themes and AA`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await serveStructure(page);
    const panel = await openDomains(page, message('domains.tab'), message('domains.trayTitle'));
    const tray = panel.getByRole('complementary', { name: message('domains.trayTitle') });
    await expect(panel.getByText(message('domains.count', { shown: String(catalog.domains.length), total: String(catalog.domains.length) }))).toBeVisible();

    await panel.getByLabel(message('domains.kind')).selectOption('sh3');
    await expect(panel.getByText(message('domains.count', { shown: String(sh3.length), total: String(catalog.domains.length) }))).toBeVisible();
    await panel.getByLabel(message('domains.query')).fill('no-such-part');
    await panel.getByRole('button', { name: message('domains.clearFilters') }).click();
    await expect(panel.getByLabel(message('domains.kind'))).toHaveValue('');

    // Everything works from the keyboard: add two parts, then move the second above the first.
    const card = (domain: DomainEntry): Locator => panel.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: stretch(domain), exact: true }) });
    for (const domain of [first, second]) {
      const add = card(domain).getByRole('button', { name: message('domains.add') });
      await add.focus(); await page.keyboard.press('Space');
      await expect(add).toHaveAttribute('aria-pressed', 'true');
    }
    const up = tray.getByRole('button', { name: message('domains.moveUpLabel', { name: `${stretch(second)} · ${second.accession}` }) });
    await up.focus(); await page.keyboard.press('Enter');
    await expect(tray.getByText(second.sequence + first.sequence)).toBeVisible();
    await expect(tray.getByRole('button', { name: message('domains.save') })).toBeDisabled();

    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/domains-${theme}-${String(width)}.png`, fullPage: true });
    }

    // The editor already holds the example, so replacing it is confirmed; the assembly arrives without a source.
    await tray.getByRole('button', { name: message('domains.analyzeAssembly') }).click();
    await page.getByRole('button', { name: message('domains.confirmLoad') }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
    await expect(page.getByRole('heading', { level: 1, name: message('workbench.analyzeTitle') })).toBeVisible();
  });
}

test('documented domains in English name every source in English and keep AA at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.addInitScript((key) => { localStorage.setItem(key, JSON.stringify({ locale: 'en', theme: 'dark' })); }, PREFERENCES_STORAGE_KEY);
  await serveStructure(page);
  const panel = await openDomains(page, english['domains.tab'], english['domains.trayTitle']);
  const heading = fillMessage(english['domains.stretch'], { kind: english['domains.kindSh3'], start: String(first.feature.start), end: String(first.feature.end) });
  const card = panel.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: heading, exact: true }) });
  await expect(card.getByText(first.summary.en)).toBeVisible();
  await expect(card.getByText(fillMessage(english['domains.source'], { source: english['domains.sourcePdb'], licence: 'CC0 1.0' }))).toBeVisible();
  await expect(panel.getByText(/vía SIFTS/)).toHaveCount(0);
  await assertFits(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});
