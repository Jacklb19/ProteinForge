import { PRELOAD_ERROR_EVENT, STALE_CODE_RELOAD_STORAGE_KEY, STALE_CODE_RELOAD_WINDOW_MS } from './config';

export type StaleCodeHost = Pick<Window, 'addEventListener' | 'removeEventListener' | 'navigator' | 'sessionStorage' | 'location'>;

/**
 * A page opened before a release asks for code files the new release no longer serves.
 * An installed app keeps every file of its own release in its cache, so only a page without one
 * reloads, once, to pick up the current release; a repeated failure stays visible as an error.
 */
export function recoverFromStaleCode(host: StaleCodeHost = window, now: () => number = Date.now): () => void {
  const onPreloadError = (event: Event): void => {
    if ('serviceWorker' in host.navigator && host.navigator.serviceWorker.controller) return;
    try {
      const last = Number(host.sessionStorage.getItem(STALE_CODE_RELOAD_STORAGE_KEY));
      if (last > 0 && now() - last < STALE_CODE_RELOAD_WINDOW_MS) return;
      host.sessionStorage.setItem(STALE_CODE_RELOAD_STORAGE_KEY, String(now()));
    } catch {
      // Without session storage a reload could repeat forever; the error is shown instead.
      return;
    }
    event.preventDefault();
    host.location.reload();
  };
  host.addEventListener(PRELOAD_ERROR_EVENT, onPreloadError);
  return () => { host.removeEventListener(PRELOAD_ERROR_EVENT, onPreloadError); };
}
