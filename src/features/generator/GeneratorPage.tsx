import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { useGenerator, parseSearchForm } from './context';
import { GENERATOR_CONFIG as C } from './config';
import type { SearchArm } from './search';
import { residueClass } from '../chemistry/config';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';

/** RF17 searches only explicitly calculated properties; every output remains an academic candidate. */
export function GeneratorPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const generator = useGenerator(); const { form, result, status, progress } = generator;
  const sequence = useSequenceDraft(); const alignment = useAlignmentDraft(); const navigate = useNavigate();
  const [pending, setPending] = useState<{ sequence: string } | { compare: true } | null>(null);
  const { run } = generator;
  // The page opens on a finished search with the initial conditions instead of an empty form.
  useEffect(() => { if (result === null && status === 'idle') run(); }, [result, status, run]);
  const parsed = parseSearchForm(form);
  const stale = result !== null && (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(result.parameters));
  const busy = status === 'running';
  const unavailable = stale || busy;

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
  function download(): void {
    if (!result || unavailable) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = C.filename; link.click();
    setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
  }

  type NumericField = 'length' | 'budget' | 'seed' | 'gravyMinimum' | 'gravyMaximum' | 'massMinimum' | 'massMaximum';
  function numeric(key: NumericField, label: TranslationKey, minimum: number, maximum: number, step: number): React.JSX.Element {
    return (
      <label className="field" htmlFor={`generator-${key}`}>
        <span>{t(label)}</span>
        <input
          id={`generator-${key}`} className="text-input" type="number" inputMode={step === 1 ? 'numeric' : 'decimal'}
          min={minimum} max={maximum} step={step} value={form[key]} disabled={busy} required
          onChange={(event) => { generator.setForm({ [key]: event.target.value }); setPending(null); }}
        />
      </label>
    );
  }

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
      <PageHeading titleKey="generator.title" introduction="generator.introduction">
        <Link className="button button-primary" to={ROUTES.laboratory}>{t('lab.openLaboratory')}</Link>
      </PageHeading>

      <form className="section generator-form" onSubmit={(event) => { event.preventDefault(); setPending(null); generator.run(); }}>
        <h2>{t('generator.conditions')}</h2>
        <div className="generator-inputs">
          {numeric('length', 'generator.length', C.minLength, C.maxLength, 1)}
        </div>
        <details className="disclosure generator-advanced">
          <summary>{t('workbench.advanced')}</summary>
          <div className="generator-inputs">
          {numeric('budget', 'generator.budget', C.minBudget, C.maxBudget, 1)}
          {numeric('seed', 'generator.seed', 1, C.maxSeed, 1)}
          </div>
        </details>
        <p className="field-help">{t('generator.bounds')}</p>

        <div className="generator-targets">
          <fieldset>
            <legend>{t('generator.gravy')}</legend>
            <label className="checkbox-option">
              <input type="checkbox" checked={form.gravyEnabled} disabled={busy} onChange={(event) => { generator.setForm({ gravyEnabled: event.target.checked }); setPending(null); }} />
              <span>{t('generator.enableGravy')}</span>
            </label>
            <div className="generator-range">
              {numeric('gravyMinimum', 'generator.minimum', -4.5, 4.5, 0.01)}
              {numeric('gravyMaximum', 'generator.maximum', -4.5, 4.5, 0.01)}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('generator.mass')}</legend>
            <label className="checkbox-option">
              <input type="checkbox" checked={form.massEnabled} disabled={busy} onChange={(event) => { generator.setForm({ massEnabled: event.target.checked }); setPending(null); }} />
              <span>{t('generator.enableMass')}</span>
            </label>
            <div className="generator-range">
              {numeric('massMinimum', 'generator.minimum', 0.01, 100_000, 0.01)}
              {numeric('massMaximum', 'generator.maximum', 0.01, 100_000, 0.01)}
            </div>
          </fieldset>
        </div>

        <div className="actions">
          <button type="submit" className="button button-primary" disabled={busy}>{t('generator.run')}</button>
          {busy && <button type="button" className="button button-secondary" onClick={generator.cancel}>{t('generator.cancel')}</button>}
        </div>
        <p role="status" className="status-message" data-state={status === 'invalid' || status === 'error' ? 'error' : undefined}>{status === 'idle' ? '' : t(`generator.${status}`)}</p>
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
          {stale && <p role="status" className="status-message" data-state="error">{t('generator.stale')}</p>}

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
                    <td>{formatNumber(arm.evaluations)}</td>
                    <td>{formatNumber(arm.matchingEvaluations)}</td>
                    <td>{formatNumber(arm.bestLoss, { maximumFractionDigits: 4 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="field-help">{t('generator.metricsNote')}</p>
          <ChemistryLegend />
          <div className="candidate-columns">{candidates(result.guided, 'generator.guided')}{candidates(result.reference, 'generator.reference')}</div>

          <div className="actions">
            <button type="button" className="button button-secondary" disabled={unavailable} onClick={download}>{t('generator.download')}</button>
            <button type="button" className="button button-secondary" disabled={unavailable} onClick={() => { compare(); }}>{t('generator.compare')}</button>
          </div>

          {pending && !unavailable && (
            <div className="project-confirm" role="group" aria-label={t('generator.replace')}>
              <p>{t('generator.replace')}</p>
              <button type="button" className="button button-primary" onClick={() => { if ('sequence' in pending) analyze(pending.sequence, true); else compare(true); }}>{t('generator.confirm')}</button>
              <button type="button" className="button button-secondary" onClick={() => { setPending(null); }}>{t('generator.keep')}</button>
            </div>
          )}
        </section>
      )}

      <p className="field-help">{t('generator.scope')}</p>
      <details className="disclosure generator-method">
        <summary>{t('generator.methodTitle')}</summary>
        <p>{t('generator.methodText')}</p>
        <p className="field-help">{t('generator.retention')}</p>
      </details>
    </main>
  );
}
