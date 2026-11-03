import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { useAlignmentDraft } from '../alignment/alignmentDraft';
import { ProjectContext } from '../projects/projectContext';
import { captureWorkspace, workspaceInputKey } from '../projects/snapshot';
import { REPORT_FILENAMES, REPORT_TIMEOUT_MS } from './config';
import type { ReportFormat, ReportRequest, ReportResponse } from './reportMessages';
import { SAVE_FORMATS } from './storage/config';
import type { ReportScreen } from './storage/config';
import { ReportSaveGroup } from './storage/ReportSaveGroup';
import { useReportSave } from './storage/useReportSave';
import type { PreparedReport } from './storage/useReportSave';
import { useSavedReports } from './storage/useSavedReports';

/**
 * On-demand local Worker; obsolete exports are discarded if inputs change while generating. Where this
 * build stores reports, the menu adds "Save to my account" below the downloads.
 */
export function ReportActions({ children, screen = 'analyze' }: { children?: ReactNode; screen?: ReportScreen }): React.JSX.Element | null {
  const { t, locale } = useTranslation();
  const sequence = useSequenceDraft(); const alignment = useAlignmentDraft();
  const projects = useContext(ProjectContext);
  const [status, setStatus] = useState<'idle' | 'running' | 'error' | 'stale' | 'done'>('idle');
  const operation = useRef<{ worker: Worker; timer: number } | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const downloadTitle = useId();
  const revision = useRef('');
  const inputKey = workspaceInputKey(sequence.text, alignment, sequence.profileWindow);
  useEffect(() => { revision.current = inputKey; }, [inputKey]);
  useEffect(() => () => { if (operation.current) { operation.current.worker.terminate(); clearTimeout(operation.current.timer); operation.current = null; } }, []);
  // The list is read when the menu first opens, not on every visit to the screen.
  const [opened, setOpened] = useState(false);
  const saved = useSavedReports(opened);
  const save = useReportSave({ saved, prepare, currentKey: () => revision.current, projectId: projects?.active?.id ?? '' });
  const available = sequence.text.length > 0 || alignment.result !== null;
  if (!available) return null;
  const saveFormats = SAVE_FORMATS[screen].filter((format) => (format !== 'profile' || sequence.text) && (format !== 'alignment' || alignment.result));
  const storing = saved.mode !== 'hidden';

  function finish(): void { if (operation.current) { operation.current.worker.terminate(); clearTimeout(operation.current.timer); operation.current = null; } }
  // Capturing the workspace reads the project contracts, which arrive with this first export.
  async function prepare(format: ReportFormat): Promise<PreparedReport> {
    const key = inputKey;
    const snapshot = await captureWorkspace(sequence.text, alignment, sequence.profileWindow, undefined, undefined, sequence.source);
    if (!snapshot.activeSequence && !snapshot.workspace.alignment.result) return null;
    if (format === 'alignment' && !snapshot.workspace.alignment.result) return 'stale';
    if (format === 'profile' && !snapshot.activeSequence) return null;
    return { key, request: { id: 1, format, locale, input: { ...snapshot, name: 'ProteinForge' } } };
  }
  async function start(format: ReportFormat): Promise<void> {
    try {
      const prepared = await prepare(format);
      if (prepared === 'stale') { setStatus('stale'); return; }
      if (!prepared) { setStatus('error'); return; }
      finish();
      const worker = new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' });
      const request: ReportRequest = prepared.request;
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
  const downloads = <>
    <button type="button" className="button" disabled={status === 'running'} onClick={() => { void start('pdf'); }}>{t('report.pdf')}</button>
    <button type="button" className="button" disabled={status === 'running'} onClick={() => { void start('json'); }}>{t('report.json')}</button>
    {sequence.text && <button type="button" className="button" disabled={status === 'running'} onClick={() => { void start('profile'); }}>{t('report.profileCsv')}</button>}
    {alignment.result && <button type="button" className="button" disabled={status === 'running'} onClick={() => { void start('alignment'); }}>{t('report.alignmentCsv')}</button>}
    {children}
    {status === 'running' && <button type="button" className="button" onClick={() => { finish(); setStatus('idle'); }}>{t('projects.cancel')}</button>}
    <p role="status" className="status-message" data-state={status === 'error' || status === 'stale' ? 'error' : undefined}>{status === 'idle' ? '' : t(`report.${status}`)}</p>
  </>;
  return <details className="toolbar-menu report-menu" ref={menu} onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }} onKeyDown={(event) => {
    // Closing the menu never cancels a save in progress; reopening it shows the progress again.
    if (event.key === 'Escape' && menu.current?.open) { event.preventDefault(); menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
  }}><summary className="button button-secondary">{t('report.export')}</summary>
    {storing ? <div className="toolbar-popover report-popover">
      <div className="report-downloads" role="group" aria-labelledby={downloadTitle}>
        <p className="report-group-title" id={downloadTitle}>{t('report.downloadGroup')}</p>
        {downloads}
      </div>
      <ReportSaveGroup formats={saveFormats} saved={saved} save={save} onDownload={(format) => { void start(format); }} />
    </div> : <div className="toolbar-popover">{downloads}</div>}
  </details>;
}
