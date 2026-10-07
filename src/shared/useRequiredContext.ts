import { useContext } from 'react';
import type { Context } from 'react';
import { translate } from '../i18n/translate';
import { DEFAULT_LOCALE } from '../i18n/config';

/** Reads a context whose provider is mandatory and fails loudly when it is missing. */
export function useRequiredContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context);
  if (value === null) throw new Error(translate(DEFAULT_LOCALE, 'errors.missingProvider', { name }));
  return value;
}
