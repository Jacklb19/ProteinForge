import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { AuthProvider } from './AuthProvider';
import { AuthError } from './authApi';
import type { AuthApi } from './authApi';
import { useAuth } from './authContext';
import type { AuthContextValue } from './authContext';
import type { MfaApi } from './mfaApi';
import { SESSION_REFRESH_MARGIN_SECONDS, SESSION_STORAGE_KEY } from './config';
import type { AuthSession } from './session';

const settings = { url: 'https://project.supabase.co', anonKey: 'public-key' };
const factorId = '0b6e2f4a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'user-1', ...payload })}.signature`;
}

function sessionAt(aal: 'aal1' | 'aal2', refreshToken: string, expiresIn = 3600): AuthSession {
  return { accessToken: token({ aal }), refreshToken, expiresAt: Math.floor(Date.now() / 1000) + expiresIn, user: { id: 'user-1', email: 'ana@example.org' } };
}

function mockApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    signUp: vi.fn(), signIn: vi.fn(), recover: vi.fn(), updatePassword: vi.fn(), getUser: vi.fn(), authorizeUrl: vi.fn(),
    refresh: vi.fn().mockResolvedValue(sessionAt('aal1', 'refreshed')),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockMfa(overrides: Partial<MfaApi> = {}): MfaApi {
  return {
    listFactors: vi.fn().mockResolvedValue([]),
    enrollTotp: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
    verifyCode: vi.fn().mockResolvedValue(sessionAt('aal2', 'aal2-refresh')),
    unenroll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Exposes the second factor operations of the provider as buttons and shows the session level. */
function Probe(): React.JSX.Element {
  const auth = useAuth();
  const [outcome, setOutcome] = useState('idle');
  const run = (operation: () => Promise<unknown>) => () => {
    void operation().then(() => { setOutcome('done'); }, (error: unknown) => { setOutcome(error instanceof AuthError ? error.code : 'unexpected'); });
  };
  return (
    <>
      <p data-testid="level">{auth.assurance?.level ?? 'none'}</p>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="outcome">{outcome}</p>
      <button onClick={run(() => auth.verifyTotp(factorId, '123456'))}>verify</button>
      <button onClick={run(() => auth.unenrollFactor(factorId))}>unenroll</button>
      <button onClick={run(() => auth.listFactors())}>list</button>
      <button onClick={run(() => auth.enrollTotp('Phone'))}>enroll</button>
      <button onClick={run(() => auth.signOut())}>sign out</button>
    </>
  );
}

function renderProvider(api: AuthApi, mfa: MfaApi, stored: AuthSession | null): void {
  if (stored) window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
  render(<AuthProvider settings={settings} api={api} mfaApi={mfa}><Probe /></AuthProvider>);
}

function storedSession(): AuthSession | null {
  return JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as AuthSession | null;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

afterEach(() => {
  window.localStorage.clear();
});

describe('second factor session', () => {
  it('keeps the raised session returned by a verified code', async () => {
    const mfa = mockMfa();
    renderProvider(mockApi(), mfa, sessionAt('aal1', 'aal1-refresh'));
    expect(screen.getByTestId('level')).toHaveTextContent('aal1');
    fireEvent.click(screen.getByRole('button', { name: 'verify' }));
    await waitFor(() => { expect(screen.getByTestId('level')).toHaveTextContent('aal2'); });
    expect(mfa.verifyCode).toHaveBeenCalledWith(expect.any(String), factorId, '123456');
    expect(storedSession()?.refreshToken).toBe('aal2-refresh');
  });

  it('discards a refresh that started before the verification and arrives after it', async () => {
    const late = deferred<AuthSession>();
    const api = mockApi({ refresh: vi.fn().mockReturnValue(late.promise) });
    // Close enough to expiry for the scheduled refresh to start within a second.
    renderProvider(api, mockMfa(), sessionAt('aal1', 'aal1-refresh', SESSION_REFRESH_MARGIN_SECONDS + 1));
    await waitFor(() => { expect(api.refresh).toHaveBeenCalledWith('aal1-refresh'); }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'verify' }));
    await waitFor(() => { expect(screen.getByTestId('level')).toHaveTextContent('aal2'); });
    await act(async () => { late.resolve(sessionAt('aal1', 'stale-refresh')); await late.promise; });
    expect(screen.getByTestId('level')).toHaveTextContent('aal2');
    expect(storedSession()?.refreshToken).toBe('aal2-refresh');
  });

  it('does not reopen a session signed out while its refresh was pending', async () => {
    const late = deferred<AuthSession>();
    const api = mockApi({ refresh: vi.fn().mockReturnValue(late.promise) });
    renderProvider(api, mockMfa(), sessionAt('aal1', 'aal1-refresh', SESSION_REFRESH_MARGIN_SECONDS + 1));
    await waitFor(() => { expect(api.refresh).toHaveBeenCalled(); }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'sign out' }));
    await waitFor(() => { expect(screen.getByTestId('status')).toHaveTextContent('anonymous'); });
    await act(async () => { late.resolve(sessionAt('aal1', 'reopened')); await late.promise; });
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(storedSession()).toBeNull();
  });

  it('refreshes after removing a factor so the session drops back to aal1', async () => {
    const api = mockApi();
    const mfa = mockMfa();
    renderProvider(api, mfa, sessionAt('aal2', 'aal2-refresh'));
    fireEvent.click(screen.getByRole('button', { name: 'unenroll' }));
    await waitFor(() => { expect(screen.getByTestId('outcome')).toHaveTextContent('done'); });
    expect(mfa.unenroll).toHaveBeenCalledWith(expect.any(String), factorId);
    expect(api.refresh).toHaveBeenCalledWith('aal2-refresh');
    expect(screen.getByTestId('level')).toHaveTextContent('aal1');
    expect(storedSession()?.refreshToken).toBe('refreshed');
  });

  it('keeps the session when the refresh after removing a factor finds no connection', async () => {
    const api = mockApi({ refresh: vi.fn().mockRejectedValue(new AuthError('network')) });
    renderProvider(api, mockMfa(), sessionAt('aal2', 'aal2-refresh'));
    fireEvent.click(screen.getByRole('button', { name: 'unenroll' }));
    await waitFor(() => { expect(screen.getByTestId('outcome')).toHaveTextContent('done'); });
    expect(screen.getByTestId('status')).toHaveTextContent('signed-in');
    expect(storedSession()?.refreshToken).toBe('aal2-refresh');
  });

  it('keeps the session after a wrong code but follows the service when it signs every session out', async () => {
    const verifyCode = vi.fn()
      .mockRejectedValueOnce(new AuthError('mfa_verification_failed'))
      .mockRejectedValueOnce(new AuthError('mfa_verification_rejected'));
    renderProvider(mockApi(), mockMfa({ verifyCode }), sessionAt('aal1', 'aal1-refresh'));
    fireEvent.click(screen.getByRole('button', { name: 'verify' }));
    await waitFor(() => { expect(screen.getByTestId('outcome')).toHaveTextContent('mfa_verification_failed'); });
    expect(screen.getByTestId('status')).toHaveTextContent('signed-in');
    fireEvent.click(screen.getByRole('button', { name: 'verify' }));
    await waitFor(() => { expect(screen.getByTestId('outcome')).toHaveTextContent('mfa_verification_rejected'); });
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(storedSession()).toBeNull();
  });

  it('passes the access token to listing and enrollment', async () => {
    const mfa = mockMfa({ enrollTotp: vi.fn().mockResolvedValue({ factorId, friendlyName: 'Phone', qrCodeSource: 'data:', secret: 'S', uri: 'otpauth://totp/x' }) });
    const current = sessionAt('aal1', 'aal1-refresh');
    renderProvider(mockApi(), mfa, current);
    fireEvent.click(screen.getByRole('button', { name: 'list' }));
    await waitFor(() => { expect(mfa.listFactors).toHaveBeenCalledWith(current.accessToken); });
    fireEvent.click(screen.getByRole('button', { name: 'enroll' }));
    await waitFor(() => { expect(mfa.enrollTotp).toHaveBeenCalledWith(current.accessToken, 'Phone'); });
  });

  it('refuses every second factor operation without a session', async () => {
    const mfa = mockMfa();
    const captured: AuthContextValue[] = [];
    function Capture(): null {
      const auth = useAuth();
      useEffect(() => { captured.push(auth); }, [auth]);
      return null;
    }
    render(<AuthProvider settings={settings} api={mockApi()} mfaApi={mfa}><Capture /></AuthProvider>);
    const current = captured.at(-1);
    if (!current) throw new Error('The provider did not render');
    expect(current.assurance).toBeNull();
    for (const operation of [() => current.listFactors(), () => current.enrollTotp('Phone'), () => current.verifyTotp(factorId, '123456'), () => current.unenrollFactor(factorId)]) {
      await expect(operation()).rejects.toMatchObject({ code: 'session_expired' });
    }
    expect(mfa.listFactors).not.toHaveBeenCalled();
    expect(mfa.verifyCode).not.toHaveBeenCalled();
  });
});
