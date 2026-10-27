import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import { ROUTES } from '../src/shared/navigation';
import { GetResidueMappingRequestSchema, GetResidueMappingResponseSchema } from '../src/gen/proteinforge/reference/v1/reference_service_pb';
import { ListProjectsResponseSchema } from '../src/gen/proteinforge/project/v1/project_service_pb';
import { GRPC_CODES, fulfillRpc, fulfillRpcError, isRpc, rpcMethod, rpcRequest } from './rpc';
import { assertFits, openSequenceEditor, storeSession, setTheme } from './helpers';
import { siftsFixture } from './siftsFixture';

const ACCOUNT = { id: 'e2e-user', email: 'test@example.org', accessToken: 'e2e-token' };
async function supply(page: Page) {
  await storeSession(page, ACCOUNT);
  let requests = 0; let downloads = 0;
  let failure: { code: number; message: string } | null = null;
  let mismatch = false;
  const document = siftsFixture();
  await page.route('https://models.rcsb.org/**', route => {
    expect(route.request().url()).toBe('https://models.rcsb.org/1trz.bcif');
    expect(route.request().headers().authorization).toBeUndefined(); downloads += 1;
    return route.fulfill({ path: 'e2e/fixtures/1TRZ.bcif', contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
  });
  await page.route(isRpc, route => {
    if (rpcMethod(route) === 'ProjectService/ListProjects') return fulfillRpc(route, ListProjectsResponseSchema, {});
    expect(rpcMethod(route)).toBe('ReferenceService/GetResidueMapping');
    expect(route.request().headers().authorization).toBe(`Bearer ${ACCOUNT.accessToken}`);
    expect(rpcRequest(route, GetResidueMappingRequestSchema)).toMatchObject({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 });
    requests += 1;
    return failure ? fulfillRpcError(route, failure.code, failure.message) : fulfillRpc(route, GetResidueMappingResponseSchema, { ...document, referenceSequenceSha256: mismatch ? '0'.repeat(64) : document.referenceSequenceSha256 });
  });
  return { downloads: () => downloads, requests: () => requests, fail: (value: typeof failure) => { failure = value; }, mismatch: () => { mismatch = true; } };
}

async function settleViewer(page: Page): Promise<void> {
  await page.locator('.structure-canvas').scrollIntoViewIfNeeded();
  await expect(page.locator('.structure-canvas')).toBeInViewport();
  await page.evaluate(() => new Promise<void>(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); }));
}

for (const width of [360, 1280]) {
  test(`verified selection travels between Library and Analyze at ${String(width)}px`, async ({ page }) => {
    test.setTimeout(60_000);
    const supplied = await supply(page); const errors: string[] = [];
    page.on('pageerror', error => { errors.push(error.message); });
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.library);
    const status = page.locator('.mapping-status');
    await expect(status).toHaveAttribute('data-mapping-state', 'ambiguous');
    await expect(page.getByLabel(spanish['mapping.chain'])).toHaveValue('');
    expect(supplied.requests()).toBe(1); expect(supplied.downloads()).toBe(1);
    await page.getByLabel(spanish['mapping.chain']).selectOption('A');
    await expect(status).toHaveAttribute('data-mapping-state', 'mapped');
    await expect(status).toContainText('A:1');
    await page.getByLabel(spanish['mapping.position']).fill('60');
    await expect(status).toHaveAttribute('data-mapping-state', 'unmapped');
    await page.getByLabel(spanish['mapping.position']).fill('90');
    await page.getByRole('button', { name: spanish['mapping.openAnalysis'] }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
    await expect(status).toHaveAttribute('data-mapping-state', 'mapped');
    await expect(page.locator('.residue-reader [data-position="90"]')).toHaveClass(/is-selected/);
    const reader = page.locator('.residue-reader');
    await reader.focus(); await reader.press('Home');
    await expect(status).toHaveAttribute('data-mapping-state', 'unmapped');
    await reader.press('End');
    await expect(status).toHaveAttribute('data-mapping-state', 'mapped');
    await expect(page.locator('.mapped-position')).toContainText('P01308:110');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await assertFits(page);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await settleViewer(page);
      await page.screenshot({ path: `artifacts/sifts-analyze-${theme}-${String(width)}.png`, fullPage: true });
    }
    await page.getByRole('link', { name: spanish['structure.openViewer'], exact: true }).click();
    await expect(page.getByLabel(spanish['mapping.position'])).toHaveValue('110');
    await expect(page.getByLabel(spanish['mapping.chain'])).toHaveValue('A');
    await expect(status).toHaveAttribute('data-mapping-state', 'mapped');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await assertFits(page);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await settleViewer(page);
      await page.screenshot({ path: `artifacts/sifts-library-${theme}-${String(width)}.png`, fullPage: true });
    }
    await page.locator('.structure-canvas canvas').click({ position: { x: 8, y: 8 } });
    await expect(page.getByLabel(spanish['mapping.position'])).toHaveValue('');
    await expect(status).toHaveAttribute('data-mapping-state', 'noSelection');
    await page.getByRole('button', { name: spanish['mapping.openAnalysis'] }).click();
    const editor = await openSequenceEditor(page); const text = await editor.inputValue();
    await editor.fill(text + 'A');
    await expect(page.locator('.mapped-reference')).toHaveCount(0);
    await expect(page.locator('.subject-summary .page-meta')).not.toContainText('P01308');
    expect(errors).toEqual([]);
  });
}

test('ordinary anonymous Analyze keeps its immediate drawing without loading the general mapping panel', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', request => { if (/\/(MappedStructure|libraryApi|molstarRuntime)\./.test(request.url())) loaded.push(request.url()); });
  await page.goto(ROUTES.analyze);
  await expect(page.locator('figure.stage.stage-rail')).toBeVisible();
  await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
  await expect(page.locator('.mapped-reference')).toHaveCount(0);
  expect(loaded).toEqual([]);
});

test('mapping failures remain distinct and retry keeps real coordinates and camera controls', async ({ page }) => {
  test.setTimeout(60_000);
  const supplied = await supply(page); supplied.fail({ code: 4, message: 'sifts-timeout' });
  await page.goto(ROUTES.library);
  const status = page.locator('.mapping-status');
  await expect(status).toHaveAttribute('data-mapping-state', 'timeout');
  await expect(page.getByText(spanish['library.viewerReady'], { exact: true })).toBeVisible();
  const canvas = await page.locator('.structure-canvas canvas').elementHandle();
  for (const [code, message, state] of [
    [GRPC_CODES.resourceExhausted, 'sifts-response-too-large', 'size'],
    [GRPC_CODES.resourceExhausted, 'uniprot-rate-limit', 'limit'],
    [GRPC_CODES.notFound, 'sifts-not-found', 'missing'],
    [GRPC_CODES.unavailable, 'sifts-unavailable', 'unavailable'],
    [GRPC_CODES.failedPrecondition, 'sifts-reference-version', 'stale'],
  ] as const) {
    supplied.fail({ code, message });
    await page.getByRole('button', { name: spanish['mapping.retry'] }).click();
    await expect(status).toHaveAttribute('data-mapping-state', state);
    await expect(page.getByLabel(spanish['mapping.chain'])).toBeDisabled();
    await expect(page.getByRole('button', { name: spanish['library.zoomIn'], exact: true })).toBeEnabled();
  }
  supplied.fail(null);
  await page.getByRole('button', { name: spanish['mapping.retry'] }).click();
  await expect(status).toHaveAttribute('data-mapping-state', 'ambiguous');
  expect(supplied.downloads()).toBe(1);
  expect(await canvas.evaluate(node => node.isConnected)).toBe(true);
  // Same mapped fragment, but an incorrect complete-reference digest must still close selection.
  supplied.mismatch(); await page.reload();
  await expect(status).toHaveAttribute('data-mapping-state', 'stale');
  await expect(page.getByLabel(spanish['mapping.chain'])).toBeDisabled();
});

test('English labels and verified correspondence use the same public evidence', async ({ page }) => {
  await supply(page);
  await page.addInitScript(() => { localStorage.setItem('proteinforge.preferences', JSON.stringify({ locale: 'en', theme: 'light' })); });
  await page.goto(ROUTES.library);
  await expect(page.locator('.mapping-status')).toHaveAttribute('data-mapping-state', 'ambiguous');
  await expect(page.getByLabel(english['mapping.chain'])).toBeEnabled();
  await page.getByLabel(english['mapping.chain']).selectOption('C');
  await expect(page.locator('.mapping-status')).toContainText('Unique correspondence');
});
