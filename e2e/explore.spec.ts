import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';
import { timestampFromIso } from '../src/features/api/timestamps';
import { ALPHAFOLD_API_URL, EXPLORE_PARAM } from '../src/features/explore/config';
import { ListProjectsResponseSchema } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { GetEntryRequestSchema, GetEntryResponseSchema, SearchEntriesRequestSchema, SearchEntriesResponseSchema } from '../src/gen/proteinforge/reference/v1/reference_service_pb';
import { GRPC_CODES, fulfillRpc, fulfillRpcError, isRpc, rpcMethod, rpcRequest } from './rpc';
import { TEST_ACCOUNT, assertFits, message, setTheme } from './helpers';

const fixture = (accession: string): string => readFileSync(`src/features/descriptors/fixtures/${accession}.fasta`, 'utf8').split(/\r?\n/).slice(1).join('');
const MODEL_FILE = 'AF-P00698-F1-model_v6.bcif';
const MODEL_URL = `https://alphafold.ebi.ac.uk/files/${MODEL_FILE}`;
/** Hen lysozyme as the reference service returned it on 14 Nov 2026 (entry version 253). */
const lysozyme = {
  accession: 'P00698', name: 'Lysozyme C', organism: 'Gallus gallus', reviewed: true, sequence: fixture('P00698'), entryVersion: 253, sequenceVersion: 1,
  retrievedAt: '2026-11-14T16:30:00Z', function: 'Lysozymes have primarily a bacteriolytic function.',
  features: [
    { kind: 'active-site', description: '', begin: 53, end: 53, paired: false }, { kind: 'active-site', description: '', begin: 70, end: 70, paired: false },
    { kind: 'binding-site', description: 'substrate', begin: 119, end: 119, paired: false }, { kind: 'domain', description: 'C-type lysozyme', begin: 19, end: 147, paired: false },
    { kind: 'signal', description: '', begin: 1, end: 18, paired: false }, { kind: 'chain', description: 'Lysozyme C', begin: 19, end: 147, paired: false },
    { kind: 'disulfide', description: '', begin: 24, end: 145, paired: true }, { kind: 'disulfide', description: '', begin: 48, end: 133, paired: true },
    { kind: 'disulfide', description: '', begin: 82, end: 98, paired: true }, { kind: 'disulfide', description: '', begin: 94, end: 112, paired: true },
    { kind: 'variant', description: 'A > V', begin: 49, end: 49, paired: false }, { kind: 'variant', description: 'Y > F', begin: 71, end: 71, paired: false },
    { kind: 'variant', description: 'Y > S', begin: 71, end: 71, paired: false },
  ],
};
const insulin = { ...lysozyme, accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', sequence: fixture('P01308'), features: [] };
type Entry = typeof lysozyme;

/** Answers the reference service with the given entries and checks that only an accession or a query travels. */
async function serveEntries(page: Page, entries: readonly Entry[]): Promise<void> {
  await page.route(isRpc, (route) => {
    const method = rpcMethod(route);
    if (method === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, {});
    if (!method.startsWith('ReferenceService/')) return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
    expect(route.request().headers().authorization).toBe(`Bearer ${TEST_ACCOUNT.accessToken}`);
    const summary = (entry: Entry) => ({ accession: entry.accession, name: entry.name, organism: entry.organism, length: entry.sequence.length, reviewed: entry.reviewed });
    if (method === 'ReferenceService/SearchEntries') {
      expect(rpcRequest(route, SearchEntriesRequestSchema).query).toBe('insulin');
      return fulfillRpc(route, SearchEntriesResponseSchema, { entries: entries.map(summary), limit: 10, truncated: false, retrieveTime: timestampFromIso(lysozyme.retrievedAt) });
    }
    const entry = entries.find(item => item.accession === rpcRequest(route, GetEntryRequestSchema).accession);
    if (!entry) return fulfillRpcError(route, GRPC_CODES.notFound, 'uniprot-not-found');
    return fulfillRpc(route, GetEntryResponseSchema, { entry: {
      summary: summary(entry), sequence: entry.sequence, entryVersion: entry.entryVersion, sequenceVersion: entry.sequenceVersion,
      retrieveTime: timestampFromIso(entry.retrievedAt), function: entry.function, structures: [], features: entry.features,
    } });
  });
}

/** Answers AlphaFold DB locally: the lookup of each accession and the real coordinates of the lysozyme model. */
async function serveModels(page: Page, known: readonly Entry[]): Promise<{ lookups: () => string[] }> {
  const lookups: string[] = [];
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' };
  await page.route('https://alphafold.ebi.ac.uk/**', (route) => {
    const url = route.request().url();
    // Public records are read without the visitor's session.
    expect(route.request().headers().authorization).toBeUndefined();
    if (url === MODEL_URL) return route.fulfill({ path: `e2e/fixtures/${MODEL_FILE}`, contentType: 'application/octet-stream', headers });
    expect(url.startsWith(ALPHAFOLD_API_URL)).toBe(true);
    const accession = url.slice(ALPHAFOLD_API_URL.length);
    lookups.push(accession);
    const entry = known.find(item => item.accession === accession);
    if (!entry) return route.fulfill({ status: 404, json: { error: 'not found' }, headers });
    return route.fulfill({ json: [{ bcifUrl: MODEL_URL, latestVersion: 6, globalMetricValue: 93.88, sequence: entry.sequence, sequenceStart: 1, sequenceEnd: entry.sequence.length }], headers });
  });
  return { lookups: () => lookups };
}

const reading = (page: Page) => page.locator('.explore-current');
const stopButton = (page: Page, kind: string, place: string) => page.locator('.explore-stop').filter({ hasText: kind }).filter({ hasText: place });

test('a protein opens with its predicted model and a tour that explains each stop', async ({ page }) => {
  await serveEntries(page, [lysozyme]);
  const models = await serveModels(page, [lysozyme]);
  await page.goto(ROUTES.explore);
  await expect(page.getByRole('heading', { level: 2, name: lysozyme.name, exact: true })).toBeVisible();
  await expect(page.getByText(spanish['library.viewerReady'])).toBeVisible();
  expect(models.lookups()).toEqual(['P00698']);
  await expect(page.locator('.explore-stage')).toContainText(message('explore.modelProvenance', { version: '6', score: '94', band: spanish['explore.confidenceVeryHigh'] }));
  await expect(page.locator('.explore-tour')).toContainText(message('explore.tourCount', { count: '13' }));
  await expect(page.locator('.explore-stop')).toHaveCount(lysozyme.features.length);

  // The tour starts at what the protein does: its first catalytic residue.
  await reading(page).getByRole('button', { name: spanish['explore.tourStart'] }).click();
  await expect(reading(page).getByRole('heading', { name: spanish['explore.kindActiveSite'] })).toBeFocused();
  await expect(reading(page)).toContainText(message('explore.tourProgress', { index: '1', total: '13' }));
  await expect(reading(page)).toContainText(message('explore.residue', { name: 'Glu', position: '53' }));
  await expect(reading(page)).toContainText(spanish['explore.meansActiveSite']);
  await reading(page).getByRole('button', { name: spanish['explore.tourNext'] }).click();
  await expect(reading(page)).toContainText(message('explore.residue', { name: 'Asp', position: '70' }));

  // A bond names its two residues, not the span between them.
  await stopButton(page, spanish['explore.kindDisulfide'], message('explore.pair', { begin: '24', end: '145' })).click();
  await expect(reading(page)).toContainText(`${message('explore.residue', { name: 'Cys', position: '24' })} · ${message('explore.residue', { name: 'Cys', position: '145' })}`);
  await expect(reading(page)).toContainText(spanish['explore.meansDisulfide']);
  // A long stop gives its extent, and the source text stays in its original language under a note.
  await stopButton(page, spanish['explore.kindDomain'], message('explore.span', { begin: '19', end: '147' })).click();
  await expect(reading(page)).toContainText(message('explore.spanSize', { count: '129', begin: '19', end: '147' }));
  await expect(reading(page)).toContainText(spanish['explore.sourceNote']);
  await expect(reading(page)).toContainText('C-type lysozyme');
  await expect(page.getByText(spanish['library.viewerReady'])).toBeVisible();

  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
  await assertFits(page);
});

test('another protein is found by name, and one without a model keeps its tour as text', async ({ page }) => {
  await serveEntries(page, [lysozyme, insulin]);
  await serveModels(page, [lysozyme]);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(ROUTES.explore);
  await expect(page.getByRole('heading', { level: 2, name: lysozyme.name, exact: true })).toBeVisible();
  await page.getByLabel(spanish['explore.query']).fill('insulin');
  await page.getByRole('button', { name: spanish['explore.search'], exact: true }).click();
  await page.getByRole('button', { name: message('explore.openEntry', { name: insulin.name }) }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.explore}\\?${EXPLORE_PARAM}=P01308$`));
  await expect(page.getByRole('heading', { level: 2, name: insulin.name, exact: true })).toBeVisible();
  await expect(page.locator('.explore-stage')).toContainText(spanish['explore.modelMissing']);
  await expect(page.locator('.explore-tour')).toContainText(spanish['explore.tourEmpty']);
  await assertFits(page);
  // The address names the protein, so going back returns to the previous one.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 2, name: lysozyme.name, exact: true })).toBeVisible();
  await expect(page.getByText(spanish['library.viewerReady'])).toBeVisible();
  await assertFits(page);
});
