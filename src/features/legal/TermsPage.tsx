import { LegalPage } from './LegalPage';
import type { LegalSection } from './LegalPage';

const SECTIONS: readonly LegalSection[] = [
  { titleKey: 'terms.purposeTitle', textKey: 'terms.purposeText' },
  { titleKey: 'terms.scienceTitle', textKey: 'terms.scienceText' },
  { titleKey: 'terms.accountTitle', textKey: 'terms.accountText' },
  { titleKey: 'terms.contentTitle', textKey: 'terms.contentText' },
  { titleKey: 'terms.useTitle', textKey: 'terms.useText' },
  { titleKey: 'terms.availabilityTitle', textKey: 'terms.availabilityText' },
  { titleKey: 'terms.changesTitle', textKey: 'terms.changesText' },
];

/** Describes the current academic service and the responsibilities of its users. */
export function TermsPage(): React.JSX.Element {
  return <LegalPage titleKey="terms.title" introduction="terms.introduction" sections={SECTIONS} />;
}
