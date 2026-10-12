import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spanish } from '../src/i18n/es';
import { SESSION_STORAGE_KEY } from '../src/features/auth/config';
import { ROUTES } from '../src/shared/navigation';
import { assertFits } from './helpers';

const sequence = readFileSync('src/features/descriptors/fixtures/P01308.fasta', 'utf8').split(/\r?\n/).slice(1).join('');
const reference = { accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', length: sequence.length, reviewed: true, sequence, entryVersion: 284, sequenceVersion: 1, retrievedAt: '2026-10-12T08:00:00Z', function: 'Reference annotation in original language.', structures: [{ id: '1TRZ', method: 'X-ray', resolution: '1.60 A', chains: 'A/C=90-110, B/D=25-54' }] };

test('bundled references remain usable without an account and manual edits clear provenance', async ({ page }) => {
  await page.goto(ROUTES.library);
  await expect(page.locator('.reference-listing').first().getByRole('listitem')).toHaveCount(3);
  await page.locator('.reference-listing').first().getByRole('button', { name: spanish['library.load'] }).first().click();
  await expect(page.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue(sequence);
  await expect(page.locator('.sequence-provenance')).toContainText('P01308');
  await page.getByRole('textbox', { name: spanish['editor.label'] }).fill(`${sequence}A`);
  await expect(page.locator('.sequence-provenance')).toHaveCount(0);
});

test('UniProt search and detail import exact sequence/version without sending editor contents', async ({ page }) => {
  await page.addInitScript((key) => { localStorage.setItem(key, JSON.stringify({ accessToken: 'e2e-token', refreshToken: 'e2e-refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: 'e2e-user', email: 'test@example.org' } })); }, SESSION_STORAGE_KEY);
  await page.route('**/v1/projects**', (route) => route.fulfill({ json: { items: [], nextOffset: null } }));
  await page.route('**/v1/uniprot/**', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer e2e-token');
    expect(route.request().postData()).toBeNull();
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/search')) {
      expect(url.searchParams.get('query')).toBe('accession:P01308');
      return route.fulfill({ json: { items: [{ accession: reference.accession, name: reference.name, organism: reference.organism, length: reference.length, reviewed: reference.reviewed }], limit: 10, truncated: false, retrievedAt: reference.retrievedAt } });
    }
    return route.fulfill({ json: reference });
  });
  await page.goto(ROUTES.library);
  await page.getByRole('button', { name: spanish['library.search'], exact: true }).click();
  await page.getByRole('button', { name: 'Consultar P01308' }).click();
  await expect(page.locator('.entry-detail')).toContainText('versión de entrada 284');
  await expect(page.locator('.entry-detail')).toContainText('versión de secuencia 1');
  await page.locator('.entry-detail').getByRole('button', { name: spanish['library.load'] }).click();
  await expect(page.getByRole('textbox', { name: spanish['editor.label'] })).toHaveValue(sequence);
  await expect(page.locator('.sequence-provenance')).toContainText(spanish['library.uniprotSource']);
});

for (const width of [360, 1280]) {
  test(`experimental 1TRZ loads under demand and keeps usable controls at ${String(width)}px`, async ({ page }) => {
    let downloads = 0;
    await page.route('https://models.rcsb.org/**', (route) => {
      expect(route.request().url()).toBe('https://models.rcsb.org/1trz.bcif');
      expect(route.request().headers().authorization).toBeUndefined();
      downloads += 1;
      return route.fulfill({ path: 'e2e/fixtures/1TRZ.bcif', contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.library);
    expect(downloads).toBe(0);
    await page.getByRole('combobox', { name: spanish['library.structureChoose'] }).selectOption('1TRZ');
    await expect(page.getByText(spanish['library.viewerReady'])).toBeVisible();
    expect(downloads).toBe(1);
    await expect(page.locator('.structure-provenance')).toContainText('51 de 110');
    await page.getByRole('button', { name: spanish['library.rotateLeft'] }).click();
    await page.getByRole('button', { name: spanish['library.zoomIn'] }).click();
    const viewer = page.getByRole('img', { name: 'Coordenadas experimentales PDB 1TRZ en Mol*' });
    await viewer.focus(); await expect(viewer).toBeFocused(); await viewer.press('ArrowRight');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/library-${theme}-${String(width)}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: spanish['library.closeViewer'] }).click();
    await expect(page.locator('.structure-canvas')).toHaveCount(0);
  });
}

test('a failed coordinate download is explicit and never replaced by a fabricated structure', async ({ page }) => {
  await page.route('https://models.rcsb.org/**', (route) => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(ROUTES.library);
  await page.getByRole('combobox', { name: spanish['library.structureChoose'] }).selectOption('1TRZ');
  await expect(page.getByText(spanish['library.viewerError'])).toBeVisible();
  await expect(page.getByRole('button', { name: spanish['library.resetView'] })).toBeDisabled();
});
