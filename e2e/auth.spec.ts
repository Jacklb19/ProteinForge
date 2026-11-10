import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { assertFits, identityEnabled, setTheme } from './helpers';
import { spanish } from '../src/i18n/es';
import { ROUTES } from '../src/shared/navigation';

// Access pages are what a visitor without a session sees.
test.use({ signedIn: false });

// Identity depends on the environment of the server under test: without settings every screen says so and
// stays disabled; with them the forms are ready and the external provider is offered.
const screens = [
  { route: ROUTES.signIn, title: spanish['auth.signInTitle'], action: spanish['auth.signInAction'], fields: 2, toggles: 1, provider: true },
  { route: ROUTES.signUp, title: spanish['auth.signUpTitle'], action: spanish['auth.signUpAction'], fields: 3, toggles: 2, provider: true },
  { route: ROUTES.recover, title: spanish['auth.recoverTitle'], action: spanish['auth.recoverAction'], fields: 1, toggles: 0, provider: false },
  { route: ROUTES.confirm, title: spanish['auth.confirmTitle'], action: spanish['auth.verifyAction'], fields: 2, toggles: 0, provider: false },
] as const;

// The whole card, the provider button included, must fit the first screen of a laptop and of a phone.
const SCREENS = [[360, 740], [1280, 800]] as const;

for (const [width, height] of SCREENS) {
  for (const screen of screens) {
    test(`identity ${screen.route} fits ${String(width)}×${String(height)} without scrolling and passes AA in both themes`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(screen.route);
      await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
      const action = page.getByRole('button', { name: screen.action, exact: true });
      if (identityEnabled) {
        await expect(page.getByText(spanish['auth.disabled'])).toHaveCount(0);
        await expect(action).toBeEnabled();
      } else {
        await expect(page.getByText(spanish['auth.disabled'])).toBeVisible();
        await expect(action).toBeDisabled();
      }
      if (screen.provider) {
        const provider = page.getByRole('link', { name: spanish['auth.continueGoogle'] });
        await expect(provider).toHaveCount(identityEnabled ? 1 : 0);
        if (identityEnabled) {
          await expect(provider.locator('img.provider-mark')).toBeVisible();
          await expect.poll(() => provider.locator('img.provider-mark').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        }
      }
      // One main region contains the example and the form; inputs align and toggles stay within their fields.
      // Every control of the card ends inside the first screen.
      const lowest = await page.locator('main .auth-page').evaluate((card) => Math.max(...[...card.querySelectorAll('a, button, input')].map(node => node.getBoundingClientRect().bottom)));
      expect(lowest).toBeLessThanOrEqual(height);
      await expect(page.getByText(spanish['lab.saveFile'])).toHaveCount(0);
      const layout = await page.evaluate(() => {
        const main = document.querySelector('main.auth-layout')?.getBoundingClientRect();
        const form = document.querySelector('.auth-form');
        const body = document.querySelector('#app-content')?.getBoundingClientRect();
        if (!main || !form || !body) throw new Error('Missing identity form.');
        const round = (value: number) => Math.round(value * 100) / 100;
        return {
          mains: document.querySelectorAll('main').length,
          left: main.left - body.left, right: document.documentElement.clientWidth - main.right,
          inputs: [...form.querySelectorAll('input')].map((input) => round(input.getBoundingClientRect().width)),
          toggles: [...form.querySelectorAll('.password-control')].map((control) => {
            const input = control.querySelector('input')?.getBoundingClientRect();
            const toggle = control.querySelector('button')?.getBoundingClientRect();
            return Boolean(input && toggle && toggle.left >= input.left && toggle.right <= input.right && toggle.top >= input.top && toggle.bottom <= input.bottom);
          }),
        };
      });
      expect(layout.mains).toBe(1);
      expect(Math.abs(layout.left - layout.right)).toBeLessThanOrEqual(1);
      expect(layout.inputs).toHaveLength(screen.fields);
      expect(new Set(layout.inputs).size).toBe(1);
      expect(layout.toggles).toEqual(Array.from({ length: screen.toggles }, () => true));
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(page, theme);
        await assertFits(page);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
        if (width === 1280 || screen.route === ROUTES.signIn) {
          await page.screenshot({ path: `artifacts/auth-${screen.route.replace('/', '')}-${theme}-${String(width)}.png`, fullPage: true });
        }
      }
    });
  }
}

test('identity screens link to each other and the password toggle reveals the field', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole('banner').getByRole('link', { name: spanish['shell.signIn'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signIn}$`));
  // The address changes before the lazily loaded page replaces the home page, which has its own «Crear cuenta».
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeVisible();
  await page.locator('#app-content').getByRole('link', { name: spanish['auth.signUpAction'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signUp}$`));
  await page.getByRole('link', { name: spanish['auth.signInAction'], exact: true }).click();
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
  await expect(page.getByRole('heading', { level: 1, name: spanish['public.heroTitle'] })).toBeVisible();
});
