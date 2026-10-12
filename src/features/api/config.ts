/** Existing backend contracts; no project endpoints are assumed by the client. */
export const API_ENDPOINTS = { health: '/v1/health', me: '/v1/me' } as const;
export const API_TIMEOUT_MS = 10_000;

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
