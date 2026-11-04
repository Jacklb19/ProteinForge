import type { TranslationKey } from '../../i18n';
import { ACCESS_ROUTES, AFTER_SIGN_IN_ROUTE, PAGE_TITLES } from '../../shared/navigation';
import { OAUTH_DESTINATION_STORAGE_KEY } from './config';

/** Path part of an address, without query or fragment. */
function pathOf(address: string): string {
  return address.split(/[?#]/, 1)[0] ?? address;
}

/**
 * A return address must stay inside the application: one leading slash only (`//host` and `/\host` lead
 * to another site) and never an access page, which would send the visitor back to signing in.
 */
export function isReturnAddress(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    && !ACCESS_ROUTES.includes(pathOf(value));
}

/** The page a protected route sent the visitor from, if any. */
export function requestedDestination(state: unknown): string | null {
  const from = typeof state === 'object' && state !== null ? (state as { from?: unknown }).from : undefined;
  return isReturnAddress(from) ? from : null;
}

/** Where a protected page sent the visitor, if any; otherwise the default destination. */
export function destinationAfterSignIn(state: unknown): string {
  return requestedDestination(state) ?? AFTER_SIGN_IN_ROUTE;
}

/** Name of the page behind a return address, for «Volverás a…»; unknown pages have none. */
export function destinationTitle(address: string): TranslationKey | null {
  return PAGE_TITLES[pathOf(address).replace(/(.)\/+$/, '$1')] ?? null;
}

/** Keeps only the requested path across the Google redirect; storage may be unavailable, and then it is lost. */
export function rememberDestination(address: string | null): void {
  try {
    if (address) sessionStorage.setItem(OAUTH_DESTINATION_STORAGE_KEY, address);
    else sessionStorage.removeItem(OAUTH_DESTINATION_STORAGE_KEY);
  } catch { /* The visitor lands on the default page instead. */ }
}

/** Reads and forgets the path kept before the Google redirect. */
export function takeRememberedDestination(): string {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(OAUTH_DESTINATION_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_DESTINATION_STORAGE_KEY);
  } catch { /* Nothing was kept. */ }
  return isReturnAddress(stored) ? stored : AFTER_SIGN_IN_ROUTE;
}
