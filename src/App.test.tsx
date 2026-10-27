import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import App from './App';
import { spanish } from './i18n/es';
import { translate } from './i18n/translate';
import { DEFAULT_LOCALE } from './i18n/config';
import { readAuthSettings } from './features/auth/config';
import { DEFAULT_EXAMPLE } from './features/editor/examples';
import { INSULIN_BACKBONE } from './features/structure/backbone';
import { PREFERENCES_STORAGE_KEY } from './preferences/config';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS, PUBLIC_SECTIONS, ROUTES, SIDEBAR_STORAGE_KEY } from './shared/navigation';

function openAt(path: string): void {
  window.history.pushState(null, '', path);
  render(<App />);
}

afterEach(() => {
  window.history.pushState(null, '', ROUTES.home);
  localStorage.clear();
});

describe('App', () => {
  it('opens on the public website: sections, a real structure and entries to account and example, without the sidebar', () => {
    openAt(ROUTES.home);

    expect(screen.getByRole('heading', { level: 1, name: spanish['public.heroTitle'] })).toBeInTheDocument();
    const structureLabel = translate(DEFAULT_LOCALE, 'structure.label', { name: spanish['examples.insulinName'], id: INSULIN_BACKBONE.id });
    expect(screen.getByRole('group', { name: structureLabel })).toBeInTheDocument();
    const strandLabel = translate(DEFAULT_LOCALE, 'landing.strandLabel', { count: DEFAULT_EXAMPLE.text.length });
    expect(screen.getAllByRole('img', { name: strandLabel }).length).toBeGreaterThan(0);

    const sections = screen.getByRole('navigation', { name: spanish['public.sections'] });
    expect(within(sections).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(PUBLIC_SECTIONS.map(section => `${ROUTES.home}#${section.id}`));
    for (const section of PUBLIC_SECTIONS) expect(document.getElementById(section.id)).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: spanish['nav.main'] })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: spanish['public.exploreExample'] })).toHaveAttribute('href', ROUTES.analyze);
    const bar = document.querySelector<HTMLElement>('.site-bar');
    if (!bar) throw new Error('Missing site bar.');
    expect(within(bar).getByRole('link', { name: spanish['shell.signIn'] })).toHaveAttribute('href', ROUTES.signIn);
    // Account creation is offered only where identity is configured.
    const signUp = within(bar).queryByRole('link', { name: spanish['auth.signUpAction'] });
    if (readAuthSettings()) expect(signUp).toHaveAttribute('href', ROUTES.signUp);
    else expect(signUp).not.toBeInTheDocument();
    // Appearance and language live together in Preferences, not beside the content.
    const preferences = within(bar).getByText(spanish['workbench.preferences'], { selector: 'summary *' }).closest('details');
    if (!preferences) throw new Error('Missing preferences.');
    expect(within(preferences).getByRole('group', { name: spanish['account.appearance'] })).toBeInTheDocument();
    expect(within(preferences).getByRole('group', { name: spanish['shell.languageLabel'] })).toBeInTheDocument();
  });

  it('opens a tool inside the laboratory: grouped sidebar, no empty groups, help and preferences at the foot', () => {
    openAt(ROUTES.analyze);

    expect(screen.getByRole('heading', { level: 1, name: spanish['workbench.analyzeTitle'] })).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary', { name: spanish['shell.sidebar'] });
    const navigation = within(sidebar).getByRole('navigation', { name: spanish['nav.main'] });
    const visible = NAVIGATION_ITEMS.filter(item => !item.signedInOnly);
    expect(within(navigation).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(visible.map(item => item.path));
    expect(within(navigation).getByRole('link', { name: spanish['nav.analyze'] })).toHaveAttribute('aria-current', 'page');
    const groups = NAVIGATION_GROUPS.filter(group => visible.some(item => item.group === group.id)).map(group => spanish[group.labelKey]);
    expect(within(navigation).getAllByText((_, element) => element?.classList.contains('sidebar-group-label') ?? false).map(label => label.textContent)).toEqual(groups);
    expect(within(sidebar).getByRole('link', { name: spanish['nav.guide'] })).toHaveAttribute('href', ROUTES.guide);
    expect(within(sidebar).getByText(spanish['workbench.preferences'], { selector: 'summary .sidebar-label' })).toBeInTheDocument();
    expect(screen.queryByText(spanish['workbench.workspace'])).not.toBeInTheDocument();
  });

  it('collapses the sidebar, keeps every name for assistive technology and remembers only that choice', () => {
    openAt(ROUTES.analyze);
    const sidebar = screen.getByRole('complementary', { name: spanish['shell.sidebar'] });
    act(() => { fireEvent.click(within(sidebar).getByRole('button', { name: spanish['shell.collapseSidebar'] })); });
    expect(document.querySelector('.workspace')).toHaveAttribute('data-compact', 'true');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    expect(within(sidebar).getByRole('link', { name: spanish['nav.alignment'] })).toHaveAttribute('href', ROUTES.alignment);
    expect(within(sidebar).getByRole('button', { name: spanish['shell.expandSidebar'] })).toBeInTheDocument();
    // Besides the existing appearance and language preference, nothing else is written by the frame.
    expect(Object.keys(localStorage).filter(key => key !== PREFERENCES_STORAGE_KEY)).toEqual([SIDEBAR_STORAGE_KEY]);
  });

  it('gathers methods in the guide, each with a way back to its tool', async () => {
    openAt(ROUTES.guide);
    expect(await screen.findByRole('heading', { level: 1, name: spanish['guide.title'] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translate(DEFAULT_LOCALE, 'guide.openTool', { tool: spanish['nav.analyze'] }) })).toHaveAttribute('href', ROUTES.analyze);
    expect(screen.getByText(spanish['descriptors.instabilityIndexMethod'], { exact: false })).toBeInTheDocument();
  });
});
