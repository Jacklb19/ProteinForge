import type { Theme } from './config';

export type ResolvedTheme = Exclude<Theme, 'system'>;

/** Appearance actually shown, resolving `system` through the device preference. */
export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

/** The explicit theme that flips the appearance currently shown. */
export function toggledTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  return resolveTheme(theme, prefersDark) === 'dark' ? 'light' : 'dark';
}
