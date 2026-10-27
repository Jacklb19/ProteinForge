import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { timestampFromIso } from '../src/features/api/timestamps';
import { ListProjectsResponseSchema } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { GetEntryRequestSchema, GetEntryResponseSchema, GetResidueMappingRequestSchema, GetResidueMappingResponseSchema, SearchEntriesRequestSchema, SearchEntriesResponseSchema } from '../src/gen/proteinforge/reference/v1/reference_service_pb';
import { siftsFixture } from './siftsFixture';
import { GRPC_CODES, fulfillRpc, fulfillRpcError, isRpc, rpcMethod, rpcRequest } from './rpc';
import { assertFits, message, openExportMenu, openSequenceEditor, storeSession } from './helpers';

const fixture = (accession: string): string => readFileSync(`src/features/descriptors/fixtures/${accession}.fasta`, 'utf8').split(/\r?\n/).slice(1).join('');
const BUNDLED = ['P01308', 'P01317', 'P00698', 'P13569'] as const;
const sequence = fixture('P01308');
const lysozyme = fixture('P00698');
const STRUCTURE_URL = 'https://models.rcsb.org/1trz.bcif';
const ACCOUNT = { id: 'e2e-user', email: 'test@example.org', accessToken: 'e2e-token' };
const reference = { accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', length: sequence.length, reviewed: true, sequence, entryVersion: 284, sequenceVersion: 1, retrievedAt: '2026-10-12T08:00:00Z', function: 'Reference annotation in original language.', structures: [{ id: '1TRZ', method: 'X-ray', resolution: '1.60 A', chains: 'A/C=90-110, B/D=25-54' }] };

/** The page downloads the example coordinates as soon as it opens, so the route is registered before navigating. */
async function serveStructure(page: Page): Promise<{ downloads: () => number }> {
  let downloads = 0;
  await page.route('https://models.rcsb.org/**', (route) => {
    expect(route.request().url()).toBe(STRUCTURE_URL);
    expect(route.request().headers().authorization).toBeUndefined();
    downloads += 1;
    return route.fulfill({ path: 'e2e/fixtures/1TRZ.bcif', contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
  });
  return { downloads: () => downloads };
}

/** Signs in and answers UniProt requests with one entry, checking that only the query travels. */
async function serveUniProt(page: Page, entry: typeof reference): Promise<void> {
  await storeSession(page, ACCOUNT);
  await page.route(isRpc, (route) => {
    const method = rpcMethod(route);
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, {});
    expect(route.request().headers().authorization).toBe(`Bearer ${ACCOUNT.accessToken}`);
    if (method === 'ReferenceService/GetResidueMapping') {
      const request = rpcRequest(route, GetResidueMappingRequestSchema);
      expect(request).toMatchObject({ accession: 'P01308', sequenceVersion: 1 });
      expect(['1TRZ', ...entry.structures.map(item => item.id)]).toContain(request.pdbId);
      if (request.pdbId !== '1TRZ') return fulfillRpcError(route, GRPC_CODES.notFound, 'sifts-not-found');
      return fulfillRpc(route, GetResidueMappingResponseSchema, siftsFixture());
    }
    const summary = { accession: entry.accession, name: entry.name, organism: entry.organism, length: entry.length, reviewed: entry.reviewed };
    const retrieveTime = timestampFromIso(entry.retrievedAt);
    if (method === 'ReferenceService/SearchEntries') {
      // Only the query travels: no sequence or project data.
      expect(rpcRequest(route, SearchEntriesRequestSchema).query).toBe('accession:P01308');
      return fulfillRpc(route, SearchEntriesResponseSchema, { entries: [summary], limit: 10, truncated: false, retrieveTime });
    }
    expect(rpcRequest(route, GetEntryRequestSchema).accession).toBe(entry.accession);
    return fulfillRpc(route, GetEntryResponseSchema, { entry: {
      summary, sequence: entry.sequence, entryVersion: entry.entryVersion, sequenceVersion: entry.sequenceVersion, retrieveTime, function: entry.function,
      structures: entry.structures.map((item) => ({ id: item.id, method: item.method, resolution: item.resolution, chains: item.chains })),
    } });
  });
}

test('bundled references remain usable without an account and manual edits clear provenance', async ({ page }) => {
  await serveStructure(page);
  await page.goto(ROUTES.library);
  const listing = page.locator('.reference-listing').first();
  await expect(listing.getByRole('listitem')).toHaveCount(BUNDLED.length);
  for (const accession of BUNDLED) await expect(listing.getByText(accession, { exact: true })).toBeVisible();
  // The editor already holds the example, so replacing it is a deliberate step.
  await listing.getByRole('listitem').filter({ hasText: 'P00698' }).getByRole('button', { name: spanish['library.load'] }).click();
  const confirmation = page.getByRole('region', { name: spanish['library.replaceTitle'] });
  await expect(confirmation).toContainText(spanish['library.replaceHelp']);
  await expect(page).toHaveURL(new RegExp(`${ROUTES.library}$`));
  await confirmation.getByRole('button', { name: spanish['library.confirmLoad'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByRole('heading', { level: 2, name: spanish['library.lysozyme'], exact: true })).toBeVisible();
  await expect(page.locator('.subject-summary .page-meta')).toContainText('P00698');
  const editor = await openSequenceEditor(page);
  await expect(editor).toHaveValue(lysozyme);
  await editor.fill(`${lysozyme}A`);
  await expect(page.getByRole('heading', { level: 2, name: spanish['editor.ownTitle'], exact: true })).toBeVisible();
  await expect(page.locator('.subject-summary .page-meta')).not.toContainText('P00698');
});

test('UniProt search and detail import exact sequence/version without sending editor contents', async ({ page }) => {
  await serveStructure(page);
  await serveUniProt(page, reference);
  await page.goto(ROUTES.library);
  await page.getByRole('tab', { name: spanish['library.uniprotTitle'] }).click();
  await page.getByRole('button', { name: spanish['library.search'], exact: true }).click();
  await page.getByRole('button', { name: message('library.openEntry', { id: reference.accession }) }).click();
  await expect(page.locator('.entry-detail')).toContainText('versión de entrada 284');
  await expect(page.locator('.entry-detail')).toContainText('versión de secuencia 1');
  await page.locator('.entry-detail').getByRole('button', { name: spanish['library.load'] }).click();
  await page.getByRole('button', { name: spanish['library.confirmLoad'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.locator('.subject-summary .page-meta')).toContainText(reference.accession);
  await expect(await openSequenceEditor(page)).toHaveValue(sequence);
  // The imported provenance travels with the draft: the reproducible report records the exact versions.
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  const popover = await openExportMenu(page);
  const downloadPromise = page.waitForEvent('download');
  await popover.getByRole('button', { name: spanish['report.json'] }).click();
  const download = await downloadPromise; await download.saveAs('artifacts/library-uniprot-report.json');
  const report = JSON.parse(readFileSync('artifacts/library-uniprot-report.json', 'utf8')) as { sequence: string; source: Record<string, unknown> | null };
  expect(report.sequence).toBe(sequence);
  expect(report.source).toMatchObject({ origin: 'uniprot', accession: reference.accession, entryVersion: reference.entryVersion, sequenceVersion: reference.sequenceVersion, retrievedAt: reference.retrievedAt });
});

for (const width of [360, 1280]) {
  test(`experimental 1TRZ loads on arrival and keeps usable controls at ${String(width)}px`, async ({ page }) => {
    const structure = await serveStructure(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.library);
    // The example structure is preselected and its coordinates are requested once, without choosing anything.
    await expect(page.getByRole('combobox', { name: spanish['library.structureChoose'] })).toHaveValue('1TRZ');
    await expect(page.locator('.structure-viewer').getByText(spanish['library.viewerReady'])).toBeVisible();
    expect(structure.downloads()).toBe(1);
    await expect(page.locator('.structure-canvas')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('figure.stage-library')).toHaveCount(0);
    await expect(page.locator('.structure-provenance')).toContainText('51 de 110');
    await page.getByRole('button', { name: spanish['library.rotateLeft'] }).click();
    await page.getByRole('button', { name: spanish['library.zoomIn'] }).click();
    const viewer = page.getByRole('img', { name: message('library.viewerLabel', { id: '1TRZ' }) });
    await viewer.focus(); await expect(viewer).toBeFocused(); await viewer.press('ArrowRight');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({ path: `artifacts/library-${theme}-${String(width)}.png`, fullPage: true });
    }
    // Leaving the selection empty removes the viewer; choosing the structure again downloads it again.
    await page.getByRole('combobox', { name: spanish['library.structureChoose'] }).selectOption('');
    await expect(page.locator('.structure-canvas')).toHaveCount(0);
    await page.getByRole('combobox', { name: spanish['library.structureChoose'] }).selectOption('1TRZ');
    await expect(page.locator('.structure-viewer').getByText(spanish['library.viewerReady'])).toBeVisible();
    expect(structure.downloads()).toBe(2);
  });
}

test('the measured drawing stands in until the viewer is ready, with its status and controls hidden', async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://models.rcsb.org/**', async (route) => {
    await held;
    await route.fulfill({ path: 'e2e/fixtures/1TRZ.bcif', contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
  });
  const requested = page.waitForRequest(STRUCTURE_URL);
  await page.goto(ROUTES.library);
  const placeholder = page.locator('figure.stage.stage-library');
  await expect(placeholder).toBeVisible();
  await expect(placeholder.getByRole('group', { name: message('structure.label', { name: spanish['examples.insulinName'], id: '1TRZ' }) })).toBeVisible();
  await requested;
  await expect(page.locator('.structure-canvas')).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('.structure-viewer').getByRole('status')).toHaveText(spanish['library.viewerLoading']);
  await expect(page.locator('.structure-viewer').getByRole('status')).toHaveClass(/visually-hidden/);
  await expect(page.locator('.structure-viewer .actions')).toBeHidden();
  await expect(page.locator('#structure-instructions')).toBeHidden();
  await expect(page.getByRole('button', { name: spanish['library.resetView'] })).toHaveCount(0);
  release();
  await expect(page.locator('.structure-viewer').getByText(spanish['library.viewerReady'])).toBeVisible();
  await expect(placeholder).toHaveCount(0);
  await expect(page.getByRole('button', { name: spanish['library.resetView'] })).toBeEnabled();
});

test('a failed coordinate download is explicit and never replaced by a fabricated structure', async ({ page }) => {
  await page.route('https://models.rcsb.org/**', (route) => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }));
  // A second annotated structure has no bundled drawing, so its failure has nothing to stand in for it.
  await serveUniProt(page, { ...reference, structures: [...reference.structures, { id: '4INS', method: 'X-ray', resolution: '1.50 A', chains: 'A/C=90-110, B/D=25-54' }] });
  const refusedDownload = page.waitForResponse(response => response.url().startsWith('https://models.rcsb.org/') && response.status() === 503);
  await page.goto(ROUTES.library);
  await refusedDownload;
  // The example keeps the drawing of its measured coordinates; the viewer never becomes ready and stays out of reach.
  const status = page.locator('.structure-viewer').getByRole('status');
  await expect(status).toHaveText(spanish['library.viewerError']);
  await expect(page.locator('figure.stage.stage-library')).toBeVisible();
  await expect(page.locator('.structure-canvas')).toHaveAttribute('data-ready', 'false');
  await expect(status).not.toHaveClass(/visually-hidden/);
  await expect(page.getByRole('button', { name: spanish['library.retry'], exact: true })).toBeVisible();
  await expect(page.locator('.structure-viewer .actions button', { hasText: spanish['library.resetView'] })).toBeDisabled();

  await page.getByRole('tab', { name: spanish['library.uniprotTitle'] }).click();
  await page.getByRole('button', { name: spanish['library.search'], exact: true }).click();
  await page.getByRole('button', { name: message('library.openEntry', { id: reference.accession }) }).click();
  await expect(page.locator('.entry-detail')).toBeVisible();
  await expect(page.locator('.structure-canvas')).toHaveCount(0);
  await page.getByRole('combobox', { name: spanish['library.structureChoose'] }).selectOption('4INS');
  await expect(page.getByText(spanish['library.viewerError'])).toBeVisible();
  await expect(status).not.toHaveClass(/visually-hidden/);
  await expect(page.locator('figure.stage-library')).toHaveCount(0);
  await expect(page.getByRole('button', { name: spanish['library.resetView'] })).toBeDisabled();
  await expect(page.getByRole('button', { name: spanish['library.retry'] })).toBeVisible();
});
