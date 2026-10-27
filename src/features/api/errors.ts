export type ApiErrorCode = 'network' | 'timeout' | 'cancelled' | 'session' | 'unavailable' | 'invalid-response' | 'unknown' | 'conflict' | 'not-found' | 'validation' | 'schema' | 'forbidden' | 'laboratory-size' | 'generator-history-size' | 'requires-current-client' | 'draft-changed' | 'rate-limit';

/** Safe UI categories without loading the service transport or generated contracts. */
export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly requestId?: string) { super(code); this.name = 'ApiError'; }
}
