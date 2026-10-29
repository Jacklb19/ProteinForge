import { describe, expect, it } from 'vitest';
import { isExpiring, loadSession, saveSession, storedSession } from './session';
import { sessionSchema } from './schemas';
import { SESSION_STORAGE_KEY } from './config';

const VALID = { accessToken: 'a', refreshToken: 'r', expiresAt: 1_800_000_000, user: { id: 'u', email: 'person@example.org' } };

/**
 * `storedSession` reads the session without zod because it runs before the first render, so the
 * schema can no longer vouch for it by being the only reader. These cases go through both and
 * require the same verdict and the same value: that is what keeps the hand-written check from
 * drifting into accepting, rejecting or returning something else.
 */
const CASES: { name: string; value: unknown }[] = [
  { name: 'a complete session', value: VALID },
  { name: 'an empty email, which the schema allows', value: { ...VALID, user: { id: 'u', email: '' } } },
  { name: 'an expiry of one second', value: { ...VALID, expiresAt: 1 } },
  { name: 'unknown fields beside the known ones', value: { ...VALID, scope: 'bearer', extra: { nested: true } } },
  { name: 'an unknown field inside the user', value: { ...VALID, user: { ...VALID.user, role: 'owner' } } },
  { name: 'nothing at all', value: undefined },
  { name: 'null', value: null },
  { name: 'a string', value: 'session' },
  { name: 'a number', value: 7 },
  { name: 'an array', value: [VALID] },
  { name: 'an array where the user belongs', value: { ...VALID, user: ['u'] } },
  { name: 'a missing access token', value: { refreshToken: 'r', expiresAt: 1, user: VALID.user } },
  { name: 'a missing refresh token', value: { accessToken: 'a', expiresAt: 1, user: VALID.user } },
  { name: 'a missing expiry', value: { accessToken: 'a', refreshToken: 'r', user: VALID.user } },
  { name: 'a missing user', value: { accessToken: 'a', refreshToken: 'r', expiresAt: 1 } },
  { name: 'a missing user id', value: { ...VALID, user: { email: 'person@example.org' } } },
  { name: 'a missing user email', value: { ...VALID, user: { id: 'u' } } },
  { name: 'an empty access token', value: { ...VALID, accessToken: '' } },
  { name: 'an empty refresh token', value: { ...VALID, refreshToken: '' } },
  { name: 'an empty user id', value: { ...VALID, user: { id: '', email: '' } } },
  { name: 'a numeric access token', value: { ...VALID, accessToken: 1 } },
  { name: 'a numeric user email', value: { ...VALID, user: { id: 'u', email: 1 } } },
  { name: 'a null user email', value: { ...VALID, user: { id: 'u', email: null } } },
  { name: 'an expiry as text', value: { ...VALID, expiresAt: '1800000000' } },
  { name: 'an expiry of zero', value: { ...VALID, expiresAt: 0 } },
  { name: 'a negative expiry', value: { ...VALID, expiresAt: -1 } },
  { name: 'a fractional expiry', value: { ...VALID, expiresAt: 1.5 } },
  { name: 'an expiry that is not a number', value: { ...VALID, expiresAt: Number.NaN } },
  { name: 'an endless expiry', value: { ...VALID, expiresAt: Number.POSITIVE_INFINITY } },
  { name: 'an expiry beyond exact integers', value: { ...VALID, expiresAt: 2 ** 53 } },
  { name: 'a null user', value: { ...VALID, user: null } },
];

describe('the stored session reads the same as its schema', () => {
  it.each(CASES)('agrees on $name', ({ value }) => {
    const schema = sessionSchema.safeParse(value);
    const written = storedSession(value);
    expect(written !== null).toBe(schema.success);
    if (schema.success) expect(written).toStrictEqual(schema.data);
  });

  it('covers every field of the schema, so a new one cannot pass unchecked', () => {
    expect([...Object.keys(sessionSchema.shape)].sort()).toStrictEqual(['accessToken', 'expiresAt', 'refreshToken', 'user']);
  });
});

describe('session storage', () => {
  it('round-trips through storage and drops what the schema would not keep', () => {
    const storage = new Map<string, string>();
    const fake = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); } } as unknown as Storage;
    saveSession(VALID, fake);
    expect(loadSession(fake)).toStrictEqual(VALID);
    storage.set(SESSION_STORAGE_KEY, JSON.stringify({ ...VALID, scope: 'bearer' }));
    expect(loadSession(fake)).toStrictEqual(VALID);
    storage.set(SESSION_STORAGE_KEY, '{ not json');
    expect(loadSession(fake)).toBeNull();
    saveSession(null, fake);
    expect(loadSession(fake)).toBeNull();
  });

  it('reports an expiry inside the refresh margin', () => {
    expect(isExpiring({ ...VALID, expiresAt: 1000 }, 60, 1_000_000)).toBe(true);
    expect(isExpiring({ ...VALID, expiresAt: 2000 }, 60, 1_000_000)).toBe(false);
  });
});
