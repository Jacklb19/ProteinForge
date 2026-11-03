import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n';
import { REPORT_FILENAMES } from '../config';
import { OPENABLE_REPORT_KINDS, REPORT_CONTENT_TYPES, REPORT_FORMAT_NAMES, REPORT_KIND_FORMATS, REPORT_OPEN_URL_LIFETIME_MS } from './config';
import { fingerprint } from './fingerprint';
import type { StoredReport } from './reportStorageClient';
import { failureReason, ReportStorageError } from './reportStorageErrors';
import { dropSavedReport, groupByProject, reportStorage, useSavedReports } from './useSavedReports';
import { useReportText } from './useReportText';

type RowProblem = 'mismatch' | 'missing' | 'failed';
const PROBLEM_KEYS = { mismatch: 'report.hashMismatch', missing: 'report.missing', failed: 'report.actionError' } as const;

/** Downloads the stored bytes and accepts them only when they match the fingerprint declared on save. */
async function verifiedFile(report: StoredReport, token: string): Promise<Blob> {
  const api = await reportStorage();
  if (!api) throw new ReportStorageError('failed');
  const { url } = await api.download(report.id, token);
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new ReportStorageError('failed');
  const bytes = await response.arrayBuffer();
  if (await fingerprint(bytes) !== report.sha256) throw new Error('mismatch');
  return new Blob([bytes], { type: REPORT_CONTENT_TYPES[report.kind] });
}

function problemOf(error: unknown): RowProblem {
  if (error instanceof Error && error.message === 'mismatch') return 'mismatch';
  return failureReason(error) === 'missing' ? 'missing' : 'failed';
}

function ReportRow({ report, onRemoved }: { report: StoredReport; onRemoved: (id: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const text = useReportText();
  const saved = useSavedReports();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<RowProblem | null>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const format = t(REPORT_FORMAT_NAMES[REPORT_KIND_FORMATS[report.kind]]);
  const date = text.date(report.createdAt);
  const size = text.size(report.sizeBytes);
  const pending = report.status === 'pending';
  const variables = { format, date };

  async function fetchFile(open: boolean): Promise<void> {
    // The tab opens within the click, so the browser does not block it; it gets the file once verified.
    const tab = open ? window.open('', '_blank') : null;
    if (tab) tab.opener = null;
    setWorking(true); setProblem(null);
    try {
      const file = await verifiedFile(report, saved.token);
      const url = URL.createObjectURL(file);
      if (tab) tab.location.href = url;
      else { const link = document.createElement('a'); link.href = url; link.download = REPORT_FILENAMES[REPORT_KIND_FORMATS[report.kind]]; link.click(); }
      setTimeout(() => { URL.revokeObjectURL(url); }, tab ? REPORT_OPEN_URL_LIFETIME_MS : 0);
    } catch (error) {
      tab?.close();
      setProblem(problemOf(error));
    } finally { setWorking(false); }
  }
  async function remove(): Promise<void> {
    setWorking(true); setProblem(null);
    const removed = await onRemoved(report.id);
    // The row is gone on success; the list moves the focus on.
    if (!removed) { setWorking(false); setConfirming(false); setProblem('failed'); }
  }
  function keep(): void { setConfirming(false); requestAnimationFrame(() => { removeButton.current?.focus(); }); }

  return <li className="report-row" data-state={pending ? 'pending' : undefined} data-report={report.id}>
    <div className="report-row-text">
      <p className="report-row-title">{format}</p>
      {pending ? <p className="report-row-meta">{t('report.pending')} · {date}</p>
        : <p className="report-row-meta">{t('report.rowMeta', { size, date })} · <span className="hash" aria-hidden="true">{text.hash(report.sha256)}</span><span className="visually-hidden">{t('report.fingerprint', { hash: report.sha256 })}</span></p>}
    </div>
    {confirming ? <div className="project-confirm" role="group" aria-labelledby={titleId} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); keep(); } }}>
      <h3 id={titleId}>{t('report.removeTitle')}</h3>
      <p>{format} · {t('report.rowMeta', { size, date })}</p>
      <p className="field-help">{t('report.removeText')}</p>
      <div className="report-confirm-actions">
        <button type="button" className="button button-secondary" autoFocus onClick={keep}>{t('report.keep')}</button>
        <button type="button" className="button button-danger" disabled={working} onClick={() => { void remove(); }}>{t('report.remove')}</button>
      </div>
    </div> : <div className="report-row-actions">
      {!pending && OPENABLE_REPORT_KINDS.includes(report.kind) && <button type="button" className="button button-quiet" disabled={working} aria-label={t('report.openNamed', variables)} onClick={() => { void fetchFile(true); }}>{t('report.open')}</button>}
      {!pending && <button type="button" className="button button-quiet" disabled={working} aria-label={t('report.downloadNamed', variables)} onClick={() => { void fetchFile(false); }}>{t('report.downloadSaved')}</button>}
      <button ref={removeButton} type="button" className="button button-quiet link-danger" disabled={working} aria-label={t('report.removeNamed', variables)} onClick={() => { setConfirming(true); }}>{t('report.remove')}</button>
    </div>}
    {problem && <p className="status-message report-row-problem" data-state="error" role="alert">{t(PROBLEM_KEYS[problem])}</p>}
  </li>;
}

/** Rows of saved reports with open, download and remove; after a removal the focus moves to the next row. */
function SavedReportRows({ reports, label, onEmpty }: { reports: readonly StoredReport[]; label?: string; onEmpty: () => void }) {
  const { t } = useTranslation();
  const saved = useSavedReports();
  const list = useRef<HTMLUListElement>(null);
  const [removedAt, setRemovedAt] = useState<number | null>(null);
  async function remove(id: string): Promise<boolean> {
    const api = await reportStorage();
    const owner = saved.owner;
    if (!api || !owner) return false;
    const index = reports.findIndex((report) => report.id === id);
    try {
      await api.remove(id, saved.token);
    } catch (error) {
      // Already gone from the account: the row has nothing left to remove.
      if (failureReason(error) !== 'missing') return false;
    }
    const next = reports[index + 1] ?? reports[index - 1];
    dropSavedReport(owner, id);
    setRemovedAt(Date.now());
    requestAnimationFrame(() => {
      const target = next ? list.current?.querySelector<HTMLElement>(`[data-report="${next.id}"] button`) : null;
      if (target) target.focus(); else onEmpty();
    });
    return true;
  }
  return <>
    <ul className="report-list" aria-label={label} ref={list}>
      {reports.map((report) => <ReportRow key={report.id} report={report} onRemoved={remove} />)}
    </ul>
    <p className="visually-hidden" role="status">{removedAt ? t('report.removed') : ''}</p>
  </>;
}

/**
 * Once a list has shown rows it stays while the account does, so removing its last report leaves a
 * place for the focus instead of taking the list away under it.
 */
function useShown(rows: boolean, ready: boolean): boolean {
  const [shown, setShown] = useState(false);
  if (rows && !shown) setShown(true);
  if (!ready && shown) setShown(false);
  return shown || rows;
}

/** "Show saved reports (n)" on a project card; nothing when the project has none or this build stores none. */
export function ProjectReports({ projectId, name }: { projectId: string; name: string }) {
  const { t, formatNumber } = useTranslation();
  const saved = useSavedReports();
  const summary = useRef<HTMLElement>(null);
  const empty = useRef<HTMLParagraphElement>(null);
  const [emptied, setEmptied] = useState(false);
  const reports = saved.mode === 'ready' && saved.loaded ? groupByProject(saved.reports).get(projectId) ?? [] : [];
  const shown = useShown(reports.length > 0, saved.mode === 'ready');
  useEffect(() => { if (emptied) empty.current?.focus(); }, [emptied]);
  if (!shown) return null;
  if (!reports.length) return <p ref={empty} tabIndex={-1} className="project-reports field-help">{t('report.emptyProject')}</p>;
  return <details className="project-reports">
    <summary ref={summary}>{t('report.showSaved', { count: formatNumber(reports.length) })}</summary>
    <SavedReportRows reports={reports} label={t('report.savedOf', { project: name })} onEmpty={() => { setEmptied(true); }} />
  </details>;
}

/**
 * Reports saved without an open project or whose project was deleted, with the account's total usage.
 * `projectIds`: every project of the account, when all are loaded; a report linked to none of them
 * belongs to a project deleted after the list was read. Otherwise only unlinked reports are shown.
 */
export function UnlinkedReports({ projectIds }: { projectIds: readonly string[] | null }) {
  const { t } = useTranslation();
  const text = useReportText();
  const saved = useSavedReports();
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const reports = saved.loaded ? saved.reports.filter((report) => !report.projectId || (projectIds !== null && !projectIds.includes(report.projectId))) : [];
  const shown = useShown(reports.length > 0 || saved.status === 'error', saved.mode === 'ready');
  if (saved.mode !== 'ready' || !shown) return null;
  return <section className="unlinked-reports" aria-labelledby={titleId}>
    <div className="reports-head">
      <h2 id={titleId} ref={heading} tabIndex={-1}>{t('report.unlinkedTitle')}</h2>
      {saved.loaded && <p className="report-usage">{text.usage(saved.usage)}</p>}
    </div>
    {saved.status === 'error' ? <div className="report-state-actions">
      <p className="status-message" data-state="error" role="alert">{t('report.listError')}</p>
      <button type="button" className="button button-quiet" onClick={saved.refresh}>{t('report.retry')}</button>
    </div> : <>
      <p>{t('report.unlinkedHelp')}</p>
      <SavedReportRows reports={reports} onEmpty={() => { heading.current?.focus(); }} />
    </>}
  </section>;
}
