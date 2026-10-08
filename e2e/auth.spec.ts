import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { assertFits } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

// The local server has no identity settings, so every screen must say so and stay accessible.
const screens = [
  { route: ROUTES.signIn, title: spanish['auth.signInTitle'], action: spanish['auth.signInAction'] },
  { route: ROUTES.signUp, title: spanish['auth.signUpTitle'], action: spanish['auth.signUpAction'] },
  { route: ROUTES.recover, title: spanish['auth.recoverTitle'], action: spanish['auth.recoverAction'] },
] as const;

test('identity screens explain the missing configuration and pass AA at both widths and themes', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of screens) {
      await page.goto(screen.route);
      await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
      await expect(page.getByText(spanish['auth.disabled'])).toBeVisible();
      await expect(page.getByRole('button', { name: screen.action })).toBeDisabled();
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        await assertFits(page);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
        if (width === 1280 || screen.route === ROUTES.signIn) {
          await page.screenshot({ path: `artifacts/auth-${screen.route.replace('/', '')}-${theme}-${String(width)}.png`, fullPage: true });
        }
      }
    }
  }
});

test('identity screens link to each other and the password toggle reveals the field', async ({ page }) => {
  await page.goto(ROUTES.signIn);
  await page.getByRole('link', { name: spanish['auth.signUpAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signUp}$`));
  await page.getByRole('link', { name: spanish['auth.signInAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signIn}$`));
  await page.getByRole('link', { name: spanish['auth.forgot'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.recover}$`));
  await page.getByRole('link', { name: spanish['auth.backToSignIn'] }).click();
  const toggle = page.getByRole('button', { name: spanish['auth.showPassword'] });
  await toggle.click();
  await expect(page.getByLabel(spanish['auth.password'], { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: spanish['auth.hidePassword'] })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: spanish['notFound.title'] })).toBeVisible();
  await page.getByRole('link', { name: spanish['notFound.home'], exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeVisible();
});
