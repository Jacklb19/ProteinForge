import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LocaleProvider } from '../i18n';
import { loadPreferences, savePreferences } from './preferences';
import { PreferencesContext } from './preferencesContext';
import type { PreferencesContextValue } from './preferencesContext';

/** Makes local appearance and language preferences available to routes. */
export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    if (preferences.theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preferences.theme;
    }
    savePreferences(preferences);
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
