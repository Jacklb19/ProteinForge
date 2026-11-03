import { REPORT_TIMEOUT_MS } from '../config';
import type { ReportRequest, ReportResponse } from '../reportMessages';
import { ReportStorageError } from './reportStorageErrors';

/** The same report Worker as the downloads, as a promise that cancellation and the time limit end. */
export function generateReport(request: ReportRequest, signal: AbortSignal): Promise<{ blob: Blob; sha256: string }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new ReportStorageError('cancelled')); return; }
    const worker = new Worker(new URL('../report.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: ReportStorageError, value?: { blob: Blob; sha256: string }): void => {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (value) resolve(value); else reject(error ?? new ReportStorageError('failed'));
    };
    const abort = (): void => { finish(new ReportStorageError('cancelled')); };
    const timer = window.setTimeout(() => { finish(); }, REPORT_TIMEOUT_MS);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<ReportResponse>) => {
      if (event.data.error) finish(); else finish(undefined, { blob: event.data.blob, sha256: event.data.sha256 });
    };
    worker.onerror = () => { finish(); };
    worker.postMessage(request);
  });
}
