import { createContext } from 'react';
import type { Locale } from '../i18n';
import type { Preferences, Theme } from './preferences';

export interface PreferencesContextValue extends Preferences {
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);
