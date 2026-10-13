import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { spanish } from './i18n/es';
import { translate } from './i18n/translate';
import { DEFAULT_LOCALE } from './i18n/config';
import { readAuthSettings } from './features/auth/config';
import { DEFAULT_EXAMPLE } from './features/editor/examples';
import { INSULIN_BACKBONE } from './features/structure/backbone';
import { NAVIGATION_ITEMS, ROUTES } from './shared/navigation';

describe('App', () => {
  it('opens on the public website with the shared site navigation and clear entries to the tools', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: spanish['landing.title'] })).toBeInTheDocument();
    const structureLabel = translate(DEFAULT_LOCALE, 'structure.label', { name: spanish['examples.insulinName'], id: INSULIN_BACKBONE.id });
    expect(screen.getByRole('group', { name: structureLabel })).toBeInTheDocument();
    const strandLabel = translate(DEFAULT_LOCALE, 'landing.strandLabel', { count: DEFAULT_EXAMPLE.text.length });
    expect(screen.getByRole('img', { name: strandLabel })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: spanish['landing.profileLabel'] })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: spanish['nav.main'] });
    const links = within(navigation).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(NAVIGATION_ITEMS.map((item) => spanish[item.labelKey]));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(NAVIGATION_ITEMS.map((item) => item.path));

    expect(screen.getByRole('link', { name: spanish['landing.analyzeAction'] })).toHaveAttribute('href', ROUTES.analyze);
    expect(screen.getByRole('link', { name: spanish['landing.compareAction'] })).toHaveAttribute('href', ROUTES.alignment);
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('link', { name: spanish['shell.signIn'] })).toHaveAttribute('href', ROUTES.signIn);
    // Account creation is offered only where identity is configured.
    const signUp = within(bar).queryByRole('link', { name: spanish['auth.signUpAction'] });
    if (readAuthSettings()) expect(signUp).toHaveAttribute('href', ROUTES.signUp);
    else expect(signUp).not.toBeInTheDocument();
  });
});
