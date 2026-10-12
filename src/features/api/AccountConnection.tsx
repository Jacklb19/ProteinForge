import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useAuth } from '../auth/authContext';
import { ApiError, createProteinForgeApi } from './apiClient';
import { readApiBaseUrl } from './config';

const ERROR_KEYS: Record<ApiError['code'], TranslationKey> = {
  network: 'connection.network', timeout: 'connection.timeout', cancelled: 'connection.loading',
  session: 'connection.session', unavailable: 'connection.unavailable', 'invalid-response': 'connection.invalid', unknown: 'connection.unavailable',
  conflict: 'connection.unavailable', 'not-found': 'connection.unavailable', validation: 'connection.invalid', schema: 'connection.unavailable', forbidden: 'connection.session',
};
type ConnectionState = { key: TranslationKey; requestId?: string; identityId?: string };

/** Reflects health and /me separately from browser sign-in; it never promises project persistence. */
export function AccountConnection(): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  const client = useMemo(() => { const base = readApiBaseUrl(); return base ? createProteinForgeApi(base) : null; }, []);
  const token = auth.session?.accessToken;
  const userId = auth.session?.user.id;
  const [state, setState] = useState<ConnectionState>({ key: client ? 'connection.loading' : 'connection.disabled' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    const isActive = () => !controller.signal.aborted;
    const activeToken = token;
    const activeUserId = userId;
    async function check(): Promise<void> {
      await Promise.resolve();
      if (!isActive() || !client) return;
      setState({ key: 'connection.loading' });
      try {
        const health = await client.health(controller.signal);
        let key: TranslationKey = health.identity ? 'connection.ready' : 'connection.identityMissing';
        if (activeToken && health.identity) {
          const identity = await client.me(activeToken, controller.signal);
          if (identity.id !== activeUserId) throw new ApiError('session');
          key = 'connection.verified';
        }
        if (isActive()) setState({ key, identityId: activeUserId });
      } catch (error) {
        if (isActive()) setState(error instanceof ApiError ? { key: ERROR_KEYS[error.code], requestId: error.requestId } : { key: 'connection.unavailable' });
      }
    }
    void check();
    return () => { controller.abort(); };
  }, [client, token, userId, attempt]);

  return (
    <div className="connection-status">
      <p role="status" aria-live="polite">{t(state.key === 'connection.verified' && state.identityId !== userId ? 'connection.loading' : state.key)}</p>
      {state.requestId && <p className="field-help">{t('connection.reference', { id: state.requestId })}</p>}
      {client && <button className="button button-secondary" onClick={() => { setAttempt((value) => value + 1); }}>{t('connection.retry')}</button>}
      <p className="field-help">{t('connection.scope')}</p>
    </div>
  );
}
