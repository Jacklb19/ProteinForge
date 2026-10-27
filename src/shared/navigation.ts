import type { TranslationKey } from '../i18n';
import type { IconName } from './Icon';

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
  guide: '/guide',
  signIn: '/sign-in',
  signUp: '/sign-up',
  recover: '/recover',
  privacy: '/privacy',
  terms: '/terms',
  /** Former addresses kept as redirects; `workspace` is also the registered OAuth return address. */
  workspace: '/app',
  settings: '/settings',
} as const;

/** Laboratory destinations, in display order within their sidebar group. */
export const NAVIGATION_ITEMS: readonly { path: string; labelKey: TranslationKey; icon: IconName; group: 'research' | 'design' | 'organize'; end: boolean; signedInOnly?: boolean }[] = [
  { path: ROUTES.analyze, labelKey: 'nav.analyze', icon: 'analyze', group: 'research', end: false },
  { path: ROUTES.alignment, labelKey: 'nav.alignment', icon: 'compare', group: 'research', end: false },
  { path: ROUTES.library, labelKey: 'nav.library', icon: 'library', group: 'research', end: false },
  { path: ROUTES.generate, labelKey: 'nav.generate', icon: 'design', group: 'design', end: true },
  { path: ROUTES.laboratory, labelKey: 'workbench.laboratory', icon: 'laboratory', group: 'design', end: false },
  { path: ROUTES.projects, labelKey: 'nav.projects', icon: 'projects', group: 'organize', end: false, signedInOnly: true },
];

/** Sidebar groups in display order; a group without a visible destination is not shown. */
export const NAVIGATION_GROUPS: readonly { id: (typeof NAVIGATION_ITEMS)[number]['group']; labelKey: TranslationKey }[] = [
  { id: 'research', labelKey: 'nav.groupResearch' },
  { id: 'design', labelKey: 'nav.groupDesign' },
  { id: 'organize', labelKey: 'nav.groupOrganize' },
];

/** Sections of the public page, as anchors in its header. */
export const PUBLIC_SECTIONS: readonly { id: string; labelKey: TranslationKey }[] = [
  { id: 'about', labelKey: 'public.navAbout' },
  { id: 'tools', labelKey: 'public.navTools' },
  { id: 'workflow', labelKey: 'public.navWorkflow' },
];

/** Local key of the sidebar width; only this visual choice is kept in the browser. */
export const SIDEBAR_STORAGE_KEY = 'proteinforge.sidebar-collapsed';

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
