import type { TranslationKey } from '../../i18n';
import type { IconName } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';
import type { Descriptors } from '../descriptors/descriptors';

/** Descriptors quoted under the analysis example. */
export const HERO_FACTS: readonly { key: keyof Descriptors }[] = [
  { key: 'massDa' },
  { key: 'isoelectricPoint' },
  { key: 'gravy' },
];

export type LandingTool = 'analyze' | 'compare' | 'design' | 'laboratory';

/** Tools presented on the public page, each with the question it answers and the limit of its result. */
export const LANDING_TOOLS: readonly { id: LandingTool; labelKey: TranslationKey; questionKey: TranslationKey; textKey: TranslationKey; scopeKey: TranslationKey; route: string }[] = [
  { id: 'analyze', labelKey: 'nav.analyze', questionKey: 'public.analyzeQuestion', textKey: 'public.analyzeText', scopeKey: 'workbench.analysisScope', route: ROUTES.analyze },
  { id: 'compare', labelKey: 'nav.alignment', questionKey: 'public.compareQuestion', textKey: 'public.compareText', scopeKey: 'workbench.scoreHelp', route: ROUTES.alignment },
  { id: 'design', labelKey: 'nav.generate', questionKey: 'public.designQuestion', textKey: 'public.designText', scopeKey: 'generator.scope', route: ROUTES.generate },
  { id: 'laboratory', labelKey: 'workbench.laboratory', questionKey: 'public.labQuestion', textKey: 'public.labText', scopeKey: 'public.labScope', route: ROUTES.laboratory },
];

export const INTRO_POINTS: readonly { icon: IconName; titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { icon: 'library', titleKey: 'public.pointSource', textKey: 'public.pointSourceText' },
  { icon: 'analyze', titleKey: 'public.pointMeaning', textKey: 'public.pointMeaningText' },
  { icon: 'projects', titleKey: 'public.pointKeep', textKey: 'public.pointKeepText' },
];

export const WORKFLOW_STEPS: readonly { icon: IconName; titleKey: TranslationKey; textKey: TranslationKey }[] = [
  { icon: 'upload', titleKey: 'public.stepInput', textKey: 'public.stepInputText' },
  { icon: 'compare', titleKey: 'public.stepExplore', textKey: 'public.stepExploreText' },
  { icon: 'projects', titleKey: 'public.stepKeep', textKey: 'public.stepKeepText' },
];

export const QUESTIONS: readonly { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
  { questionKey: 'public.questionAccount', answerKey: 'public.answerAccount' },
  { questionKey: 'public.questionPrediction', answerKey: 'public.answerPrediction' },
  { questionKey: 'public.questionFunction', answerKey: 'public.answerFunction' },
];
