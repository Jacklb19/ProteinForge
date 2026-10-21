import { z } from 'zod';
import { AccountService } from '../../gen/proteinforge/account/v1/account_service_pb';
import { callOptions, createRpcClient, rpc } from './rpc';

const healthSchema = z.object({ status: z.literal('ok'), version: z.string().min(1), identity: z.boolean() });
const identitySchema = z.object({ id: z.string().min(1), email: z.string() });
export type ApiErrorCode = 'network' | 'timeout' | 'cancelled' | 'session' | 'unavailable' | 'invalid-response' | 'unknown' | 'conflict' | 'not-found' | 'validation' | 'schema' | 'forbidden' | 'laboratory-size';

/** Only safe categories and correlation IDs reach the UI; response details are never shown or logged. */
export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly requestId?: string) { super(code); this.name = 'ApiError'; }
}

export interface ProteinForgeApi {
  health(signal?: AbortSignal): Promise<z.infer<typeof healthSchema>>;
  me(token: string, signal?: AbortSignal): Promise<z.infer<typeof identitySchema>>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Validates a decoded message against the client contract before it reaches the interface. */
export function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('invalid-response');
  return parsed.data;
}

/** Account calls through AccountService; local analyses remain local. */
export function createProteinForgeApi(baseUrl: string, fetchImplementation?: FetchLike): ProteinForgeApi {
  const client = createRpcClient(AccountService, baseUrl, fetchImplementation);
  return {
    async health(signal) {
      const status = await rpc(() => client.getStatus({}, callOptions(signal)));
      return validated(healthSchema, { status: status.status, version: status.version, identity: status.identityConfigured });
    },
    async me(token, signal) {
      if (!token.trim()) throw new ApiError('session');
      const identity = await rpc(() => client.getMe({}, callOptions(signal, token)));
      return validated(identitySchema, { id: identity.id, email: identity.email });
    },
  };
}
