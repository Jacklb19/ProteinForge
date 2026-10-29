import { decodePayload } from './authApi';
import type { MfaFactor } from './mfaApi';

/** Supabase authenticator assurance levels: `aal1` after a sign in, `aal2` after a second factor. */
export type AssuranceLevel = 'aal1' | 'aal2';

export interface SessionAssurance {
  level: AssuranceLevel;
  /** Authentication methods of the session, most recent first, as listed in the `amr` claim. */
  methods: string[];
}

/**
 * Where the session stands on the second factor: `none` when the account has no verified authenticator,
 * `pending` when it has one but this session has not confirmed a code yet, and `complete` at `aal2`.
 */
export type AssuranceStep = 'none' | 'pending' | 'complete';

/**
 * Reads the assurance claims of an access token. The signature is not checked: the result only decides
 * what to ask the visitor, and the server keeps enforcing its own policies.
 */
export function readAssurance(accessToken: string): SessionAssurance {
  const payload = decodePayload(accessToken);
  const level: AssuranceLevel = payload?.aal === 'aal2' ? 'aal2' : 'aal1';
  const claim = payload?.amr;
  const methods = Array.isArray(claim)
    ? claim.flatMap((entry: unknown) => {
      if (typeof entry === 'string') return [entry];
      if (typeof entry === 'object' && entry !== null && 'method' in entry && typeof entry.method === 'string') return [entry.method];
      return [];
    })
    : [];
  return { level, methods };
}

/** Combines the session level with the account factors, like `getAuthenticatorAssuranceLevel` in supabase-js. */
export function assuranceStep(assurance: SessionAssurance, factors: readonly MfaFactor[]): AssuranceStep {
  if (assurance.level === 'aal2') return 'complete';
  return factors.some((factor) => factor.status === 'verified') ? 'pending' : 'none';
}
