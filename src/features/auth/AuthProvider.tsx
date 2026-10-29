import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';
import { AuthError, createAuthApi, parseFragmentSession } from './authApi';
import type { AuthApi } from './authApi';
import { readAssurance } from './assurance';
import type { MfaApi } from './mfaApi';
import { readAuthSettings, SESSION_REFRESH_MARGIN_SECONDS } from './config';
import type { AuthSettings } from './config';
import { isExpiring, loadSession, saveSession } from './session';
import type { AuthSession } from './session';
import { ROUTES } from '../../shared/navigation';

interface Props {
  children: ReactNode;
  /** Overrides the environment settings, mainly for tests; `null` disables identity. */
  settings?: AuthSettings | null;
  /** Overrides the REST client, mainly for tests. */
  api?: AuthApi;
  /** Overrides the second factor client, mainly for tests. */
  mfaApi?: MfaApi;
}

const RECOVERY_FRAGMENT_TYPE = 'recovery';

/** The server signs every session out when a verification hook refuses the attempt. */
const SIGNED_OUT_BY_VERIFICATION = 'mfa_verification_rejected';

interface InitialState {
  session: AuthSession | null;
  status: AuthStatus;
  recoveryPending: boolean;
  redirectError: string | null;
  /** A stored session close to expiry; it is refreshed before being trusted. */
  staleSession: AuthSession | null;
}

/**
 * The second factor client validates with zod, so it arrives with the first second factor call and never
 * before the first paint. A failed download is reported as a network error and tried again next time.
 */
function deferredMfaApi(settings: AuthSettings): () => Promise<MfaApi> {
  let loading: Promise<MfaApi> | null = null;
  return () => (loading ??= import('./mfaApi').then(
    ({ createMfaApi }) => createMfaApi(settings),
    () => { loading = null; throw new AuthError('network'); },
  ));
}

/** Reads the redirect fragment and the stored session once, before the first render. */
function readInitialState(enabled: boolean): InitialState {
  if (!enabled) return { session: null, status: 'disabled', recoveryPending: false, redirectError: null, staleSession: null };
  const fragment = parseFragmentSession(window.location.hash);
  if (fragment.session) {
    saveSession(fragment.session);
    return { session: fragment.session, status: 'signed-in', recoveryPending: fragment.type === RECOVERY_FRAGMENT_TYPE, redirectError: fragment.error, staleSession: null };
  }
  const stored = loadSession();
  if (!stored) return { session: null, status: 'anonymous', recoveryPending: false, redirectError: fragment.error, staleSession: null };
  if (isExpiring(stored, SESSION_REFRESH_MARGIN_SECONDS)) {
    return { session: null, status: 'loading', recoveryPending: false, redirectError: fragment.error, staleSession: stored };
  }
  return { session: stored, status: 'signed-in', recoveryPending: false, redirectError: fragment.error, staleSession: null };
}

/**
 * Keeps the Supabase session, captures tokens from redirect fragments and refreshes before expiry.
 * A refresh only lands if the session it started from is still current, so a late `aal1` token cannot
 * replace an `aal2` session from a second factor, nor reopen a session that was signed out meanwhile.
 */
export function AuthProvider({ children, settings, api, mfaApi }: Props): React.JSX.Element {
  const [environmentSettings] = useState(() => readAuthSettings());
  const configuredSettings = settings === undefined ? environmentSettings : settings;
  const client = useMemo(() => api ?? (configuredSettings ? createAuthApi(configuredSettings) : null), [api, configuredSettings]);
  const mfa = useMemo(
    () => (mfaApi ? () => Promise.resolve(mfaApi) : configuredSettings ? deferredMfaApi(configuredSettings) : null),
    [mfaApi, configuredSettings],
  );
  const [initial] = useState(() => readInitialState(client !== null));
  const [session, setSession] = useState<AuthSession | null>(initial.session);
  const [status, setStatus] = useState<AuthStatus>(initial.status);
  const [recoveryPending, setRecoveryPending] = useState(initial.recoveryPending);
  const [redirectError, setRedirectError] = useState<string | null>(initial.redirectError);
  const refreshTimer = useRef<number | null>(null);
  const currentRefreshToken = useRef<string | null>(initial.session?.refreshToken ?? initial.staleSession?.refreshToken ?? null);

  const apply = useCallback((next: AuthSession | null) => {
    currentRefreshToken.current = next?.refreshToken ?? null;
    setSession(next);
    saveSession(next);
    setStatus(next ? 'signed-in' : 'anonymous');
    if (!next) setRecoveryPending(false);
  }, []);

  /** Refreshes from the given token and applies the outcome only while that token is still the current one. */
  const refreshFrom = useCallback((refreshToken: string, keepOnNetworkError = false) => {
    if (!client) return Promise.resolve();
    return client.refresh(refreshToken).then(
      (refreshed) => { if (currentRefreshToken.current === refreshToken) apply(refreshed); },
      (error: unknown) => {
        if (currentRefreshToken.current !== refreshToken) return;
        if (keepOnNetworkError && error instanceof AuthError && error.code === 'network') return;
        apply(null);
      },
    );
  }, [client, apply]);

  useEffect(() => {
    if (!client) return;
    if (initial.session || initial.redirectError) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    if (!initial.staleSession) return;
    currentRefreshToken.current = initial.staleSession.refreshToken;
    void refreshFrom(initial.staleSession.refreshToken);
  }, [client, initial, refreshFrom]);

  useEffect(() => {
    if (!client || !session) return;
    const delayMs = Math.max(0, (session.expiresAt - SESSION_REFRESH_MARGIN_SECONDS) * 1000 - Date.now());
    refreshTimer.current = window.setTimeout(() => { void refreshFrom(session.refreshToken); }, delayMs);
    return () => { if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current); };
  }, [client, session, refreshFrom]);

  const assurance = useMemo(() => (session ? readAssurance(session.accessToken) : null), [session]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    recoveryPending,
    redirectError,
    async signIn(email, password) {
      if (!client) return;
      setRedirectError(null);
      apply(await client.signIn(email, password));
    },
    async signUp(email, password) {
      if (!client) return { session: null, confirmationRequired: false };
      setRedirectError(null);
      const outcome = await client.signUp(email, password);
      if (outcome.session) apply(outcome.session);
      return outcome;
    },
    async signOut() {
      const current = session;
      apply(null);
      setRecoveryPending(false);
      if (client && current) await client.signOut(current.accessToken).catch(() => undefined);
    },
    async recover(email) {
      if (!client) return;
      await client.recover(email, `${window.location.origin}${ROUTES.recover}`);
    },
    async updatePassword(password) {
      if (!client || !session) throw new AuthError('session_expired');
      await client.updatePassword(session.accessToken, password);
      setRecoveryPending(false);
    },
    authorizeUrl(provider) {
      return client ? client.authorizeUrl(provider, `${window.location.origin}${ROUTES.workspace}`) : null;
    },
    assurance,
    async listFactors() {
      if (!mfa || !session) throw new AuthError('session_expired');
      return (await mfa()).listFactors(session.accessToken);
    },
    async enrollTotp(friendlyName) {
      if (!mfa || !session) throw new AuthError('session_expired');
      return (await mfa()).enrollTotp(session.accessToken, friendlyName);
    },
    async verifyTotp(factorId, code) {
      if (!mfa || !session) throw new AuthError('session_expired');
      try {
        apply(await (await mfa()).verifyCode(session.accessToken, factorId, code));
      } catch (error) {
        if (error instanceof AuthError && error.code === SIGNED_OUT_BY_VERIFICATION) apply(null);
        throw error;
      }
    },
    async unenrollFactor(factorId) {
      if (!mfa || !session) throw new AuthError('session_expired');
      await (await mfa()).unenroll(session.accessToken, factorId);
      // The access token keeps its level until it is replaced; without a connection the scheduled refresh does it later.
      await refreshFrom(session.refreshToken, true);
    },
  }), [status, session, recoveryPending, redirectError, client, mfa, apply, refreshFrom, assurance]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
