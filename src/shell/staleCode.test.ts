import { describe, expect, it, vi } from 'vitest';
import { PRELOAD_ERROR_EVENT, STALE_CODE_RELOAD_STORAGE_KEY, STALE_CODE_RELOAD_WINDOW_MS } from './config';
import { recoverFromStaleCode } from './staleCode';
import type { StaleCodeHost } from './staleCode';

/** A page with its own event target, session storage and reload, optionally controlled by an installed app. */
function page(controlled: boolean, storage: Storage = sessionStorage) {
  const events = new EventTarget();
  const reload = vi.fn();
  const host = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    navigator: { serviceWorker: { controller: controlled ? {} : null } },
    sessionStorage: storage,
    location: { reload },
  } as unknown as StaleCodeHost;
  const fail = (): Event => { const event = new Event(PRELOAD_ERROR_EVENT, { cancelable: true }); events.dispatchEvent(event); return event; };
  return { host, reload, fail };
}

describe('recovery from code files of a previous release', () => {
  it('reloads a page without an installed app once, and shows a second failure soon after', () => {
    sessionStorage.clear();
    let time = 1_000_000;
    const { host, reload, fail } = page(false);
    const stop = recoverFromStaleCode(host, () => time);

    expect(fail().defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STALE_CODE_RELOAD_STORAGE_KEY)).toBe(String(time));

    time += STALE_CODE_RELOAD_WINDOW_MS - 1;
    expect(fail().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    time += 1;
    expect(fail().defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);

    stop();
    expect(fail().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('leaves an installed app alone, since it keeps every file of its own release', () => {
    sessionStorage.clear();
    const { host, reload, fail } = page(true);
    recoverFromStaleCode(host);
    expect(fail().defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STALE_CODE_RELOAD_STORAGE_KEY)).toBeNull();
  });

  it('does not reload when it cannot remember having reloaded', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    const { host, reload, fail } = page(false, blocked);
    recoverFromStaleCode(host);
    expect(fail().defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
