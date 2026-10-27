import type { TranslationKey } from '../../i18n';

/** Kinds of structural evidence the tools distinguish; the public page and the guide describe the same three. */
export const EVIDENCE_KINDS: readonly { titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { titleKey: 'public.experimental', textKey: 'public.experimentalText' },
  { titleKey: 'public.predicted', textKey: 'public.predictedText' },
  { titleKey: 'public.draft', textKey: 'public.draftText' },
];

/** Sections of the guide in display order; each id is also its anchor. */
export const GUIDE_SECTIONS = {
  properties: { id: 'guide-properties', titleKey: 'guide.propertiesTitle' },
  profile: { id: 'guide-profile', titleKey: 'guide.profileTitle' },
  comparison: { id: 'guide-comparison', titleKey: 'guide.comparisonTitle' },
  design: { id: 'guide-design', titleKey: 'guide.designTitle' },
  structures: { id: 'guide-structures', titleKey: 'guide.structuresTitle' },
  evidence: { id: 'guide-evidence', titleKey: 'guide.evidenceTitle' },
} as const satisfies Record<string, { id: string; titleKey: TranslationKey }>;
