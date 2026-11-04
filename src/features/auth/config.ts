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
  verify: '/verify',
  resend: '/resend',
} as const;

/** Confirmation of a new account's email with the code sent next to the link: Supabase OTP types. */
export const EMAIL_CODE_VERIFY_TYPE = 'email';
export const EMAIL_CODE_RESEND_TYPE = 'signup';
/** Digits of the email code; it must match «Email OTP Length» in the Supabase project. */
export const EMAIL_CODE_LENGTH = 6;
/** Wait before another code can be requested; it matches the minimum interval between emails of the project. */
export const RESEND_WAIT_SECONDS = 60;
/** The email code arrives as a whole string; this is the widest paste accepted before spaces are removed. */
export const EMAIL_CODE_INPUT_MAX_LENGTH = 12;

/** Only the path a protected page asked for is kept across the Google redirect; never any personal data. */
export const OAUTH_DESTINATION_STORAGE_KEY = 'proteinforge.after-sign-in';

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

/**
 * Only these answers to a refresh mean the session is over; anything else (no network, 5xx, 429, a gateway
 * page) keeps it and the refresh runs again after each delay in turn, the last one repeating.
 */
export const SESSION_REJECTED_STATUSES: readonly number[] = [400, 401];
export const SESSION_REJECTED_CODES: readonly string[] = ['invalid_grant', 'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired'];
export const SESSION_RETRY_DELAYS_MS = [5_000, 15_000, 60_000] as const;

/** Form rules shown to the visitor and enforced before any request. */
export const PASSWORD_MIN_LENGTH = 8;
/** Supabase hashes passwords with bcrypt, which ignores everything after the first 72 bytes of UTF-8. */
export const PASSWORD_MAX_BYTES = 72;
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
  otp_expired: 'auth.errorCodeInvalid',
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
