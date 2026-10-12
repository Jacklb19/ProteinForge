import type { TranslationKey } from '../i18n';
import type { IconName } from './Icon';

/** Application paths; every link and route reads them from here. */
export const ROUTES = {
  home: '/',
  workspace: '/app',
  analyze: '/analyze',
  alignment: '/alignment',
  settings: '/settings',
  signIn: '/sign-in',
  signUp: '/sign-up',
  recover: '/recover',
  privacy: '/privacy',
  terms: '/terms',
  library: '/library',
  generate: '/generate',
} as const;

/** Workspace destinations in display order; the public website has its own section links. */
export const NAVIGATION_ITEMS: readonly { path: string; labelKey: TranslationKey; icon: IconName; end: boolean }[] = [
  { path: ROUTES.workspace, labelKey: 'workspace.nav', icon: 'home', end: true },
  { path: ROUTES.analyze, labelKey: 'nav.analyze', icon: 'sequence', end: false },
  { path: ROUTES.alignment, labelKey: 'nav.alignment', icon: 'alignment', end: false },
  { path: ROUTES.settings, labelKey: 'nav.settings', icon: 'settings', end: false },
];
export const WORKSPACE_PATHS: readonly string[] = [...NAVIGATION_ITEMS.map((item) => item.path), ROUTES.library, ROUTES.generate];

export const PUBLIC_SECTIONS = {
  product: 'product',
  flow: 'how-it-works',
  criterion: 'scientific-criterion',
} as const;

export const PUBLIC_NAVIGATION: readonly { id: string; labelKey: TranslationKey }[] = [
  { id: PUBLIC_SECTIONS.product, labelKey: 'landing.productLink' },
  { id: PUBLIC_SECTIONS.flow, labelKey: 'landing.flowLink' },
];

/** Secondary links shown in the page footer. */
export const FOOTER_LINKS: readonly { path: string; labelKey: TranslationKey }[] = [
  { path: ROUTES.privacy, labelKey: 'nav.privacy' },
  { path: ROUTES.terms, labelKey: 'nav.terms' },
  { path: ROUTES.settings, labelKey: 'nav.settings' },
];

/** Public source repositories; the footer links to them. */
export const REPOSITORY_LINKS: readonly { url: string; labelKey: TranslationKey }[] = [
  { url: 'https://github.com/Jacklb19/ProteinForge', labelKey: 'footer.frontendRepository' },
  { url: 'https://github.com/Jacklb19/Protein_Back', labelKey: 'footer.backendRepository' },
];

/** Where a visitor lands after signing in, unless a protected page sent them to sign in. */
export const AFTER_SIGN_IN_ROUTE = ROUTES.workspace;
