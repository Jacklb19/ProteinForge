import { useContext, useMemo } from 'react';
import { languageTags, LocaleContext } from './locale';
import { translate } from './translate';
import type { TranslationKey, TranslationVariables } from './translate';

export type { TranslationKey } from './translate';

/** Resolves typed keys and formats values with the active locale. */
export function useTranslation() {
  const locale = useContext(LocaleContext);
  return useMemo(() => {
    return {
      locale,
      t: (key: TranslationKey, variables: TranslationVariables = {}): string => translate(locale, key, variables),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions): string =>
        new Intl.NumberFormat(languageTags[locale], options).format(value),
      formatDate: (value: Date, options?: Intl.DateTimeFormatOptions): string =>
        new Intl.DateTimeFormat(languageTags[locale], options).format(value),
      formatUnit: (value: number, unit: Intl.NumberFormatOptions['unit']): string =>
        new Intl.NumberFormat(languageTags[locale], { style: 'unit', unit }).format(value),
    };
  }, [locale]);
}
