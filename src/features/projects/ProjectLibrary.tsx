import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { useProjects } from './projectContext';
import type { ProjectSummary } from './contracts';
import { DEFAULT_PROJECT_QUERY, MAX_PROJECT_NAME_LENGTH, PROJECT_ORDERS, PROJECT_ORDER_KEYS } from './config';
import type { ProjectQuery } from './config';
import { ProjectFeedback } from './ProjectControls';
import { ProjectCard } from './ProjectCard';
import type { ProjectDestination } from './ProjectCard';
import { ProjectDialog } from './ProjectDialog';
import type { ProjectIntent } from './ProjectDialog';
import { LabContext } from '../design-lab/context';
import { SAVED_RUNS_ID, useGeneratorHistoryMode } from '../generator/historyMode';

/** Search and sorting apply to the whole owned collection before paging. */
export function ProjectLibrary(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const projects = useProjects();
  const lab = useContext(LabContext);
  const auth = useAuth();
  const draft = useSequenceDraft();
  const alignment = useAlignmentDraft();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<ProjectIntent | null>(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState<ProjectQuery>(projects.listing);
  const showRuns = useGeneratorHistoryMode() === 'ready';
  /** Opens a project and goes where its evidence lives; a comparison without analysis opens Alinear. */
  async function open(project: ProjectSummary, destination?: ProjectDestination): Promise<void> {
    const opened = await projects.open(project.id, destination === 'laboratory' ? 'laboratory' : undefined);
    if (!opened) return;
    setIntent(null);
    const alignment = opened.workspace.alignment;
    const comparisonOnly = !opened.activeSequence && Boolean(alignment.first || alignment.second);
    if (destination === 'laboratory') { void navigate(ROUTES.laboratory); return; }
    // Saved searches belong to the project open in Analyze, so it opens there and shows them in Design.
    if (destination === 'generator') { void navigate(`${ROUTES.generate}#${SAVED_RUNS_ID}`); return; }
    void navigate(destination === 'alignment' || (!destination && comparisonOnly) ? ROUTES.alignment : ROUTES.analyze);
  }

  /** Replacing work in progress is confirmed first; each destination watches its own drafts. */
  function requestOpen(project: ProjectSummary, destination?: ProjectDestination): void {
    const replaces = destination === 'laboratory' ? Boolean(lab?.dirty) : Boolean(draft.text || alignment.first || alignment.second);
    if (replaces) setIntent({ action: 'open', project, destination }); else void open(project, destination);
  }
  function submit(): void {
    if (!intent) return;
    if (intent.action === 'open') { void open(intent.project, intent.destination); return; }
    const result = intent.action === 'delete' ? projects.remove(intent.project) : intent.action === 'rename' ? projects.rename(intent.project, name) : projects.duplicate(intent.project, name);
    void result.then(done => { if (done) setIntent(null); });
  }
  if (auth.status === 'loading') return <p role="status">{t('projects.sessionLoading')}</p>;
  if (auth.status !== 'signed-in') return <div className="project-empty"><p>{t('projects.signInLibrary')}</p><div className="actions"><Link className="button button-primary" state={{ from: ROUTES.projects }} to={ROUTES.signIn}>{t('shell.signIn')}</Link><Link className="button button-secondary" state={{ from: ROUTES.projects }} to={ROUTES.signUp}>{t('auth.signUpAction')}</Link></div></div>;
  if (!projects.enabled) return <p className="notice">{t('projects.config')}</p>;
  return <section id="projects" className="project-library" aria-label={t('projects.title')}>
    <form className="projects-toolbar" role="search" onSubmit={event => { event.preventDefault(); void projects.refresh(false, query); }}>
      <div className="projects-search"><label className="visually-hidden" htmlFor="project-search">{t('projects.search')}</label><input id="project-search" type="search" className="text-input" value={query.query} maxLength={MAX_PROJECT_NAME_LENGTH} placeholder={t('projects.search')} onChange={event => { setQuery({ ...query, query: event.target.value }); }} disabled={projects.busy} /><button className="button button-secondary" type="submit" disabled={projects.busy}>{t('projects.searchAction')}</button></div>
      <label className="visually-hidden" htmlFor="project-order">{t('projects.order')}</label><select id="project-order" className="text-input" value={query.order} disabled={projects.busy} onChange={event => {
        const order = PROJECT_ORDERS.find(value => value === event.target.value);
        if (order) { const next = { ...query, order }; setQuery(next); void projects.refresh(false, next); }
      }}>{PROJECT_ORDERS.map(order => <option key={order} value={order}>{t(PROJECT_ORDER_KEYS[order])}</option>)}</select>
    </form>
    {!intent && <ProjectFeedback />}
    {!projects.busy && !projects.error && projects.items.length === 0 && <div className="project-empty">{projects.listing.query ? <><p>{t('projects.noMatches')}</p><button className="button button-secondary" type="button" onClick={() => { setQuery(DEFAULT_PROJECT_QUERY); void projects.refresh(false, DEFAULT_PROJECT_QUERY); }}>{t('projects.clearSearch')}</button></> : <><div><h2>{t('projects.emptyTitle')}</h2><p>{t('projects.emptyHelp')}</p></div><Link className="button button-secondary" to={ROUTES.analyze}>{t('projects.begin')}</Link></>}</div>}
    <div className="project-grid" aria-busy={projects.busy}>
      {projects.items.map(project => (
        <ProjectCard
          key={project.id} project={project} busy={projects.busy}
          active={project.id === projects.active?.id} dirty={projects.dirty} showRuns={showRuns}
          onOpen={destination => { requestOpen(project, destination); }}
          onAction={action => {
            setName(action === 'duplicate' ? t('projects.copyName', { name: project.name }).slice(0, MAX_PROJECT_NAME_LENGTH) : project.name);
            setIntent({ action, project });
          }}
        />
      ))}
    </div>
    <div className="projects-list-footer"><p className="field-help" role="status">{t(projects.items.length === 1 ? 'projects.loadedOne' : 'projects.loaded', { count: formatNumber(projects.items.length) })}</p><div className="actions">{projects.nextPageToken !== null && <button className="button button-secondary" disabled={projects.busy} type="button" onClick={() => { void projects.refresh(true); }}>{t('projects.more')}</button>}<button className="button button-quiet" type="button" disabled={projects.busy} onClick={() => { void projects.refresh(false, projects.listing); }}>{t('projects.refresh')}</button></div></div>
    {intent && <ProjectDialog intent={intent} name={name} setName={setName} onClose={() => { setIntent(null); }} onSubmit={submit} />}
  </section>;
}
