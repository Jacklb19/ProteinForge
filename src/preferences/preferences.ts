import { LOCALES } from '../i18n/config';
import type { Locale } from '../i18n/config';
import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY, THEMES } from './config';
import type { Theme } from './config';

export type { Theme } from './config';

export interface Preferences {
  locale: Locale;
  theme: Theme;
}

function isOption<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

/** Reads validated local preferences without depending on storage availability. */
export function loadPreferences(): Preferences {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFERENCES;
    const value = stored as Record<string, unknown>;
    return {
      locale: isOption(LOCALES, value.locale) ? value.locale : DEFAULT_PREFERENCES.locale,
      theme: isOption(THEMES, value.theme) ? value.theme : DEFAULT_PREFERENCES.theme,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Persists local preferences when the browser allows storage access. */
export function savePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be denied without disabling the in-memory preferences.
  }
}
