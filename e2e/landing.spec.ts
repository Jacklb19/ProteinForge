import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { assertFits, examplePairTitle, alignmentVerdict, identityEnabled, message, messagePattern, openSequenceEditor, setTheme } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

const insulin = readFileSync('src/features/descriptors/fixtures/P01308.fasta', 'utf8').split(/\r?\n/).slice(1).join('');
const structure = JSON.parse(readFileSync('src/features/structure/fixtures/1trz-backbone.json', 'utf8')) as { id: string };
const labReference = (JSON.parse(readFileSync('src/features/design-lab/fixtures/ubiquitin.json', 'utf8')) as { reference: { id: string } }).reference.id;
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
  test(`the public page keeps real example data, every section and AA at ${String(width)}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1, name: spanish['public.heroTitle'] })).toBeVisible();
    await expect(page.locator('.workspace-sidebar')).toHaveCount(0);

    // The account is the main entry where identity exists; the public example is the secondary one.
    const example = page.locator('.hero-actions').getByRole('link', { name: spanish['public.exploreExample'], exact: true });
    await expect(example).toHaveAttribute('href', ROUTES.analyze);
    const create = page.locator('.hero-actions').getByRole('link', { name: spanish['auth.signUpAction'], exact: true });
    await expect(create).toHaveCount(identityEnabled ? 1 : 0);
    if (identityEnabled) await expect(create).toHaveAttribute('href', ROUTES.signUp);

    // The measured structure is drawn, named and offers its three colorings.
    const stage = page.locator('figure.stage.stage-hero');
    await expect(stage.getByRole('group', { name: structureLabel })).toBeVisible();
    await structurePainted(page);
    for (const mode of ['structure.modeChemistry', 'structure.modeHydropathy', 'structure.modeChain'] as const) {
      await stage.getByRole('radio', { name: spanish[mode], exact: true }).check();
      await expect(stage.getByRole('radio', { name: spanish[mode], exact: true })).toBeChecked();
    }

    // The sequence ribbon carries every residue, its named regions and its disulfide bridges.
    const ribbon = page.locator('.public-strand .ribbon');
    await expect(ribbon.getByRole('img', { name: message('landing.strandLabel', { count: insulin.length }) })).toBeVisible();
    await expect(ribbon.locator('.residue[data-position]')).toHaveCount(insulin.length);
    await expect(ribbon.locator('ul.ribbon-regions li')).toHaveCount(4);
    await expect(ribbon.locator('svg.ribbon-arcs path')).toHaveCount(3);
    await expect(ribbon.locator('.residue[data-position="96"]')).toHaveClass(/is-selected/);
    await ribbon.locator('.residue[data-position="31"]').click();
    await expect(ribbon.locator('.residue[data-position="31"]')).toHaveClass(/is-selected/);
    await expect(ribbon.locator('.residue.is-selected')).toHaveCount(1);

    // Sections answer what it is, which tools exist, how work flows, what evidence means and common doubts.
    for (const id of ['about', 'tools', 'workflow']) await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await expect(page.locator('#about .public-points li')).toHaveCount(3);
    await expect(page.locator('#workflow .public-points li')).toHaveCount(3);
    await expect(page.locator('.public-kinds dt')).toHaveText([spanish['public.experimental'], spanish['public.predicted'], spanish['public.draft']]);
    await expect(page.locator('.public-faq details')).toHaveCount(3);

    // Each tool example shows figures computed in this visit by the real workers, once it is on screen.
    const tools = page.getByRole('tablist', { name: spanish['public.toolsTabs'] });
    await tools.scrollIntoViewIfNeeded();
    await expect(page.locator('#public-tools-analyze-panel .public-facts')).toContainText('11.980,91');
    await expect(page.locator('#public-tools-analyze-panel').getByRole('img', { name: spanish['landing.profileLabel'] })).toBeVisible();
    await tools.getByRole('tab', { name: spanish['nav.alignment'], exact: true }).click();
    const compare = page.locator('#public-tools-compare-panel');
    await expect(compare.locator('figcaption')).toContainText(messagePattern('landing.alignmentText'));
    await expect(compare.locator('.alignment-map').getByRole('img', { name: messagePattern('alignment.mapLabel') })).toBeVisible();
    await expect(compare.locator('.map-key li')).toHaveCount(4);
    await tools.getByRole('tab', { name: spanish['nav.alignment'], exact: true }).press('ArrowRight');
    await expect(tools.getByRole('tab', { name: spanish['nav.generate'], exact: true })).toBeFocused();
    await expect(page.locator('#public-tools-design-panel .public-facts dt')).toHaveText([spanish['generator.length'], spanish['descriptors.gravy'], spanish['generator.budget']]);
    await expect(page.locator('ol.candidate-rows')).toHaveCount(0);
    await tools.getByRole('tab', { name: spanish['workbench.laboratory'], exact: true }).click();
    const lab = page.locator('#public-tools-laboratory-panel');
    await expect(lab.getByRole('group', { name: message('public.labFigureLabel', { id: labReference }) })).toBeVisible();
    await expect(lab.locator('figcaption')).toContainText(messagePattern('public.labFigureFacts'));
    await expect(lab.getByRole('link', { name: message('public.tryTool', { tool: spanish['workbench.laboratory'] }) })).toHaveAttribute('href', ROUTES.laboratory);
    await tools.getByRole('tab', { name: spanish['nav.analyze'], exact: true }).click();
    await expect(page.getByRole('status')).toHaveCount(0);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      await assertFits(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/landing-${theme}-${String(width)}.png`, fullPage: true });
      await page.screenshot({ path: `artifacts/landing-preview-${theme}-${String(width)}.png` });
    }
  });
}

test('the public page starts no tool work on arrival and loads each example when it is shown', async ({ page }) => {
  const workers: string[] = [];
  page.on('request', (request) => {
    const match = /\/([\w-]+\.worker)\.ts/.exec(request.url());
    if (match?.[1]) workers.push(match[1]);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(ROUTES.home);
  await structurePainted(page);
  await frames(page, 10);
  expect(workers).toEqual([]);
  await page.locator('#tools').scrollIntoViewIfNeeded();
  await expect(page.locator('#public-tools-analyze-panel .public-facts')).toBeVisible();
  expect(workers).toContain('descriptors.worker');
  expect(workers).not.toContain('alignment.worker');
  await page.getByRole('tab', { name: spanish['nav.alignment'], exact: true }).click();
  await expect(page.locator('#public-tools-compare-panel .alignment-map')).toBeVisible();
  expect(workers).toContain('alignment.worker');
  await page.getByRole('tab', { name: spanish['nav.generate'], exact: true }).click();
  await frames(page, 10);
  expect(workers).not.toContain('search.worker');
});

test('the example action opens the workbench with the insulin sequence loaded', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.locator('.hero-actions').getByRole('link', { name: spanish['public.exploreExample'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'], exact: true })).toBeVisible();
  await expect(page.getByText(spanish['descriptors.mass'], { exact: true })).toBeVisible();
  await expect(await openSequenceEditor(page)).toHaveValue(insulin);
});

test('reduced motion keeps the structure still and removes the entrance movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.home);
  // Production CSS normalizes zero milliseconds to zero seconds; both must mean no delay.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-enter').trim())).toMatch(/^0(?:ms|s)$/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-reveal').trim())).toMatch(/^0(?:ms|s)$/);
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator('#about')).toHaveAttribute('data-revealed', 'true');
  expect(await page.locator('#about').evaluate((element) => getComputedStyle(element).animationDuration)).toBe('0s');
  expect(await page.locator('#about').evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await page.evaluate(() => { window.scrollTo(0, 0); });
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
  await page.locator('.public-strand .ribbon .residue[data-position="31"]').click();
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

test('presentation, identity and laboratory form a complete navigation flow', async ({ page }) => {
  await page.goto(ROUTES.home);
  const bar = page.locator('header.site-bar');
  await bar.getByRole('link', { name: spanish['shell.signIn'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signIn}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeVisible();
  // Access pages belong to the public frame: no laboratory sidebar.
  await expect(page.locator('.workspace-sidebar')).toHaveCount(0);
  await page.locator('#app-content').getByRole('link', { name: spanish['auth.signUpAction'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signUp}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signUpTitle'] })).toBeVisible();
  await bar.getByRole('link', { name: spanish['shell.home'] }).click();
  await expect(page.getByRole('heading', { level: 1, name: spanish['public.heroTitle'] })).toBeVisible();
  await page.locator('#tools').scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: spanish['nav.alignment'], exact: true }).click();
  await page.locator('#public-tools-compare-panel').getByRole('link', { name: message('public.tryTool', { tool: spanish['nav.alignment'] }) }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(examplePairTitle);
  await expect(alignmentVerdict(page)).toBeVisible();
  await page.locator('.workspace-sidebar').getByRole('link', { name: spanish['shell.home'] }).click();
  await page.locator('#tools').scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: spanish['nav.generate'], exact: true }).click();
  await page.locator('#public-tools-design-panel').getByRole('link', { name: message('public.tryTool', { tool: spanish['nav.generate'] }) }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.generate}$`));
  await expect(page.getByRole('heading', { name: spanish['generator.results'] })).toBeVisible();
});
