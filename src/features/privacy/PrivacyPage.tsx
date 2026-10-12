import { LegalPage } from '../legal/LegalPage';
import type { LegalSection } from '../legal/LegalPage';

const SECTIONS: readonly LegalSection[] = [
  { titleKey: 'privacy.operatorTitle', textKey: 'privacy.operatorText' },
  { titleKey: 'privacy.localTitle', textKey: 'privacy.localText' },
  { titleKey: 'privacy.accountTitle', textKey: 'privacy.accountText' },
  { titleKey: 'privacy.googleTitle', textKey: 'privacy.googleText' },
  { titleKey: 'privacy.providersTitle', textKey: 'privacy.providersText' },
  { titleKey: 'privacy.retentionTitle', textKey: 'privacy.retentionText' },
  { titleKey: 'privacy.noTrackingTitle', textKey: 'privacy.noTrackingText' },
  { titleKey: 'privacy.externalTitle', textKey: 'privacy.externalText' },
];

/** What stays in the browser, what leaves it and when the visitor is asked. */
export function PrivacyPage(): React.JSX.Element {
  return <LegalPage titleKey="privacy.title" introduction="privacy.introduction" sections={SECTIONS} />;
}
