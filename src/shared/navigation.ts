import type { TranslationKey } from '../i18n';
import type { IconName } from './Icon';

/** Application paths; every link and route reads them from here. */
export const ROUTES = {
  analyze: '/',
  alignment: '/alignment',
  settings: '/settings',
} as const;

/** Primary destinations in display order: top bar on wide screens, tab bar on phones. */
export const NAVIGATION_ITEMS: readonly { path: string; labelKey: TranslationKey; icon: IconName; end: boolean }[] = [
  { path: ROUTES.analyze, labelKey: 'nav.analyze', icon: 'sequence', end: true },
  { path: ROUTES.alignment, labelKey: 'nav.alignment', icon: 'alignment', end: false },
  { path: ROUTES.settings, labelKey: 'nav.settings', icon: 'settings', end: false },
];
