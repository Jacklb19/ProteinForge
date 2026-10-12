import { AuthError } from './authApi';
import { AUTH_ERROR_MESSAGE_KEYS } from './config';
import type { TranslationKey } from '../../i18n/translate';

/** Catalog key for a failure; unknown codes and foreign errors share one generic message. */
export function authErrorKey(error: unknown): TranslationKey {
  const code = error instanceof AuthError ? error.code : 'unknown';
  return AUTH_ERROR_MESSAGE_KEYS[code] ?? AUTH_ERROR_MESSAGE_KEYS.unknown ?? 'auth.errorUnknown';
}
