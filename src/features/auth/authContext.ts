import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import type { AuthSession } from './session';
import type { SignUpOutcome } from './authApi';
import type { SessionAssurance } from './assurance';
import type { MfaFactor, TotpEnrollment } from './mfaApi';

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
  /** Assurance claims of the current access token, or `null` without a session. */
  assurance: SessionAssurance | null;
  /** Second factors of the account, verified or still being added. */
  listFactors(): Promise<MfaFactor[]>;
  /** Starts adding an authenticator app; it only counts once `verifyTotp` confirms its first code. */
  enrollTotp(friendlyName: string): Promise<TotpEnrollment>;
  /** Confirms a code, finishing an enrollment or raising this session to `aal2`, and keeps the new session. */
  verifyTotp(factorId: string, code: string): Promise<void>;
  /** Removes a factor and refreshes the session so that its level matches the remaining factors. */
  unenrollFactor(factorId: string): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  return useRequiredContext(AuthContext, 'AuthProvider');
}
