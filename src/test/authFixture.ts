import { vi } from 'vitest';
import type { AuthContextValue } from '../features/auth/authContext';
export const signedInFixture: AuthContextValue = { status: 'signed-in', session: { accessToken: 'owner-token', refreshToken: 'refresh', expiresAt: 9999999999, user: { id: 'owner', email: 'a@example.org' } }, recoveryPending: false, redirectError: null, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), recover: vi.fn(), updatePassword: vi.fn(), authorizeUrl: vi.fn() };
