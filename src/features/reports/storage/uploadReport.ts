import { REPORT_UPLOAD_TIMEOUT_MS } from './config';
import { ReportStorageError } from './reportStorageErrors';

export interface UploadOptions { signal: AbortSignal; onProgress: (fraction: number) => void }

/**
 * Sends the file straight to the signed Storage URL. XMLHttpRequest, because fetch reports no upload
 * progress. No cookies travel and the session token never goes to Storage: the URL itself authorizes.
 */
export function uploadReport(url: string, file: Blob, contentType: string, { signal, onProgress }: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new ReportStorageError('cancelled')); return; }
    const request = new XMLHttpRequest();
    const abort = (): void => { request.abort(); };
    const settle = (error?: ReportStorageError): void => {
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    request.open('PUT', url);
    request.withCredentials = false;
    request.timeout = REPORT_UPLOAD_TIMEOUT_MS;
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => { if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total); };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) { onProgress(1); settle(); } else settle(new ReportStorageError('failed'));
    };
    request.onerror = () => { settle(new ReportStorageError('failed')); };
    request.ontimeout = () => { settle(new ReportStorageError('failed')); };
    request.onabort = () => { settle(new ReportStorageError('cancelled')); };
    signal.addEventListener('abort', abort, { once: true });
    // The exact bytes that were fingerprinted, typed as the reservation expects.
    request.send(new Blob([file], { type: contentType }));
  });
}
