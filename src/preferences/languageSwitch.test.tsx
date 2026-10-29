import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from './PreferencesProvider';
import { loadPreferences } from './preferences';
import { usePreferences } from './usePreferences';
import { useTranslation } from '../i18n';
import { english } from '../i18n/en';
import { spanish } from '../i18n/es';

// The English catalog is held back until the test releases it, as on a slow first download.
const arrival = vi.hoisted(() => {
  let release = (): void => undefined;
  const loaded = { value: false };
  const promise = new Promise<void>(resolve => { release = () => { loaded.value = true; resolve(); }; });
  return { promise, loaded, release: () => { release(); } };
});
vi.mock('../i18n/catalogs', async (original) => {
  const actual = await original<typeof import('../i18n/catalogs')>();
  return { ...actual,
    isCatalogLoaded: (locale: string) => locale === 'es' || arrival.loaded.value,
    loadCatalog: () => arrival.promise };
});

function Probe(): React.JSX.Element {
  const { chosenLocale, setLocale } = usePreferences();
  const { t } = useTranslation();
  return <><p data-testid="chosen">{chosenLocale}</p><h1>{t('app.title')}</h1><button type="button" onClick={() => { setLocale('en'); }}>en</button></>;
}

describe('switching to a language that is not loaded yet', () => {
  it('shows the choice at once and changes the texts when the catalog arrives', async () => {
    localStorage.clear();
    render(<PreferencesProvider><Probe /></PreferencesProvider>);
    act(() => { screen.getByRole('button').click(); });
    expect(screen.getByTestId('chosen')).toHaveTextContent('en');
    expect(screen.getByRole('heading')).toHaveTextContent(spanish['app.title']);
    expect(document.documentElement.lang).toBe('es');
    // Stored before the catalog arrives: a reload in the meantime keeps the choice.
    expect(loadPreferences().locale).toBe('en');
    await act(async () => { arrival.release(); await arrival.promise; });
    expect(screen.getByRole('heading')).toHaveTextContent(english['app.title']);
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('chosen')).toHaveTextContent('en');
  });
});
