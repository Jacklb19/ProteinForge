import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';
import { AuthError, createAuthApi, parseFragmentSession } from './authApi';
import type { AuthApi } from './authApi';
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
}

const RECOVERY_FRAGMENT_TYPE = 'recovery';

interface InitialState {
  session: AuthSession | null;
  status: AuthStatus;
  recoveryPending: boolean;
  redirectError: string | null;
  /** A stored session close to expiry; it is refreshed before being trusted. */
  staleSession: AuthSession | null;
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

/** Keeps the Supabase session, captures tokens from redirect fragments and refreshes before expiry. */
export function AuthProvider({ children, settings, api }: Props): React.JSX.Element {
  const [environmentSettings] = useState(() => readAuthSettings());
  const configuredSettings = settings === undefined ? environmentSettings : settings;
  const client = useMemo(() => api ?? (configuredSettings ? createAuthApi(configuredSettings) : null), [api, configuredSettings]);
  const [initial] = useState(() => readInitialState(client !== null));
  const [session, setSession] = useState<AuthSession | null>(initial.session);
  const [status, setStatus] = useState<AuthStatus>(initial.status);
  const [recoveryPending, setRecoveryPending] = useState(initial.recoveryPending);
  const [redirectError, setRedirectError] = useState<string | null>(initial.redirectError);
  const refreshTimer = useRef<number | null>(null);

  const apply = useCallback((next: AuthSession | null) => {
    setSession(next);
    saveSession(next);
    setStatus(next ? 'signed-in' : 'anonymous');
    if (!next) setRecoveryPending(false);
  }, []);

  useEffect(() => {
    if (!client) return;
    if (initial.session || initial.redirectError) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    if (!initial.staleSession) return;
    let active = true;
    client.refresh(initial.staleSession.refreshToken)
      .then((refreshed) => { if (active) apply(refreshed); })
      .catch(() => { if (active) apply(null); });
    return () => { active = false; };
  }, [client, initial, apply]);

  useEffect(() => {
    if (!client || !session) return;
    const delayMs = Math.max(0, (session.expiresAt - SESSION_REFRESH_MARGIN_SECONDS) * 1000 - Date.now());
    refreshTimer.current = window.setTimeout(() => {
      client.refresh(session.refreshToken).then(apply).catch(() => { apply(null); });
    }, delayMs);
    return () => { if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current); };
  }, [client, session, apply]);

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
  }), [status, session, recoveryPending, redirectError, client, apply]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
