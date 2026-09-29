import type { ReactNode } from 'react';
import { LocaleContext } from './locale';
import type { Locale } from './locale';

/** Supplies the selected locale to the component tree. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }): React.JSX.Element {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
