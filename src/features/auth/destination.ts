import { AFTER_SIGN_IN_ROUTE } from '../../shared/navigation';

/** Where a protected page sent the visitor, if any; otherwise the default destination. */
export function destinationAfterSignIn(state: unknown): string {
  const from = typeof state === 'object' && state !== null ? (state as { from?: unknown }).from : undefined;
  return typeof from === 'string' && from.startsWith('/') ? from : AFTER_SIGN_IN_ROUTE;
}
