import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { captureWorkspace, workspaceInputKey } from '../projects/snapshot';
import { REPORT_FILENAMES, REPORT_TIMEOUT_MS } from './config';
import type { ReportFormat, ReportRequest, ReportResponse } from './reportMessages';

/** On-demand local Worker; obsolete exports are discarded if inputs change while generating. */
export function ReportActions({ children }: { children?: ReactNode }): React.JSX.Element | null {
  const { t, locale } = useTranslation();
  const sequence = useSequenceDraft(); const alignment = useAlignmentDraft();
  const [status, setStatus] = useState<'idle' | 'running' | 'error' | 'stale' | 'done'>('idle');
  const operation = useRef<{ worker: Worker; timer: number } | null>(null);
  const revision = useRef('');
  const inputKey = workspaceInputKey(sequence.text, alignment, sequence.profileWindow);
  useEffect(() => { revision.current = inputKey; }, [inputKey]);
  useEffect(() => () => { if (operation.current) { operation.current.worker.terminate(); clearTimeout(operation.current.timer); operation.current = null; } }, []);
  const available = sequence.text.length > 0 || alignment.result !== null;
  if (!available) return null;

  function finish(): void { if (operation.current) { operation.current.worker.terminate(); clearTimeout(operation.current.timer); operation.current = null; } }
  function start(format: ReportFormat): void {
    try {
      const snapshot = captureWorkspace(sequence.text, alignment, sequence.profileWindow, undefined, undefined, sequence.source);
      if (!snapshot.activeSequence && !snapshot.workspace.alignment.result) { setStatus('error'); return; }
      if (format === 'alignment' && !snapshot.workspace.alignment.result) { setStatus('stale'); return; }
      if (format === 'profile' && !snapshot.activeSequence) { setStatus('error'); return; }
      finish();
      const worker = new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' });
      const request: ReportRequest = { id: 1, format, locale, input: { ...snapshot, name: 'ProteinForge' } };
      const timer = window.setTimeout(() => { finish(); setStatus('error'); }, REPORT_TIMEOUT_MS);
      operation.current = { worker, timer }; setStatus('running');
      worker.onmessage = (event: MessageEvent<ReportResponse>) => {
        if (operation.current?.worker !== worker) return;
        finish();
        if (revision.current !== inputKey) { setStatus('stale'); return; }
        if (event.data.error) { setStatus('error'); return; }
        const url = URL.createObjectURL(event.data.blob);
        const link = document.createElement('a'); link.href = url; link.download = REPORT_FILENAMES[format]; link.click();
        setTimeout(() => { URL.revokeObjectURL(url); }, 0); setStatus('done');
      };
      worker.onerror = () => { if (operation.current?.worker === worker) { finish(); setStatus('error'); } };
      worker.postMessage(request);
    } catch { finish(); setStatus('error'); }
  }
  return <details className="toolbar-menu report-menu"><summary className="button button-secondary">{t('report.export')}</summary><div className="toolbar-popover">
    <button type="button" className="button" disabled={status === 'running'} onClick={() => { start('pdf'); }}>{t('report.pdf')}</button>
    <button type="button" className="button" disabled={status === 'running'} onClick={() => { start('json'); }}>{t('report.json')}</button>
    {sequence.text && <button type="button" className="button" disabled={status === 'running'} onClick={() => { start('profile'); }}>{t('report.profileCsv')}</button>}
    {alignment.result && <button type="button" className="button" disabled={status === 'running'} onClick={() => { start('alignment'); }}>{t('report.alignmentCsv')}</button>}
    {children}
    {status === 'running' && <button type="button" className="button" onClick={() => { finish(); setStatus('idle'); }}>{t('projects.cancel')}</button>}
    <p role="status" className="status-message" data-state={status === 'error' || status === 'stale' ? 'error' : undefined}>{status === 'idle' ? '' : t(`report.${status}`)}</p></div></details>;
}
