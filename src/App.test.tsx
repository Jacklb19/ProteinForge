import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import App from './App';
import { spanish } from './i18n/es';
import { translate } from './i18n/translate';
import { DEFAULT_LOCALE } from './i18n/config';
import { SESSION_STORAGE_KEY } from './features/auth/config';
import { DEFAULT_EXAMPLE } from './features/editor/examples';
import { INSULIN_BACKBONE } from './features/structure/backbone';
import { PREFERENCES_STORAGE_KEY } from './preferences/config';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS, PUBLIC_FOOTER_LINKS, PUBLIC_SECTIONS, ROUTES, SIDEBAR_STORAGE_KEY } from './shared/navigation';

const TOOL_ROUTES = [ROUTES.analyze, ROUTES.alignment, ROUTES.generate, ROUTES.laboratory, ROUTES.library, ROUTES.projects, ROUTES.profile];

/** Identity configured, as in every deployment; unit tests otherwise run without it. */
function withIdentity(): void {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key');
}

function signedIn(): void {
  withIdentity();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1', email: 'ana@example.org' } }));
}

function openAt(path: string): void {
  window.history.pushState(null, '', path);
  render(<App />);
}

afterEach(() => {
  window.history.pushState(null, '', ROUTES.home);
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe('App', () => {
  it('opens on the public website: sections, a real structure and the way to an account, without any tool', () => {
    withIdentity();
    openAt(ROUTES.home);

    expect(screen.getByRole('heading', { level: 1, name: spanish['public.heroTitle'] })).toBeInTheDocument();
    const structureLabel = translate(DEFAULT_LOCALE, 'structure.label', { name: spanish['examples.insulinName'], id: INSULIN_BACKBONE.id });
    expect(screen.getByRole('group', { name: structureLabel })).toBeInTheDocument();
    const strandLabel = translate(DEFAULT_LOCALE, 'landing.strandLabel', { count: DEFAULT_EXAMPLE.text.length });
    expect(screen.getAllByRole('img', { name: strandLabel }).length).toBeGreaterThan(0);

    const sections = screen.getByRole('navigation', { name: spanish['public.sections'] });
    expect(within(sections).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([...PUBLIC_SECTIONS.map(section => `${ROUTES.home}#${section.id}`), ROUTES.guide]);
    for (const section of PUBLIC_SECTIONS) expect(document.getElementById(section.id)).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: spanish['nav.main'] })).not.toBeInTheDocument();

    // Signed out, nothing on the public site opens a tool: only the account, the guide and the legal pages.
    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
    for (const route of TOOL_ROUTES) expect(hrefs).not.toContain(route);
    const bar = document.querySelector<HTMLElement>('.site-bar');
    if (!bar) throw new Error('Missing site bar.');
    expect(within(bar).getByRole('link', { name: spanish['shell.signIn'] })).toHaveAttribute('href', ROUTES.signIn);
    expect(within(bar).getByRole('link', { name: spanish['auth.signUpAction'] })).toHaveAttribute('href', ROUTES.signUp);
    const footer = screen.getByRole('navigation', { name: spanish['footer.navigation'] });
    expect(within(footer).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(PUBLIC_FOOTER_LINKS.map(link => link.path));
    // Language and theme sit in the bar as two small controls, without a disclosure.
    const language = within(bar).getByRole('group', { name: spanish['shell.languageLabel'] });
    expect(within(language).getAllByRole('button').map(button => [button.getAttribute('lang'), button.getAttribute('aria-pressed')])).toEqual([['es', 'true'], ['en', 'false']]);
    expect(within(bar).getByRole('button', { name: spanish['shell.themeToDark'] })).toBeInTheDocument();
    expect(bar.querySelector('details')).toBeNull();
  });

  it('sends a visitor without a session from any tool to sign in, saying where they will return', async () => {
    withIdentity();
    openAt(ROUTES.alignment);
    expect(await screen.findByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeInTheDocument();
    expect(window.location.pathname).toBe(ROUTES.signIn);
    expect(screen.getByRole('note')).toHaveTextContent(translate(DEFAULT_LOCALE, 'auth.returnNote', { page: spanish['nav.alignment'] }));
    expect(screen.queryByRole('complementary', { name: spanish['shell.sidebar'] })).not.toBeInTheDocument();
  });

  it('opens a tool inside the laboratory with a session: grouped sidebar, help and the account at the foot', () => {
    signedIn();
    openAt(ROUTES.analyze);

    expect(screen.getByRole('heading', { level: 1, name: spanish['workbench.analyzeTitle'] })).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary', { name: spanish['shell.sidebar'] });
    const navigation = within(sidebar).getByRole('navigation', { name: spanish['nav.main'] });
    expect(within(navigation).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(NAVIGATION_ITEMS.map(item => item.path));
    expect(within(navigation).getByRole('link', { name: spanish['nav.analyze'] })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getAllByText((_, element) => element?.classList.contains('sidebar-group-label') ?? false).map(label => label.textContent)).toEqual(NAVIGATION_GROUPS.map(group => spanish[group.labelKey]));
    expect(within(sidebar).getByRole('link', { name: spanish['nav.guide'] })).toHaveAttribute('href', ROUTES.guide);
    const foot = sidebar.querySelector<HTMLElement>('.sidebar-foot');
    if (!foot) throw new Error('Missing sidebar foot.');
    expect(within(foot).getByRole('link', { name: new RegExp(spanish['settings.account']) })).toHaveAttribute('href', ROUTES.profile);
    // Language and theme are chosen on the profile once signed in.
    expect(within(foot).queryByRole('group', { name: spanish['shell.languageLabel'] })).not.toBeInTheDocument();
    expect(sidebar.querySelector('details')).toBeNull();
    expect(screen.queryByText(spanish['workbench.workspace'])).not.toBeInTheDocument();
  });

  it('collapses the sidebar, keeps every name for assistive technology and remembers only that choice', () => {
    signedIn();
    openAt(ROUTES.analyze);
    const sidebar = screen.getByRole('complementary', { name: spanish['shell.sidebar'] });
    act(() => { fireEvent.click(within(sidebar).getByRole('button', { name: spanish['shell.collapseSidebar'] })); });
    expect(document.querySelector('.workspace')).toHaveAttribute('data-compact', 'true');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    expect(within(sidebar).getByRole('link', { name: spanish['nav.alignment'] })).toHaveAttribute('href', ROUTES.alignment);
    expect(within(sidebar).getByRole('button', { name: spanish['shell.expandSidebar'] })).toBeInTheDocument();
    // Besides the session and the appearance and language preference, nothing else is written by the frame.
    expect(Object.keys(localStorage).filter(key => key !== PREFERENCES_STORAGE_KEY && key !== SESSION_STORAGE_KEY)).toEqual([SIDEBAR_STORAGE_KEY]);
  });

  it('opens the guide without a session, on the public site, with a way to each tool', async () => {
    withIdentity();
    openAt(ROUTES.guide);
    expect(await screen.findByRole('heading', { level: 1, name: spanish['guide.title'] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translate(DEFAULT_LOCALE, 'guide.openTool', { tool: spanish['nav.analyze'] }) })).toHaveAttribute('href', ROUTES.analyze);
    expect(screen.getByText(spanish['descriptors.instabilityIndexMethod'], { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: spanish['shell.sidebar'] })).not.toBeInTheDocument();
  });
});
