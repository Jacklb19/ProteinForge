import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../features/auth/authContext';
import { english } from '../i18n/en';
import { spanish } from '../i18n/es';
import { DARK_SCHEME_QUERY } from '../preferences/config';
import { PreferencesProvider } from '../preferences/PreferencesProvider';
import { ROUTES } from '../shared/navigation';
import { signedInFixture } from '../test/authFixture';
import { LanguageSwitch, ThemeToggle } from './Preferences';
import { SidebarContent } from './Sidebar';

/** A device that asks for the given appearance. */
function deviceScheme(dark: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === DARK_SCHEME_QUERY && dark, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.lang = 'es';
});

describe('theme button', () => {
  it('resolves the system choice through a dark device, then flips between explicit themes keeping focus', () => {
    deviceScheme(true);
    render(<PreferencesProvider><ThemeToggle /></PreferencesProvider>);
    const button = screen.getByRole('button', { name: spanish['shell.themeToLight'] });
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    button.focus();
    fireEvent.click(button);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: spanish['shell.themeToDark'] })).toBe(button);
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(button).toHaveAccessibleName(spanish['shell.themeToLight']);
  });

  it('switches a light device on the system choice to dark', () => {
    deviceScheme(false);
    render(<PreferencesProvider><ThemeToggle /></PreferencesProvider>);
    fireEvent.click(screen.getByRole('button', { name: spanish['shell.themeToDark'] }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});

describe('language switch', () => {
  it('is a named group of short buttons with full names, language and pressed state', () => {
    render(<PreferencesProvider><LanguageSwitch /></PreferencesProvider>);
    const group = screen.getByRole('group', { name: spanish['shell.languageLabel'] });
    const [es, en] = within(group).getAllByRole('button');
    if (!es || !en) throw new Error('Missing language buttons.');
    expect(es).toHaveAccessibleName(spanish['settings.spanish']);
    expect(es).toHaveTextContent(spanish['settings.spanishShort']);
    expect(es).toHaveAttribute('lang', 'es');
    expect(es).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAccessibleName(spanish['settings.english']);
    expect(en).toHaveTextContent(spanish['settings.englishShort']);
    expect(en).toHaveAttribute('lang', 'en');
    expect(en).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(en);
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('group', { name: english['shell.languageLabel'] })).toBeInTheDocument();
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(es).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('account entry of the sidebar', () => {
  function renderSidebar(path: string): HTMLElement {
    render(<MemoryRouter initialEntries={[path]}><PreferencesProvider><AuthContext.Provider value={signedInFixture}>
      <SidebarContent variant="rail" />
    </AuthContext.Provider></PreferencesProvider></MemoryRouter>);
    const email = signedInFixture.session?.user.email ?? '';
    return screen.getByRole('link', { name: new RegExp(`${spanish['settings.account']}.*${email}`) });
  }

  it('is a plain link to the profile, marked as the current page there, with nothing that pops up', () => {
    const account = renderSidebar(ROUTES.profile);
    expect(account).toHaveAttribute('href', ROUTES.profile);
    expect(account).toHaveAttribute('aria-current', 'page');
    expect(account).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByRole('button', { name: new RegExp(spanish['settings.account']) })).not.toBeInTheDocument();
    // With a session, language and theme live on the profile, not in the sidebar.
    expect(screen.queryByRole('group', { name: spanish['shell.languageLabel'] })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: spanish['shell.themeToDark'] })).not.toBeInTheDocument();
  });

  it('is not current elsewhere in the laboratory', () => {
    expect(renderSidebar(ROUTES.analyze)).not.toHaveAttribute('aria-current');
  });
});
