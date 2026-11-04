import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';
import { assertFits, chooseTheme, signInWithEmptyAccount, TEST_ACCOUNT, token } from './helpers';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import { SESSION_STORAGE_KEY } from '../src/features/auth/config';
import { SUPPORT_EMAIL_URL } from '../src/features/legal/config';
import { ROUTES } from '../src/shared/navigation';

// Perfil replaces the former settings page: the old address leads here and the preferences live with the account.
test('profile preferences fit both widths and themes with accessible controls', async ({ page }) => {
  await signInWithEmptyAccount(page);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.settings);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['account.title']);
    // Projects has its own section in the sidebar; the profile no longer repeats it.
    await expect(page.getByRole('link', { name: spanish['projects.listLink'] })).toHaveCount(0);
    for (const theme of ['light', 'dark'] as const) {
      await chooseTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByText(spanish['settings.themeHelp'])).toBeVisible();
      await assertFits(page);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/profile-${theme}-${String(width)}.png`, fullPage: true });
    }
  }
});

test('system theme and English preserve layout and keyboard focus', async ({ page }) => {
  await signInWithEmptyAccount(page);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(ROUTES.settings);
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
  await chooseTheme(page, 'system');
  const system = page.getByRole('radio', { name: spanish['settings.system'], exact: true });
  await system.focus();
  await system.press('ArrowRight');
  await expect(page.getByRole('radio', { name: spanish['settings.light'], exact: true })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await system.focus();
  await chooseTheme(page, 'system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim())).toBe(token('--dark-bg-canvas'));
  await page.getByRole('radio', { name: spanish['settings.english'], exact: true }).check();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(english['account.title']);
  await expect(page.getByRole('button', { name: english['settings.signOut'], exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: english['account.appearance'], exact: true })).toBeVisible();
  await expect(page.getByText(english['settings.themeHelp'])).toBeVisible();
  await expect(page.getByText(spanish['settings.themeHelp'])).toHaveCount(0);
  expect(await page.evaluate(() => document.body.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'artifacts/profile-english-360.png', fullPage: true });
});

test('profile holds the account, its projects and its data choices, and signs out', async ({ page }) => {
  await signInWithEmptyAccount(page);
  await page.goto(ROUTES.profile);
  await expect(page.locator('.profile-head')).toContainText(TEST_ACCOUNT.email);
  for (const title of ['settings.account', 'account.appearance', 'settings.language', 'account.privacy'] as const) {
    await expect(page.getByRole('region', { name: spanish[title], exact: true })).toBeVisible();
  }
  // The account entry of the sidebar is a plain link, marked as the page shown.
  const account = page.getByRole('complementary', { name: spanish['shell.sidebar'] }).getByRole('link', { name: new RegExp(TEST_ACCOUNT.email) });
  await expect(account).toHaveAttribute('href', ROUTES.profile);
  await expect(account).toHaveAttribute('aria-current', 'page');
  await expect(account).not.toHaveAttribute('aria-expanded');
  // Projects has its own section; the header only signs out, without an index or a link to the public site.
  await expect(page.getByRole('region', { name: spanish['projects.title'], exact: true })).toHaveCount(0);
  await expect(page.locator('.profile-head').getByRole('link')).toHaveCount(0);
  await expect(page.locator('.profile-index')).toHaveCount(0);
  await expect(page.locator('.profile-head').getByRole('button', { name: spanish['settings.signOut'], exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: spanish['settings.spanish'], exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: spanish['settings.system'], exact: true })).toBeChecked();
  await expect(page.getByRole('link', { name: spanish['account.policyAction'], exact: true })).toHaveAttribute('href', ROUTES.privacy);
  await expect(page.getByRole('link', { name: spanish['account.deleteAction'], exact: true })).toHaveAttribute('href', SUPPORT_EMAIL_URL);

  // The password link is requested for the signed-in address; the request is answered locally.
  const recovery = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/recover'));
  const password = page.getByRole('button', { name: spanish['account.passwordAction'], exact: true });
  await password.click();
  expect((await recovery).postDataJSON()).toEqual({ email: TEST_ACCOUNT.email });
  await expect(page.getByText(spanish['account.passwordSent'])).toBeVisible();
  await expect(password).toBeDisabled();

  await page.getByRole('button', { name: spanish['settings.signOut'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.signIn}$`));
  await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_STORAGE_KEY)).toBeNull();
  await expect(page.getByRole('banner').getByRole('link', { name: spanish['shell.signIn'], exact: true })).toBeVisible();
});

test.describe('without a session', () => {
  test.use({ signedIn: false });

  test('profile and the former settings address ask to sign in and say where the visitor returns', async ({ page }) => {
    for (const route of [ROUTES.profile, ROUTES.settings]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.signIn}$`));
      await expect(page.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeVisible();
      await expect(page.getByRole('note')).toHaveText(spanish['auth.returnNote'].replace('{{page}}', spanish['nav.profile']));
    }
  });
});
