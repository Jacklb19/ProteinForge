import { useCallback, useEffect, useMemo, useState } from 'react';
import { validateSequence } from '../editor/sequence';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { annotationsForAccession } from '../editor/annotations';
import { useTranslation } from '../../i18n';
import {
  ALIGNMENT_MODES, MATRIX_NAMES, MAX_ALIGNMENT_RESIDUES, MODE_LABEL_KEYS, PERCENT_FORMAT, PROGRESS_FORMAT, SCORING_SUBSTITUTIONS,
  TERMINAL_GAP_LABEL_KEYS,
} from './config';
import { AlignmentBlocks } from './AlignmentBlocks';
import { AlignmentMap, AlignmentMapKey } from './AlignmentMap';
import { useAlignmentDraft } from './alignmentDraft';
import type { AlignmentInput } from './alignmentDraft';
import { countGapColumns, isStaleResult } from './alignmentSummary';
import { changesInside } from './columns';
import { isExampleInput, referenceFor } from './examples';
import type { AlignmentResult } from './gotoh';
import { useAlignmentWorker } from './useAlignmentWorker';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';
import { SegmentedControl } from '../../shared/SegmentedControl';
import { ProjectControls } from '../projects/ProjectControls';
import { ReportActions } from '../reports/ReportActions';

const PROJECT_PANEL_ID = 'project-panel';

/** Two sequences side by side: what they share, where they part, and the residues behind each difference. */
export function AlignmentPage(): React.JSX.Element {
  const { t, formatNumber, locale } = useTranslation();
  const draft = useAlignmentDraft();
  const { first, second, matrix, mode, result, resultInput, warnings, update } = draft;
  const analysis = useSequenceDraft();
  const [message, setMessage] = useState('');
  const [projectOpen, setProjectOpen] = useState(false);
  const analysisSequence = useMemo(() => validateSequence(analysis.text).sequence, [analysis.text]);
  const receive = useCallback((next: AlignmentResult, input: AlignmentInput) => { update({ result: next, resultInput: input }); }, [update]);
  const worker = useAlignmentWorker(receive);
  const { start: startWorker } = worker;

  const a = validateSequence(first);
  const b = validateSequence(second);
  const currentInput: AlignmentInput = useMemo(() => ({ first: a.sequence, second: b.sequence, matrix, mode }), [a.sequence, b.sequence, matrix, mode]);

  // The untouched example opens already aligned: the real worker runs it once on arrival.
  const openExample = result === null && isExampleInput(currentInput);
  useEffect(() => { if (openExample) startWorker(currentInput); }, [openExample, startWorker, currentInput]);

  function start(): void {
    if (a.invalidPositions.length > 0 || b.invalidPositions.length > 0) { setMessage(t('alignment.invalid')); return; }
    if (!a.sequence || !b.sequence) { setMessage(t('alignment.empty')); return; }
    if (a.sequence.length > MAX_ALIGNMENT_RESIDUES || b.sequence.length > MAX_ALIGNMENT_RESIDUES) {
      setMessage(t('alignment.limit', { count: formatNumber(MAX_ALIGNMENT_RESIDUES) }));
      return;
    }
    const nextWarnings = SCORING_SUBSTITUTIONS
      .filter(({ residue }) => a.sequence.includes(residue) || b.sequence.includes(residue))
      .map(({ warningKey }) => warningKey);
    update({ warnings: nextWarnings, result: null, resultInput: null });
    setMessage(startWorker(currentInput) ? '' : t('alignment.workerStartError'));
  }

  const status = worker.status;
  const failure = status === 'error' ? t('alignment.workerError') : status === 'unavailable' ? t('alignment.workerStartError') : '';
  const percent = (count: number, total: number): string => formatNumber(total > 0 ? count / total : 0, PERCENT_FORMAT);
  const residueCount = (sequence: string): string => sequence.length > 0
    ? t(sequence.length === 1 ? 'editor.residueCountOne' : 'editor.residueCount', { count: formatNumber(sequence.length) })
    : '';
  const stale = result !== null && isStaleResult(resultInput, currentInput);
  const firstReference = referenceFor(a.sequence);
  const secondReference = referenceFor(b.sequence);
  const firstName = firstReference ? t(firstReference.label) : t('alignment.first');
  const secondName = secondReference ? t(secondReference.label) : t('alignment.second');
  // A name that starts with a capitalized word (not an acronym) drops the capital in the middle of the title.
  const midSentence = (name: string): string => (/^\p{Lu}\p{Ll}/u.test(name) ? name.charAt(0).toLocaleLowerCase(locale) + name.slice(1) : name);
  const title = firstReference && secondReference ? t('alignment.pairTitle', { first: firstName, second: midSentence(secondName) }) : t('alignment.title');
  const meta = [firstReference?.accession, residueCount(a.sequence)].filter(Boolean).join(', ') || t('alignment.introduction');
  const metaSecond = [secondReference?.accession, residueCount(b.sequence)].filter(Boolean).join(', ');
  // Region notes describe the first sequence, so they only apply to the result computed from it.
  const annotations = result && !stale && firstReference ? annotationsForAccession(firstReference.accession) : null;
  const mature = annotations ? annotations.regions.filter((region) => region.mature) : [];
  const changes = result && annotations && mature.length > 0 ? changesInside(result, mature) : null;
  const gaps = result ? countGapColumns(result) : 0;

  return (
    <main className="page alignment-page">
      <header className="page-head">
        <div className="page-head-text">
          <p className="page-kicker">{t('nav.alignment')}</p>
          <h1>{title}</h1>
          <p className="page-purpose">{t('alignment.purpose')}</p>
          <p className="page-meta">{[isExampleInput(currentInput) ? t('editor.exampleTag') : '', meta, metaSecond].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="toolbar">
          <button className="button button-secondary" type="button" aria-expanded={projectOpen} aria-controls={PROJECT_PANEL_ID} onClick={() => { setProjectOpen((current) => !current); }}>{t('projects.save')}</button>
          <ReportActions />
        </div>
      </header>
      {projectOpen && <section id={PROJECT_PANEL_ID} className="tool-panel" aria-labelledby="project-panel-title"><ProjectControls /></section>}

      <section className="section alignment-inputs" aria-labelledby="alignment-inputs-title">
        <h2 id="alignment-inputs-title" className="visually-hidden">{t('alignment.inputs')}</h2>
        <div className="sequence-pair">
          <div className="field">
            <div className="field-header">
              <label htmlFor="alignment-first">{firstName}</label>
              <span className="field-meta">{residueCount(a.sequence)}</span>
            </div>
            <textarea id="alignment-first" spellCheck={false} value={first} onChange={(event) => { update({ first: event.target.value }); }} />
            {analysisSequence.length > 0 && analysisSequence !== a.sequence && (
              <button className="button button-quiet" type="button" onClick={() => { update({ first: analysisSequence }); }}>{t('alignment.useAnalysis')}</button>
            )}
          </div>
          <div className="field">
            <div className="field-header">
              <label htmlFor="alignment-second">{secondName}</label>
              <span className="field-meta">{residueCount(b.sequence)}</span>
            </div>
            <textarea id="alignment-second" spellCheck={false} value={second} onChange={(event) => { update({ second: event.target.value }); }} />
          </div>
        </div>
        <div className="comparison-controls">
        <details className="disclosure comparison-advanced">
          <summary>{t('workbench.compareParameters')}</summary>
          <p className="field-help">{t('workbench.compareHelp')}</p>
        <div className="alignment-parameters">
          <SegmentedControl
            legend={t('alignment.mode')}
            options={ALIGNMENT_MODES.map((value) => ({ value, label: t(MODE_LABEL_KEYS[value]) }))}
            value={mode}
            onChange={(value) => { update({ mode: value }); }}
          />
          <SegmentedControl
            legend={t('alignment.matrix')}
            options={MATRIX_NAMES.map((value) => ({ value, label: value }))}
            value={matrix}
            onChange={(value) => { update({ matrix: value }); }}
          />
        </div>
        </details>
          <div className="alignment-actions">
            {status === 'running' && <button className="button button-secondary" type="button" onClick={worker.cancel}>{t('alignment.cancel')}</button>}
            <button className="button button-primary" type="button" onClick={start} disabled={status === 'running'}>{t('alignment.start')}</button>
          </div>
        </div>
        {status === 'running' && <progress className="alignment-progress" max={1} value={worker.progress} aria-label={t('alignment.progress')} />}
        <div className="status-message" data-state={message || failure ? 'error' : status} role="status" aria-live="polite">
          {message || failure || (status === 'running' && t('alignment.running', { percent: formatNumber(worker.progress, PROGRESS_FORMAT) })) || (status === 'cancelled' && t('alignment.cancelled'))}
        </div>
        {warnings.map((warning) => <p className="notice" key={warning} role="note">{t(warning)}</p>)}
      </section>

      {result && (
        <div className={`alignment-result${stale ? ' is-stale' : ''}`}>
          <section className="section" aria-labelledby="alignment-result-title">
            <h2 id="alignment-result-title" className="visually-hidden">{t('alignment.result')}</h2>
            {stale && <p className="notice" role="note">{t('alignment.stale')}</p>}
            <p className="verdict">{t('alignment.verdict', { count: formatNumber(result.identities), total: formatNumber(result.columns) })}</p>
            {changes && <p className="verdict-note">{t('alignment.matureNote', { regions: mature.map((region) => t(region.labelKey)).join(t('alignment.regionJoin')), inside: formatNumber(changes.inside), outside: formatNumber(changes.outside) })}</p>}
            <dl className="figures">
              <div><dt>{t('alignment.identity')}</dt><dd>{percent(result.identities, result.columns)}</dd><dd className="figure-explanation">{t('workbench.identityHelp')}</dd></div>
              <div><dt>{t('alignment.similarity')}</dt><dd>{percent(result.similarities, result.columns)}</dd><dd className="figure-explanation">{t('workbench.similarityHelp')}</dd></div>
              <div><dt>{t('alignment.gaps')}</dt><dd>{formatNumber(gaps)}</dd></div>
              <div><dt>{t('alignment.score')}</dt><dd>{formatNumber(result.score)}</dd><dd className="figure-explanation">{t('workbench.scoreHelp')}</dd></div>
            </dl>
            <AlignmentMap result={result} annotations={annotations} label={t('alignment.mapLabel', { identical: formatNumber(result.identities), total: formatNumber(result.columns) })} />
            <AlignmentMapKey />
            <p className="field-help">{t('alignment.parameters', {
              matrix: result.parameters.matrix,
              mode: t(MODE_LABEL_KEYS[result.parameters.mode]),
              open: formatNumber(result.parameters.gapOpen),
              extend: formatNumber(result.parameters.gapExtend),
              ends: t(TERMINAL_GAP_LABEL_KEYS[result.parameters.terminalGaps]),
            })}</p>
          </section>
          <section className="section" aria-labelledby="alignment-blocks-title">
            <div className="section-header"><h2 id="alignment-blocks-title">{t('alignment.blocksTitle')}</h2><ChemistryLegend /></div>
            <AlignmentBlocks result={result} firstName={firstName} secondName={secondName} />
            <p className="field-help">{t('alignment.legend')}</p>
          </section>
        </div>
      )}
    </main>
  );
}
