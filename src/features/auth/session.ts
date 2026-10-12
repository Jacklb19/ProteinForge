import { z } from 'zod';
import { SESSION_STORAGE_KEY } from './config';

/** Session kept in the browser; `expiresAt` is a Unix timestamp in seconds. */
export const sessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  user: z.object({ id: z.string().min(1), email: z.string() }),
});

export type AuthSession = z.infer<typeof sessionSchema>;

/** Reads a validated session, or `null` when storage is empty, denied or corrupted. */
export function loadSession(storage: Storage | null = safeStorage()): AuthSession | null {
  try {
    const raw = storage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
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
