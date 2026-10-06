import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n';

/** Common page title and descriptive introduction. */
export function PageHeading({ titleKey, introduction }: { titleKey: TranslationKey; introduction: TranslationKey }): React.JSX.Element {
  const { t } = useTranslation();
  return <header className="page-heading"><h1>{t(titleKey)}</h1><p>{t(introduction)}</p></header>;
}
