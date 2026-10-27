import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { LEGAL_UPDATED_DATE, SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from './config';

export interface LegalSection {
  titleKey: TranslationKey;
  textKey: TranslationKey;
}

interface Props {
  titleKey: TranslationKey;
  introduction: TranslationKey;
  sections: readonly LegalSection[];
}

/** Public policy text stays expanded, readable and accessible without an account. */
export function LegalPage({ titleKey, introduction, sections }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="page legal-page">
      <PageHeading titleKey={titleKey} introduction={introduction} />
      <p className="legal-updated"><time dateTime={LEGAL_UPDATED_DATE}>{t('legal.updated')}</time></p>
      <div className="legal-layout">
      <nav className="legal-index" aria-label={t('workbench.legalIndex')}>
        {sections.map(section => <a key={section.titleKey} href={`#${section.titleKey}`}>{t(section.titleKey)}</a>)}
        <a href="#legal-contact">{t('legal.contactTitle')}</a>
      </nav>
      <div className="legal-sections">
        {sections.map((section) => (
          <section key={section.titleKey} className="legal-section" aria-labelledby={section.titleKey}>
            <h2 id={section.titleKey}>{t(section.titleKey)}</h2>
            <p>{t(section.textKey)}</p>
          </section>
        ))}
        <section className="legal-section" aria-labelledby="legal-contact">
          <h2 id="legal-contact">{t('legal.contactTitle')}</h2>
          <p>{t('legal.contactText')}</p>
          <a className="legal-contact" href={SUPPORT_EMAIL_URL}>{SUPPORT_EMAIL}</a>
        </section>
      </div>
      </div>
      <nav className="legal-links" aria-label={t('legal.navigation')}>
        <Link className="button button-secondary" to={ROUTES.privacy}>{t('nav.privacy')}</Link>
        <Link className="button button-secondary" to={ROUTES.terms}>{t('nav.terms')}</Link>
      </nav>
    </main>
  );
}
