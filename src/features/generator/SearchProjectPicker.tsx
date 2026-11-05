import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { ProjectContext } from '../projects/projectContext';
import type { ProjectSummary } from '../projects/contracts';
import { MAX_PROJECT_NAME_LENGTH } from '../projects/config';
import { generatorHistoryRuns } from './history';
import { HistoryFeedback } from './GeneratorHistory';
import { useGeneratorHistoryMode } from './historyMode';

const NONE = 'none';
const NEW = 'new';
const PICKER_ID = 'generator-project';
const PANEL_TITLE_ID = 'generator-new-project-title';

/**
 * Design's own project for searches, chosen in the page heading: every saved project with its count of
 * searches, no project, or a new one. Choosing here never opens the project in Analyze. Returns the field
 * for the heading, the note under the introduction and the panel that creates a project.
 */
export function useSearchProjectPicker(): { field: React.JSX.Element | null; note: string | null; panel: React.JSX.Element | null } {
  const { t } = useTranslation();
  const mode = useGeneratorHistoryMode();
  const projects = useContext(ProjectContext);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [attempt, setAttempt] = useState<number | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (creating) input.current?.focus(); }, [creating]);
  if (mode !== 'ready' || !projects) return { field: null, note: null, panel: null };

  const chosen = projects.searchProject;
  // The chosen project may sit beyond the loaded page of the list; it is always offered.
  const listed: ProjectSummary[] = chosen && !projects.items.some((item) => item.id === chosen.id) ? [chosen, ...projects.items] : projects.items;
  const runsOf = (item: ProjectSummary): number => item.id === chosen?.id && chosen.workspace.generatorHistory
    ? generatorHistoryRuns(chosen.workspace.generatorHistory).length : item.preview?.generatorRuns ?? 0;
  const label = (item: ProjectSummary): string => {
    const count = runsOf(item);
    return count === 0 ? t('generator.projectOptionNone', { name: item.name }) : count === 1 ? t('generator.projectOptionOne', { name: item.name }) : t('generator.projectOption', { name: item.name, count });
  };
  const cancel = (): void => { setCreating(false); setName(''); select.current?.focus(); };
  async function create(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!projects || !name.trim()) return;
    setAttempt(projects.attempt + 1);
    if (await projects.createSearchProject(name)) { setCreating(false); setName(''); select.current?.focus(); }
  }

  const field = (
    <div className="field generator-project-picker">
      <label htmlFor={PICKER_ID}>{t('generator.project')}</label>
      <select
        id={PICKER_ID} ref={select} className="text-input" disabled={projects.busy}
        value={creating ? NEW : chosen?.id ?? NONE}
        aria-controls={creating ? PANEL_TITLE_ID : undefined}
        onChange={(event) => {
          const value = event.target.value;
          if (value === NEW) { setCreating(true); return; }
          setCreating(false);
          setAttempt(projects.attempt + 1);
          void projects.chooseSearchProject(value === NONE ? null : value);
        }}
      >
        {listed.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        <option value={NONE}>{t('generator.noProject')}</option>
        <option value={NEW}>{t('generator.newProjectOption')}</option>
      </select>
    </div>
  );
  const panel = creating ? (
    <section className="tool-panel generator-new-project" aria-labelledby={PANEL_TITLE_ID} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } }}>
      <h2 id={PANEL_TITLE_ID}>{t('generator.newProjectTitle')}</h2>
      <form className="generator-new-project-form" onSubmit={(event) => { void create(event); }}>
        <label className="field" htmlFor="generator-new-project-name"><span>{t('generator.newName')}</span>
          <input id="generator-new-project-name" ref={input} className="text-input" value={name} maxLength={MAX_PROJECT_NAME_LENGTH} required onChange={(event) => { setName(event.target.value); }} />
        </label>
        <div className="actions">
          <button type="submit" className="button button-primary" disabled={!name.trim() || projects.busy}>{t('generator.createProject')}</button>
          <button type="button" className="button button-secondary" onClick={cancel}>{t('generator.saveCancel')}</button>
        </div>
      </form>
      <p className="field-help">{t('generator.newProjectHelp')}</p>
    </section>
  ) : null;
  return {
    field,
    note: t('generator.projectHelp'),
    panel: <>{panel}<HistoryFeedback attempt={attempt} success={chosen && attempt !== null ? t('generator.projectChosen', { project: chosen.name }) : null} /></>,
  };
}
