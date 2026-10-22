import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { assertFits, examplePairTitle, alignmentVerdict, identityEnabled, message, messagePattern, openSequenceEditor } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

const insulin = readFileSync('src/features/descriptors/fixtures/P01308.fasta', 'utf8').split(/\r?\n/).slice(1).join('');
const structure = JSON.parse(readFileSync('src/features/structure/fixtures/1trz-backbone.json', 'utf8')) as { id: string };
const structureLabel = message('structure.label', { name: spanish['examples.insulinName'], id: structure.id });
const HERO_CANVAS = '.stage-hero .backbone-view canvas';

/** Current drawing of the hero structure. */
function drawing(page: Page): Promise<string> {
  return page.locator(HERO_CANVAS).evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
}

/** Lets the page render a number of frames. */
async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate(async (total) => {
    for (let frame = 0; frame < total; frame += 1) await new Promise((resolve) => { requestAnimationFrame(resolve); });
  }, count);
}

/** Waits until the hero structure has been painted with its final fonts. */
async function structurePainted(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator(HERO_CANVAS).evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext('2d');
    if (!context || element.width === 0 || element.height === 0) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) painted += 1;
    return painted;
  })).toBeGreaterThan(0);
}

for (const width of [360, 1280]) {
  test(`landing keeps computed example data and AA at ${String(width)}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeVisible();

    // Two entries of the same size lead to the tools that open on the same protein.
    const analyze = page.getByRole('link', { name: spanish['landing.analyzeAction'], exact: true });
    const compare = page.getByRole('link', { name: spanish['landing.compareAction'], exact: true });
    await expect(analyze).toHaveAttribute('href', ROUTES.analyze);
    await expect(compare).toHaveAttribute('href', ROUTES.alignment);
    const [analyzeBox, compareBox] = [await analyze.boundingBox(), await compare.boundingBox()];
    expect(analyzeBox?.width).toBe(compareBox?.width);
    expect(analyzeBox?.height).toBe(compareBox?.height);

    // The measured structure is drawn, named and offers its three colorings.
    const stage = page.locator('figure.stage.stage-hero');
    await expect(stage.getByRole('group', { name: structureLabel })).toBeVisible();
    await structurePainted(page);
    for (const mode of ['structure.modeChemistry', 'structure.modeHydropathy', 'structure.modeChain'] as const) {
      await stage.getByRole('radio', { name: spanish[mode], exact: true }).check();
      await expect(stage.getByRole('radio', { name: spanish[mode], exact: true })).toBeChecked();
    }

    // The sequence ribbon carries every residue, its named regions and its disulfide bridges.
    const ribbon = page.locator('.strand .ribbon');
    await expect(ribbon.getByRole('img', { name: message('landing.strandLabel', { count: insulin.length }) })).toBeVisible();
    await expect(ribbon.locator('.residue[data-position]')).toHaveCount(insulin.length);
    await expect(ribbon.locator('ul.ribbon-regions li')).toHaveCount(4);
    await expect(ribbon.locator('svg.ribbon-arcs path')).toHaveCount(3);
    await expect(ribbon.locator('.residue[data-position="96"]')).toHaveClass(/is-selected/);
    await ribbon.locator('.residue[data-position="31"]').click();
    await expect(ribbon.locator('.residue[data-position="31"]')).toHaveClass(/is-selected/);
    await expect(ribbon.locator('.residue.is-selected')).toHaveCount(1);

    // Each view shows figures computed in this visit by the real workers.
    // Three tool views, plus what an account adds for visitors who can create one.
    await expect(page.locator('section.view')).toHaveCount(identityEnabled ? 4 : 3);
    const account = page.locator('section.view', { hasText: spanish['landing.accountTitle'] });
    await expect(account).toHaveCount(identityEnabled ? 1 : 0);
    if (identityEnabled) {
      await expect(account.locator('.account-compare dt')).toHaveText([spanish['landing.withoutAccount'], spanish['landing.withAccount']]);
      await expect(account.getByRole('link', { name: spanish['auth.signUpAction'], exact: true })).toHaveAttribute('href', ROUTES.signUp);
      await expect(account.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveAttribute('href', ROUTES.signIn);
    }
    await expect(page.getByRole('img', { name: spanish['landing.profileLabel'] })).toBeVisible();
    await expect(page.locator('.view-fact')).toContainText('11.980,91');
    await expect(page.locator('section.view', { hasText: spanish['landing.alignmentTitle'] }).locator('.view-copy')).toContainText(messagePattern('landing.alignmentText'));
    await expect(page.locator('section.view .alignment-map').getByRole('img', { name: messagePattern('alignment.mapLabel') })).toBeVisible();
    await expect(page.locator('section.view .map-key li')).toHaveCount(4);
    await expect(page.locator('section.view', { hasText: spanish['landing.designTitle'] }).locator('.view-copy')).toContainText(messagePattern('landing.designText'));
    await expect(page.locator('ol.candidate-rows')).toHaveAttribute('aria-label', spanish['generator.guided']);
    await expect(page.locator('ol.candidate-rows li').first()).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('link', { name: spanish['landing.openAnalyze'], exact: true })).toHaveAttribute('href', ROUTES.analyze);
    await expect(page.getByRole('link', { name: spanish['landing.openAlignment'], exact: true })).toHaveAttribute('href', ROUTES.alignment);
    await expect(page.getByRole('link', { name: spanish['landing.openDesign'], exact: true })).toHaveAttribute('href', ROUTES.generate);

    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/landing-${theme}-${String(width)}.png`, fullPage: true });
      await page.screenshot({ path: `artifacts/landing-preview-${theme}-${String(width)}.png` });
    }
  });
}

test('the example action opens the workbench with the insulin sequence loaded', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole('link', { name: spanish['landing.analyzeAction'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['examples.insulinName']);
  await expect(page.getByText(spanish['descriptors.mass'], { exact: true })).toBeVisible();
  await expect(await openSequenceEditor(page)).toHaveValue(insulin);
});

test('reduced motion keeps the structure still and removes the entrance delays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.home);
  expect(await page.locator('main.page').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  // Production CSS normalizes zero milliseconds to zero seconds; both must mean no delay.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-enter').trim())).toMatch(/^0(?:ms|s)$/);
  await structurePainted(page);
  await frames(page, 5);
  const still = await drawing(page);
  await frames(page, 40);
  expect(await drawing(page)).toBe(still);

  // It still answers to the visitor: the arrow keys turn it, and the sequence and the coloring change the drawing.
  const view = page.locator('.stage-hero').getByRole('group', { name: structureLabel });
  await view.focus();
  await view.press('ArrowRight');
  const turned = await drawing(page);
  expect(turned).not.toBe(still);
  await page.locator('.strand .ribbon .residue[data-position="31"]').click();
  await expect.poll(() => drawing(page)).not.toBe(turned);
  const selected = await drawing(page);
  await page.locator('.stage-hero').getByRole('radio', { name: spanish['structure.modeChain'], exact: true }).check();
  await expect.poll(() => drawing(page)).not.toBe(selected);
});

test('the structure turns on its own only until the first interaction', async ({ page }) => {
  await page.goto(ROUTES.home);
  await structurePainted(page);
  const first = await drawing(page);
  await expect.poll(() => drawing(page)).not.toBe(first);
  const view = page.locator('.stage-hero').getByRole('group', { name: structureLabel });
  await view.focus();
  await view.press('ArrowLeft');
  await frames(page, 5);
  const stopped = await drawing(page);
  await frames(page, 40);
  expect(await drawing(page)).toBe(stopped);
});

test('landing, identity and tools form a complete navigation flow', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole('banner').getByRole('link', { name: spanish['shell.signIn'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signIn}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeVisible();
  await page.locator('#app-content').getByRole('link', { name: spanish['auth.signUpAction'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signUp}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signUpTitle'] })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: spanish['shell.home'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeVisible();
  await page.getByRole('link', { name: spanish['landing.compareAction'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(examplePairTitle);
  await expect(alignmentVerdict(page)).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: spanish['shell.home'] }).click();
  await page.getByRole('link', { name: spanish['landing.openDesign'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.generate}$`));
  await expect(page.getByRole('heading', { name: spanish['generator.results'] })).toBeVisible();
});
