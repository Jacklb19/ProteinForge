import { z } from 'zod';
import { AuthError, createAuthRequest, parseSessionResponse } from './authApi';
import type { FetchLike } from './authApi';
import { AUTH_ENDPOINTS, FACTOR_ENDPOINTS, TOTP_FACTOR_TYPE, TOTP_QR_DATA_URI_PREFIX } from './config';
import type { AuthSettings } from './config';
import type { AuthSession } from './session';
import { factorNameSchema, totpCodeSchema } from './validation';

/** A second factor of the account as listed by `GET /user`; only `verified` factors raise a session to `aal2`. */
export interface MfaFactor {
  id: string;
  type: string;
  friendlyName: string;
  status: 'verified' | 'unverified';
  createdAt: string;
}

/** Everything an authenticator app needs to add the account; the secret is shown once and never stored. */
export interface TotpEnrollment {
  factorId: string;
  friendlyName: string;
  /** SVG image of the `otpauth://` address, ready for an `<img>` source. */
  qrCodeSource: string;
  /** Base32 secret for apps that cannot scan the image. */
  secret: string;
  uri: string;
}

export interface MfaChallenge {
  id: string;
  factorId: string;
  /** Unix timestamp in seconds after which the challenge can no longer be verified. */
  expiresAt: number;
}

/** Second factor operations of Supabase Auth; every call needs the access token of the current session. */
export interface MfaApi {
  listFactors: (accessToken: string) => Promise<MfaFactor[]>;
  enrollTotp: (accessToken: string, friendlyName: string) => Promise<TotpEnrollment>;
  challenge: (accessToken: string, factorId: string) => Promise<MfaChallenge>;
  /** Confirms a code; the returned session replaces the stored one, because the old refresh token cannot reach `aal2`. */
  verify: (accessToken: string, challenge: MfaChallenge, code: string) => Promise<AuthSession>;
  /** Creates a challenge and verifies the code against it at once, as `challengeAndVerify` does in supabase-js. */
  verifyCode: (accessToken: string, factorId: string, code: string) => Promise<AuthSession>;
  /** Removes a factor; a verified one requires an `aal2` session, and the session must be refreshed afterwards. */
  unenroll: (accessToken: string, factorId: string) => Promise<void>;
}

const factorIdSchema = z.uuid();

const factorSchema = z.object({
  id: z.string().min(1),
  factor_type: z.string().min(1),
  friendly_name: z.string().optional(),
  status: z.enum(['verified', 'unverified']),
  created_at: z.string(),
});

const userFactorsSchema = z.object({ factors: z.array(z.unknown()).nullish() });

const enrollResponseSchema = z.object({
  id: factorIdSchema,
  type: z.literal(TOTP_FACTOR_TYPE),
  friendly_name: z.string().optional(),
  totp: z.object({ qr_code: z.string().includes('<svg'), secret: z.string().min(1), uri: z.string().startsWith('otpauth://') }),
});

const challengeResponseSchema = z.object({ id: factorIdSchema, type: z.literal(TOTP_FACTOR_TYPE), expires_at: z.number().int().positive() });

const unenrollResponseSchema = z.object({ id: factorIdSchema });

/** Factor IDs become part of the request path, so anything other than a UUID is refused before sending. */
function checkedFactorId(factorId: string): string {
  if (!factorIdSchema.safeParse(factorId).success) throw new AuthError('mfa_factor_not_found');
  return factorId;
}

function checkedCode(code: string): string {
  const parsed = totpCodeSchema.safeParse(code);
  if (!parsed.success) throw new AuthError('totp_code_invalid');
  return parsed.data;
}

function parse<Schema extends z.ZodType>(schema: Schema, data: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AuthError('unknown');
  return parsed.data;
}

export function createMfaApi(settings: AuthSettings, fetchImplementation?: FetchLike): MfaApi {
  const request = createAuthRequest(settings, fetchImplementation);
  const factorsPath = AUTH_ENDPOINTS.factors;

  async function challenge(accessToken: string, factorId: string): Promise<MfaChallenge> {
    const data = await request(`${factorsPath}${FACTOR_ENDPOINTS.challenge(checkedFactorId(factorId))}`, { method: 'POST', body: {}, accessToken });
    const parsed = parse(challengeResponseSchema, data);
    return { id: parsed.id, factorId, expiresAt: parsed.expires_at };
  }

  async function verify(accessToken: string, current: MfaChallenge, code: string): Promise<AuthSession> {
    const normalized = checkedCode(code);
    const data = await request(`${factorsPath}${FACTOR_ENDPOINTS.verify(checkedFactorId(current.factorId))}`, {
      method: 'POST',
      body: { challenge_id: current.id, code: normalized },
      accessToken,
    });
    return parseSessionResponse(data);
  }

  return {
    async listFactors(accessToken) {
      const { factors } = parse(userFactorsSchema, await request(AUTH_ENDPOINTS.user, { method: 'GET', accessToken }));
      // Every verified type counts towards `aal2`; unexpected entries are skipped instead of failing the whole list.
      return (factors ?? []).flatMap((entry) => {
        const parsed = factorSchema.safeParse(entry);
        if (!parsed.success) return [];
        const factor = parsed.data;
        return [{ id: factor.id, type: factor.factor_type, friendlyName: factor.friendly_name ?? '', status: factor.status, createdAt: factor.created_at }];
      });
    },
    async enrollTotp(accessToken, friendlyName) {
      const name = factorNameSchema.safeParse(friendlyName);
      if (!name.success) throw new AuthError('factor_name_invalid');
      const data = await request(factorsPath, { method: 'POST', body: { factor_type: TOTP_FACTOR_TYPE, friendly_name: name.data }, accessToken });
      const parsed = parse(enrollResponseSchema, data);
      return {
        factorId: parsed.id,
        friendlyName: parsed.friendly_name ?? name.data,
        qrCodeSource: `${TOTP_QR_DATA_URI_PREFIX}${encodeURIComponent(parsed.totp.qr_code)}`,
        secret: parsed.totp.secret,
        uri: parsed.totp.uri,
      };
    },
    challenge,
    verify,
    async verifyCode(accessToken, factorId, code) {
      // The code is checked first so that a typing mistake does not spend a challenge from the rate limit.
      const normalized = checkedCode(code);
      return verify(accessToken, await challenge(accessToken, factorId), normalized);
    },
    async unenroll(accessToken, factorId) {
      parse(unenrollResponseSchema, await request(`${factorsPath}${FACTOR_ENDPOINTS.remove(checkedFactorId(factorId))}`, { method: 'DELETE', accessToken }));
    },
  };
}
