import { DEFAULT_LOCALE, languageTags } from './config';
import type { Locale } from './config';
import { translate } from './translate';
import type { TranslationKey, TranslationVariables } from './translate';

/**
 * Text produced where the visitor's language is unknown (Workers, scientific code). It travels as
 * a catalog key with raw values; the interface translates and formats it in the active language.
 */
export interface LocalizedText {
  key: TranslationKey;
  variables?: TranslationVariables;
}

/** Translates a localized text, formatting numeric values for the locale. */
export function localize(locale: Locale, text: LocalizedText): string {
  const format = new Intl.NumberFormat(languageTags[locale]);
  const variables = Object.fromEntries(Object.entries(text.variables ?? {}).map(([name, value]) => [name, typeof value === 'number' ? format.format(value) : value]));
  return translate(locale, text.key, variables);
}

interface Localized { readonly text: LocalizedText }

/** Failure with a catalog key. The message, in the default language, is only for logs and tests. */
export class LocalizedError extends Error implements Localized {
  readonly text: LocalizedText;
  constructor(key: TranslationKey, variables?: TranslationVariables) {
    super(localize(DEFAULT_LOCALE, { key, variables }));
    this.name = 'LocalizedError';
    this.text = { key, variables };
  }
}

/** Invalid scientific input, with a catalog key. */
export class LocalizedRangeError extends RangeError implements Localized {
  readonly text: LocalizedText;
  constructor(key: TranslationKey, variables?: TranslationVariables) {
    super(localize(DEFAULT_LOCALE, { key, variables }));
    this.name = 'LocalizedRangeError';
    this.text = { key, variables };
  }
}

/** The localized text of a failure, or the fallback when it carries none. */
export function localizedFailure(error: unknown, fallback: TranslationKey): LocalizedText {
  return error instanceof LocalizedError || error instanceof LocalizedRangeError ? error.text : { key: fallback };
}
