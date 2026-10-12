import { useEffect, useMemo, useRef, useState } from 'react';
import { validateSequence } from '../editor/sequence';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useTranslation } from '../../i18n';
import {
  ALIGNMENT_MODES, MATRIX_NAMES, MAX_ALIGNMENT_RESIDUES, MODE_LABEL_KEYS, PERCENT_FORMAT, PROGRESS_FORMAT, SCORING_SUBSTITUTIONS,
  TERMINAL_GAP_LABEL_KEYS,
} from './config';
import type { AlignmentRequest, AlignmentResponse } from './messages';
import { AlignmentBlocks } from './AlignmentBlocks';
import { useAlignmentDraft } from './alignmentDraft';
import type { AlignmentInput } from './alignmentDraft';
import { countGapColumns, isStaleResult } from './alignmentSummary';
import { PageHeading } from '../../shared/PageHeading';
import { SegmentedControl } from '../../shared/SegmentedControl';

type Status = 'idle' | 'running' | 'cancelled' | 'error';

/** Starts cancellable alignments and displays reproducible results. */
export function AlignmentPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const draft = useAlignmentDraft();
  const { first, second, matrix, mode, result, resultInput, warnings, update } = draft;
  const analysis = useSequenceDraft();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const pendingInput = useRef<AlignmentInput | null>(null);
  const analysisSequence = useMemo(() => validateSequence(analysis.text).sequence, [analysis.text]);

  useEffect(() => {
    try {
      const instance = new Worker(new URL('./alignment.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<AlignmentResponse>) => {
        const response = event.data;
        if (response.id !== requestId.current) return;
        if (response.type === 'progress') setProgress(response.fraction);
        if (response.type === 'result') {
          update({ result: response.result, resultInput: pendingInput.current });
          setStatus('idle');
        }
        if (response.type === 'cancelled') setStatus('cancelled');
        if (response.type === 'error') { setMessage(t('alignment.workerError')); setStatus('error'); }
      };
      instance.onerror = () => { setMessage(t('alignment.workerError')); setStatus('error'); };
    } catch {
      queueMicrotask(() => { setMessage(t('alignment.workerStartError')); setStatus('error'); });
    }
    return () => { worker.current?.terminate(); worker.current = null; };
  }, [t, update]);

  const a = validateSequence(first);
  const b = validateSequence(second);
  const currentInput: AlignmentInput = { first: a.sequence, second: b.sequence, matrix, mode };

  function start(): void {
    if (a.invalidPositions.length > 0 || b.invalidPositions.length > 0) { setMessage(t('alignment.invalid')); return; }
    if (!a.sequence || !b.sequence) { setMessage(t('alignment.empty')); return; }
    if (a.sequence.length > MAX_ALIGNMENT_RESIDUES || b.sequence.length > MAX_ALIGNMENT_RESIDUES) {
      setMessage(t('alignment.limit', { count: formatNumber(MAX_ALIGNMENT_RESIDUES) }));
      return;
    }
    if (!worker.current) { setMessage(t('alignment.workerStartError')); return; }
    const nextWarnings = SCORING_SUBSTITUTIONS
      .filter(({ residue }) => a.sequence.includes(residue) || b.sequence.includes(residue))
      .map(({ warningKey }) => t(warningKey));
    pendingInput.current = currentInput;
    update({ warnings: nextWarnings, result: null, resultInput: null });
    setMessage('');
    setProgress(0);
    setStatus('running');
    const request: AlignmentRequest = { type: 'start', id: ++requestId.current, first: a.sequence, second: b.sequence, matrix, mode };
    worker.current.postMessage(request);
  }

  function cancel(): void {
    if (!worker.current || status !== 'running') return;
    const request: AlignmentRequest = { type: 'cancel', id: requestId.current };
    worker.current.postMessage(request);
  }

  const ratio = (count: number, total: number) => t('alignment.ratio', {
    count: formatNumber(count),
    total: formatNumber(total),
    percent: formatNumber(total > 0 ? count / total : 0, PERCENT_FORMAT),
  });
  const residueCount = (sequence: string) => sequence.length > 0
    ? t(sequence.length === 1 ? 'editor.residueCountOne' : 'editor.residueCount', { count: formatNumber(sequence.length) })
    : '';
  const stale = result !== null && isStaleResult(resultInput, currentInput);

  return (
    <main className="page alignment-page">
      <PageHeading titleKey="alignment.title" introduction="alignment.introduction" />
      {!first && !second && <p className="analysis-ready">{t('guide.comparisonEmpty')}</p>}
      <section className="alignment-inputs card" aria-labelledby="alignment-inputs-title">
        <h2 id="alignment-inputs-title" className="visually-hidden">{t('alignment.inputs')}</h2>
        <div className="sequence-pair">
          <div className="field">
            <div className="field-header">
              <label htmlFor="alignment-first">{t('alignment.first')}</label>
              <span className="field-meta">{residueCount(a.sequence)}</span>
            </div>
            <textarea id="alignment-first" spellCheck={false} value={first} onChange={(event) => { update({ first: event.target.value }); }} />
            {analysisSequence.length > 0 && analysisSequence !== a.sequence && (
              <button className="button button-quiet" type="button" onClick={() => { update({ first: analysisSequence }); }}>{t('alignment.useAnalysis')}</button>
            )}
          </div>
          <div className="field">
            <div className="field-header">
              <label htmlFor="alignment-second">{t('alignment.second')}</label>
              <span className="field-meta">{residueCount(b.sequence)}</span>
            </div>
            <textarea id="alignment-second" spellCheck={false} value={second} onChange={(event) => { update({ second: event.target.value }); }} />
          </div>
        </div>
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
        <p className="field-help">{t('guide.comparisonHelp')}</p>
        <p className="field-help">{t('alignment.limit', { count: formatNumber(MAX_ALIGNMENT_RESIDUES) })}</p>
        <div className="alignment-actions">
          <button className="button button-primary" type="button" onClick={start} disabled={status === 'running'}>{t('alignment.start')}</button>
          {status === 'running' && <button className="button button-secondary" type="button" onClick={cancel}>{t('alignment.cancel')}</button>}
        </div>
        {status === 'running' && <progress className="alignment-progress" max={1} value={progress} aria-label={t('alignment.progress')} />}
        <div className="status-message" data-state={message ? 'error' : status} role="status" aria-live="polite">
          {message || (status === 'running' && t('alignment.running', { percent: formatNumber(progress, PROGRESS_FORMAT) })) || (status === 'cancelled' && t('alignment.cancelled'))}
        </div>
        {warnings.map((warning) => <p className="notice" key={warning} role="note">{warning}</p>)}
      </section>
      {result && (
        <section aria-labelledby="alignment-result-title" className={`alignment-result${stale ? ' is-stale' : ''}`}>
          <h2 id="alignment-result-title">{t('alignment.result')}</h2>
          {stale && <p className="notice" role="note">{t('alignment.stale')}</p>}
          <dl className="property-list summary-list">
            <div className="property"><dt>{t('alignment.score')}</dt><dd>{formatNumber(result.score)}</dd></div>
            <div className="property"><dt>{t('alignment.identity')}</dt><dd>{ratio(result.identities, result.columns)}</dd></div>
            <div className="property"><dt>{t('alignment.similarity')}</dt><dd>{ratio(result.similarities, result.columns)}</dd></div>
            <div className="property"><dt>{t('alignment.gaps')}</dt><dd>{ratio(countGapColumns(result), result.columns)}</dd></div>
          </dl>
          <p className="field-help">{t('alignment.parameters', {
            matrix: result.parameters.matrix,
            mode: t(MODE_LABEL_KEYS[result.parameters.mode]),
            open: formatNumber(result.parameters.gapOpen),
            extend: formatNumber(result.parameters.gapExtend),
            ends: t(TERMINAL_GAP_LABEL_KEYS[result.parameters.terminalGaps]),
          })}</p>
          <p className="field-help">{t('alignment.legend')}</p>
          <AlignmentBlocks result={result} />
        </section>
      )}
    </main>
  );
}
