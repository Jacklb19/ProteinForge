import { SESSION_STORAGE_KEY } from './config';

export type { AuthSession } from './schemas';
import type { AuthSession } from './schemas';

/**
 * The stored session, read without zod.
 *
 * This runs before the first render, so it is the one validation that cannot wait for a file to
 * arrive. `schemas.ts` keeps the zod shape and stays the source of truth: `session.test.ts` runs
 * the same cases through both and requires the same verdict and the same value, so this cannot
 * drift into accepting or returning something the schema would not.
 *
 * Like the schema it is built from, it keeps only the four known fields and drops anything else
 * the stored object carries.
 */
export function storedSession(value: unknown): AuthSession | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { accessToken, refreshToken, expiresAt, user } = value as Record<string, unknown>;
  if (typeof accessToken !== 'string' || accessToken.length < 1) return null;
  if (typeof refreshToken !== 'string' || refreshToken.length < 1) return null;
  // Safe integers, not merely whole numbers: that is what the schema's `int()` accepts, and the
  // parity test caught the difference at 2 ** 53.
  if (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) return null;
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return null;
  const { id, email } = user as Record<string, unknown>;
  if (typeof id !== 'string' || id.length < 1) return null;
  if (typeof email !== 'string') return null;
  return { accessToken, refreshToken, expiresAt, user: { id, email } };
}

/** Reads a validated session, or `null` when storage is empty, denied or corrupted. */
export function loadSession(storage: Storage | null = safeStorage()): AuthSession | null {
  try {
    const raw = storage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return storedSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persists or clears the session; storage failures leave the in-memory session intact. */
export function saveSession(session: AuthSession | null, storage: Storage | null = safeStorage()): void {
  try {
    if (session) storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else storage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private contexts; the session still works for this page.
  }
}

/** Whether the access token expires within the given margin. */
export function isExpiring(session: AuthSession, marginSeconds: number, now = Date.now()): boolean {
  return session.expiresAt - marginSeconds <= now / 1000;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
