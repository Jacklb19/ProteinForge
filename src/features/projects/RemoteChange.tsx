import { useTranslation } from '../../i18n';
import { useProjects } from './projectContext';

/** Under a tool's header: the open project changed in another tab or device, before a save runs into it. */
export function RemoteChange(): React.JSX.Element | null {
  const { t } = useTranslation();
  const projects = useProjects();
  const active = projects.active;
  if (!active || !projects.remoteChange) return null;
  const removed = projects.remoteChange === 'removed';
  return <div className="notice remote-change" role="status">
    <p>{t(removed ? 'sync.remoteRemoved' : projects.dirty ? 'sync.remoteChangedDirty' : 'sync.remoteChanged', { name: active.name })}</p>
    {removed
      ? <button className="button button-secondary" type="button" disabled={projects.busy} onClick={() => { projects.detach(); }}>{t('sync.remoteDetach')}</button>
      : <button className="button button-secondary" type="button" disabled={projects.busy} onClick={() => { void projects.open(active.id); }}>{t(projects.dirty ? 'sync.remoteLoadDiscard' : 'sync.remoteLoad')}</button>}
  </div>;
}
