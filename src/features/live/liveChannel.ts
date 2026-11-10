import { LIVE_CLOSE, LIVE_HEARTBEAT_MS, LIVE_MESSAGES, LIVE_READY_TIMEOUT_MS, LIVE_RETRY_DELAYS_MS, LIVE_RETRY_JITTER, LIVE_SUBPROTOCOL } from './config';

export interface LiveStamp { id: string; updatedAt: string }
/** `changed` is null when the tab was away and only knows that something is different now. */
export interface LiveChange { changed: LiveStamp[] | null; removed: string[] }
export interface LiveChannel {
  /** The current access token; null ends the connection until there is one again. */
  setToken(token: string | null): void;
  /** Lets the connection go (tab hidden, no network) or brings it back. */
  setActive(active: boolean): void;
  close(): void;
}
/** The part of a WebSocket the channel uses, so tests can stand in for it. */
export interface LiveSocket {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  send(data: string): void;
  close(code?: number): void;
}
export interface LiveChannelOptions {
  url: string;
  token: string | null;
  onChange: (change: LiveChange) => void;
  createSocket?: (url: string, protocol: string) => LiveSocket;
  random?: () => number;
}
export type LiveConnector = (options: Pick<LiveChannelOptions, 'token' | 'onChange'>) => LiveChannel;

const OPEN = 1;
function browserSocket(address: string, protocol: string): LiveSocket {
  const native = new WebSocket(address, protocol);
  const socket: LiveSocket = {
    get readyState() { return native.readyState; }, onopen: null, onmessage: null, onclose: null,
    send: (data) => { native.send(data); }, close: (code) => { native.close(code); },
  };
  native.onopen = () => { socket.onopen?.(); };
  native.onmessage = (event) => { socket.onmessage?.(event); };
  native.onclose = (event) => { socket.onclose?.(event); };
  return socket;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const stamps = (value: unknown): LiveStamp[] => Array.isArray(value)
  ? value.filter((item): item is LiveStamp => isRecord(item) && typeof item.id === 'string' && typeof item.updatedAt === 'string') : [];

/**
 * Keeps one authenticated connection to the API's live channel and reports when the account's projects change.
 * The token goes in the first message, never in the address. A lost connection returns on its own with growing
 * waits; after the server's planned rotation it returns at once, and after a rejected token it waits for a new one.
 */
export function openLiveChannel({ url, token: initialToken, onChange, createSocket = browserSocket, random = Math.random }: LiveChannelOptions): LiveChannel {
  let token = initialToken;
  let active = true;
  let closed = false;
  let socket: LiveSocket | null = null;
  let ready = false;
  let attempts = 0;
  let revision: string | null = null;
  /** The token the server refused; connecting again with the same one would be refused again. */
  let refused: string | null = null;
  let sent: string | null = null;
  let awaitingPong = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const send = (message: Record<string, unknown>): void => { if (socket?.readyState === OPEN) socket.send(JSON.stringify(message)); };
  const quiet = (): void => { clearTimeout(retryTimer); clearTimeout(readyTimer); clearInterval(heartbeat); retryTimer = readyTimer = heartbeat = undefined; };
  const wanted = (): boolean => !closed && active && token !== null && token !== refused;

  function drop(): void {
    quiet();
    const previous = socket;
    socket = null; ready = false;
    if (previous) { previous.onopen = previous.onmessage = previous.onclose = null; previous.close(LIVE_CLOSE.normal); }
  }

  function retry(): void {
    if (!wanted()) return;
    const delay = LIVE_RETRY_DELAYS_MS[Math.min(attempts, LIVE_RETRY_DELAYS_MS.length - 1)] ?? LIVE_RETRY_DELAYS_MS[0];
    attempts++;
    retryTimer = setTimeout(connect, delay * (1 - LIVE_RETRY_JITTER * random()));
  }

  function beat(interval: number): void {
    clearInterval(heartbeat);
    awaitingPong = false;
    heartbeat = setInterval(() => {
      // An unanswered ping means the connection is dead even though the browser has not noticed.
      if (awaitingPong) { drop(); retry(); return; }
      awaitingPong = true;
      send({ type: LIVE_MESSAGES.ping });
    }, interval);
  }

  function receive(data: unknown): void {
    let message: unknown;
    try { message = typeof data === 'string' ? JSON.parse(data) : null; } catch { return; }
    if (!isRecord(message)) return;
    if (message.type === LIVE_MESSAGES.pong) { awaitingPong = false; return; }
    if (typeof message.revision !== 'string') return;
    if (message.type === LIVE_MESSAGES.ready) {
      clearTimeout(readyTimer);
      ready = true; attempts = 0;
      const seconds = typeof message.heartbeatSeconds === 'number' && message.heartbeatSeconds > 0 ? message.heartbeatSeconds * 1_000 : LIVE_HEARTBEAT_MS;
      beat(seconds);
      // Something changed while this tab was not connected.
      if (revision !== null && revision !== message.revision) onChange({ changed: null, removed: [] });
      revision = message.revision;
    } else if (message.type === LIVE_MESSAGES.projectsChanged) {
      revision = message.revision;
      onChange({ changed: stamps(message.changed), removed: Array.isArray(message.removed) ? message.removed.filter((id): id is string => typeof id === 'string') : [] });
    }
  }

  function connect(): void {
    if (!wanted() || socket) return;
    quiet();
    let current: LiveSocket;
    try { current = createSocket(url, LIVE_SUBPROTOCOL); } catch { retry(); return; }
    socket = current;
    current.onopen = () => {
      sent = token;
      send({ type: LIVE_MESSAGES.auth, token: sent });
      readyTimer = setTimeout(() => { drop(); retry(); }, LIVE_READY_TIMEOUT_MS);
    };
    current.onmessage = (event) => { receive(event.data); };
    current.onclose = (event) => {
      quiet();
      socket = null; ready = false;
      if (event.code === LIVE_CLOSE.unauthorized) { refused = sent; return; }
      if (event.code === LIVE_CLOSE.rotate) { attempts = 0; connect(); return; }
      retry();
    };
  }

  connect();
  return {
    setToken(next) {
      if (next === token) return;
      token = next;
      if (next === null) { drop(); return; }
      // An open connection keeps reading with the refreshed token; otherwise this is the moment to try again.
      if (ready) { sent = next; send({ type: LIVE_MESSAGES.auth, token: next }); }
      else if (!socket) { attempts = 0; connect(); }
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (!next) drop();
      else { attempts = 0; connect(); }
    },
    close() { closed = true; drop(); },
  };
}
