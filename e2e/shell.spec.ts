import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  alignmentVerdict, assertFits, examplePairTitle, followNavigation, identityEnabled, message, navigationLink, openExportMenu, openPreferences,
  openPublicSite, openSequenceEditor, openSiteMenu, setTheme, signInWithEmptyAccount, siteMenu, TEST_ACCOUNT,
} from './helpers';
import { BAR_VEIL_SCROLL_PX, FOOTER_LINKS, NAVIGATION_ITEMS, ROUTES, SIDEBAR_STORAGE_KEY } from '../src/shared/navigation';
import { PREFERENCES_STORAGE_KEY } from '../src/preferences/config';
import { spanish } from '../src/i18n/es';
import { english } from '../src/i18n/en';
import references from '../src/features/descriptors/fixtures/protparam.json' with { type: 'json' };

const destinations = NAVIGATION_ITEMS.filter(item => !item.signedInOnly).map((item) => spanish[item.labelKey]);
const AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// The former workspace address now opens Analizar inside the laboratory, which starts on the bundled example.
for (const width of [360, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`the former workspace address opens the analysis, fits ${String(width)}px and passes AA in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTES.workspace);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.analyze}$`));
      await setTheme(page, theme);
      await expect(page.getByRole('heading', { level: 1, name: spanish['workbench.analyzeTitle'] })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'], exact: true })).toBeVisible();
      await expect(page.locator('.subject-summary .page-meta')).toContainText('P01308');
      await expect(page.getByRole('tab', { name: spanish['workbench.summary'], exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.descriptor-panel .property')).toHaveCount(5);
      await expect(page.locator('canvas.hydropathy-chart')).toBeHidden();
      await expect(page.locator('figure.stage.stage-rail')).toBeVisible();
      // No location strip above the tool: the tool's own heading opens the content.
      await expect(page.getByText(spanish['workbench.workspace'], { exact: true })).toHaveCount(0);
      if (width < 1024) {
        await expect(page.locator('.workspace-sidebar')).toBeHidden();
        await expect(page.getByRole('button', { name: spanish['shell.openMenu'] })).toBeVisible();
      } else {
        await expect(page.getByRole('complementary', { name: spanish['shell.sidebar'] })).toBeVisible();
      }
      await assertFits(page);
      expect((await new AxeBuilder({ page }).withTags(AA).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `artifacts/analysis-${theme}-${String(width)}.png`, fullPage: true });
      await page.screenshot({ path: `artifacts/analysis-preview-${theme}-${String(width)}.png` });
    });
  }
}

test('first visit explores the example, exports results and keeps the draft across both frames', async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.locator('.hero-actions').getByRole('link', { name: spanish['public.exploreExample'] }).click();
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
  // The draft belongs to the visit: it survives the public site, which uses a different frame.
  await (await openSequenceEditor(page)).fill('ACDEFGHIKLMNPQRSTVWY');
  await openPublicSite(page);
  await expect(page.locator('.workspace-sidebar')).toHaveCount(0);
  await page.locator('.hero-actions').getByRole('link', { name: spanish['public.exploreExample'] }).click();
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

test('the laboratory phone menu is a dialog with the sidebar that closes four ways and hands focus back', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  const toggle = page.getByRole('button', { name: spanish['shell.openMenu'] });
  await expect(toggle).toHaveAttribute('aria-controls', 'site-menu');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: spanish['nav.main'] })).toBeHidden();

  let menu = await openSiteMenu(page);
  await expect(menu).toHaveAttribute('id', 'site-menu');
  await expect(menu).toHaveAttribute('aria-modal', 'true');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('button', { name: spanish['shell.closeMenu'] })).toBeFocused();
  await expect(menu.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link')).toHaveText(destinations);
  await expect(menu.getByRole('link', { name: spanish['nav.analyze'], exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(menu.getByRole('link', { name: spanish['nav.guide'], exact: true })).toHaveAttribute('href', ROUTES.guide);
  await expect(menu.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveAttribute('href', ROUTES.signIn);
  const preferences = await openPreferences(menu);
  await expect(preferences.getByRole('group', { name: spanish['account.appearance'] }).getByRole('radio')).toHaveCount(3);
  for (const theme of ['light', 'dark'] as const) {
    await preferences.getByRole('radio', { name: spanish[`settings.${theme}`], exact: true }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await assertFits(page);
    const axe = await new AxeBuilder({ page }).withTags(AA).analyze();
    expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
    await page.screenshot({ path: `artifacts/menu-${theme}-360.png` });
  }
  await preferences.getByRole('radio', { name: spanish['settings.system'], exact: true }).check();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  // Escape closes the open preferences first, then the menu.
  await page.keyboard.press('Escape');
  await expect(preferences.locator('.preferences-popover')).toBeHidden();
  await expect(menu).toBeVisible();
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
  await page.mouse.click(Math.min(355, sheet.x + sheet.width + 20), sheet.y + sheet.height / 2);
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
  const first = menu.getByRole('link', { name: spanish['shell.home'], exact: true });
  const last = menu.locator('a[href], button, summary').filter({ visible: true }).last();
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  const preferences = await openPreferences(menu);
  const dark = preferences.getByRole('radio', { name: spanish['settings.dark'], exact: true });
  await dark.focus();
  await page.keyboard.press('Space');
  await expect(dark).toBeChecked();
  await expect(dark).toBeFocused();
  const englishOption = preferences.getByRole('radio', { name: spanish['settings.english'], exact: true });
  await englishOption.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#site-menu').getByRole('radio', { name: english['settings.english'], exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
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

test('the sidebar groups the tools, collapses to named icons and remembers only its width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(ROUTES.analyze);
  const sidebar = page.getByRole('complementary', { name: spanish['shell.sidebar'] });
  await expect(sidebar.getByRole('navigation', { name: spanish['nav.main'] }).getByRole('link')).toHaveText(destinations);
  await expect(navigationLink(page, spanish['nav.analyze'])).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.locator('.sidebar-group-label')).toHaveText([spanish['nav.groupResearch'], spanish['nav.groupDesign']]);
  await expect(sidebar.getByRole('link', { name: spanish['shell.home'] })).toHaveAttribute('href', ROUTES.home);
  // The sidebar stays in place while the tool scrolls; its own list scrolls when the height is short.
  await page.evaluate(() => { window.scrollTo(0, 600); });
  expect(await sidebar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  expect(await sidebar.evaluate((element) => getComputedStyle(element.querySelector('.sidebar-nav') as Element).overflowY)).toBe('auto');

  const editor = await openSequenceEditor(page);
  await editor.fill('MKTAYIAKQR');
  await sidebar.getByRole('button', { name: spanish['shell.collapseSidebar'] }).click();
  await expect(page.locator('.workspace')).toHaveAttribute('data-compact', 'true');
  await expect(editor).toHaveValue('MKTAYIAKQR');
  const compare = navigationLink(page, spanish['nav.alignment']);
  await expect(compare).toBeVisible();
  const box = await compare.boundingBox();
  if (!box) throw new Error('The compact link has no box.');
  expect(box.width).toBeGreaterThanOrEqual(44);
  // The name appears beside the icon on hover and on keyboard focus.
  const tooltip = compare.locator('.sidebar-label');
  await expect(tooltip).toHaveCSS('opacity', '0');
  await compare.hover();
  await expect(tooltip).toHaveCSS('opacity', '1');
  await page.mouse.move(640, 400);
  await navigationLink(page, spanish['nav.analyze']).focus();
  await page.keyboard.press('Tab');
  await expect(compare).toBeFocused();
  await expect(tooltip).toHaveCSS('opacity', '1');
  const label = await tooltip.boundingBox();
  if (!label) throw new Error('The compact name has no box.');
  expect(label.x).toBeGreaterThanOrEqual(box.x + box.width);
  expect(await page.evaluate((key) => localStorage.getItem(key), SIDEBAR_STORAGE_KEY)).toBe('true');
  expect(await page.evaluate((known) => Object.keys(localStorage).filter(key => !known.includes(key)), [PREFERENCES_STORAGE_KEY, SIDEBAR_STORAGE_KEY])).toEqual([]);
  const axe = await new AxeBuilder({ page }).withTags(AA).analyze();
  expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
  await assertFits(page);
  await page.screenshot({ path: 'artifacts/sidebar-compact-1280.png' });

  await page.reload();
  await expect(page.locator('.workspace')).toHaveAttribute('data-compact', 'true');
  await page.getByRole('button', { name: spanish['shell.expandSidebar'] }).click();
  await expect(page.locator('.workspace')).toHaveAttribute('data-compact', 'false');
});

test('the public bar veils after scrolling, links to its sections and keeps legal links in the footer', async ({ page }) => {
  await page.goto(ROUTES.home);
  const bar = page.locator('header.site-bar');
  await expect(bar).toHaveAttribute('data-scrolled', 'false');
  await page.evaluate((offset) => { window.scrollTo(0, offset + 200); }, BAR_VEIL_SCROLL_PX);
  await expect(bar).toHaveAttribute('data-scrolled', 'true');
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await expect(page.getByRole('navigation', { name: spanish['nav.main'] })).toHaveCount(0);
  const sections = page.getByRole('navigation', { name: spanish['public.sections'] });
  await sections.getByRole('link', { name: spanish['public.navTools'], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.home}#tools$`));
  await expect(page.locator('#tools')).toBeInViewport();
  await expect(bar).toHaveAttribute('data-scrolled', 'true');
  expect(await bar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await expect(bar).toHaveAttribute('data-scrolled', 'false');

  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText(spanish['app.name']);
  await expect(footer).toContainText(spanish['app.tagline']);
  const links = footer.getByRole('navigation', { name: spanish['footer.navigation'] }).getByRole('link');
  await expect(links).toHaveText([spanish['public.laboratory'], ...FOOTER_LINKS.map((link) => spanish[link.labelKey])]);
  expect(await links.evaluateAll((elements) => elements.map((element) => element.getAttribute('href')))).toEqual([ROUTES.analyze, ...FOOTER_LINKS.map((link) => link.path)]);
  // Neither theme nor language sits in the footer or in the content: both belong to Preferences.
  await expect(footer.getByRole('radio')).toHaveCount(0);
  await expect(page.locator('main').getByRole('radio', { name: spanish['settings.dark'], exact: true })).toHaveCount(0);
});

test('a signed-in visitor reaches the account from the sidebar menu and from the phone menu', async ({ page }) => {
  await signInWithEmptyAccount(page);
  await page.goto(ROUTES.analyze);
  const sidebar = page.getByRole('complementary', { name: spanish['shell.sidebar'] });
  await expect(sidebar.locator('.sidebar-group-label')).toHaveText([spanish['nav.groupResearch'], spanish['nav.groupDesign'], spanish['nav.groupOrganize']]);
  await expect(navigationLink(page, spanish['nav.projects'])).toHaveAttribute('href', ROUTES.projects);
  await expect(sidebar.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveCount(0);
  const trigger = sidebar.getByRole('button', { name: new RegExp(TEST_ACCOUNT.email) });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar.locator('.account-menu').getByRole('link')).toHaveText([spanish['workbench.account'], spanish['shell.publicSite']]);
  await expect(sidebar.locator('.account-menu').getByRole('button', { name: spanish['settings.signOut'] })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await sidebar.getByRole('link', { name: spanish['workbench.account'] }).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish['account.title']);

  // The public site recognises the session and offers the laboratory instead of the account forms.
  await openPublicSite(page);
  await expect(page.locator('header.site-bar').getByRole('link', { name: spanish['public.openLaboratory'] })).toHaveAttribute('href', ROUTES.analyze);
  await expect(page.locator('header.site-bar').getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(ROUTES.analyze);
  await assertFits(page);
  const menu = await openSiteMenu(page);
  await expect(menu.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveCount(0);
  await menu.getByRole('button', { name: new RegExp(TEST_ACCOUNT.email) }).click();
  await assertFits(page);
  await menu.getByRole('link', { name: spanish['workbench.account'], exact: true }).click();
  await expect(siteMenu(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));
});

test('a visitor without a session finds account actions and switches language from every width', async ({ page }) => {
  const bar = page.locator('header.site-bar');
  const signUp = bar.getByRole('link', { name: spanish['auth.signUpAction'], exact: true });

  // Desktop: both account actions sit in the public bar next to Preferences.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ROUTES.home);
  await expect(bar.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toBeVisible();
  await expect(signUp).toHaveCount(identityEnabled ? 1 : 0);
  if (identityEnabled) {
    await expect(signUp).toBeVisible();
    await expect(signUp).toHaveAttribute('href', ROUTES.signUp);
  }
  await assertFits(page);

  // Tablet: sections, preferences and account creation move into the menu; the bar never overflows.
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole('navigation', { name: spanish['public.sections'] })).toBeHidden();
  await expect(bar.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toBeVisible();
  await assertFits(page);
  const menu = await openSiteMenu(page);
  if (identityEnabled) await expect(menu.getByRole('link', { name: spanish['auth.signUpAction'], exact: true })).toHaveAttribute('href', ROUTES.signUp);
  await expect(menu.getByRole('link', { name: spanish['shell.signIn'], exact: true })).toHaveAttribute('href', ROUTES.signIn);

  // Language is reachable without a session: from the public menu and from the laboratory preferences.
  await menu.getByRole('radio', { name: spanish['settings.english'], exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // The dialog is renamed with the language, so it is located by its id from here on.
  await expect(page.locator('#site-menu').getByRole('link', { name: english['shell.signIn'], exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: english['public.heroTitle'] })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ROUTES.analyze);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const preferences = await openPreferences(page);
  await expect(preferences.getByRole('radio', { name: english['settings.english'], exact: true })).toBeChecked();
  await preferences.getByRole('radio', { name: english['settings.spanish'], exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 2, name: spanish['examples.insulinName'] })).toBeVisible();
  await followNavigation(page, spanish['nav.alignment']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(examplePairTitle);
  await assertFits(page);
});

for (const width of [360, 1280]) {
  test(`the guide gathers the methods, links back to each tool and passes AA at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.guide);
    await expect(page.getByRole('heading', { level: 1, name: spanish['guide.title'] })).toBeVisible();
    await expect(page.locator('.guide-section')).toHaveCount(6);
    await expect(page.locator('.guide-section').first().locator('.guide-terms dt')).toHaveCount(5);
    await expect(page.getByText(spanish['descriptors.instabilityIndexMethod'], { exact: true })).toBeVisible();
    for (const [route, label] of [[ROUTES.analyze, 'nav.analyze'], [ROUTES.alignment, 'nav.alignment'], [ROUTES.generate, 'nav.generate'], [ROUTES.library, 'nav.library'], [ROUTES.laboratory, 'workbench.laboratory']] as const) {
      await expect(page.getByRole('link', { name: message('guide.openTool', { tool: spanish[label] }), exact: true })).toHaveAttribute('href', route);
    }
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      await assertFits(page);
      const axe = await new AxeBuilder({ page }).withTags(AA).analyze();
      expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
      await page.screenshot({ path: `artifacts/guide-${theme}-${String(width)}.png`, fullPage: true });
    }
  });
}
