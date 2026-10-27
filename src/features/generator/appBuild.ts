import { normalizeAppBuild } from './buildCommit';

/** Commit of this build, injected by vite.config.ts; null in tests, unclean checkouts or builds without git. */
export const APP_BUILD: string | null = normalizeAppBuild(import.meta.env.VITE_APP_BUILD);
