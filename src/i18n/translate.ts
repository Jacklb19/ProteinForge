import { english } from './en';
import { spanish } from './es';
import type { Locale } from './locale';

export type TranslationKey = keyof typeof spanish;
export type TranslationVariables = Record<string, string | number>;

/** Resolves catalog keys without React, including messages produced by workers. */
export function translate(locale: Locale, key: TranslationKey, variables: TranslationVariables = {}): string {
  const catalog = locale === 'es' ? spanish : english;
  return catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(variables[name] ?? `{{${name}}}`));
}
