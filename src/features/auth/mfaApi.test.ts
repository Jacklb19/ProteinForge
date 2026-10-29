import { describe, expect, it, vi } from 'vitest';
import { AuthError } from './authApi';
import { createMfaApi } from './mfaApi';
import { AUTH_ERROR_MESSAGE_KEYS, TOTP_FACTOR_NAME_MAX_LENGTH, TOTP_QR_DATA_URI_PREFIX } from './config';
import { authErrorKey } from './errors';
import { english } from '../../i18n/en';
import { spanish } from '../../i18n/es';

const settings = { url: 'https://project.supabase.co', anonKey: 'public-key' };
const factorId = '0b6e2f4a-3c1d-4e5f-8a9b-1c2d3e4f5a6b';
const challengeId = '7d8e9f0a-1b2c-4d3e-9f4a-5b6c7d8e9f0a';
const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="0" y="0" width="8" height="8"/></svg>';

type FetchMock = ReturnType<typeof vi.fn<(input: string, init?: RequestInit) => Promise<Response>>>;

function fetchReturning(...bodies: [number, unknown][]): FetchMock {
  const mock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
  for (const [status, body] of bodies) mock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  return mock;
}

function call(mock: FetchMock, index: number): { url: string | undefined; method: string | undefined; authorization: string | undefined; body: unknown } {
  const [url, init] = mock.mock.calls[index] ?? [];
  return {
    url,
    method: init?.method,
    authorization: (init?.headers as Record<string, string> | undefined)?.Authorization,
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
  };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AuthError);
  return (error as AuthError).code;
}

describe('second factor client', () => {
  it('starts an authenticator enrollment with the user token and returns a displayable QR code', async () => {
    const fetchMock = fetchReturning([200, {
      id: factorId, type: 'totp', friendly_name: 'Phone',
      totp: { qr_code: svg, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/protein-forge.vercel.app:ana@example.org?issuer=protein-forge.vercel.app&secret=JBSWY3DPEHPK3PXP' },
    }]);
    const enrollment = await createMfaApi(settings, fetchMock).enrollTotp('access', '  Phone  ');
    expect(call(fetchMock, 0)).toEqual({ url: 'https://project.supabase.co/auth/v1/factors', method: 'POST', authorization: 'Bearer access', body: { factor_type: 'totp', friendly_name: 'Phone' } });
    expect(enrollment).toMatchObject({ factorId, friendlyName: 'Phone', secret: 'JBSWY3DPEHPK3PXP' });
    expect(enrollment.uri.startsWith('otpauth://totp/')).toBe(true);
    expect(enrollment.qrCodeSource.startsWith(TOTP_QR_DATA_URI_PREFIX)).toBe(true);
    expect(decodeURIComponent(enrollment.qrCodeSource.slice(TOTP_QR_DATA_URI_PREFIX.length))).toBe(svg);
  });

  it('refuses empty or overlong names before sending anything', async () => {
    const fetchMock = fetchReturning();
    const api = createMfaApi(settings, fetchMock);
    expect(await failure(api.enrollTotp('access', '   '))).toBe('factor_name_invalid');
    expect(await failure(api.enrollTotp('access', 'x'.repeat(TOTP_FACTOR_NAME_MAX_LENGTH + 1)))).toBe('factor_name_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an enrollment without an SVG image, secret or otpauth address as an unexpected answer', async () => {
    const fetchMock = fetchReturning(
      [200, { id: factorId, type: 'totp', totp: { qr_code: 'not an image', secret: 'S', uri: 'otpauth://totp/x' } }],
      [200, { id: factorId, type: 'phone', phone: '+15555550100' }],
      [200, { id: 'not-a-uuid', type: 'totp', totp: { qr_code: svg, secret: 'S', uri: 'otpauth://totp/x' } }],
    );
    const api = createMfaApi(settings, fetchMock);
    expect(await failure(api.enrollTotp('access', 'Phone'))).toBe('unknown');
    expect(await failure(api.enrollTotp('access', 'Phone'))).toBe('unknown');
    expect(await failure(api.enrollTotp('access', 'Phone'))).toBe('unknown');
  });

  it('challenges and verifies a code at once, normalizing spaces and returning the raised session', async () => {
    const fetchMock = fetchReturning(
      [200, { id: challengeId, type: 'totp', expires_at: 1_900_000_300 }],
      [200, { access_token: 'aal2-access', token_type: 'bearer', expires_in: 3600, expires_at: 1_900_003_600, refresh_token: 'aal2-refresh', user: { id: 'user-1', email: 'ana@example.org' } }],
    );
    const session = await createMfaApi(settings, fetchMock).verifyCode('access', factorId, ' 123 456 ');
    expect(call(fetchMock, 0)).toEqual({ url: `https://project.supabase.co/auth/v1/factors/${factorId}/challenge`, method: 'POST', authorization: 'Bearer access', body: {} });
    expect(call(fetchMock, 1)).toEqual({ url: `https://project.supabase.co/auth/v1/factors/${factorId}/verify`, method: 'POST', authorization: 'Bearer access', body: { challenge_id: challengeId, code: '123456' } });
    expect(session).toEqual({ accessToken: 'aal2-access', refreshToken: 'aal2-refresh', expiresAt: 1_900_003_600, user: { id: 'user-1', email: 'ana@example.org' } });
  });

  it('keeps the challenge separately so a second code can be checked against it', async () => {
    const fetchMock = fetchReturning(
      [200, { id: challengeId, type: 'totp', expires_at: 1_900_000_300 }],
      [422, { code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }],
    );
    const api = createMfaApi(settings, fetchMock);
    const challenge = await api.challenge('access', factorId);
    expect(challenge).toEqual({ id: challengeId, factorId, expiresAt: 1_900_000_300 });
    expect(await failure(api.verify('access', challenge, '000000'))).toBe('mfa_verification_failed');
  });

  it('rejects malformed codes without spending a challenge', async () => {
    const fetchMock = fetchReturning();
    const api = createMfaApi(settings, fetchMock);
    for (const code of ['', '12345', '1234567', '12a456', '１２３４５６']) {
      expect(await failure(api.verifyCode('access', factorId, code))).toBe('totp_code_invalid');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses factor identifiers that are not UUIDs, since they become part of the path', async () => {
    const fetchMock = fetchReturning();
    const api = createMfaApi(settings, fetchMock);
    expect(await failure(api.challenge('access', '../user'))).toBe('mfa_factor_not_found');
    expect(await failure(api.unenroll('access', `${factorId}?x=1`))).toBe('mfa_factor_not_found');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports expired challenges, missing levels and rate limits with their service codes', async () => {
    const fetchMock = fetchReturning(
      [200, { id: challengeId, type: 'totp', expires_at: 1_900_000_300 }],
      [422, { code: 422, error_code: 'mfa_challenge_expired', msg: 'MFA challenge has expired' }],
      [422, { code: 422, error_code: 'insufficient_aal', msg: 'AAL2 required to unenroll verified factor' }],
      [429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Too many requests' }],
    );
    const api = createMfaApi(settings, fetchMock);
    expect(await failure(api.verifyCode('access', factorId, '123456'))).toBe('mfa_challenge_expired');
    expect(await failure(api.unenroll('access', factorId))).toBe('insufficient_aal');
    expect(await failure(api.challenge('access', factorId))).toBe('over_request_rate_limit');
  });

  it('lists the factors of the user, skipping entries it cannot read', async () => {
    const fetchMock = fetchReturning(
      [200, { id: 'user-1', email: 'ana@example.org', factors: [
        { id: factorId, friendly_name: 'Phone', factor_type: 'totp', status: 'verified', created_at: '2026-10-29T10:00:00Z', updated_at: '2026-10-29T10:01:00Z', last_challenged_at: null },
        { id: challengeId, factor_type: 'totp', status: 'unverified', created_at: '2026-10-29T11:00:00Z' },
        { id: 'broken', status: 'verified' },
      ] }],
      [200, { id: 'user-1', email: 'ana@example.org' }],
    );
    const api = createMfaApi(settings, fetchMock);
    expect(await api.listFactors('access')).toEqual([
      { id: factorId, type: 'totp', friendlyName: 'Phone', status: 'verified', createdAt: '2026-10-29T10:00:00Z' },
      { id: challengeId, type: 'totp', friendlyName: '', status: 'unverified', createdAt: '2026-10-29T11:00:00Z' },
    ]);
    expect(call(fetchMock, 0)).toMatchObject({ url: 'https://project.supabase.co/auth/v1/user', method: 'GET', authorization: 'Bearer access' });
    expect(await api.listFactors('access')).toEqual([]);
  });

  it('removes a factor and checks the confirmation', async () => {
    const fetchMock = fetchReturning([200, { id: factorId }], [200, {}]);
    const api = createMfaApi(settings, fetchMock);
    await api.unenroll('access', factorId);
    expect(call(fetchMock, 0)).toMatchObject({ url: `https://project.supabase.co/auth/v1/factors/${factorId}`, method: 'DELETE', authorization: 'Bearer access' });
    expect(await failure(api.unenroll('access', factorId))).toBe('unknown');
  });
});

describe('second factor messages', () => {
  it('gives every second factor failure its own message in both catalogs', () => {
    const codes = ['totp_code_invalid', 'factor_name_invalid', 'mfa_verification_failed', 'mfa_challenge_expired', 'mfa_ip_address_mismatch', 'mfa_factor_not_found',
      'mfa_factor_name_conflict', 'too_many_enrolled_mfa_factors', 'insufficient_aal', 'mfa_totp_enroll_not_enabled', 'mfa_totp_verify_not_enabled', 'mfa_verification_rejected'];
    for (const code of codes) {
      const key = authErrorKey(new AuthError(code));
      expect(key).toBe(AUTH_ERROR_MESSAGE_KEYS[code]);
      expect(key).not.toBe('auth.errorUnknown');
      expect(spanish[key]).toBeTruthy();
      expect(english[key]).toBeTruthy();
    }
  });
});
