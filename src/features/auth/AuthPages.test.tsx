import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { AuthError } from './authApi';
import type { AuthApi } from './authApi';
import { useAuth } from './authContext';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';
import { RecoverPage } from './RecoverPage';
import { SESSION_STORAGE_KEY } from './config';
import { spanish } from '../../i18n/es';
import { AFTER_SIGN_IN_ROUTE, ROUTES } from '../../shared/navigation';

const settings = { url: 'https://project.supabase.co', anonKey: 'public-key' };
const session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1', email: 'ana@example.org' } };

function mockApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    signUp: vi.fn().mockResolvedValue({ session: null, confirmationRequired: true }),
    signIn: vi.fn().mockResolvedValue(session),
    refresh: vi.fn().mockResolvedValue(session),
    recover: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    getUser: vi.fn().mockResolvedValue(session.user),
    signOut: vi.fn().mockResolvedValue(undefined),
    authorizeUrl: vi.fn().mockReturnValue('https://project.supabase.co/auth/v1/authorize?provider=google'),
    ...overrides,
  };
}

function Destination(): React.JSX.Element {
  return <p>{spanish['nav.analyze']}</p>;
}

function renderAt(path: string, api: AuthApi | undefined, children: ReactNode, configured = true): void {
  render(
    <AuthProvider settings={configured ? settings : null} api={configured ? api : undefined}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ROUTES.signIn} element={<SignInPage />} />
          <Route path={ROUTES.signUp} element={<SignUpPage />} />
          <Route path={ROUTES.recover} element={<RecoverPage />} />
          <Route path={AFTER_SIGN_IN_ROUTE} element={<Destination />} />
          {children}
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('identity screens', () => {
  it('refreshes an expiring environment-configured session once instead of recreating the client after refresh', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', settings.url);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', settings.anonKey);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...session, expiresAt: Math.floor(Date.now() / 1000) + 1 }));
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ access_token: 'renewed-access', refresh_token: 'renewed-refresh', expires_in: 3600, user: session.user }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthProvider><MemoryRouter initialEntries={[ROUTES.signIn]}><Routes><Route path={ROUTES.signIn} element={<SignInPage />} /><Route path={AFTER_SIGN_IN_ROUTE} element={<Destination />} /></Routes></MemoryRouter></AuthProvider>);
    await waitFor(() => { expect(screen.getByText(spanish['nav.analyze'])).toBeInTheDocument(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('grant_type=refresh_token');
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toMatchObject({ accessToken: 'renewed-access' });
  });
  it('explains when identity is not configured and keeps the form disabled', () => {
    renderAt(ROUTES.signIn, undefined, null, false);
    expect(screen.getByText(spanish['auth.disabled'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: spanish['auth.signInAction'] })).toBeDisabled();
    expect(screen.queryByRole('link', { name: spanish['auth.continueGoogle'] })).not.toBeInTheDocument();
  });

  it('validates fields before calling the service and shows service errors', async () => {
    const api = mockApi({ signIn: vi.fn().mockRejectedValue(new AuthError('invalid_credentials')) });
    renderAt(ROUTES.signIn, api, null);
    fireEvent.click(screen.getByRole('button', { name: spanish['auth.signInAction'] }));
    expect(screen.getByText(spanish['auth.errorEmailRequired'])).toBeInTheDocument();
    expect(screen.getByText(spanish['auth.errorPasswordRequired'])).toBeInTheDocument();
    expect(vi.mocked(api.signIn)).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(spanish['auth.email']), { target: { value: 'ana@example.org' } });
    fireEvent.change(screen.getByLabelText(spanish['auth.password']), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: spanish['auth.signInAction'] }));
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent(spanish['auth.errorInvalidCredentials']); });
    expect(vi.mocked(api.signIn)).toHaveBeenCalledWith('ana@example.org', 'wrong-password');
  });

  it('signs in, stores the session and continues to the analysis screen', async () => {
    const api = mockApi();
    renderAt(ROUTES.signIn, api, null);
    expect(AFTER_SIGN_IN_ROUTE).toBe(ROUTES.analyze);
    expect(screen.getByRole('heading', { level: 1, name: spanish['auth.signInTitle'] })).toBeInTheDocument();
    const provider = screen.getByRole('link', { name: spanish['auth.continueGoogle'] });
    expect(provider).toHaveAttribute('href', 'https://project.supabase.co/auth/v1/authorize?provider=google');
    expect(provider.querySelector('img.provider-mark')).toHaveAttribute('alt', '');
    fireEvent.change(screen.getByLabelText(spanish['auth.email']), { target: { value: 'ana@example.org' } });
    fireEvent.change(screen.getByLabelText(spanish['auth.password']), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: spanish['auth.signInAction'] }));
    await waitFor(() => { expect(screen.getByText(spanish['nav.analyze'])).toBeInTheDocument(); });
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual(session);
  });

  it('requires matching passwords of the minimum length and reports a pending confirmation', async () => {
    const api = mockApi();
    renderAt(ROUTES.signUp, api, null);
    fireEvent.change(screen.getByLabelText(spanish['auth.email']), { target: { value: 'new@example.org' } });
    fireEvent.change(screen.getByLabelText(spanish['auth.password']), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(spanish['auth.confirmPassword']), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: spanish['auth.signUpAction'] }));
    const alerts = screen.getAllByRole('alert').map((element) => element.textContent);
    expect(alerts).toEqual([expect.stringMatching(/al menos 8 caracteres/), spanish['auth.errorPasswordMismatch']]);
    expect(vi.mocked(api.signUp)).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(spanish['auth.password']), { target: { value: 'long-enough-password' } });
    fireEvent.change(screen.getByLabelText(spanish['auth.confirmPassword']), { target: { value: 'long-enough-password' } });
    fireEvent.click(screen.getByRole('button', { name: spanish['auth.signUpAction'] }));
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent(spanish['auth.signedUpConfirm']); });
    expect(vi.mocked(api.signUp)).toHaveBeenCalledWith('new@example.org', 'long-enough-password');
  });

  it('sends the recovery link to the recover route', async () => {
    const api = mockApi();
    renderAt(ROUTES.recover, api, null);
    fireEvent.change(screen.getByLabelText(spanish['auth.email']), { target: { value: 'ana@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: spanish['auth.recoverAction'] }));
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent(spanish['auth.recoverSent']); });
    expect(vi.mocked(api.recover)).toHaveBeenCalledWith('ana@example.org', `${window.location.origin}${ROUTES.recover}`);
  });

  it('captures a recovery fragment, asks for a new password and clears the fragment', async () => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    const access = `${encode({ alg: 'HS256' })}.${encode({ sub: 'user-1', email: 'ana@example.org' })}.sig`;
    window.history.replaceState(null, '', `/recover#access_token=${access}&refresh_token=refresh&expires_in=3600&type=recovery`);
    const api = mockApi();
    renderAt(ROUTES.recover, api, null);
    expect(screen.getByRole('heading', { level: 1, name: spanish['auth.resetTitle'] })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText(spanish['auth.newPassword']), { target: { value: 'another-password' } });
    fireEvent.change(screen.getByLabelText(spanish['auth.confirmPassword']), { target: { value: 'another-password' } });
    act(() => { fireEvent.click(screen.getByRole('button', { name: spanish['auth.resetAction'] })); });
    await waitFor(() => { expect(screen.getByText(spanish['nav.analyze'])).toBeInTheDocument(); });
    expect(vi.mocked(api.updatePassword)).toHaveBeenCalledWith(access, 'another-password');
  });

  it('refreshes a stored session that is about to expire', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...session, expiresAt: Math.floor(Date.now() / 1000) + 10 }));
    const api = mockApi();
    renderAt(ROUTES.signIn, api, null);
    await waitFor(() => { expect(screen.getByText(spanish['nav.analyze'])).toBeInTheDocument(); });
    expect(vi.mocked(api.refresh)).toHaveBeenCalledWith('refresh');
  });

  it('retires password recovery when its session can no longer be refreshed', async () => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    const access = `${encode({ alg: 'HS256' })}.${encode({ sub: 'user-1', email: 'ana@example.org' })}.sig`;
    window.history.replaceState(null, '', `/recover#access_token=${access}&refresh_token=expired-refresh&expires_in=1&type=recovery`);
    const api = mockApi({ refresh: vi.fn().mockRejectedValue(new AuthError('refresh_token_not_found')) });
    renderAt(ROUTES.recover, api, null);
    await waitFor(() => { expect(api.refresh).toHaveBeenCalledWith('expired-refresh'); });
    await waitFor(() => { expect(screen.getByRole('heading', { level: 1, name: spanish['auth.recoverTitle'] })).toBeInTheDocument(); });
    expect(screen.queryByLabelText(spanish['auth.newPassword'])).not.toBeInTheDocument();
    expect(api.updatePassword).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects a password update without a session instead of reporting success', async () => {
    function UpdateProbe(): React.JSX.Element {
      const auth = useAuth();
      const [outcome, setOutcome] = useState('pending');
      return <button onClick={() => { void auth.updatePassword('new-password').then(() => { setOutcome('updated'); }, (error: unknown) => { setOutcome(error instanceof AuthError ? error.code : 'unexpected'); }); }}>{outcome}</button>;
    }
    const api = mockApi();
    render(<AuthProvider settings={settings} api={api}><UpdateProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'pending' }));
    expect(await screen.findByRole('button', { name: 'session_expired' })).toBeInTheDocument();
    expect(api.updatePassword).not.toHaveBeenCalled();
  });
});
