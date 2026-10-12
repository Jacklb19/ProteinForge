import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { assertFits, revealAll } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

for (const width of [360, 1280]) {
  test(`landing keeps computed example data and AA at ${String(width)}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeVisible();
    const chain = page.getByRole('img', { name: spanish['landing.artLabel'] });
    await expect(chain).toBeVisible();
    await expect(page.getByRole('img', { name: spanish['landing.ornamentLabel'] })).toBeVisible();
    expect(await chain.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.sample-properties')).toContainText('11.980,91');
    expect(await page.locator('.tool-card').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.tool-card[data-status="available"] a')).toHaveCount(2);
    await expect(page.getByRole('img', { name: spanish['landing.helixLabel'] })).toBeVisible();
    await revealAll(page);
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
  await page.getByRole('button', { name: spanish['landing.exampleAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue(/^MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN$/);
  await expect(page.getByText(spanish['descriptors.mass'], { exact: true })).toBeVisible();
});

test('reduced motion removes the ambient sweep and the entrance delays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.home);
  expect(await page.locator('.ornamental-chain').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-enter').trim())).toBe('0ms');
  expect(await page.locator('.ornamental-chain').evaluate((element) => getComputedStyle(element).transform)).toBe('none');
});

test('public sections, registration and workspace entry form a complete navigation flow', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link', { name: spanish['landing.flowLink'] }).click();
  await expect(page.locator('#flow-title')).toBeInViewport();
  await page.getByRole('link', { name: spanish['landing.accountPrimary'], exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signUp}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signUpTitle'] })).toBeVisible();
  await page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link', { name: spanish['landing.primaryAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.workspace}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['workspace.title'] })).toBeVisible();
});
