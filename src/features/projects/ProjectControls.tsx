import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import type { DescriptorState } from '../descriptors/useDescriptors';
import { useProjects } from './projectContext';
import { MAX_PROJECT_NAME_LENGTH, PROJECT_ERROR_KEYS } from './config';

export function ProjectFeedback(): React.JSX.Element {
  const projects = useProjects();
  const { t } = useTranslation();
  return <div className="project-feedback" aria-live="polite" role="status">
    {projects.busy && <p className="status-message">{t('projects.busy')}</p>}
    {projects.error && <p className="status-message" data-state="error">{t(PROJECT_ERROR_KEYS[projects.error.code])}{projects.error.requestId && <span className="field-help"> {t('projects.reference', { id: projects.error.requestId })}</span>}</p>}
    {!projects.busy && projects.notice && <p className="status-message" data-state="success">{t(`projects.${projects.notice}`)}</p>}
  </div>;
}

function SaveForm({ descriptors }: { descriptors?: DescriptorState }): React.JSX.Element {
  const projects = useProjects();
  const { t } = useTranslation();
  const [name, setName] = useState(projects.active?.name ?? '');
  const [reloadPending, setReloadPending] = useState(false);
  return <>
    <form className="project-save-form" onSubmit={(event) => { event.preventDefault(); void projects.save(name, descriptors); }}>
      <div className="field"><label htmlFor="project-name">{t('projects.name')}</label><input className="text-input" id="project-name" value={name} onChange={(event) => { setName(event.target.value); }} required maxLength={MAX_PROJECT_NAME_LENGTH} disabled={projects.busy} placeholder={t('projects.namePlaceholder')} /></div>
      <button type="submit" className="button button-primary" disabled={projects.busy || !name.trim()}>{t(projects.active ? 'projects.update' : 'projects.create')}</button>
      {projects.active && <button type="button" className="button button-secondary" disabled={projects.busy || !name.trim()} onClick={() => { void projects.save(name, descriptors, true); }}>{t('projects.saveCopy')}</button>}
    </form>
    {projects.active && <div className="project-state"><p>{t(projects.dirty ? 'projects.unsaved' : 'projects.upToDate', { name: projects.active.name })}</p><button className="button button-quiet" type="button" disabled={projects.busy} onClick={() => { setReloadPending(true); }}>{t('projects.reload')}</button><button className="button button-quiet" type="button" disabled={projects.busy} onClick={() => { projects.detach(); }}>{t('projects.detach')}</button></div>}
    {reloadPending && projects.active && <div className="project-confirm" role="group" aria-label={t('projects.reload')}><p>{t('projects.replaceWarning')}</p><div className="actions"><button className="button button-secondary" type="button" onClick={() => { setReloadPending(false); }}>{t('projects.cancel')}</button><button className="button button-primary" type="button" disabled={projects.busy} onClick={() => { if (projects.active) void projects.open(projects.active.id).then((opened) => { if (opened) setReloadPending(false); }); }}>{t('projects.confirmOpen')}</button></div></div>}
  </>;
}

/** Saving is an explicit action. Anonymous analysis remains usable and never sends sequence data. */
export function ProjectControls({ descriptors }: { descriptors?: DescriptorState }): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  const projects = useProjects();
  return <>
    <h2 id="project-panel-title" className="visually-hidden">{t('projects.workTitle')}</h2>
    {auth.status === 'loading' ? <p className="field-help">{t('projects.sessionLoading')}</p> : auth.status !== 'signed-in' ? <div className="project-empty"><p>{t('projects.signInHelp')}</p><div className="actions"><Link className="button button-primary" to={ROUTES.signUp}>{t('auth.signUpAction')}</Link><Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link></div></div> : !projects.enabled ? <p className="notice">{t('projects.config')}</p> : <><SaveForm key={`${projects.active?.id ?? 'new'}:${projects.active?.name ?? ''}`} descriptors={descriptors} /><p className="field-help">{t('projects.saveHelp')} <Link className="inline-link" to={ROUTES.projects}>{t('projects.listLink')}</Link></p><ProjectFeedback /></>}
  </>;
}
