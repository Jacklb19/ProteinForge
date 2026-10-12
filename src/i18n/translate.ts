import { english } from './en';
import { spanish } from './es';
import type { Locale } from './config';

export type TranslationKey = keyof typeof spanish;
export type TranslationVariables = Record<string, string | number>;

const catalogs: Record<Locale, Record<TranslationKey, string>> = { es: spanish, en: english };

/** Resolves catalog keys without React, including messages produced by workers. */
export function translate(locale: Locale, key: TranslationKey, variables: TranslationVariables = {}): string {
  return catalogs[locale][key].replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(variables[name] ?? `{{${name}}}`));
}
