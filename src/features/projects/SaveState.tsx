import { useTranslation } from '../../i18n';
import type { SaveStateValue } from './draftSaveState';

/**
 * The state that opens a tool's data line, in bold, before what describes the subject. Only the state
 * itself is a live region, so a time that keeps moving («2 minutes ago») is never announced.
 */
export function SaveState({ kind, project, detail }: SaveStateValue): React.JSX.Element {
  const { t } = useTranslation();
  const label = kind === 'example' ? t('saveState.example') : kind === 'unsaved' ? t('saveState.unsaved')
    : kind === 'saved' ? t('saveState.saved', { project: project ?? '' }) : t('saveState.changed', { project: project ?? '' });
  return <><span className="save-state" aria-live="polite" aria-atomic="true"><strong>{label}</strong></span>{detail ? ` · ${detail}` : null}</>;
}
