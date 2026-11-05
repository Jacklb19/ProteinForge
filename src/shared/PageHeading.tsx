import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { TranslationVariables } from '../i18n/translate';

interface Props {
  titleKey: TranslationKey;
  introduction: TranslationKey;
  titleVariables?: TranslationVariables;
  introductionVariables?: TranslationVariables;
  /** Optional actions aligned with the title on wide screens. */
  children?: ReactNode;
  /** Short lines under the introduction: the save state, or what the actions do. */
  note?: ReactNode;
}

/** Common page title and descriptive introduction. */
export function PageHeading({ titleKey, introduction, titleVariables, introductionVariables, children, note }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <header className="page-heading">
      <div className="page-heading-text">
        <h1>{t(titleKey, titleVariables)}</h1>
        <p>{t(introduction, introductionVariables)}</p>
        {note && <div className="page-heading-note">{note}</div>}
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </header>
  );
}
