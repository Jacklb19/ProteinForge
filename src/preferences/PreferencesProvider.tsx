import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LocaleProvider } from '../i18n';
import { loadPreferences, savePreferences } from './preferences';
import { PreferencesContext } from './preferencesContext';
import type { PreferencesContextValue } from './preferencesContext';
import { translate } from '../i18n/translate';

/** Makes local appearance and language preferences available to routes. */
export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.title = translate(preferences.locale, 'app.title');
    if (preferences.theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preferences.theme;
    }
    savePreferences(preferences);
    const refreshBrowserColor = () => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
      const metadata = document.querySelector('meta[name="theme-color"]');
      if (color && metadata) metadata.setAttribute('content', color);
    };
    refreshBrowserColor();
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    systemTheme.addEventListener('change', refreshBrowserColor);
    return () => { systemTheme.removeEventListener('change', refreshBrowserColor); };
  }, [preferences]);

  const value: PreferencesContextValue = {
    ...preferences,
    setLocale: (locale) => { setPreferences((current) => ({ ...current, locale })); },
    setTheme: (theme) => { setPreferences((current) => ({ ...current, theme })); },
  };

  return (
    <PreferencesContext.Provider value={value}>
      <LocaleProvider locale={preferences.locale}>{children}</LocaleProvider>
    </PreferencesContext.Provider>
  );
}
