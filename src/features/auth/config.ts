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
  factors: '/factors',
} as const;

/** Second factor paths below `AUTH_ENDPOINTS.factors`, for one factor identified by its UUID. */
export const FACTOR_ENDPOINTS = {
  challenge: (factorId: string) => `/${factorId}/challenge`,
  verify: (factorId: string) => `/${factorId}/verify`,
  remove: (factorId: string) => `/${factorId}`,
} as const;

/** Only authenticator apps are offered; Supabase also knows phone and WebAuthn factors, which stay unused. */
export const TOTP_FACTOR_TYPE = 'totp';

/** Supabase validates six-digit SHA-1 codes over 30 s periods; the length is checked before any request. */
export const TOTP_CODE_LENGTH = 6;

/** Client-side limit for the name of an authenticator; Supabase only requires it to be unique per user. */
export const TOTP_FACTOR_NAME_MAX_LENGTH = 64;

/** Prefix that turns the SVG text returned at enrollment into an image source; the CSP allows `data:` images. */
export const TOTP_QR_DATA_URI_PREFIX = 'data:image/svg+xml;charset=utf-8,';

/** Session storage key; tokens are sent only to Supabase Auth and the configured ProteinForge API. */
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
  totp_code_invalid: 'auth.errorTotpCodeInvalid',
  factor_name_invalid: 'auth.errorFactorNameInvalid',
  mfa_verification_failed: 'auth.errorTotpRejected',
  mfa_challenge_expired: 'auth.errorTotpExpired',
  mfa_ip_address_mismatch: 'auth.errorTotpExpired',
  mfa_factor_not_found: 'auth.errorFactorMissing',
  mfa_factor_name_conflict: 'auth.errorFactorNameTaken',
  too_many_enrolled_mfa_factors: 'auth.errorTooManyFactors',
  insufficient_aal: 'auth.errorSecondFactorRequired',
  mfa_totp_enroll_not_enabled: 'auth.errorSecondFactorUnavailable',
  mfa_totp_verify_not_enabled: 'auth.errorSecondFactorUnavailable',
  mfa_verification_rejected: 'auth.errorTotpBlocked',
  unknown: 'auth.errorUnknown',
};
