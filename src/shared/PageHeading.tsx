import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n';

interface Props {
  titleKey: TranslationKey;
  introduction: TranslationKey;
  /** Optional actions aligned with the title on wide screens. */
  children?: ReactNode;
}

/** Common page title and descriptive introduction. */
export function PageHeading({ titleKey, introduction, children }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <header className="page-heading">
      <div className="page-heading-text">
        <h1>{t(titleKey)}</h1>
        <p>{t(introduction)}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </header>
  );
}
