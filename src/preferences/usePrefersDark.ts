import { useSyncExternalStore } from 'react';
import { DARK_SCHEME_QUERY } from './config';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  query.addEventListener('change', onChange);
  return () => { query.removeEventListener('change', onChange); };
}

function prefersDark(): boolean {
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

/** Whether the device asks for a dark appearance, updated when that setting changes. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, prefersDark);
}
