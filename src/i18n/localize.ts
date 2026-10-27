import { DEFAULT_LOCALE, languageTags } from './config';
import type { Locale } from './config';
import { translate } from './translate';
import { describeFailuresWith } from './localized';
import type { LocalizedText } from './localized';

/** Translates a localized text, formatting numeric values for the locale. */
export function localize(locale: Locale, text: LocalizedText): string {
  const format = new Intl.NumberFormat(languageTags[locale]);
  const variables = Object.fromEntries(Object.entries(text.variables ?? {}).map(([name, value]) => [name, typeof value === 'number' ? format.format(value) : value]));
  return translate(locale, text.key, variables);
}

// Failures raised on the interface thread read in the default language in logs and tests.
describeFailuresWith(text => localize(DEFAULT_LOCALE, text));
