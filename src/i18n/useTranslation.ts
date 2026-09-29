import { useContext, useMemo } from 'react';
import { english } from './en';
import { spanish } from './es';
import { languageTags, LocaleContext } from './locale';

export type TranslationKey = keyof typeof spanish;
type Variables = Record<string, string | number>;

/** Resolves typed keys and formats values with the active locale. */
export function useTranslation() {
  const locale = useContext(LocaleContext);
  return useMemo(() => {
    const catalog = locale === 'es' ? spanish : english;
    return {
      locale,
      t: (key: TranslationKey, variables: Variables = {}): string =>
        catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(variables[name] ?? `{{${name}}}`)),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions): string =>
        new Intl.NumberFormat(languageTags[locale], options).format(value),
      formatDate: (value: Date, options?: Intl.DateTimeFormatOptions): string =>
        new Intl.DateTimeFormat(languageTags[locale], options).format(value),
      formatUnit: (value: number, unit: Intl.NumberFormatOptions['unit']): string =>
        new Intl.NumberFormat(languageTags[locale], { style: 'unit', unit }).format(value),
    };
  }, [locale]);
}
