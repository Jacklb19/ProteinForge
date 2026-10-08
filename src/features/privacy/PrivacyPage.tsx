import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Icon } from '../../shared/Icon';
import type { IconName } from '../../shared/Icon';
import { PageHeading } from '../../shared/PageHeading';

const SECTIONS: readonly { icon: IconName; titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { icon: 'lock', titleKey: 'privacy.localTitle', textKey: 'privacy.localText' },
  { icon: 'user', titleKey: 'privacy.accountTitle', textKey: 'privacy.accountText' },
  { icon: 'mail', titleKey: 'privacy.externalTitle', textKey: 'privacy.externalText' },
  { icon: 'shield', titleKey: 'privacy.noTrackingTitle', textKey: 'privacy.noTrackingText' },
];

/** What stays in the browser, what leaves it and when the visitor is asked. */
export function PrivacyPage(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="page privacy-page">
      <PageHeading titleKey="privacy.title" introduction="privacy.introduction" />
      <div className="privacy-grid">
        {SECTIONS.map((section) => (
          <section key={section.titleKey} className="card privacy-card" aria-labelledby={section.titleKey}>
            <span className="tool-icon"><Icon name={section.icon} /></span>
            <h2 id={section.titleKey}>{t(section.titleKey)}</h2>
            <p>{t(section.textKey)}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
