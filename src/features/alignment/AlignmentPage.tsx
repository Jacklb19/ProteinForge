import { useEffect, useRef, useState } from 'react';
import { validateSequence } from '../editor/sequence';
import { useTranslation } from '../../i18n';
import { MAX_ALIGNMENT_RESIDUES } from './wavefront';
import type { AlignmentMode, AlignmentResult, MatrixName } from './gotoh';
import type { AlignmentRequest, AlignmentResponse } from './messages';
import { AlignmentBlocks } from './AlignmentBlocks';

type Status = 'idle' | 'running' | 'cancelled' | 'error';

/** Starts cancellable alignments and displays reproducible results. */
export function AlignmentPage(): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [matrix, setMatrix] = useState<MatrixName>('BLOSUM62');
  const [mode, setMode] = useState<AlignmentMode>('global');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<AlignmentResult | null>(null);
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    try {
      const instance = new Worker(new URL('./alignment.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<AlignmentResponse>) => {
        const response = event.data;
        if (response.id !== requestId.current) return;
        if (response.type === 'progress') setProgress(response.fraction);
        if (response.type === 'result') { setResult(response.result); setStatus('idle'); }
        if (response.type === 'cancelled') setStatus('cancelled');
        if (response.type === 'error') { setMessage(t('alignment.workerError')); setStatus('error'); }
      };
      instance.onerror = () => { setMessage(t('alignment.workerError')); setStatus('error'); };
    } catch {
      queueMicrotask(() => { setMessage(t('alignment.workerStartError')); setStatus('error'); });
    }
    return () => { worker.current?.terminate(); worker.current = null; };
  }, [t]);

  function start(): void {
    const a = validateSequence(first);
    const b = validateSequence(second);
    if (a.invalidPositions.length > 0 || b.invalidPositions.length > 0) { setMessage(t('alignment.invalid')); return; }
    if (!a.sequence || !b.sequence) { setMessage(t('alignment.empty')); return; }
    if (a.sequence.length > MAX_ALIGNMENT_RESIDUES || b.sequence.length > MAX_ALIGNMENT_RESIDUES) {
      setMessage(t('alignment.limit', { count: formatNumber(MAX_ALIGNMENT_RESIDUES) }));
      return;
    }
    if (!worker.current) { setMessage(t('alignment.workerStartError')); return; }
    const nextWarnings: string[] = [];
    if (a.sequence.includes('U') || b.sequence.includes('U')) nextWarnings.push(t('alignment.warningU'));
    if (a.sequence.includes('O') || b.sequence.includes('O')) nextWarnings.push(t('alignment.warningO'));
    setWarnings(nextWarnings);
    setResult(null);
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

  const percent = result && result.columns > 0 ? result.identities / result.columns : 0;
  const similarityPercent = result && result.columns > 0 ? result.similarities / result.columns : 0;
  return (
    <main className="alignment-page">
      <h1>{t('alignment.title')}</h1>
      <p>{t('alignment.introduction')}</p>
      <label htmlFor="alignment-first">{t('alignment.first')}</label>
      <textarea id="alignment-first" value={first} onChange={(event) => { setFirst(event.target.value); }} />
      <label htmlFor="alignment-second">{t('alignment.second')}</label>
      <textarea id="alignment-second" value={second} onChange={(event) => { setSecond(event.target.value); }} />
      <label htmlFor="alignment-mode">{t('alignment.mode')}</label>
      <select id="alignment-mode" value={mode} onChange={(event) => { setMode(event.target.value as AlignmentMode); }}>
        <option value="global">{t('alignment.global')}</option>
        <option value="local">{t('alignment.local')}</option>
      </select>
      <label htmlFor="alignment-matrix">{t('alignment.matrix')}</label>
      <select id="alignment-matrix" value={matrix} onChange={(event) => { setMatrix(event.target.value as MatrixName); }}>
        <option value="BLOSUM45">{t('alignment.matrix45')}</option>
        <option value="BLOSUM62">{t('alignment.matrix62')}</option>
        <option value="BLOSUM80">{t('alignment.matrix80')}</option>
      </select>
      <div className="alignment-actions">
        <button type="button" onClick={start} disabled={status === 'running'}>{t('alignment.start')}</button>
        <button type="button" onClick={cancel} disabled={status !== 'running'}>{t('alignment.cancel')}</button>
      </div>
      <div role="status" aria-live="polite">
        {message || (status === 'running' && t('alignment.running', { percent: formatNumber(progress, { style: 'percent', maximumFractionDigits: 0 }) })) || (status === 'cancelled' && t('alignment.cancelled'))}
      </div>
      {warnings.map((warning) => <p key={warning} role="note">{warning}</p>)}
      {result && (
        <section aria-labelledby="alignment-result-title" className="alignment-result">
          <h2 id="alignment-result-title">{t('alignment.result')}</h2>
          <p>{t('alignment.score', { score: formatNumber(result.score) })}</p>
          <p>{t('alignment.identities', { count: formatNumber(result.identities), total: formatNumber(result.columns), percent: formatNumber(percent, { style: 'percent', maximumFractionDigits: 1 }) })}</p>
          <p>{t('alignment.similarities', { count: formatNumber(result.similarities), total: formatNumber(result.columns), percent: formatNumber(similarityPercent, { style: 'percent', maximumFractionDigits: 1 }) })}</p>
          <p>{t('alignment.parameters', {
            matrix: result.parameters.matrix,
            mode: t(result.parameters.mode === 'global' ? 'alignment.global' : 'alignment.local'),
            open: formatNumber(result.parameters.gapOpen),
            extend: formatNumber(result.parameters.gapExtend),
            ends: t(result.parameters.terminalGaps === 'free' ? 'alignment.freeEnds' : 'alignment.localEnds'),
          })}</p>
          <p>{t('alignment.legend')}</p>
          <AlignmentBlocks result={result} />
        </section>
      )}
    </main>
  );
}
