import { useEffect, useRef, useState } from 'react';
import type { ReportFormat, ReportRequest } from '../reportMessages';
import { REPORT_FIRST_SAVE_KEY_PREFIX, REPORT_FORMAT_KINDS, REPORT_STORAGE_LIMITS } from './config';
import { generateReport } from './generateReport';
import { failureReason, ReportStorageError } from './reportStorageErrors';
import { uploadReport } from './uploadReport';
import { addSavedReport, loadSavedReports, quotaReason, reportStorage } from './useSavedReports';
import type { SavedReports } from './useSavedReports';

export type SaveState =
  | { status: 'idle' | 'cancelled' | 'stale' }
  | { status: 'notice'; format: ReportFormat }
  /** `progress`: share of the file uploaded, `null` while the Worker writes it. */
  | { status: 'saving'; format: ReportFormat; progress: number | null }
  | { status: 'saved' | 'error'; format: ReportFormat }
  | { status: 'too-large'; format: ReportFormat; sizeBytes: number }
  | { status: 'quota'; reason: 'count' | 'bytes' };

/** The report request for the current input, the key that tells whether that input is still current, or why there is none. */
export type PreparedReport = { request: ReportRequest; key: string } | 'stale' | null;
interface Options { saved: SavedReports; prepare: (format: ReportFormat) => Promise<PreparedReport>; currentKey: () => string; projectId: string }

function noticeKey(owner: string): string { return `${REPORT_FIRST_SAVE_KEY_PREFIX}${owner}`; }
function noticeSeen(owner: string): boolean {
  try { return window.localStorage.getItem(noticeKey(owner)) !== null; } catch { return false; }
}
function rememberNotice(owner: string): void {
  try { window.localStorage.setItem(noticeKey(owner), new Date().toISOString()); } catch { /* the notice simply shows again */ }
}

/**
 * Saving a report: Worker → fingerprint → size and quota against the latest list → reserve → upload →
 * complete. Cancelling or failing after the reservation removes it; if that also fails the report
 * stays in the list as unfinished, with Remove.
 */
export function useReportSave({ saved, prepare, currentKey, projectId }: Options) {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const [owner, setOwner] = useState(saved.owner);
  const operation = useRef<AbortController | null>(null);
  // A notice, outcome or save of one account never carries over to another.
  if (owner !== saved.owner) { setOwner(saved.owner); setState({ status: 'idle' }); }
  useEffect(() => { operation.current?.abort(); }, [saved.owner]);
  // Leaving the screen ends the save; the reservation is released like a cancellation.
  useEffect(() => () => { operation.current?.abort(); }, []);

  async function run(format: ReportFormat): Promise<void> {
    const { owner, token, reports } = saved;
    const api = await reportStorage();
    if (!owner || !api) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setState({ status: 'saving', format, progress: null });
    let reserved: string | null = null;
    let reserving = false;
    let size = 0;
    try {
      const prepared = await prepare(format);
      if (prepared === 'stale') { setState({ status: 'stale' }); return; }
      if (!prepared) throw new ReportStorageError('failed');
      const file = await generateReport(prepared.request, controller.signal);
      if (currentKey() !== prepared.key) { setState({ status: 'stale' }); return; }
      size = file.blob.size;
      if (size > REPORT_STORAGE_LIMITS.maxReportBytes) { setState({ status: 'too-large', format, sizeBytes: size }); return; }
      const quota = quotaReason(reports, size);
      if (quota) { setState({ status: 'quota', reason: quota }); return; }
      // Not cancelled mid-flight: the server may already have committed the reservation, and only its
      // answer says which one to release.
      reserving = true;
      const reservation = await api.reserve({ kind: REPORT_FORMAT_KINDS[format], sizeBytes: size, sha256: file.sha256, projectId }, token);
      reserving = false;
      reserved = reservation.report.id;
      if (controller.signal.aborted) throw new ReportStorageError('cancelled');
      setState({ status: 'saving', format, progress: 0 });
      await uploadReport(reservation.uploadUrl, file.blob, reservation.contentType, {
        signal: controller.signal, onProgress: (progress) => { setState({ status: 'saving', format, progress }); },
      });
      const report = await api.complete(reserved, token, controller.signal);
      reserved = null;
      addSavedReport(owner, report);
      setState({ status: 'saved', format });
    } catch (error) {
      const reason = failureReason(error);
      if (reserved) {
        const id = reserved;
        // Without the cancelled signal: the reservation must go even when the save was stopped.
        await api.remove(id, token).catch(() => { void loadSavedReports(owner, token, true); });
      }
      if (reason === 'quota') {
        // Another device may have filled the account: the message follows the list as it is now.
        const current = await loadSavedReports(owner, token, true);
        setState({ status: 'quota', reason: quotaReason(current ?? reports, size) ?? 'bytes' });
        return;
      }
      // A reservation whose answer was lost or malformed may exist: the list shows it as unfinished.
      if (reserving) void loadSavedReports(owner, token, true);
      setState(reason === 'cancelled' ? { status: 'cancelled' } : { status: 'error', format });
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }

  return {
    state,
    /** The first save in this browser and account asks first; the answer is remembered only when it saves. */
    save: (format: ReportFormat) => {
      if (saved.owner && !noticeSeen(saved.owner)) setState({ status: 'notice', format });
      else void run(format);
    },
    /** `format`: the one chosen when the notice is accepted, which may differ from the one that raised it. */
    confirm: (format: ReportFormat) => {
      if (state.status !== 'notice' || !saved.owner) return;
      rememberNotice(saved.owner);
      void run(format);
    },
    dismiss: () => { setState({ status: 'idle' }); },
    cancel: () => { operation.current?.abort(); },
    retry: (format: ReportFormat) => { void run(format); },
  };
}
export type ReportSave = ReturnType<typeof useReportSave>;
