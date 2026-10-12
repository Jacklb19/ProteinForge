import { z } from 'zod';
import { API_ENDPOINTS, API_TIMEOUT_MS } from './config';

const healthSchema = z.object({ status: z.literal('ok'), version: z.string().min(1), identity: z.boolean() });
const identitySchema = z.object({ id: z.string().min(1), email: z.string() });
const problemSchema = z.object({ requestId: z.string().max(64).optional() });
export type ApiErrorCode = 'network' | 'timeout' | 'cancelled' | 'session' | 'unavailable' | 'invalid-response' | 'unknown';

/** Only safe categories and correlation IDs reach the UI; response details are never shown or logged. */
export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly requestId?: string) { super(code); this.name = 'ApiError'; }
}

export interface ProteinForgeApi {
  health(signal?: AbortSignal): Promise<z.infer<typeof healthSchema>>;
  me(token: string, signal?: AbortSignal): Promise<z.infer<typeof identitySchema>>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Token-bearing requests target only the configured API; local analyses remain local. */
export function createProteinForgeApi(baseUrl: string, fetchImplementation: FetchLike = fetch): ProteinForgeApi {
  async function request(path: string, signal?: AbortSignal, token?: string): Promise<unknown> {
    const controller = new AbortController();
    const cancel = () => { controller.abort('cancelled'); };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(() => { controller.abort('timeout'); }, API_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-Id': crypto.randomUUID() };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetchImplementation(`${baseUrl}${path}`, { headers, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
      let data: unknown;
      try { data = await response.json(); } catch {
        if (!response.ok) throw new ApiError(response.status === 401 ? 'session' : 'unavailable');
        throw new ApiError('invalid-response');
      }
      if (!response.ok) {
        const problem = problemSchema.safeParse(data);
        throw new ApiError(response.status === 401 ? 'session' : response.status >= 500 ? 'unavailable' : 'unknown', problem.success ? problem.data.requestId : undefined);
      }
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new ApiError(controller.signal.reason === 'timeout' ? 'timeout' : 'cancelled');
      if (error instanceof ApiError) throw error;
      throw new ApiError('network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  return {
    async health(signal) {
      const parsed = healthSchema.safeParse(await request(API_ENDPOINTS.health, signal));
      if (!parsed.success) throw new ApiError('invalid-response');
      return parsed.data;
    },
    async me(token, signal) {
      if (!token.trim()) throw new ApiError('session');
      const parsed = identitySchema.safeParse(await request(API_ENDPOINTS.me, signal, token));
      if (!parsed.success) throw new ApiError('invalid-response');
      return parsed.data;
    },
  };
}
