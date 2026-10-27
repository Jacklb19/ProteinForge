import { useContext, useMemo } from 'react';
import { languageTags, LocaleContext } from './locale';
import { translate } from './translate';
import type { TranslationKey, TranslationVariables } from './translate';
import { localize } from './localize';
import type { LocalizedText } from './localized';
import { NUMBER_FORMAT_CACHE_SIZE } from './config';

export type { TranslationKey } from './translate';

/** Resolves typed keys and formats values with the active locale. */
export function useTranslation() {
  const locale = useContext(LocaleContext);
  return useMemo(() => {
    const numbers = new Map<string, Intl.NumberFormat>();
    const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string => {
      const key = JSON.stringify(options ?? {});
      let formatter = numbers.get(key);
      if (!formatter) {
        formatter = new Intl.NumberFormat(languageTags[locale], options);
        if (numbers.size === NUMBER_FORMAT_CACHE_SIZE) numbers.clear();
        numbers.set(key, formatter);
      }
      return formatter.format(value);
    };
    return {
      locale,
      t: (key: TranslationKey, variables: TranslationVariables = {}): string => translate(locale, key, variables),
      /** Text from a Worker or scientific code, in the active language. */
      localize: (text: LocalizedText): string => localize(locale, text),
      formatNumber,
      formatDate: (value: Date, options?: Intl.DateTimeFormatOptions): string =>
        new Intl.DateTimeFormat(languageTags[locale], options).format(value),
      formatUnit: (value: number, unit: Intl.NumberFormatOptions['unit']): string =>
        formatNumber(value, { style: 'unit', unit }),
    };
  }, [locale]);
}
