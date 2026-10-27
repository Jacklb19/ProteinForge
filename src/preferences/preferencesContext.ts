import { createContext } from 'react';
import type { Locale } from '../i18n';
import type { Preferences, Theme } from './preferences';

export interface PreferencesContextValue extends Preferences {
  /** The language a control shows as selected: the requested one while its texts load, then the active one. */
  chosenLocale: Locale;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);
