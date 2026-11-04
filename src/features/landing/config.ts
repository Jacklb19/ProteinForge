import type { TranslationKey } from '../../i18n';
import type { Descriptors } from '../descriptors/descriptors';

/** Descriptors quoted under the analysis example. */
export const HERO_FACTS: readonly { key: keyof Descriptors }[] = [
  { key: 'massDa' },
  { key: 'isoelectricPoint' },
  { key: 'gravy' },
];

export type LandingTool = 'analyze' | 'compare' | 'design' | 'laboratory';

/**
 * What each tool does, shown one after another with its real result; the public page never opens a tool.
 * `scopeKey` is the limit of that result, where it needs saying.
 */
export const LANDING_USES: readonly { id: LandingTool; titleKey: TranslationKey; textKey: TranslationKey; scopeKey?: TranslationKey }[] = [
  { id: 'analyze', titleKey: 'public.analyzeUse', textKey: 'public.analyzeText', scopeKey: 'workbench.analysisScope' },
  { id: 'compare', titleKey: 'public.compareUse', textKey: 'public.compareText' },
  { id: 'design', titleKey: 'public.designUse', textKey: 'public.designText' },
  { id: 'laboratory', titleKey: 'public.labUse', textKey: 'public.labText', scopeKey: 'public.labScope' },
];

export const QUESTIONS: readonly { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
  { questionKey: 'public.questionAccount', answerKey: 'public.answerAccount' },
  { questionKey: 'public.questionSequences', answerKey: 'account.sequencesText' },
  { questionKey: 'public.questionPrediction', answerKey: 'public.answerPrediction' },
  { questionKey: 'public.questionFunction', answerKey: 'public.answerFunction' },
];

/** The answer about accounts opens by default: it is the question every visitor of the public site has. */
export const OPEN_QUESTION: TranslationKey = 'public.questionAccount';
