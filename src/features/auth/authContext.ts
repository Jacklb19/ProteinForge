import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { AuthSession } from './session';
import type { SignUpOutcome } from './authApi';

/**
 * `disabled`: the deployment has no identity settings. `loading`: a stored session is being verified.
 * `anonymous` and `signed-in` are the stable states.
 */
export type AuthStatus = 'disabled' | 'loading' | 'anonymous' | 'signed-in';

export interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  /** True when the visitor arrived from a password recovery link and must set a new password. */
  recoveryPending: boolean;
  /** Error code delivered in a redirect fragment, cleared on the next action. */
  redirectError: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpOutcome>;
  signOut(): Promise<void>;
  recover(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  authorizeUrl(provider: string): string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  return useRequiredContext(AuthContext, 'AuthProvider');
}
