import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LocaleProvider } from '../i18n';
import { loadPreferences, savePreferences } from './preferences';
import { PreferencesContext } from './preferencesContext';
import type { PreferencesContextValue } from './preferencesContext';
import { isCatalogLoaded, loadCatalog, translateLoaded } from '../i18n/catalogs';
import { DEFAULT_LOCALE } from '../i18n/config';
import type { Locale } from '../i18n/config';
import { BROWSER_COLOR_TOKEN } from './config';

/** Makes local appearance and language preferences available to routes. */
export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  // A stored language whose catalog could not be fetched falls back to the default one.
  const [preferences, setPreferences] = useState(() => {
    const stored = loadPreferences();
    return isCatalogLoaded(stored.locale) ? stored : { ...stored, locale: DEFAULT_LOCALE };
  });

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.title = translateLoaded(preferences.locale, 'app.title');
    if (preferences.theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preferences.theme;
    }
    savePreferences(preferences);
    const refreshBrowserColor = () => {
      const color = getComputedStyle(document.documentElement).getPropertyValue(BROWSER_COLOR_TOKEN).trim();
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
    setLocale: (locale: Locale) => {
      const apply = (): void => { setPreferences((current) => ({ ...current, locale })); };
      // Another language arrives as its own chunk; the choice applies once its texts are here.
      if (isCatalogLoaded(locale)) apply();
      else void loadCatalog(locale).then(apply, () => { /* The current language stays; the offline cache normally holds both. */ });
    },
    setTheme: (theme) => { setPreferences((current) => ({ ...current, theme })); },
  };

  return (
    <PreferencesContext.Provider value={value}>
      <LocaleProvider locale={preferences.locale}>{children}</LocaleProvider>
    </PreferencesContext.Provider>
  );
}
