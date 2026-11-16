/** When the page last reloaded itself because a code file of its release was gone. */
export const STALE_CODE_RELOAD_STORAGE_KEY = 'proteinforge.stale-code-reload';
/** A second failure this soon after reloading is a real outage, not an old page: it is shown, not retried. */
export const STALE_CODE_RELOAD_WINDOW_MS = 60_000;
/** Vite dispatches this on the window when a lazily loaded code file cannot be fetched. */
export const PRELOAD_ERROR_EVENT = 'vite:preloadError';
