import { createContext } from 'react';

export type Locale = 'es' | 'en';
export const LocaleContext = createContext<Locale>('es');
export const languageTags: Record<Locale, string> = { es: 'es-CO', en: 'en-US' };
