import type { TranslationKey } from '../../i18n/translate';

/** Public identity settings read from the environment; both must be present for identity to work. */
export interface AuthSettings {
  url: string;
  anonKey: string;
}

/** Resolves the identity settings, or `null` when the deployment has not configured them. */
export function readAuthSettings(environment: ImportMetaEnv = import.meta.env): AuthSettings | null {
  const url = environment.VITE_SUPABASE_URL?.trim() ?? '';
  const anonKey = environment.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  return url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
}

/** Supabase Auth (GoTrue) REST paths relative to the project URL. */
export const AUTH_BASE_PATH = '/auth/v1';
export const AUTH_ENDPOINTS = {
  signUp: '/signup',
  token: '/token',
  recover: '/recover',
  user: '/user',
  logout: '/logout',
  authorize: '/authorize',
} as const;

/** Local storage key for the current session; the token never leaves the browser except for Supabase requests. */
export const SESSION_STORAGE_KEY = 'proteinforge.session';

/** Sessions are refreshed this many seconds before their access token expires. */
export const SESSION_REFRESH_MARGIN_SECONDS = 60;

/** Form rules shown to the visitor and enforced before any request. */
export const PASSWORD_MIN_LENGTH = 8;
export const EMAIL_MAX_LENGTH = 254;

/** Identity providers offered through Supabase redirection; each must be enabled in the project. */
export const OAUTH_PROVIDERS: readonly { id: string; labelKey: TranslationKey }[] = [
  { id: 'google', labelKey: 'auth.continueGoogle' },
];

/** Known Supabase error codes mapped to the message shown to the visitor. */
export const AUTH_ERROR_MESSAGE_KEYS: Readonly<Record<string, TranslationKey>> = {
  invalid_credentials: 'auth.errorInvalidCredentials',
  invalid_grant: 'auth.errorInvalidCredentials',
  email_not_confirmed: 'auth.errorEmailNotConfirmed',
  user_already_exists: 'auth.errorUserExists',
  email_exists: 'auth.errorUserExists',
  weak_password: 'auth.errorWeakPassword',
  over_request_rate_limit: 'auth.errorRateLimited',
  over_email_send_rate_limit: 'auth.errorRateLimited',
  same_password: 'auth.errorSamePassword',
  session_expired: 'auth.errorSessionExpired',
  refresh_token_not_found: 'auth.errorSessionExpired',
  network: 'auth.errorNetwork',
  unknown: 'auth.errorUnknown',
};
