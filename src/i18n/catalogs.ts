import { spanish } from './es';
import { DEFAULT_LOCALE } from './config';
import type { Locale } from './config';
import { fillMessage } from './message';
import type { TranslationVariables } from './message';
import type { TranslationKey } from './translate';

type Catalog = Record<TranslationKey, string>;

/**
 * Catalogs of the interface thread. The default language ships with the application; another one
 * arrives as its own chunk when a visitor chooses it, and the offline cache keeps it afterwards.
 */
const loaded: Partial<Record<Locale, Catalog>> = { [DEFAULT_LOCALE]: spanish };
const loaders: Record<Locale, () => Promise<Catalog>> = {
  es: () => Promise.resolve(spanish),
  en: async () => (await import('./en')).english,
};

export function isCatalogLoaded(locale: Locale): boolean {
  return loaded[locale] !== undefined;
}

/** Fetches a language once; later calls reuse it. */
export async function loadCatalog(locale: Locale): Promise<void> {
  loaded[locale] ??= await loaders[locale]();
}

/** Resolves a key in a language that has already been loaded; asking for another one is a defect. */
export function translateLoaded(locale: Locale, key: TranslationKey, variables: TranslationVariables = {}): string {
  const catalog = loaded[locale];
  if (!catalog) throw new Error(fillMessage(spanish['errors.catalogMissing'], { locale }));
  return fillMessage(catalog[key], variables);
}
