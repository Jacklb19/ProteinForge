import { DEFAULT_LOCALE } from '../i18n/config';
import type { Locale } from '../i18n/config';
import type { TranslationKey } from '../i18n/translate';
import type { IconName } from '../shared/Icon';

/** Appearance choices; `system` follows the device. The order is the display order. */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'system';

export const PREFERENCES_STORAGE_KEY = 'proteinforge.preferences';

/** Media query of the device appearance that the `system` choice follows. */
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Design token copied into the browser's `theme-color` so the browser frame matches the page. */
export const BROWSER_COLOR_TOKEN = '--bg-canvas';

export const DEFAULT_PREFERENCES: { locale: Locale; theme: Theme } = { locale: DEFAULT_LOCALE, theme: DEFAULT_THEME };

/** Translation keys for each option, in the same order as the option lists. */
export const THEME_LABEL_KEYS = {
  system: 'settings.system',
  light: 'settings.light',
  dark: 'settings.dark',
} as const satisfies Record<Theme, TranslationKey>;

export const LOCALE_LABEL_KEYS = {
  es: 'settings.spanish',
  en: 'settings.english',
} as const satisfies Record<Locale, TranslationKey>;

/** Short visible text of each language button; the full name above stays its accessible name. */
export const LOCALE_SHORT_LABEL_KEYS = {
  es: 'settings.spanishShort',
  en: 'settings.englishShort',
} as const satisfies Record<Locale, TranslationKey>;

/** The theme button names and shows where it leads: the moon switches to dark, the sun to light. */
export const THEME_TOGGLE_LABEL_KEYS = {
  light: 'shell.themeToLight',
  dark: 'shell.themeToDark',
} as const satisfies Record<Exclude<Theme, 'system'>, TranslationKey>;

export const THEME_TOGGLE_ICONS = {
  light: 'sun',
  dark: 'moon',
} as const satisfies Record<Exclude<Theme, 'system'>, IconName>;
