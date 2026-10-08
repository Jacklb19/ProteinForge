import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { assertFits, revealAll } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

test('landing explains the product with a live profile and keeps AA at both widths and themes', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.home);
    await expect(page.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeVisible();
    const chain = page.getByRole('img', { name: spanish['landing.artLabel'] });
    await expect(chain).toBeVisible();
    expect(await chain.locator('circle.hero-bead').count()).toBeGreaterThan(50);
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
    }
  }
});

test('the example action opens the workbench with the insulin sequence loaded', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole('button', { name: spanish['landing.exampleAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByRole('textbox', { name: /secuencia de aminoácidos/i })).toHaveValue(/^MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN$/);
  await expect(page.getByText(/masa molecular/i)).toBeVisible();
});

test('reduced motion removes the ambient sweep and the entrance delays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.home);
  await expect(page.locator('.hero-chain-sweep')).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-enter').trim())).toBe('0ms');
  expect(await page.locator('.hero-bead').first().evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
});
