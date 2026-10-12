import type { TranslationKey } from '../../i18n';
import type { IconName } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';

/** Task launchers share the real tools; they never create a separate calculation path. */
export const WORKSPACE_TASKS: readonly { path: string; icon: IconName; title: TranslationKey; text: TranslationKey; action: TranslationKey }[] = [
  { path: ROUTES.analyze, icon: 'sequence', title: 'workspace.analyzeTitle', text: 'workspace.analyzeText', action: 'workspace.analyzeAction' },
  { path: ROUTES.alignment, icon: 'alignment', title: 'workspace.compareTitle', text: 'workspace.compareText', action: 'workspace.compareAction' },
  { path: ROUTES.library, icon: 'book', title: 'library.taskTitle', text: 'library.taskText', action: 'library.taskAction' },
  { path: ROUTES.generate, icon: 'sequence', title: 'generator.taskTitle', text: 'generator.taskText', action: 'generator.taskAction' },
];

export const GETTING_STARTED_STEPS = ['workspace.step1', 'workspace.step2', 'workspace.step3'] as const;
export const SEQUENCE_PREVIEW_LENGTH = 32;
export const SAMPLE_RESIDUES = ['M', 'A', 'L', 'W', 'M', 'R'] as const;
