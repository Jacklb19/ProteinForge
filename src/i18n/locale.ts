import { createContext } from 'react';
import { DEFAULT_LOCALE } from './config';
import type { Locale } from './config';

export { DEFAULT_LOCALE, LOCALES, languageTags } from './config';
export type { Locale } from './config';
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
