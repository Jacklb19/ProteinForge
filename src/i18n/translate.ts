import { english } from './en';
import { spanish } from './es';
import type { Locale } from './config';
import { fillMessage } from './message';
import type { TranslationVariables } from './message';

export type TranslationKey = keyof typeof spanish;
export type { TranslationVariables } from './message';

const catalogs: Record<Locale, Record<TranslationKey, string>> = { es: spanish, en: english };

/**
 * Resolves catalog keys with every language at hand, for Workers that write documents and for build
 * tooling. The interface thread uses `catalogs.ts`, which loads only the languages it shows.
 */
export function translate(locale: Locale, key: TranslationKey, variables: TranslationVariables = {}): string {
  return fillMessage(catalogs[locale][key], variables);
}
