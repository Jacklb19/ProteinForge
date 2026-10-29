import { useEffect, useRef, useState } from 'react';
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

  const [requestedLocale, setRequestedLocale] = useState<Locale | null>(null);
  const latestRequest = useRef<Locale | null>(null);

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.title = translateLoaded(preferences.locale, 'app.title');
    if (preferences.theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preferences.theme;
    }
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

  // A chosen language is stored at once, before its catalog arrives, so reloading meanwhile keeps the
  // choice: startup fetches the stored catalog first. If the catalog fails, the current language is stored again.
  useEffect(() => {
    savePreferences({ ...preferences, locale: requestedLocale ?? preferences.locale });
  }, [preferences, requestedLocale]);

  const value: PreferencesContextValue = {
    ...preferences,
    chosenLocale: requestedLocale ?? preferences.locale,
    setLocale: (locale: Locale) => {
      latestRequest.current = locale;
      const apply = (): void => {
        if (latestRequest.current !== locale) return;
        setRequestedLocale(null);
        setPreferences((current) => ({ ...current, locale }));
      };
      // Another language arrives as its own chunk: the control shows the choice at once and the texts
      // follow when the catalog is here. If it cannot load, the current language stays.
      if (isCatalogLoaded(locale)) { apply(); return; }
      setRequestedLocale(locale);
      void loadCatalog(locale).then(apply, () => { if (latestRequest.current === locale) setRequestedLocale(null); });
    },
    setTheme: (theme) => { setPreferences((current) => ({ ...current, theme })); },
  };

  return (
    <PreferencesContext.Provider value={value}>
      <LocaleProvider locale={preferences.locale}>{children}</LocaleProvider>
    </PreferencesContext.Provider>
  );
}
