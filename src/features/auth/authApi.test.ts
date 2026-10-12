import { describe, expect, it, vi } from 'vitest';
import { AuthError, createAuthApi, parseFragmentSession, toSession } from './authApi';
import { readAuthSettings } from './config';

const settings = { url: 'https://project.supabase.co', anonKey: 'public-key' };

function response(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

describe('identity settings', () => {
  it('requires both the project URL and the public key', () => {
    expect(readAuthSettings({} as ImportMetaEnv)).toBeNull();
    expect(readAuthSettings({ VITE_SUPABASE_URL: 'https://p.supabase.co/' } as ImportMetaEnv)).toBeNull();
    expect(readAuthSettings({ VITE_SUPABASE_URL: 'https://p.supabase.co/', VITE_SUPABASE_ANON_KEY: ' key ' } as ImportMetaEnv))
      .toEqual({ url: 'https://p.supabase.co', anonKey: 'key' });
  });
});

describe('Supabase Auth client', () => {
  it('sends publishable keys as API keys, reserving Bearer authorization for user JWTs', async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(response(200, {}));
    const api = createAuthApi({ ...settings, anonKey: 'sb_publishable_test_key' }, fetchMock);
    await api.recover('test@example.org', 'https://app.example/recover');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ apikey: 'sb_publishable_test_key' });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
  });
  it('signs in with the password grant and converts the session', async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(response(200, {
      access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'user-1', email: 'ana@example.org' },
    }));
    const api = createAuthApi(settings, fetchMock);
    const before = Math.floor(Date.now() / 1000);
    const session = await api.signIn('ana@example.org', 'secret-password');
    expect(session.user).toEqual({ id: 'user-1', email: 'ana@example.org' });
    expect(session.expiresAt).toBeGreaterThanOrEqual(before + 3600);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://project.supabase.co/auth/v1/token?grant_type=password');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).apikey).toBe('public-key');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toEqual({ email: 'ana@example.org', password: 'secret-password' });
  });

  it('distinguishes a sign up that needs confirmation from one that opens a session', async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response(200, { id: 'user-2', email: 'new@example.org', confirmation_sent_at: '2026-10-07T00:00:00Z' }))
      .mockResolvedValueOnce(response(200, { access_token: 'a', refresh_token: 'r', expires_at: 1_900_000_000, user: { id: 'user-2', email: 'new@example.org' } }));
    const api = createAuthApi(settings, fetchMock);
    expect(await api.signUp('new@example.org', 'secret-password')).toEqual({ session: null, confirmationRequired: true });
    const opened = await api.signUp('new@example.org', 'secret-password');
    expect(opened.confirmationRequired).toBe(false);
    expect(opened.session?.expiresAt).toBe(1_900_000_000);
  });

  it('maps service errors to stable codes and reports network failures', async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }))
      .mockResolvedValueOnce(response(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const api = createAuthApi(settings, fetchMock);
    await expect(api.signIn('a@b.co', 'x')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(api.signIn('a@b.co', 'x')).rejects.toMatchObject({ code: 'invalid_grant' });
    const failure = await api.signIn('a@b.co', 'x').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AuthError);
    expect((failure as AuthError).code).toBe('network');
  });

  it('sends recovery, password update and sign out with the right credentials', async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockImplementation(() => Promise.resolve(response(200, {})));
    const api = createAuthApi(settings, fetchMock);
    await api.recover('ana@example.org', 'https://app.example/recover');
    await api.updatePassword('access-token', 'new-secret-password');
    await api.signOut('access-token');
    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init?.method, (init?.headers as Record<string, string>).Authorization]);
    expect(calls).toEqual([
      ['https://project.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fapp.example%2Frecover', 'POST', undefined],
      ['https://project.supabase.co/auth/v1/user', 'PUT', 'Bearer access-token'],
      ['https://project.supabase.co/auth/v1/logout', 'POST', 'Bearer access-token'],
    ]);
    expect(api.authorizeUrl('google', 'https://app.example/analyze'))
      .toBe('https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.example%2Fanalyze');
  });

  it('computes the expiry from expires_in when expires_at is absent', () => {
    const session = toSession({ access_token: 'a', refresh_token: 'r', expires_in: 60, user: { id: 'u' } }, 1_000_000);
    expect(session).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 1060, user: { id: 'u', email: '' } });
  });
});

describe('redirect fragments', () => {
  it('reads tokens and the recovery type from the URL fragment', () => {
    const access = token({ sub: 'user-9', email: 'ana@example.org' });
    const result = parseFragmentSession(`#access_token=${access}&refresh_token=refresh&expires_in=3600&token_type=bearer&type=recovery`, 1_000_000);
    expect(result.type).toBe('recovery');
    expect(result.error).toBeNull();
    expect(result.session).toEqual({ accessToken: access, refreshToken: 'refresh', expiresAt: 4600, user: { id: 'user-9', email: 'ana@example.org' } });
  });

  it('reports errors and ignores fragments without a subject', () => {
    expect(parseFragmentSession('#error=access_denied&error_code=otp_expired')).toEqual({ session: null, type: null, error: 'otp_expired' });
    expect(parseFragmentSession('#access_token=not-a-token&refresh_token=r').session).toBeNull();
    expect(parseFragmentSession('')).toEqual({ session: null, type: null, error: null });
  });
});
