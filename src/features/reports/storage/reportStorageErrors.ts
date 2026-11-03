/**
 * What the interface explains. `unsupported`: the API has no report storage (not published or not set
 * up), so nothing is offered. `quota` and `missing` come from stable server codes; the rest is `failed`.
 *
 * Kept apart from the client so that screens can name failures without loading the service transport
 * and the generated contracts, which arrive only when a signed-in owner first uses report storage.
 */
export type ReportStorageFailure = 'quota' | 'missing' | 'session' | 'unsupported' | 'cancelled' | 'failed';
export class ReportStorageError extends Error {
  constructor(readonly reason: ReportStorageFailure) { super(reason); this.name = 'ReportStorageError'; }
}

/** The reason of a failure the client already classified; any other error is a cancellation or a failure. */
export function failureReason(error: unknown): ReportStorageFailure {
  if (error instanceof ReportStorageError) return error.reason;
  if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  return 'failed';
}
