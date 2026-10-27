import { useContext } from 'react';
import { useTranslation } from '../../i18n';
import { AuthContext } from '../auth/authContext';
import { ProjectContext } from '../projects/projectContext';
import { GENERATOR_HISTORY_CONFIG as H } from './config';
import { readGeneratorHistoryEnabled } from './historyFeature';

export const SAVED_RUNS_ID = 'generator-saved-runs';

/** hidden: not offered in this build or without accounts; signed-out: invite to sign in; ready: save and list. */
export function useGeneratorHistoryMode(): 'hidden' | 'signed-out' | 'ready' {
  // Optional contexts: a screen rendered without sessions or projects simply does not offer saving.
  const auth = useContext(AuthContext);
  const projects = useContext(ProjectContext);
  if (!readGeneratorHistoryEnabled() || !auth || !projects?.enabled) return 'hidden';
  if (auth.status === 'anonymous') return 'signed-out';
  return auth.status === 'signed-in' ? 'ready' : 'hidden';
}

/** Sizes in the same kilobytes as the history limit. */
export function useKilobytes(): (bytes: number) => string {
  const { t, formatNumber } = useTranslation();
  return (bytes) => t('generator.kilobytes', { value: formatNumber(bytes / H.bytesPerKilobyte, { maximumFractionDigits: 1 }) });
}
