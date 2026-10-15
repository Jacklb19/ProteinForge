import type { ApiErrorCode } from './apiClient';

/** API calls travel as gRPC-Web to these services; the backend keeps equivalent REST routes. */
export const API_TIMEOUT_MS = 10_000;
export const REQUEST_ID_HEADER = 'X-Request-Id';
/** Stable server messages that mean "not set up for this" rather than a failed request. */
export const RPC_DETAIL_CODES: Partial<Record<string, ApiErrorCode>> = {
  'projects-schema-unavailable': 'schema',
  'identity-not-configured': 'unavailable',
};
/** Only explicit HTTP(S) origins/paths are allowed; credentials and URL fragments are rejected. */
export function readApiBaseUrl(environment: ImportMetaEnv = import.meta.env): string | null {
  const value = environment.VITE_API_BASE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    return url.href.replace(/\/+$/, '');
  } catch { return null; }
}
