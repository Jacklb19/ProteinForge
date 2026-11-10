import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_CLOSE, LIVE_READY_TIMEOUT_MS, LIVE_RETRY_DELAYS_MS, LIVE_SUBPROTOCOL, readLiveUrl } from './config';
import { openLiveChannel } from './liveChannel';
import type { LiveChange, LiveChannel, LiveSocket } from './liveChannel';
import { isNews } from './liveNews';

class FakeSocket implements LiveSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: Record<string, unknown>[] = [];
  closedWith: number | null = null;
  constructor(readonly url: string, readonly protocol: string) {}
  send(data: string): void { this.sent.push(JSON.parse(data) as Record<string, unknown>); }
  close(code?: number): void { this.readyState = 3; this.closedWith = code ?? null; }
  open(): void { this.readyState = 1; this.onopen?.(); }
  message(value: unknown): void { this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) }); }
  /** The server, or the network, ends the connection. */
  end(code: number): void { this.readyState = 3; this.onclose?.({ code }); }
}

const ADDRESS = 'wss://api.example/v1/live';
const FIRST_DELAY = LIVE_RETRY_DELAYS_MS[0];
let sockets: FakeSocket[];
let changes: LiveChange[];
const last = (): FakeSocket => { const socket = sockets.at(-1); if (!socket) throw new Error('No socket'); return socket; };
function open(token: string | null = 'token-1'): LiveChannel {
  return openLiveChannel({ url: ADDRESS, token, onChange: (change) => { changes.push(change); }, random: () => 0, createSocket: (url, protocol) => { const socket = new FakeSocket(url, protocol); sockets.push(socket); return socket; } });
}
function ready(revision = 'r1', heartbeatSeconds = 25): void { last().open(); last().message({ type: 'ready', revision, heartbeatSeconds }); }

beforeEach(() => { vi.useFakeTimers(); sockets = []; changes = []; });
afterEach(() => { vi.useRealTimers(); });

describe('readLiveUrl', () => {
  it('is off unless enabled and derives the socket address from the API address', () => {
    expect(readLiveUrl({ VITE_API_BASE_URL: 'https://api.example' } as ImportMetaEnv)).toBeNull();
    expect(readLiveUrl({ VITE_PROJECT_LIVE: 'enabled' } as ImportMetaEnv)).toBeNull();
    expect(readLiveUrl({ VITE_PROJECT_LIVE: 'enabled', VITE_API_BASE_URL: 'https://api.example/' } as ImportMetaEnv)).toBe('wss://api.example/v1/live');
    expect(readLiveUrl({ VITE_PROJECT_LIVE: 'enabled', VITE_API_BASE_URL: 'http://127.0.0.1:5296/base' } as ImportMetaEnv)).toBe('ws://127.0.0.1:5296/base/v1/live');
  });
});

describe('openLiveChannel', () => {
  it('authenticates in the first message, never in the address', () => {
    open();
    expect(last().url).toBe(ADDRESS);
    expect(last().protocol).toBe(LIVE_SUBPROTOCOL);
    expect(last().sent).toEqual([]);
    last().open();
    expect(last().sent).toEqual([{ type: 'auth', token: 'token-1' }]);
  });

  it('waits for a token before connecting', () => {
    const channel = open(null);
    expect(sockets).toHaveLength(0);
    channel.setToken('token-1');
    last().open();
    expect(last().sent).toEqual([{ type: 'auth', token: 'token-1' }]);
  });

  it('reports changes and ignores messages outside the protocol', () => {
    open(); ready();
    last().message('not json');
    last().message({ type: 'projects.changed' });
    last().message({ type: 'projects.changed', revision: 'r2', changed: [{ id: 'a', updatedAt: 'now' }, { id: 7 }], removed: ['b', 3] });
    expect(changes).toEqual([{ changed: [{ id: 'a', updatedAt: 'now' }], removed: ['b'] }]);
  });

  it('pings at the interval the server names and replaces a connection that stops answering', () => {
    open(); ready('r1', 10);
    vi.advanceTimersByTime(10_000);
    expect(last().sent.at(-1)).toEqual({ type: 'ping' });
    last().message({ type: 'pong' });
    vi.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(last().closedWith).toBe(LIVE_CLOSE.normal);
    vi.advanceTimersByTime(FIRST_DELAY);
    expect(sockets).toHaveLength(2);
  });

  it('returns with growing waits after a lost connection and starts over once confirmed', () => {
    open();
    // The last wait repeats once the list is used up.
    for (const delay of [...LIVE_RETRY_DELAYS_MS, Math.max(...LIVE_RETRY_DELAYS_MS)]) {
      const before = sockets.length;
      last().end(1006);
      vi.advanceTimersByTime(delay - 1);
      expect(sockets).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(sockets).toHaveLength(before + 1);
    }
    ready();
    const confirmed = sockets.length;
    last().end(1006);
    vi.advanceTimersByTime(FIRST_DELAY);
    expect(sockets).toHaveLength(confirmed + 1);
  });

  it('reconnects at once after the planned rotation and says so only when something changed meanwhile', () => {
    open(); ready('r1');
    last().end(LIVE_CLOSE.rotate);
    expect(sockets).toHaveLength(2);
    ready('r1');
    expect(changes).toEqual([]);
    last().end(LIVE_CLOSE.rotate);
    ready('r2');
    expect(changes).toEqual([{ changed: null, removed: [] }]);
  });

  it('does not repeat a refused token and connects again with a new one', () => {
    const channel = open();
    last().open();
    last().end(LIVE_CLOSE.unauthorized);
    vi.advanceTimersByTime(600_000);
    channel.setToken('token-1');
    expect(sockets).toHaveLength(1);
    channel.setToken('token-2');
    last().open();
    expect(last().sent).toEqual([{ type: 'auth', token: 'token-2' }]);
  });

  it('sends a refreshed token over the open connection, or with the one still opening', () => {
    const channel = open(); ready();
    channel.setToken('token-2');
    expect(sockets).toHaveLength(1);
    expect(last().sent.at(-1)).toEqual({ type: 'auth', token: 'token-2' });
    const opening = open();
    opening.setToken('token-3');
    last().open();
    expect(last().sent).toEqual([{ type: 'auth', token: 'token-3' }]);
  });

  it('replaces a connection the server never confirms', () => {
    open();
    last().open();
    vi.advanceTimersByTime(LIVE_READY_TIMEOUT_MS);
    expect(last().closedWith).toBe(LIVE_CLOSE.normal);
    vi.advanceTimersByTime(FIRST_DELAY);
    expect(sockets).toHaveLength(2);
  });

  it('lets the connection go while inactive, signed out or closed, and stays quiet afterwards', () => {
    const channel = open(); ready();
    channel.setActive(false);
    expect(last().closedWith).toBe(LIVE_CLOSE.normal);
    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(1);
    channel.setActive(true);
    expect(sockets).toHaveLength(2);
    channel.setToken(null);
    expect(last().closedWith).toBe(LIVE_CLOSE.normal);
    channel.setToken('token-1');
    expect(sockets).toHaveLength(3);
    channel.close();
    channel.setActive(false); channel.setActive(true);
    vi.advanceTimersByTime(600_000);
    expect(sockets).toHaveLength(3);
  });
});

describe('isNews', () => {
  const known = [{ id: 'a', updatedAt: '2026-11-02T08:00:00.123456Z' }];
  it('recognises the saves of this tab whatever notation the moment arrives in', () => {
    expect(isNews({ changed: [{ id: 'a', updatedAt: '2026-11-02T08:00:00.123456+00:00' }], removed: [] }, known)).toBe(false);
    expect(isNews({ changed: [], removed: ['gone-already'] }, known)).toBe(false);
  });
  it('is news when a version differs, a project is unknown or removed, or the tab was away', () => {
    expect(isNews({ changed: [{ id: 'a', updatedAt: '2026-11-02T08:00:00.123457+00:00' }], removed: [] }, known)).toBe(true);
    expect(isNews({ changed: [{ id: 'b', updatedAt: '2026-11-02T08:00:00.123456+00:00' }], removed: [] }, known)).toBe(true);
    expect(isNews({ changed: [{ id: 'a', updatedAt: 'unreadable' }], removed: [] }, known)).toBe(true);
    expect(isNews({ changed: [], removed: ['a'] }, known)).toBe(true);
    expect(isNews({ changed: null, removed: [] }, known)).toBe(true);
  });
});
