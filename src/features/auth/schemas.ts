import { z } from 'zod';

/**
 * Validation of what Supabase Auth sends and of the session kept in the browser.
 *
 * These live apart from `session.ts` and `authApi.ts` so that reading a stored session, which the
 * application does before its first render, does not pull zod into the initial download. zod costs
 * 84.297 bytes there, 24.093 compressed, and 63 ms of processor at four times slowdown to build
 * schemas nothing has used yet; see `docs/performance-2026-10-27.md`. The client loads this file
 * when it first talks to the service, which is always after the first paint.
 *
 * It stays the source of truth for the stored shape: `storedSession` in `session.ts` reads it
 * synchronously without zod, and `session.test.ts` runs the same cases through both and requires
 * them to agree.
 */

/** Session kept in the browser; `expiresAt` is a Unix timestamp in seconds. */
export const sessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  user: z.object({ id: z.string().min(1), email: z.string() }),
});

export type AuthSession = z.infer<typeof sessionSchema>;

export const sessionResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().optional(),
  expires_at: z.number().optional(),
  user: z.object({ id: z.string().min(1), email: z.string().optional() }),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const userResponseSchema = z.object({ id: z.string().min(1), email: z.string().optional() });

export const errorResponseSchema = z.object({
  error_code: z.string().optional(),
  code: z.union([z.string(), z.number()]).optional(),
  error: z.string().optional(),
  msg: z.string().optional(),
  message: z.string().optional(),
  error_description: z.string().optional(),
});
