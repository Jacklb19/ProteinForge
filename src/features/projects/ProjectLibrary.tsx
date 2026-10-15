import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { useProjects } from './projectContext';
import type { ProjectSummary } from './contracts';
import { MAX_PROJECT_NAME_LENGTH } from './config';
import { ProjectFeedback } from './ProjectControls';

type Intent = { action: 'open' | 'delete' | 'rename'; project: ProjectSummary };

/** A compact list of real owned projects, with deliberate destructive and replacement actions. */
export function ProjectLibrary(): React.JSX.Element {
  const { t, formatDate } = useTranslation();
  const projects = useProjects();
  const auth = useAuth();
  const draft = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [name, setName] = useState('');
  async function open(project: ProjectSummary): Promise<void> {
    if (await projects.open(project.id)) { setIntent(null); void navigate(ROUTES.analyze); }
  }
  return <div id="projects" className="project-library">
    {auth.status !== 'signed-in' ? <div className="project-empty"><p>{t('projects.signInHelp')}</p><Link className="button button-secondary" to={ROUTES.signIn}>{t('shell.signIn')}</Link></div> : !projects.enabled ? <p className="notice">{t('projects.config')}</p> : <>
      <ProjectFeedback />
      {!projects.busy && !projects.error && projects.items.length === 0 && <div className="project-empty"><div><h3>{t('projects.emptyTitle')}</h3><p>{t('projects.emptyHelp')}</p></div><Link className="button button-secondary" to={ROUTES.analyze}>{t('projects.begin')}</Link></div>}
      <ul className="project-list">{projects.items.map((project) => <li key={project.id} data-active={project.id === projects.active?.id}>
        <div className="project-list-copy"><h3>{project.name}</h3><p>{t('projects.updated', { date: formatDate(new Date(project.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>{project.id === projects.active?.id && <span className="field-help">{t(projects.dirty ? 'projects.activeDirty' : 'projects.active')}</span>}</div>
        <div className="project-list-actions"><button className="button button-secondary" type="button" disabled={projects.busy} aria-label={t('projects.openNamed', { name: project.name })} onClick={() => {
          if (draft.text || alignment.first || alignment.second) setIntent({ action: 'open', project });
          else void open(project);
        }}>{t('projects.open')}</button><button className="button button-quiet" type="button" disabled={projects.busy} aria-label={t('projects.renameNamed', { name: project.name })} onClick={() => { setName(project.name); setIntent({ action: 'rename', project }); }}>{t('projects.rename')}</button><button className="button button-quiet" type="button" disabled={projects.busy} aria-label={t('projects.deleteNamed', { name: project.name })} onClick={() => { setIntent({ action: 'delete', project }); }}>{t('projects.delete')}</button></div>
      </li>)}</ul>
      <div className="actions">{projects.nextPageToken !== null && <button className="button button-secondary" disabled={projects.busy} type="button" onClick={() => { void projects.refresh(true); }}>{t('projects.more')}</button>}<button className="button button-quiet" type="button" disabled={projects.busy} onClick={() => { void projects.refresh(); }}>{t('projects.refresh')}</button></div>
      <p className="field-help">{t('projects.libraryHelp')}</p>
      {intent && <form className="project-confirm" aria-label={t(`projects.${intent.action === 'delete' ? 'delete' : intent.action === 'rename' ? 'rename' : 'open'}`)} onSubmit={(event) => {
        event.preventDefault();
        if (intent.action === 'open') void open(intent.project);
        if (intent.action === 'delete') void projects.remove(intent.project).then((done) => { if (done) setIntent(null); });
        if (intent.action === 'rename') void projects.rename(intent.project, name).then((done) => { if (done) setIntent(null); });
      }}><h3>{intent.project.name}</h3>{intent.action === 'rename' ? <div className="field"><label htmlFor="rename-project">{t('projects.name')}</label><input id="rename-project" className="text-input" value={name} onChange={(event) => { setName(event.target.value); }} maxLength={MAX_PROJECT_NAME_LENGTH} required disabled={projects.busy} /></div> : <p>{t(intent.action === 'delete' ? 'projects.deleteWarning' : 'projects.replaceWarning')}</p>}<div className="actions"><button className="button button-secondary" type="button" disabled={projects.busy} onClick={() => { setIntent(null); }}>{t('projects.cancel')}</button><button className={`button ${intent.action === 'delete' ? 'button-danger' : 'button-primary'}`} type="submit" disabled={projects.busy || (intent.action === 'rename' && !name.trim())}>{t(intent.action === 'delete' ? 'projects.confirmDelete' : intent.action === 'rename' ? 'projects.confirmRename' : 'projects.confirmOpen')}</button></div></form>}
    </>}
  </div>;
}
