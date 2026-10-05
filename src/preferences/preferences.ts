import type { Locale } from '../i18n';

export type Theme = 'system' | 'light' | 'dark';

export interface Preferences {
  locale: Locale;
  theme: Theme;
}

const STORAGE_KEY = 'proteinforge.preferences';
const DEFAULT_PREFERENCES: Preferences = { locale: 'es', theme: 'system' };

/** Reads validated local preferences without depending on storage availability. */
export function loadPreferences(): Preferences {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFERENCES;
    const value = stored as Record<string, unknown>;
    return {
      locale: value.locale === 'en' ? 'en' : 'es',
      theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Persists local preferences when the browser allows storage access. */
export function savePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be denied without disabling the in-memory preferences.
  }
}
