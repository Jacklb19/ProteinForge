import { readApiBaseUrl } from '../api/config';

/** The API's live channel (WebSocket). Names and codes mirror `app/live_config.py` in the backend. */
export const LIVE_PATH = '/v1/live';
export const LIVE_SUBPROTOCOL = 'proteinforge.live.v1';
export const LIVE_MESSAGES = { auth: 'auth', ping: 'ping', ready: 'ready', pong: 'pong', projectsChanged: 'projects.changed' } as const;
export const LIVE_CLOSE = { normal: 1000, rotate: 4000, unauthorized: 4401 } as const;
/** Wait before each new attempt after a failed one; the last value repeats. */
export const LIVE_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 15_000, 30_000] as const;
/** Each wait is shortened by up to this share, so tabs that lost the server together do not return together. */
export const LIVE_RETRY_JITTER = 0.3;
/** A connection that opens but is not confirmed within this time is replaced. */
export const LIVE_READY_TIMEOUT_MS = 15_000;
/** A tab hidden for longer than this lets its connection go; it catches up when it is shown again. */
export const LIVE_HIDDEN_GRACE_MS = 60_000;
/** Used until the server says how often it expects a ping. */
export const LIVE_HEARTBEAT_MS = 25_000;
const SOCKET_SCHEMES: Record<string, string> = { 'https:': 'wss:', 'http:': 'ws:' };

/**
 * The channel is opt-in: builds leave it off until the API that serves it is published with LIVE_ENABLED.
 * The address derives from the API address, so there is no second URL to keep in step.
 */
export function readLiveUrl(environment: ImportMetaEnv = import.meta.env): string | null {
  if (environment.VITE_PROJECT_LIVE?.trim() !== 'enabled') return null;
  const base = readApiBaseUrl(environment);
  if (!base) return null;
  const url = new URL(base);
  const scheme = SOCKET_SCHEMES[url.protocol];
  if (!scheme) return null;
  url.protocol = scheme;
  url.pathname = `${url.pathname.replace(/\/+$/, '')}${LIVE_PATH}`;
  return url.href;
}
