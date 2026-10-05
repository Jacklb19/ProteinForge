import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from './PreferencesProvider';
import { usePreferences } from './usePreferences';
import { loadPreferences, savePreferences } from './preferences';

function PreferenceControls(): React.JSX.Element {
  const { locale, theme, setLocale, setTheme } = usePreferences();
  return (
    <div>
      <span data-testid="values">{locale} {theme}</span>
      <button onClick={() => { setLocale('en'); setTheme('dark'); }}>change</button>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.lang = 'es';
  delete document.documentElement.dataset.theme;
});

describe('local preferences', () => {
  it('uses defaults when storage is unavailable or contains invalid values', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(loadPreferences()).toEqual({ locale: 'es', theme: 'system' });
    vi.restoreAllMocks();
    window.localStorage.setItem('proteinforge.preferences', JSON.stringify({ locale: 'invalid', theme: 'invalid' }));
    expect(loadPreferences()).toEqual({ locale: 'es', theme: 'system' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(() => { savePreferences({ locale: 'en', theme: 'dark' }); }).not.toThrow();
  });

  it('persists language and theme and applies them to the document', async () => {
    render(<PreferencesProvider><PreferenceControls /></PreferencesProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'change' }));
    await waitFor(() => { expect(document.documentElement.dataset.theme).toBe('dark'); });
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(window.localStorage.getItem('proteinforge.preferences') ?? '{}')).toEqual({ locale: 'en', theme: 'dark' });
  });
});
