import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { assertFits } from './helpers';
import { spanish } from '../src/i18n/es';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '../src/features/legal/config';

for (const route of ['privacy', 'terms'] as const) {
  for (const width of [360, 1280]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${route} is public, readable and accessible at ${String(width)}px in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(`/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(spanish[`${route}.title`]);
        const contact = page.getByRole('link', { name: SUPPORT_EMAIL, exact: true });
        await expect(contact).toHaveAttribute('href', SUPPORT_EMAIL_URL);
        const footer = page.getByRole('navigation', { name: spanish['footer.navigation'] });
        await expect(footer.getByRole('link', { name: spanish['nav.privacy'], exact: true })).toHaveAttribute('href', '/privacy');
        await expect(footer.getByRole('link', { name: spanish['nav.terms'], exact: true })).toHaveAttribute('href', '/terms');
        await assertFits(page);
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(accessibility.violations).toEqual([]);
        await contact.focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('navigation', { name: spanish['legal.navigation'] })
          .getByRole('link', { name: spanish['nav.privacy'], exact: true })).toBeFocused();
        await page.screenshot({ path: `artifacts/legal-${route}-${String(width)}-${theme}.png`, fullPage: true });
        await footer.getByRole('link', { name: spanish[route === 'privacy' ? 'nav.terms' : 'nav.privacy'], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${route === 'privacy' ? 'terms' : 'privacy'}$`));
      });
    }
  }
}
