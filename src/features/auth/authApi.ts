import { AUTH_BASE_PATH, AUTH_ENDPOINTS } from './config';
import type { AuthSettings } from './config';
import type { AuthSession } from './session';
import type { SessionResponse } from './schemas';

/**
 * The response shapes arrive with the first call to the service, never before the first paint.
 * `AuthProvider` imports this file to read the redirect fragment, which needs no validation at all,
 * so keeping zod out of it keeps zod out of the initial download. See `./schemas.ts`.
 */
let loading: Promise<typeof import('./schemas')> | null = null;
const schemas = (): Promise<typeof import('./schemas')> => (loading ??= import('./schemas'));

/** Failure reported by Supabase Auth or the network, identified by a stable code. */
export class AuthError extends Error {
  readonly code: string;
  constructor(code: string, message = code) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export interface SignUpOutcome {
  session: AuthSession | null;
  confirmationRequired: boolean;
}

/** Operations are plain function properties so they can be passed around or mocked without binding. */
export interface AuthApi {
  signUp: (email: string, password: string) => Promise<SignUpOutcome>;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  refresh: (refreshToken: string) => Promise<AuthSession>;
  recover: (email: string, redirectTo: string) => Promise<void>;
  updatePassword: (accessToken: string, password: string) => Promise<void>;
  getUser: (accessToken: string) => Promise<AuthSession['user']>;
  signOut: (accessToken: string) => Promise<void>;
  authorizeUrl: (provider: string, redirectTo: string) => string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Converts a Supabase session payload to the browser session, computing the expiry when only `expires_in` is sent. */
export function toSession(payload: SessionResponse, now = Date.now()): AuthSession {
  const expiresAt = payload.expires_at ?? Math.floor(now / 1000) + (payload.expires_in ?? 0);
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt,
    user: { id: payload.user.id, email: payload.user.email ?? '' },
  };
}

/** Thin client for the Supabase Auth REST endpoints; it never logs tokens or sequences. */
export function createAuthApi(settings: AuthSettings, fetchImplementation: FetchLike = (input, init) => fetch(input, init)): AuthApi {
  const base = `${settings.url}${AUTH_BASE_PATH}`;

  async function request(path: string, init: { method: string; body?: unknown; accessToken?: string }): Promise<unknown> {
    const headers: Record<string, string> = { apikey: settings.anonKey, 'Content-Type': 'application/json' };
    if (init.accessToken) headers.Authorization = `Bearer ${init.accessToken}`;
    let response: Response;
    try {
      response = await fetchImplementation(`${base}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new AuthError('network');
    }
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok) {
      const { errorResponseSchema } = await schemas();
      const parsed = errorResponseSchema.safeParse(data);
      const details = parsed.success ? parsed.data : {};
      const code = details.error_code ?? (typeof details.code === 'string' ? details.code : undefined) ?? details.error ?? 'unknown';
      throw new AuthError(code, details.msg ?? details.message ?? details.error_description ?? code);
    }
    return data;
  }

  async function parseSession(data: unknown): Promise<AuthSession> {
    const { sessionResponseSchema } = await schemas();
    const parsed = sessionResponseSchema.safeParse(data);
    if (!parsed.success) throw new AuthError('unknown');
    return toSession(parsed.data);
  }

  return {
    async signUp(email, password) {
      const data = await request(AUTH_ENDPOINTS.signUp, { method: 'POST', body: { email, password } });
      const { sessionResponseSchema, userResponseSchema } = await schemas();
      const session = sessionResponseSchema.safeParse(data);
      if (session.success) return { session: toSession(session.data), confirmationRequired: false };
      if (userResponseSchema.safeParse(data).success) return { session: null, confirmationRequired: true };
      throw new AuthError('unknown');
    },
    async signIn(email, password) {
      return parseSession(await request(`${AUTH_ENDPOINTS.token}?grant_type=password`, { method: 'POST', body: { email, password } }));
    },
    async refresh(refreshToken) {
      return parseSession(await request(`${AUTH_ENDPOINTS.token}?grant_type=refresh_token`, { method: 'POST', body: { refresh_token: refreshToken } }));
    },
    async recover(email, redirectTo) {
      await request(`${AUTH_ENDPOINTS.recover}?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: { email } });
    },
    async updatePassword(accessToken, password) {
      await request(AUTH_ENDPOINTS.user, { method: 'PUT', body: { password }, accessToken });
    },
    async getUser(accessToken) {
      const { userResponseSchema } = await schemas();
      const parsed = userResponseSchema.safeParse(await request(AUTH_ENDPOINTS.user, { method: 'GET', accessToken }));
      if (!parsed.success) throw new AuthError('unknown');
      return { id: parsed.data.id, email: parsed.data.email ?? '' };
    },
    async signOut(accessToken) {
      await request(AUTH_ENDPOINTS.logout, { method: 'POST', accessToken });
    },
    authorizeUrl(provider, redirectTo) {
      return `${base}${AUTH_ENDPOINTS.authorize}?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
    },
  };
}

/** Tokens delivered in the URL fragment after an email link or an identity provider redirect. */
export function parseFragmentSession(hash: string, now = Date.now()): { session: AuthSession | null; type: string | null; error: string | null } {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  const error = parameters.get('error_code') ?? parameters.get('error_description') ?? parameters.get('error');
  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');
  const type = parameters.get('type');
  if (!accessToken || !refreshToken) return { session: null, type, error };
  const expiresIn = Number(parameters.get('expires_in'));
  const expiresAt = Number(parameters.get('expires_at'));
  const userId = decodeSubject(accessToken);
  if (!userId) return { session: null, type, error: error ?? 'unknown' };
  return {
    session: {
      accessToken,
      refreshToken,
      expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : Math.floor(now / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 0),
      user: { id: userId, email: decodeEmail(accessToken) },
    },
    type,
    error,
  };
}

function decodePayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: unknown = JSON.parse(json);
    return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function decodeSubject(token: string): string | null {
  const subject = decodePayload(token)?.sub;
  return typeof subject === 'string' && subject ? subject : null;
}

function decodeEmail(token: string): string {
  const email = decodePayload(token)?.email;
  return typeof email === 'string' ? email : '';
}
