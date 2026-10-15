/** Interface languages; the order is the display order. Kept free of React so workers can import it. */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** BCP 47 tags used for number and date formatting. */
export const languageTags: Record<Locale, string> = { es: 'es-CO', en: 'en-US' };

