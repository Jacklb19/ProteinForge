import type { TranslationKey } from '../i18n';

/** Application paths; every link and route reads them from here. */
export const ROUTES = {
  home: '/',
  analyze: '/analyze',
  alignment: '/alignment',
  generate: '/generate',
  laboratory: '/generate/lab',
  library: '/library',
  profile: '/profile',
  projects: '/projects',
  signIn: '/sign-in',
  signUp: '/sign-up',
  recover: '/recover',
  privacy: '/privacy',
  terms: '/terms',
  /** Former addresses kept as redirects; `workspace` is also the registered OAuth return address. */
  workspace: '/app',
  settings: '/settings',
} as const;

/** The same destinations on every page, in display order. */
export const NAVIGATION_ITEMS: readonly { path: string; labelKey: TranslationKey; end: boolean; signedInOnly?: boolean }[] = [
  { path: ROUTES.home, labelKey: 'nav.home', end: true },
  { path: ROUTES.analyze, labelKey: 'nav.analyze', end: false },
  { path: ROUTES.alignment, labelKey: 'nav.alignment', end: false },
  { path: ROUTES.generate, labelKey: 'nav.generate', end: false },
  { path: ROUTES.library, labelKey: 'nav.library', end: false },
  { path: ROUTES.projects, labelKey: 'nav.projects', end: false, signedInOnly: true },
];

/** Former addresses and where they lead now. */
export const REDIRECTS: readonly { from: string; to: string }[] = [
  { from: ROUTES.workspace, to: ROUTES.analyze },
  { from: ROUTES.settings, to: ROUTES.profile },
];

/** Secondary links shown in the page footer. */
export const FOOTER_LINKS: readonly { path: string; labelKey: TranslationKey }[] = [
  { path: ROUTES.privacy, labelKey: 'nav.privacy' },
  { path: ROUTES.terms, labelKey: 'nav.terms' },
];

/** Where a visitor lands after signing in, unless a protected page sent them to sign in. */
export const AFTER_SIGN_IN_ROUTE = ROUTES.analyze;

/** Vertical scroll, in CSS pixels, after which the bar takes its veil. */
export const BAR_VEIL_SCROLL_PX = 4;
