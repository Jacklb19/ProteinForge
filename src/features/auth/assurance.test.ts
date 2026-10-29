import { describe, expect, it } from 'vitest';
import { assuranceStep, readAssurance } from './assurance';
import type { MfaFactor } from './mfaApi';
import { normalizeTotpCode, factorNameSchema, totpCodeSchema } from './validation';
import { TOTP_FACTOR_NAME_MAX_LENGTH } from './config';

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

const verified: MfaFactor = { id: 'f1', type: 'totp', friendlyName: 'Phone', status: 'verified', createdAt: '2026-10-29T10:00:00Z' };
const unverified: MfaFactor = { ...verified, id: 'f2', status: 'unverified' };

describe('session assurance', () => {
  it('reads the level and the methods, most recent first, from the access token', () => {
    expect(readAssurance(token({ sub: 'u', aal: 'aal2', amr: [{ method: 'totp', timestamp: 2 }, { method: 'password', timestamp: 1 }] })))
      .toEqual({ level: 'aal2', methods: ['totp', 'password'] });
    expect(readAssurance(token({ sub: 'u', aal: 'aal1', amr: ['oauth'] }))).toEqual({ level: 'aal1', methods: ['oauth'] });
  });

  it('counts tokens without a level, with an unknown one or unreadable ones as aal1', () => {
    expect(readAssurance(token({ sub: 'u' }))).toEqual({ level: 'aal1', methods: [] });
    expect(readAssurance(token({ sub: 'u', aal: 'aal3', amr: [{ timestamp: 1 }, 7] }))).toEqual({ level: 'aal1', methods: [] });
    expect(readAssurance('not-a-token')).toEqual({ level: 'aal1', methods: [] });
  });

  it('asks for a code only when the account has a verified factor and the session is still aal1', () => {
    const aal1 = { level: 'aal1' as const, methods: ['password'] };
    expect(assuranceStep(aal1, [])).toBe('none');
    expect(assuranceStep(aal1, [unverified])).toBe('none');
    expect(assuranceStep(aal1, [unverified, verified])).toBe('pending');
    expect(assuranceStep({ level: 'aal2', methods: ['totp', 'password'] }, [verified])).toBe('complete');
  });
});

describe('second factor inputs', () => {
  it('accepts six digits written with spaces and explains the other cases', () => {
    expect(normalizeTotpCode(' 123 456\t')).toBe('123456');
    expect(totpCodeSchema.safeParse('123 456')).toMatchObject({ success: true, data: '123456' });
    expect(totpCodeSchema.safeParse('   ').error?.issues[0]?.message).toBe('auth.errorTotpCodeRequired');
    expect(totpCodeSchema.safeParse('12-34-56').error?.issues[0]?.message).toBe('auth.errorTotpCodeDigits');
  });

  it('trims authenticator names and keeps them within the client limit', () => {
    expect(factorNameSchema.safeParse('  Phone ')).toMatchObject({ success: true, data: 'Phone' });
    expect(factorNameSchema.safeParse(' ').error?.issues[0]?.message).toBe('auth.errorFactorNameRequired');
    expect(factorNameSchema.safeParse('x'.repeat(TOTP_FACTOR_NAME_MAX_LENGTH + 1)).error?.issues[0]?.message).toBe('auth.errorFactorNameLong');
  });
});
