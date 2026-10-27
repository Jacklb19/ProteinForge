import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { residueClass } from '../chemistry/config';
import { useProjects } from '../projects/projectContext';
import type { GeneratorRunSaved, GeneratorRunTarget } from '../projects/projectContext';
import { MAX_PROJECT_NAME_LENGTH, PROJECT_ERROR_KEYS } from '../projects/config';
import { CandidateRows } from './CandidateRows';
import { CANDIDATE_GRAVY_FORMAT, CANDIDATE_MASS_FORMAT, GENERATOR_HISTORY_CONFIG as H } from './config';
import { useGenerator } from './context';
import { downloadSearch } from './download';
import { generatorHistoryRuns } from './history';
import type { GeneratorRun, GeneratorRunSelection } from './history';
import { SAVED_RUNS_ID, useGeneratorHistoryMode, useKilobytes } from './historyMode';
import type { ReproductionResult } from './reproduce';
import { startReproduction } from './reproduceClient';
import type { Candidate, SearchProgress, SearchResult } from './search';

const encoder = new TextEncoder();

/** Feedback for this screen's own project writes; size and version refusals carry their next step. */
export function HistoryFeedback({ attempt, success, onDownload }: { attempt: number | null; success: string | null; onDownload?: () => void }) {
  const projects = useProjects();
  const { t } = useTranslation();
  const mine = attempt !== null && projects.attempt === attempt;
  const error = mine ? projects.error : null;
  return (
    <div className="project-feedback generator-history-feedback" aria-live="polite" role="status">
      {mine && projects.busy && <p className="status-message">{t('projects.busy')}</p>}
      {error && <div className={error.code === 'generator-history-size' || error.code === 'requires-current-client' ? 'project-confirm' : undefined}>
        <p className="status-message" data-state="error">
          {t(PROJECT_ERROR_KEYS[error.code])}
          {error.requestId && <span className="field-help"> {t('projects.reference', { id: error.requestId })}</span>}
        </p>
        {error.code === 'generator-history-size' && <div className="actions">
          <a className="button button-secondary" href={`#${SAVED_RUNS_ID}`}>{t('generator.fullChoose')}</a>
          {onDownload && <button type="button" className="button button-secondary" onClick={onDownload}>{t('generator.fullDownload')}</button>}
        </div>}
        {error.code === 'requires-current-client' && <div className="actions">
          <button type="button" className="button button-secondary" onClick={() => { window.location.reload(); }}>{t('generator.reload')}</button>
        </div>}
      </div>}
      {mine && !projects.busy && !error && success && <p className="status-message" data-state="success">{success}</p>}
    </div>
  );
}

export function SaveDialog({ result, resultJson, onClose, onStart, onDone }: { result: SearchResult; resultJson: string; onClose: () => void; onStart: (attempt: number) => void; onDone: (saved: GeneratorRunSaved | null) => void }) {
  const projects = useProjects();
  const { t, formatNumber } = useTranslation();
  const kilobytes = useKilobytes();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const active = projects.active;
  const others = projects.items.filter((item) => item.id !== active?.id);
  const [destination, setDestination] = useState<'active' | 'project' | 'new'>(active ? 'active' : others.length ? 'project' : 'new');
  const [other, setOther] = useState(others[0]?.id ?? '');
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState('none');
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    // Cancel first: saving to a project is a deliberate move.
    cancel.current?.focus();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const history = active?.workspace.generatorHistory;
  const runsAfter = (history ? generatorHistoryRuns(history).length : 0) + 1;
  const bytesAfter = encoder.encode(history?.documentJson ?? '').byteLength + encoder.encode(resultJson).byteLength;
  const invalid = (destination === 'project' && !other) || (destination === 'new' && !name.trim());
  async function submit(): Promise<void> {
    const [arm, index] = chosen.split(':');
    const selection: GeneratorRunSelection | null = arm === 'guided' || arm === 'reference' ? { arm, index: Number(index) } : null;
    const target: GeneratorRunTarget = destination === 'active' ? { kind: 'active' } : destination === 'project' ? { kind: 'project', id: other } : { kind: 'new', name };
    onStart(projects.attempt + 1);
    onDone(null);
    onClose();
    onDone(await projects.saveGeneratorRun(resultJson, selection, target));
  }
  const armName = (arm: 'guided' | 'reference'): string => t(arm === 'guided' ? 'generator.guided' : 'generator.reference');
  return (
    <dialog ref={dialog} className="project-dialog" aria-labelledby="generator-save-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <form className="project-confirm" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <h2 id="generator-save-title">{t('generator.saveTitle')}</h2>
        <fieldset className="generator-save-choices">
          <legend>{t('generator.destination')}</legend>
          {active && <label className="checkbox-option"><input type="radio" name="generator-destination" checked={destination === 'active'} onChange={() => { setDestination('active'); }} /><span>{t('generator.destinationActive', { project: active.name })}</span></label>}
          <label className="checkbox-option"><input type="radio" name="generator-destination" checked={destination === 'project'} disabled={!others.length} onChange={() => { setDestination('project'); }} /><span>{t('generator.destinationOther')}</span></label>
          {destination === 'project' && <select className="text-input" aria-label={t('generator.destinationOther')} value={other} onChange={(event) => { setOther(event.target.value); }}>
            {others.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}
          {!others.length && <p className="field-help">{t('generator.noOtherProjects')}</p>}
          <label className="checkbox-option"><input type="radio" name="generator-destination" checked={destination === 'new'} onChange={() => { setDestination('new'); }} /><span>{t('generator.destinationNew')}</span></label>
          {destination === 'new' && <label className="field" htmlFor="generator-new-project"><span>{t('generator.newName')}</span>
            <input id="generator-new-project" className="text-input" value={name} maxLength={MAX_PROJECT_NAME_LENGTH} required onChange={(event) => { setName(event.target.value); }} />
          </label>}
        </fieldset>
        <label className="field" htmlFor="generator-chosen"><span>{t('generator.chosen')}</span>
          <select id="generator-chosen" className="text-input" value={chosen} onChange={(event) => { setChosen(event.target.value); }}>
            <option value="none">{t('generator.chosenNone')}</option>
            {H.arms.flatMap((arm) => result[arm].candidates.map((_candidate, index) => (
              <option key={`${arm}:${String(index)}`} value={`${arm}:${String(index)}`}>{t('generator.chosenOption', { arm: armName(arm), index: index + 1 })}</option>
            )))}
          </select>
        </label>
        <div>
          <h3 className="generator-save-subtitle">{t('generator.whatIsSaved')}</h3>
          <p>{t('generator.savedSummary', { seed: result.parameters.seed, length: result.parameters.length, budget: formatNumber(result.parameters.budget), method: result.methodVersion, size: kilobytes(encoder.encode(resultJson).byteLength) })}</p>
          <p className="field-help">{t('generator.savedNote')}</p>
          {destination === 'active' && <p className="field-help">{t('generator.usageAfter', { runs: runsAfter, maximum: H.maxRuns, used: kilobytes(bytesAfter), limit: kilobytes(H.maxDocumentBytes) })}</p>}
        </div>
        <div className="actions">
          <button ref={cancel} className="button button-secondary" type="button" onClick={onClose}>{t('generator.saveCancel')}</button>
          <button className="button button-primary" type="submit" disabled={invalid || projects.busy}>{t('generator.save')}</button>
        </div>
      </form>
    </dialog>
  );
}

type Check = { status: 'idle' } | { status: 'running'; progress: SearchProgress } | { status: 'done'; result: ReproductionResult } | { status: 'cancelled' | 'failed' };

function ChosenCandidate({ candidate }: { candidate: Candidate }) {
  const { t, formatNumber } = useTranslation();
  if (candidate.sequence.length <= H.chosenPrefixResidues) return <CandidateRows candidates={[candidate]} label={t('generator.chosenCandidate')} />;
  const prefix = candidate.sequence.slice(0, H.chosenPrefixResidues);
  return (
    <div className="generator-chosen-long">
      <span className="candidate-cells" style={{ '--ribbon-columns': prefix.length } as React.CSSProperties} aria-hidden="true">
        {Array.from(prefix, (residue, index) => <span key={index} className="residue" data-chem={residueClass(residue)}>{residue}</span>)}
      </span>
      <span className="visually-hidden">{candidate.sequence}</span>
      <p className="field-help">
        {t('generator.chosenPrefix', { shown: H.chosenPrefixResidues, length: formatNumber(candidate.sequence.length) })}
        {' · '}
        {t('generator.rowFigures', { gravy: formatNumber(candidate.descriptors.gravy, CANDIDATE_GRAVY_FORMAT), mass: formatNumber(candidate.descriptors.massDa, CANDIDATE_MASS_FORMAT) })}
      </p>
    </div>
  );
}

function SavedRun({ run, busy, onRemove }: { run: GeneratorRun; busy: boolean; onRemove: () => void }) {
  const { t, formatNumber, formatDate } = useTranslation();
  const generator = useGenerator();
  const [check, setCheck] = useState<Check>({ status: 'idle' });
  const [confirming, setConfirming] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const result = JSON.parse(run.resultJson) as SearchResult;
  const { parameters } = result;
  const chosen = run.selection ? result[run.selection.arm].candidates[run.selection.index] : undefined;
  const ranges = [
    parameters.gravy.enabled ? t('generator.runGravy', { minimum: formatNumber(parameters.gravy.minimum), maximum: formatNumber(parameters.gravy.maximum) }) : null,
    parameters.massDa.enabled ? t('generator.runMass', { minimum: formatNumber(parameters.massDa.minimum), maximum: formatNumber(parameters.massDa.maximum) }) : null,
  ].filter(Boolean).join(' · ');
  function reproduce(): void {
    const operation = new AbortController();
    controller.current = operation;
    setCheck({ status: 'running', progress: { completed: 0, total: parameters.budget * 2 } });
    startReproduction(run.resultJson, { signal: operation.signal, onProgress: (progress) => { setCheck({ status: 'running', progress }); } })
      .then((outcome) => { setCheck({ status: 'done', result: outcome }); })
      .catch((error: unknown) => { setCheck({ status: error instanceof Error && error.message === 'cancelled' ? 'cancelled' : 'failed' }); })
      .finally(() => { if (controller.current === operation) controller.current = null; });
  }
  const title = t('generator.runTitle', { seed: parameters.seed, length: parameters.length });
  const differences = check.status === 'done' ? check.result.differences : [];
  return (
    <article className="generator-run" aria-labelledby={`run-${run.id}`}>
      <header>
        <h3 id={`run-${run.id}`}>{title}</h3>
        <p className="field-help">{t('generator.runBudget', { budget: formatNumber(parameters.budget) })}{ranges && ` · ${ranges}`}</p>
      </header>
      <dl className="generator-run-facts">
        <div><dt>{t('generator.method')}</dt><dd><code>{result.methodVersion}</code></dd></div>
        <div><dt>{t('generator.exportVersion')}</dt><dd>{t('generator.exportVersionValue', { version: result.schemaVersion })}</dd></div>
        <div><dt>{t('generator.build')}</dt><dd>{run.appBuild ? <code>{run.appBuild}</code> : t('generator.buildUnknown')}</dd></div>
        <div><dt>{t('generator.recordedAt')}</dt><dd><time dateTime={run.recordedAt}>{formatDate(new Date(run.recordedAt), { dateStyle: 'medium', timeStyle: 'short' })}</time> <span className="field-help">{t('generator.recordedNote')}</span></dd></div>
        <div><dt>{t('generator.identifier')}</dt><dd><code aria-hidden="true">{run.id.slice(0, H.identifierShown)}…</code><span className="visually-hidden">{t('generator.identifierFull', { value: run.id })}</span></dd></div>
      </dl>
      <div className="generator-run-chosen">
        <p><strong>{t('generator.chosenCandidate')}</strong>{chosen && run.selection ? ` · ${t('generator.chosenFrom', { arm: t(run.selection.arm === 'guided' ? 'generator.guided' : 'generator.reference'), index: run.selection.index + 1 })}` : ''}</p>
        {chosen ? <ChosenCandidate candidate={chosen} /> : <p className="field-help">{t('generator.noChosen')}</p>}
      </div>
      <div className="actions" role="group" aria-label={t('generator.runActions', { seed: parameters.seed })}>
        <button type="button" className="button button-secondary" onClick={() => { generator.restore(result); window.scrollTo(0, 0); }}>{t('generator.openRun')}</button>
        <button type="button" className="button button-secondary" onClick={() => { downloadSearch(run.resultJson); }}>{t('generator.downloadRun')}</button>
        <button type="button" className="button button-secondary" disabled={check.status === 'running'} onClick={reproduce}>{t('generator.reproduce')}</button>
        <button type="button" className="button button-quiet link-danger" disabled={busy} onClick={() => { setConfirming(true); }}>{t('generator.removeRun')}</button>
      </div>
      <div role="status" className="generator-run-check">
        {check.status === 'running' && <>
          <label htmlFor={`progress-${run.id}`}>{t('generator.reproducing', { done: formatNumber(check.progress.completed), total: formatNumber(check.progress.total) })}</label>
          <progress id={`progress-${run.id}`} max={check.progress.total} value={check.progress.completed} />
          <button type="button" className="button button-secondary" onClick={() => { controller.current?.abort(); }}>{t('generator.reproduceCancel')}</button>
        </>}
        {check.status === 'done' && <>
          <p className="status-message" data-state={check.result.status === 'different' ? 'error' : 'success'}>
            {check.result.status === 'identical' ? t('generator.identical') : check.result.status === 'equivalent' ? t('generator.equivalent')
              : differences.length === 1 ? t('generator.differentOne') : t('generator.different', { count: differences.length })}
          </p>
          {differences.length > 0 && <details className="disclosure"><summary>{t('generator.differentPaths')}</summary>
            <ul className="generator-run-paths">{differences.map((path) => <li key={path}><code>{path}</code></li>)}</ul>
          </details>}
        </>}
        {check.status === 'cancelled' && <p className="status-message">{t('generator.reproduceCancelled')}</p>}
        {check.status === 'failed' && <p className="status-message" data-state="error">{t('generator.reproduceFailed')}</p>}
      </div>
      {confirming && <div className="project-confirm" role="group" aria-label={t('generator.removeQuestion', { seed: parameters.seed })}>
        <p><strong>{t('generator.removeQuestion', { seed: parameters.seed })}</strong></p>
        <p className="field-help">{t('generator.removeNote')}</p>
        <div className="actions">
          <button type="button" className="button button-secondary" autoFocus onClick={() => { setConfirming(false); }}>{t('generator.removeKeep')}</button>
          <button type="button" className="button button-danger" disabled={busy} onClick={() => { setConfirming(false); onRemove(); }}>{t('generator.removeConfirm')}</button>
        </div>
      </div>}
    </article>
  );
}

/** Searches saved in the project open in Analyze, where this build offers them. */
export function SavedRuns() {
  return useGeneratorHistoryMode() === 'ready' ? <SavedRunsSection /> : null;
}

function SavedRunsSection() {
  const { t } = useTranslation();
  const projects = useProjects();
  const kilobytes = useKilobytes();
  const [attempt, setAttempt] = useState<number | null>(null);
  const active = projects.active;
  const history = active?.workspace.generatorHistory;
  const runs = history ? generatorHistoryRuns(history) : [];
  return (
    <section className="section generator-saved-runs" aria-labelledby={SAVED_RUNS_ID}>
      <div className="section-header">
        <h2 id={SAVED_RUNS_ID} tabIndex={-1}>{t('generator.historyTitle')}</h2>
        {active && <p className="generator-usage">{t('generator.usage', { runs: runs.length, maximum: H.maxRuns, used: kilobytes(encoder.encode(history?.documentJson ?? '').byteLength), limit: kilobytes(H.maxDocumentBytes) })}</p>}
      </div>
      {!active ? <p>{t('generator.historyNoProject')}</p> : <>
        <p>{t('generator.historyProject', { project: active.name })} {t('generator.historyIntro')}</p>
        <p className="field-help">{t('generator.reproduceNote')}</p>
        <HistoryFeedback attempt={attempt} success={t('generator.removed')} />
        {runs.length ? <div className="generator-runs">
          {runs.map((run) => <SavedRun key={run.id} run={run} busy={projects.busy} onRemove={() => { setAttempt(projects.attempt + 1); void projects.removeGeneratorRun(run.id); }} />)}
        </div> : <p className="field-help">{t('generator.historyEmpty')}</p>}
      </>}
    </section>
  );
}
