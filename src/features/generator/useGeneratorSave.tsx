import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { ProjectContext } from '../projects/projectContext';
import type { GeneratorRunSaved } from '../projects/projectContext';
import { downloadSearch } from './download';
import { HistoryFeedback, SaveDialog } from './GeneratorHistory';
import { useGeneratorHistoryMode } from './historyMode';
import type { SearchResult } from './search';

/**
 * «Save to project» for one result: the button joins the result's actions next to its download, and
 * the details (destination, feedback, dialog) follow that row. Both are null where saving is not offered.
 */
export function useGeneratorSave(result: SearchResult, unavailable: boolean): { button: React.JSX.Element | null; details: React.JSX.Element | null } {
  const { t } = useTranslation();
  const projects = useContext(ProjectContext);
  const mode = useGeneratorHistoryMode();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState<number | null>(null);
  const [saved, setSaved] = useState<GeneratorRunSaved | null>(null);
  const resultJson = JSON.stringify(result, null, 2);
  if (mode === 'hidden' || !projects) return { button: null, details: null };
  if (mode === 'signed-out') return { button: null, details: (
    <div className="project-confirm generator-save-invite">
      <p>{t('generator.signedOutNote')}</p>
      <div className="actions">
        <Link className="button button-primary" to={ROUTES.signIn}>{t('shell.signIn')}</Link>
        <Link className="button button-secondary" to={ROUTES.signUp}>{t('generator.signUp')}</Link>
      </div>
    </div>
  ) };
  const active = projects.active;
  const button = <button type="button" className="button button-primary" disabled={unavailable || projects.busy} onClick={() => { setOpen(true); }}>{t('generator.saveToProject')}</button>;
  return { button, details: (
    <>
      <p className="field-help generator-save-destination">
        {active ? t('generator.savesTo', { project: active.name }) : t('generator.savesNowhere')}{' '}
        <button type="button" className="button button-quiet" disabled={unavailable || projects.busy} onClick={() => { setOpen(true); }}>{t(active ? 'generator.changeProject' : 'generator.chooseProject')}</button>
      </p>
      <HistoryFeedback attempt={attempt} success={saved ? t(saved.added ? 'generator.savedTo' : 'generator.alreadySaved', { project: saved.project }) : null} onDownload={() => { downloadSearch(resultJson); }} />
      {open && <SaveDialog result={result} resultJson={resultJson} onClose={() => { setOpen(false); }} onStart={setAttempt} onDone={setSaved} />}
    </>
  ) };
}
