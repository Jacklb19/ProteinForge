import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { useGenerator } from './context';
import { parseSearchForm, searchFormProblems } from './searchForm';
import { GENERATOR_FIELD_BOUNDS } from './config';
import type { GeneratorNumberField } from './config';
import type { SearchForm } from './context';
import type { SearchFormProblem } from './searchForm';
import type { SearchArm, SearchResult } from './search';
import { downloadSearch } from './download';
import { SavedRuns } from './GeneratorHistory';
import { useGeneratorSave } from './useGeneratorSave';
import { useSearchProjectPicker } from './SearchProjectPicker';
import { generatorHistoryRuns, sha256Text } from './history';
import { INITIAL_SEARCH_FORM } from './context';
import { useGeneratorHistoryMode } from './historyMode';
import { ProjectContext } from '../projects/projectContext';
import { SaveState } from '../projects/SaveState';
import type { SaveStateValue } from '../projects/draftSaveState';
import { residueClass } from '../chemistry/config';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';

const STATUS_ID = 'generator-status';
/** Where each field's message sits: under the field itself, under its range, or under both ranges. */
type MessageSpot = 'length' | 'budget' | 'seed' | 'gravy' | 'mass' | 'targets';
const SPOT: Record<keyof SearchForm, MessageSpot> = {
  length: 'length', budget: 'budget', seed: 'seed', gravyEnabled: 'targets', massEnabled: 'targets',
  gravyMinimum: 'gravy', gravyMaximum: 'gravy', massMinimum: 'mass', massMaximum: 'mass',
};
const spotOf = (problem: SearchFormProblem): MessageSpot => SPOT[problem.fields[0] ?? 'length'];
const messageId = (spot: MessageSpot): string => `generator-${spot}-message`;
const fieldId = (field: keyof SearchForm): string => `generator-${field}`;

/** The result's own actions; saving to a project sits next to the download of the same file. */
function ResultActions({ result, unavailable, onCompare }: { result: SearchResult; unavailable: boolean; onCompare: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const save = useGeneratorSave(result, unavailable);
  return (
    <>
      <div className="actions">
        <button type="button" className="button button-secondary" disabled={unavailable} onClick={() => { downloadSearch(JSON.stringify(result, null, 2)); }}>{t('generator.download')}</button>
        {save.button}
        <button type="button" className="button button-secondary" disabled={unavailable} onClick={onCompare}>{t('generator.compare')}</button>
      </div>
      {save.details}
    </>
  );
}

/**
 * Whether the search on screen is saved in Design's project: its identifier (the SHA-256 of the exported
 * JSON) is among that project's saved searches. The opening search with the initial conditions is the example.
 */
function useSearchSaveState(result: SearchResult | null): SaveStateValue | null {
  const { t } = useTranslation();
  const mode = useGeneratorHistoryMode();
  const projects = useContext(ProjectContext);
  const [id, setId] = useState<{ json: string; value: string } | null>(null);
  const json = result ? JSON.stringify(result, null, 2) : null;
  useEffect(() => {
    if (!json || mode !== 'ready') return;
    let current = true;
    void sha256Text(json).then((value) => { if (current) setId({ json, value }); });
    return () => { current = false; };
  }, [json, mode]);
  if (!result || mode !== 'ready') return null;
  const destination = projects?.searchProject;
  const runs = destination?.workspace.generatorHistory ? generatorHistoryRuns(destination.workspace.generatorHistory) : [];
  if (destination && id?.json === json && runs.some((run) => run.id === id.value)) return { kind: 'saved', project: destination.name };
  const initial = parseSearchForm(INITIAL_SEARCH_FORM);
  if (initial.success && JSON.stringify(initial.data) === JSON.stringify(result.parameters)) return { kind: 'example' };
  return { kind: 'unsaved', detail: t('saveState.searchUnsaved') };
}

/** RF17 searches only explicitly calculated properties; every output remains an academic candidate. */
export function GeneratorPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const generator = useGenerator(); const { form, result, status, progress } = generator;
  const sequence = useSequenceDraft(); const alignment = useAlignmentDraft(); const navigate = useNavigate();
  const [pending, setPending] = useState<{ sequence: string } | { compare: true } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const picker = useSearchProjectPicker();
  const saveState = useSearchSaveState(result);
  const { run } = generator;
  // The page opens on a finished search with the initial conditions instead of an empty form.
  useEffect(() => { if (result === null && status === 'idle') run(); }, [result, status, run]);
  const parsed = parseSearchForm(form);
  const stale = result !== null && (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(result.parameters));
  const busy = status === 'running';
  const unavailable = stale || busy;
  // A refused search names each problem next to its field and marks the fields involved.
  const problems = status === 'invalid' ? searchFormProblems(form) : [];
  const flagged = new Set(problems.flatMap((problem) => problem.fields));
  const invalidProps = (key: keyof SearchForm): { 'aria-invalid'?: true; 'aria-describedby'?: string } => flagged.has(key) ? { 'aria-invalid': true, 'aria-describedby': messageId(SPOT[key]) } : {};
  const advancedFlagged = flagged.has('budget') || flagged.has('seed');
  function messages(spot: MessageSpot): React.JSX.Element | null {
    const here = problems.filter((problem) => spotOf(problem) === spot);
    if (!here.length) return null;
    return (
      <p id={messageId(spot)} className="status-message generator-field-message" data-state="invalid">
        {here.map((problem) => t(problem.messageKey, {
          minimum: problem.bounds ? formatNumber(problem.bounds.minimum) : '', maximum: problem.bounds ? formatNumber(problem.bounds.maximum) : '',
        })).join(' ')}
      </p>
    );
  }
  function submit(event: React.SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault(); setPending(null); generator.run();
    // Focus goes to the first field to fix, once its message is on screen.
    const first = searchFormProblems(form)[0]?.fields[0];
    if (first) window.requestAnimationFrame(() => { document.getElementById(fieldId(first))?.focus(); });
  }

  function analyze(value: string, confirmed = false): void {
    if (sequence.text && sequence.text !== value && !confirmed) { setPending({ sequence: value }); return; }
    sequence.setText(value); sequence.setSource(null); setPending(null); void navigate(ROUTES.analyze);
  }
  function compare(confirmed = false): void {
    if ((alignment.first || alignment.second) && !confirmed) { setPending({ compare: true }); return; }
    const first = result?.guided.candidates[0]; const second = result?.reference.candidates[0];
    if (!first || !second) return;
    alignment.update({ first: first.sequence, second: second.sequence, result: null, resultInput: null, warnings: [] });
    setPending(null); void navigate(ROUTES.alignment);
  }

  function numeric(key: GeneratorNumberField, label: TranslationKey): React.JSX.Element {
    const { minimum, maximum, step } = GENERATOR_FIELD_BOUNDS[key];
    return (
      <label className="field" htmlFor={fieldId(key)}>
        <span>{t(label)}</span>
        <input
          id={fieldId(key)} className="text-input" type="number" inputMode={step === 1 ? 'numeric' : 'decimal'}
          min={minimum} max={maximum} step={step} value={form[key]} disabled={busy} required {...invalidProps(key)}
          onChange={(event) => { generator.setForm({ [key]: event.target.value }); setPending(null); }}
        />
      </label>
    );
  }
  /** A single field with its own message underneath. */
  const single = (key: 'length' | 'budget' | 'seed', label: TranslationKey): React.JSX.Element => <div className="generator-field">{numeric(key, label)}{messages(key)}</div>;

  function candidates(arm: SearchArm, label: TranslationKey): React.JSX.Element {
    return (
      <section className="candidate-arm" aria-label={t(label)}>
        <h3>{t(label)}</h3>
        <p className="field-help">
          {t(arm.candidates.length === 1 ? 'generator.diversityOne' : 'generator.diversity', {
            count: arm.candidates.length,
            distance: arm.minimumPairDistance === null ? t('generator.noPair') : formatNumber(arm.minimumPairDistance * 100, { maximumFractionDigits: 1 }),
          })}
        </p>
        <ol className="candidate-list">
          {arm.candidates.map((candidate) => (
            <li key={candidate.sequence}>
              <div className="section-header">
                <span className={`status-message ${candidate.satisfies ? '' : 'candidate-outside'}`}>{t(candidate.satisfies ? 'generator.matches' : 'generator.outside')}</span>
                <button type="button" className="button button-secondary" disabled={unavailable} onClick={() => { analyze(candidate.sequence); }}>{t('generator.analyze')}</button>
              </div>
              <span className="candidate-cells" style={{ '--ribbon-columns': candidate.sequence.length } as React.CSSProperties} aria-hidden="true">
                {Array.from(candidate.sequence, (residue, index) => <span key={index} className="residue" data-chem={residueClass(residue)}>{residue}</span>)}
              </span>
              <code className="visually-hidden">{candidate.sequence}</code>
              <p>
                {t('generator.properties', {
                  mass: formatNumber(candidate.descriptors.massDa, { maximumFractionDigits: 2 }),
                  gravy: formatNumber(candidate.descriptors.gravy, { maximumFractionDigits: 4 }),
                  loss: formatNumber(candidate.loss, { maximumFractionDigits: 4 }),
                })}
              </p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <main className="page generator-page">
      <PageHeading titleKey="generator.title" introduction="generator.introduction" note={<>
        {saveState && <p className="page-meta"><SaveState {...saveState} /></p>}
        {picker.note && <p>{picker.note}</p>}
      </>}>
        {picker.field}
        <Link className="button button-secondary" to={ROUTES.laboratory}>{t('lab.openLaboratory')}</Link>
      </PageHeading>
      {picker.panel}

      <form className="section generator-form" noValidate onSubmit={submit}>
        <h2>{t('generator.conditions')}</h2>
        <div className="generator-inputs">
          {single('length', 'generator.length')}
        </div>
        <details className="disclosure generator-advanced" open={advancedOpen || advancedFlagged} onToggle={(event) => { setAdvancedOpen(event.currentTarget.open); }}>
          <summary>{t('workbench.advanced')}</summary>
          <div className="generator-inputs">
          {single('budget', 'generator.budget')}
          {single('seed', 'generator.seed')}
          </div>
        </details>
        <p className="field-help">{t('generator.bounds')}</p>

        <div className="generator-targets">
          <fieldset>
            <legend>{t('generator.gravy')}</legend>
            <label className="checkbox-option">
              <input id={fieldId('gravyEnabled')} type="checkbox" checked={form.gravyEnabled} disabled={busy} {...invalidProps('gravyEnabled')} onChange={(event) => { generator.setForm({ gravyEnabled: event.target.checked }); setPending(null); }} />
              <span>{t('generator.enableGravy')}</span>
            </label>
            <div className="generator-range">
              {numeric('gravyMinimum', 'generator.minimum')}
              {numeric('gravyMaximum', 'generator.maximum')}
            </div>
            {messages('gravy')}
          </fieldset>
          <fieldset>
            <legend>{t('generator.mass')}</legend>
            <label className="checkbox-option">
              <input id={fieldId('massEnabled')} type="checkbox" checked={form.massEnabled} disabled={busy} {...invalidProps('massEnabled')} onChange={(event) => { generator.setForm({ massEnabled: event.target.checked }); setPending(null); }} />
              <span>{t('generator.enableMass')}</span>
            </label>
            <div className="generator-range">
              {numeric('massMinimum', 'generator.minimum')}
              {numeric('massMaximum', 'generator.maximum')}
            </div>
            {messages('mass')}
          </fieldset>
        </div>
        {messages('targets')}

        <div className="actions">
          <button type="submit" className="button button-primary" disabled={busy}>{t('generator.run')}</button>
          {busy && <button type="button" className="button button-secondary" onClick={generator.cancel}>{t('generator.cancel')}</button>}
        </div>
        <p id={STATUS_ID} role="status" className="status-message" data-state={status === 'invalid' || status === 'error' ? 'error' : undefined}>{status === 'idle' ? '' : t(`generator.${status}`)}</p>
        {progress && (
          <div className="generator-progress">
            <label htmlFor="generator-progress">{t('generator.progress', { done: progress.completed, total: progress.total })}</label>
            <progress id="generator-progress" max={progress.total} value={progress.completed} />
          </div>
        )}
      </form>

      {result && (
        <section className="section generator-results" aria-labelledby="generator-results">
          <h2 id="generator-results">{t('generator.results')}</h2>
          <p>{t('generator.runDetails', { seed: result.parameters.seed, budget: result.parameters.budget, length: result.parameters.length })}</p>
          {stale && <p role="status" className="notice">{t('generator.stale')}</p>}

          {/* Guided search is only meaningful against the reference arm of the same budget. */}
          <div className="generator-table" tabIndex={0} role="region" aria-label={t('generator.comparison')}>
            <table>
              <caption>{t('generator.comparison')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('generator.method')}</th>
                  <th scope="col">{t('generator.evaluations')}</th>
                  <th scope="col">{t('generator.matchingEvaluations')}</th>
                  <th scope="col">{t('generator.bestLoss')}</th>
                </tr>
              </thead>
              <tbody>
                {([['generator.guided', result.guided], ['generator.reference', result.reference]] as const).map(([label, arm]) => (
                  <tr key={label}>
                    <th scope="row">{t(label)}</th>
                    {/* On phones each row stacks and every figure carries its column name. */}
                    <td data-label={t('generator.evaluations')}>{formatNumber(arm.evaluations)}</td>
                    <td data-label={t('generator.matchingEvaluations')}>{formatNumber(arm.matchingEvaluations)}</td>
                    <td data-label={t('generator.bestLoss')}>{formatNumber(arm.bestLoss, { maximumFractionDigits: 4 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="field-help">{t('generator.metricsNote')}</p>
          <ChemistryLegend />
          <div className="candidate-columns">{candidates(result.guided, 'generator.guided')}{candidates(result.reference, 'generator.reference')}</div>

          <ResultActions result={result} unavailable={unavailable} onCompare={() => { compare(); }} />

          {pending && !unavailable && (
            <div className="project-confirm" role="group" aria-label={t('generator.replace')}>
              <p>{t('generator.replace')}</p>
              <button type="button" className="button button-primary" onClick={() => { if ('sequence' in pending) analyze(pending.sequence, true); else compare(true); }}>{t('generator.confirm')}</button>
              <button type="button" className="button button-secondary" onClick={() => { setPending(null); }}>{t('generator.keep')}</button>
            </div>
          )}
        </section>
      )}

      <SavedRuns />

      <p className="field-help">{t('generator.scope')}</p>
      <details className="disclosure generator-method">
        <summary>{t('generator.methodTitle')}</summary>
        <p>{t('generator.methodText')}</p>
        <p className="field-help">{t('generator.retention')}</p>
      </details>
    </main>
  );
}
