import { createContext } from 'react';
import type { TranslationKey } from '../i18n';
import { ROUTES } from '../shared/navigation';

/** The guided visit: one stop per tool, in the order a first demonstration follows. Each opens with its example. */
export const TOUR_STOPS: readonly { path: string; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { path: ROUTES.analyze, titleKey: 'nav.analyze', bodyKey: 'tour.analyze' },
  { path: ROUTES.alignment, titleKey: 'nav.alignment', bodyKey: 'tour.alignment' },
  { path: ROUTES.library, titleKey: 'nav.library', bodyKey: 'tour.library' },
  { path: ROUTES.generate, titleKey: 'nav.generate', bodyKey: 'tour.generate' },
  { path: ROUTES.laboratory, titleKey: 'workbench.laboratory', bodyKey: 'tour.laboratory' },
  { path: ROUTES.projects, titleKey: 'nav.projects', bodyKey: 'tour.projects' },
];

/** Present only inside the laboratory frame, which is where the visit runs. */
export const TourContext = createContext<{ start: () => void } | null>(null);
