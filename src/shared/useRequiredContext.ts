import { useContext } from 'react';
import type { Context } from 'react';
import { translateLoaded } from '../i18n/catalogs';
import { DEFAULT_LOCALE } from '../i18n/config';

/** Reads a context whose provider is mandatory and fails loudly when it is missing. */
export function useRequiredContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context);
  if (value === null) throw new Error(translateLoaded(DEFAULT_LOCALE, 'errors.missingProvider', { name }));
  return value;
}
