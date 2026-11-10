import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from '../../i18n';
import type { LocalizedText } from '../../i18n/localized';
import { AlignmentMapKey } from './AlignmentMap';
import {
  BLOCK_COLUMNS, BLOCK_COLUMNS_NARROW, MULTIPLE_MAX_RESIDUES, MULTIPLE_MAX_SEQUENCES, MULTIPLE_MIN_SEQUENCES, NARROW_BLOCK_QUERY, PROGRESS_FORMAT,
} from './config';
import type { MatrixName } from './config';
import type { MultipleAlignment as Aligned, MultipleEntry } from './multiple';
import { readEntries } from './multipleInput';
import type { MultipleProblem } from './multipleInput';
import type { MultipleRequest, MultipleResponse } from './multiple.worker';

function useNarrow(): boolean {
  return useSyncExternalStore(
    (listener) => { const query = window.matchMedia(NARROW_BLOCK_QUERY); query.addEventListener('change', listener); return () => { query.removeEventListener('change', listener); }; },
    () => window.matchMedia(NARROW_BLOCK_QUERY).matches,
  );
}

/** The aligned rows in blocks that fit the screen, each row led by its number in the list of names. */
export function MultipleRows({ result }: { result: Aligned }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const width = useNarrow() ? BLOCK_COLUMNS_NARROW : BLOCK_COLUMNS;
  const starts = Array.from({ length: Math.ceil(result.columns / width) }, (_, block) => block * width);
  return <div className="multiple-rows">
    <ol className="multiple-names">
      {result.rows.map((row, index) => <li key={`${String(index)}-${row.name}`}>{row.name}{index === result.center && <> · {t('multiple.centre')}</>}</li>)}
    </ol>
    {starts.map(start => (
      <pre key={start} className="multiple-block" aria-label={t('multiple.block', { start: formatNumber(start + 1), end: formatNumber(Math.min(start + width, result.columns)) })}>
        {result.rows.map((row, index) => `${String(index + 1)} ${row.aligned.slice(start, start + width)}`).join('\n')}
      </pre>
    ))}
  </div>;
}

/**
 * Under Compare: three to eight sequences aligned together. It starts from the pair already being compared,
 * so adding one more record is enough. The calculation runs in its own Worker; cancelling ends that Worker.
 */
export function MultipleAlignment({ initial, matrix }: { initial: readonly MultipleEntry[]; matrix: MatrixName }): React.JSX.Element {
  const { t, formatNumber, localize } = useTranslation();
  const [text, setText] = useState(() => initial.filter(entry => entry.sequence).map(entry => `>${entry.name}\n${entry.sequence}`).join('\n'));
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<LocalizedText | null>(null);
  const [problem, setProblem] = useState<MultipleProblem | null>(null);
  const [result, setResult] = useState<{ input: string; data: Aligned } | null>(null);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const stop = (): void => { worker.current?.terminate(); worker.current = null; };
  useEffect(() => stop, []);

  const start = (): void => {
    const read = readEntries(text);
    setProblem(read.problem);
    setFailure(null);
    if (read.problem) return;
    stop();
    let instance: Worker;
    try { instance = new Worker(new URL('./multiple.worker.ts', import.meta.url), { type: 'module' }); }
    catch { setStatus('error'); setFailure({ key: 'alignment.workerError' }); return; }
    worker.current = instance;
    const id = ++request.current;
    instance.onmessage = (event: MessageEvent<MultipleResponse>) => {
      const response = event.data;
      if (response.id !== request.current) return;
      if (response.type === 'progress') { setProgress(response.fraction); return; }
      if (response.type === 'result') { setResult({ input: text, data: response.result }); setStatus('idle'); }
      else { setFailure(response.message); setStatus('error'); }
      stop();
    };
    instance.onerror = () => { setFailure({ key: 'alignment.workerError' }); setStatus('error'); stop(); };
    setProgress(0);
    setStatus('running');
    const message: MultipleRequest = { id, entries: read.entries, matrix };
    instance.postMessage(message);
  };
  const cancel = (): void => { request.current += 1; stop(); setStatus('idle'); };

  const message = problem === null ? (failure ? localize(failure) : '')
    : problem.kind === 'format' ? t('multiple.problemFormat')
      : problem.kind === 'count' ? t('multiple.problemCount', { count: formatNumber(problem.count), min: formatNumber(MULTIPLE_MIN_SEQUENCES), max: formatNumber(MULTIPLE_MAX_SEQUENCES) })
        : t(problem.kind === 'invalid' ? 'multiple.problemInvalid' : problem.kind === 'empty' ? 'multiple.problemEmpty' : 'multiple.problemLength', { name: problem.name, max: formatNumber(MULTIPLE_MAX_RESIDUES) });
  const shown = result?.data ?? null;
  const stale = result !== null && result.input !== text;
  return (
    <details className="disclosure multiple-alignment">
      <summary>{t('multiple.title')}</summary>
      <div className="field">
        <label htmlFor="multiple-input">{t('multiple.label')}</label>
        <textarea id="multiple-input" spellCheck={false} autoCapitalize="characters" aria-describedby="multiple-help multiple-status" aria-invalid={problem !== null}
          value={text} onChange={(event) => { setText(event.target.value); setProblem(null); }} />
        <p id="multiple-help" className="field-help">{t('multiple.help', { min: formatNumber(MULTIPLE_MIN_SEQUENCES), max: formatNumber(MULTIPLE_MAX_SEQUENCES), residues: formatNumber(MULTIPLE_MAX_RESIDUES) })}</p>
      </div>
      <div className="actions">
        {status === 'running' && <button type="button" className="button button-secondary" onClick={cancel}>{t('alignment.cancel')}</button>}
        <button type="button" className="button button-primary" disabled={status === 'running'} onClick={start}>{t('multiple.start')}</button>
      </div>
      {status === 'running' && <progress className="alignment-progress" max={1} value={progress} aria-label={t('alignment.progress')} />}
      {/* Present only while it has something to say: the page keeps a single live status of its own. */}
      {(message || status === 'running') && <p id="multiple-status" className="status-message" data-state={message ? 'error' : undefined} role="status">
        {message || t('multiple.running', { progress: formatNumber(progress, PROGRESS_FORMAT) })}
      </p>}
      {shown && <section className={`multiple-result${stale ? ' is-stale' : ''}`} aria-label={t('multiple.result')}>
        {stale && <p className="notice" role="note">{t('alignment.stale')}</p>}
        <p className="verdict">{t('multiple.verdict', { count: formatNumber(shown.identical), total: formatNumber(shown.columns), sequences: formatNumber(shown.rows.length) })}</p>
        <div className="alignment-map" style={{ '--ribbon-columns': shown.columns } as React.CSSProperties}>
          <div className="map-row" role="img" aria-label={t('multiple.mapLabel')}>
            {shown.kinds.map((kind, index) => <span key={index} data-kind={kind} />)}
          </div>
        </div>
        <AlignmentMapKey />
        <MultipleRows result={shown} />
        <p className="field-help">{t('multiple.method', { matrix: shown.matrix })}</p>
      </section>}
    </details>
  );
}
