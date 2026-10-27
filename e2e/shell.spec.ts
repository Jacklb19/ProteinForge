import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  alignmentVerdict, assertFits, examplePairTitle, followNavigation, identityEnabled, message, openExportMenu, openSequenceEditor, openSiteMenu,
  signInWithEmptyAccount, siteMenu, TEST_ACCOUNT,
} from './helpers';
import { BAR_VEIL_SCROLL_PX, FOOTER_LINKS, NAVIGATION_ITEMS, ROUTES } from '../src/shared/navigation';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import references from '../src/features/descriptors/fixtures/protparam.json' with { type: 'json' };

const destinations = NAVIGATION_ITEMS.filter(item => !item.signedInOnly).map((item) => spanish[item.labelKey]);

// The former workspace address now opens Analizar, which starts on the bundled example.
for (const width of [360, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`the former workspace address opens the analysis, fits ${String(width)}px and passes AA in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTES.workspace);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'], exact: true })).toBeVisible();
      await expect(page.locator('.subject-summary .page-meta')).toContainText('P01308');
      await expect(page.getByRole('tab', { name: spanish['workbench.summary'], exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
      await expect(page.locator('canvas.hydropathy-chart')).toBeHidden();
      await expect(page.locator('figure.stage.stage-rail')).toBeVisible();
      await assertFits(page);
      const header = await page.evaluate(() => {
        const brand = document.querySelector(innerWidth < 1024 ? '.site-bar .brand' : '.workspace-location')?.getBoundingClientRect();
        const actions = document.querySelector('.site-bar-end')?.getBoundingClientRect();
        if (!brand || !actions) throw new Error('Missing site bar.');
        return { brandRight: brand.right, actionsLeft: actions.left };
      });
      expect(header.brandRight).toBeLessThanOrEqual(header.actionsLeft);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `artifacts/analysis-${theme}-${String(width)}.png`, fullPage: true });
      await page.screenshot({ path: `artifacts/analysis-preview-${theme}-${String(width)}.png` });
    });
  }
}

test('first visit opens the example, explains results, exports them and resumes the real draft', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.locator('.hero-actions').getByRole('link', { name: spanish['landing.analyzeAction'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(page.getByText(spanish['guide.mass'])).toBeVisible();
  const exportButton = (await openExportMenu(page)).getByRole('button', { name: spanish['report.download'] });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('The exported CSV is missing.');
  const csv = await readFile(path, 'utf8');
  expect(csv).toContain('"sequence","MALWMRLL');
  const reference = references.find((entry) => entry.accession === 'P01308');
  if (!reference) throw new Error('The insulin reference is missing.');
  const exportedMass = Number(csv.match(/"massDa","([\d.]+)"/)?.[1]);
  expect(Math.abs(exportedMass - reference.massDa)).toBeLessThanOrEqual(0.1);
  // The draft belongs to the visit: it is still there after leaving the tool and coming back.
  await (await openSequenceEditor(page)).fill('ACDEFGHIKLMNPQRSTVWY');
  await followNavigation(page, spanish['nav.home']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['landing.title']);
  await followNavigation(page, spanish['nav.analyze']);
  await expect(page.getByRole('heading', { level: 2, name: spanish['editor.ownTitle'], exact: true })).toBeVisible();
  const editor = await openSequenceEditor(page);
  await expect(editor).toHaveValue('ACDEFGHIKLMNPQRSTVWY');
  await editor.fill('AC-DE');
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  await expect((await openExportMenu(page)).getByRole('button', { name: spanish['report.download'] })).toBeDisabled();
});

test('reduced motion keeps every panel and the tools one step away', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.workspace);
  expect(await page.locator('main.page').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await openSequenceEditor(page);
  expect(await page.locator('#sequence-panel').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  const menu = await openSiteMenu(page);
  expect(await menu.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await menu.evaluate((element) => getComputedStyle(element, '::backdrop').animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: spanish['editor.toAlignment'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(examplePairTitle);
  await expect(alignmentVerdict(page)).toBeVisible();
});

test('the phone menu is a dialog that closes four ways and hands focus back', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  const toggle = page.getByRole('button', { name: spanish['shell.openMenu'] });
  await expect(toggle).toHaveAttribute('aria-controls', 'site-menu');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: spanish['nav.main'] })).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(`${spanish['shell.themeToDark']}|${spanish['shell.themeToLight']}`) })).toBeHidden();

  let menu = await openSiteMenu(page);
  await expect(menu).toHaveAttribute('id', 'site-menu');
  await expect(menu).toHaveAttribute('aria-modal', 'true');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('button', { name: spanish['shell.closeMenu'] })).toBeFocused();
  await expect(menu.getByRole('navigation').getByRole('link')).toHaveText(destinations);
  await expect(menu.getByRole('link', { name: spanish['nav.analyze'], exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(menu.getByRole('group', { name: spanish['account.appearance'] }).getByRole('radio')).toHaveCount(3);
  await expect(menu.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveAttribute('href', ROUTES.signIn);
  for (const theme of ['light', 'dark'] as const) {
    await menu.getByRole('radio', { name: spanish[`settings.${theme}`], exact: true }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await assertFits(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
    await page.screenshot({ path: `artifacts/menu-${theme}-360.png` });
  }
  await menu.getByRole('radio', { name: spanish['settings.system'], exact: true }).check();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  menu = await openSiteMenu(page);
  await menu.getByRole('button', { name: spanish['shell.closeMenu'] }).click();
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();

  menu = await openSiteMenu(page);
  const sheet = await menu.boundingBox();
  if (!sheet) throw new Error('The menu has no box.');
  await page.mouse.click(sheet.x + sheet.width / 2, Math.min(890, sheet.y + sheet.height + 40));
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();

  // Choosing the page already open closes the menu the same way; a new destination takes focus to its content.
  menu = await openSiteMenu(page);
  await menu.getByRole('link', { name: spanish['nav.analyze'], exact: true }).click();
  await expect(siteMenu(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
  await expect(toggle).toBeFocused();

  menu = await openSiteMenu(page);
  await menu.getByRole('link', { name: spanish['nav.alignment'], exact: true }).click();
  await expect(siteMenu(page)).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(new RegExp(`${ROUTES.alignment}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(examplePairTitle);
  await expect(page.locator('#app-content')).toBeFocused();
});

test('the phone menu contains keyboard focus and keeps the selected preference focused', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  const menu = await openSiteMenu(page);
  const first = menu.getByRole('link', { name: spanish['app.name'], exact: true });
  const last = menu.getByRole('link', { name: spanish['shell.signIn'], exact: true });
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  const dark = menu.getByRole('radio', { name: spanish['settings.dark'], exact: true });
  await dark.focus();
  await page.keyboard.press('Space');
  await expect(dark).toBeChecked();
  await expect(dark).toBeFocused();
  const englishOption = menu.getByRole('radio', { name: spanish['settings.english'], exact: true });
  await englishOption.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#site-menu').getByRole('radio', { name: english['settings.english'], exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: english['shell.openMenu'] })).toBeFocused();
});

test('the phone menu makes the background inert for focus and the accessibility tree', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  const menu = await openSiteMenu(page);
  await page.locator('#app-content').evaluate(element => { element.focus(); });
  await expect(menu.getByRole('button', { name: spanish['shell.closeMenu'] })).toBeFocused();
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const tree = await cdp.send('Accessibility.getFullAXTree');
    expect(tree.nodes.filter(node => !node.ignored && node.role?.value === 'main')).toEqual([]);
    await cdp.detach();
  }
  await page.keyboard.press('Escape');
  await page.locator('#app-content').focus();
  await expect(page.locator('#app-content')).toBeFocused();
});

test('the bar veils after scrolling and the footer keeps only the legal links', async ({ page }) => {
  await page.goto(ROUTES.analyze);
  const bar = page.locator('header.site-bar');
  await expect(bar).toHaveAttribute('data-scrolled', 'false');
  await expect(page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link')).toHaveText(destinations);
  await expect(page.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link', { name: spanish['nav.analyze'], exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.workspace-sidebar').getByRole('link', { name: spanish['shell.home'] })).toHaveAttribute('href', ROUTES.home);
  await page.evaluate((offset) => { window.scrollTo(0, offset + 200); }, BAR_VEIL_SCROLL_PX);
  await expect(bar).toHaveAttribute('data-scrolled', 'true');
  expect(await bar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await expect(bar).toHaveAttribute('data-scrolled', 'false');

  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText(spanish['app.name']);
  await expect(footer).toContainText(spanish['app.tagline']);
  const links = footer.getByRole('navigation', { name: spanish['footer.navigation'] }).getByRole('link');
  await expect(links).toHaveText(FOOTER_LINKS.map((link) => spanish[link.labelKey]));
  expect(await links.evaluateAll((elements) => elements.map((element) => element.getAttribute('href')))).toEqual(FOOTER_LINKS.map((link) => link.path));
  expect(await footer.getByRole('link').evaluateAll((elements) => elements.map((element) => element.getAttribute('href')))).toEqual([ROUTES.home, ...FOOTER_LINKS.map((link) => link.path)]);
});

test('a signed-in visitor reaches the profile from the bar and from the phone menu', async ({ page }) => {
  await signInWithEmptyAccount(page);
  await page.goto(ROUTES.analyze);
  const account = page.getByRole('link', { name: message('shell.account', { email: TEST_ACCOUNT.email }) });
  await expect(account).toHaveAttribute('href', ROUTES.profile);
  await expect(account).toHaveClass(/account-link/);
  await expect(page.getByRole('banner').getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(`${spanish['shell.themeToDark']}|${spanish['shell.themeToLight']}`) })).toHaveCount(0);
  await account.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['account.title']);

  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  await assertFits(page);
  const menu = await openSiteMenu(page);
  await expect(menu.getByRole('radio')).toHaveCount(5);
  await expect(menu.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveCount(0);
  await assertFits(page);
  await menu.getByRole('link', { name: spanish['nav.profile'], exact: true }).click();
  await expect(siteMenu(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
});

test('a visitor without a session can create an account and switch language from every width', async ({ page }) => {
  const bar = page.getByRole('banner');
  const signUp = bar.getByRole('link', { name: spanish['auth.signUpAction'], exact: true });

  // Desktop: both account actions sit in the bar next to the destinations.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ROUTES.analyze);
  await expect(bar.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toBeVisible();
  await expect(signUp).toHaveCount(identityEnabled ? 1 : 0);
  if (identityEnabled) {
    await expect(signUp).toBeVisible();
    await expect(signUp).toHaveAttribute('href', ROUTES.signUp);
  }
  await assertFits(page);

  // Tablet: destinations and account creation move into the menu; the bar never overflows.
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole('navigation', { name: spanish['nav.main'] })).toBeHidden();
  await expect(signUp).toBeHidden();
  await expect(bar.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toBeVisible();
  await assertFits(page);
  const menu = await openSiteMenu(page);
  if (identityEnabled) await expect(menu.getByRole('link', { name: spanish['auth.signUpAction'], exact: true })).toHaveAttribute('href', ROUTES.signUp);
  await expect(menu.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveAttribute('href', ROUTES.signIn);

  // Language is reachable without a session: from the menu and from the footer.
  await menu.getByRole('radio', { name: spanish['settings.english'], exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // The dialog is renamed with the language, so it is located by its id from here on.
  await expect(page.locator('#site-menu').getByRole('link', { name: english['shell.signIn'], exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 2, name: english['examples.insulinName'] })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('radio', { name: english['settings.english'], exact: true })).toBeChecked();
  await footer.getByRole('radio', { name: english['settings.spanish'], exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'] })).toBeVisible();
  await assertFits(page);
});
