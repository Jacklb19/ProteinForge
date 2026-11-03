import { Code, ConnectError } from '@connectrpc/connect';
import { ReportKind, ReportService, ReportStatus } from '../../../gen/proteinforge/report/v1/report_service_pb';
import type { Report } from '../../../gen/proteinforge/report/v1/report_service_pb';
import { callOptions, createRpcClient } from '../../api/rpc';
import { isoFromTimestamp } from '../../api/timestamps';
import { REPORT_LIST_PAGE_SIZE, REPORT_STORAGE_LIMITS, SHA256_HEX } from './config';
import type { StoredReportKind } from './config';
import { ReportStorageError } from './reportStorageErrors';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface StoredReport {
  id: string;
  /** Empty when saved without a project or when its project was deleted. */
  projectId: string;
  kind: StoredReportKind;
  sizeBytes: number;
  sha256: string;
  status: 'pending' | 'ready';
  createdAt: string;
}

const KINDS: Partial<Record<ReportKind, StoredReportKind>> = {
  [ReportKind.PDF]: 'pdf', [ReportKind.JSON]: 'json', [ReportKind.PROFILE_CSV]: 'profile-csv', [ReportKind.ALIGNMENT_CSV]: 'alignment-csv',
};
const WIRE_KINDS: Record<StoredReportKind, ReportKind> = {
  pdf: ReportKind.PDF, json: ReportKind.JSON, 'profile-csv': ReportKind.PROFILE_CSV, 'alignment-csv': ReportKind.ALIGNMENT_CSV,
};
const STATUSES: Partial<Record<ReportStatus, StoredReport['status']>> = { [ReportStatus.PENDING]: 'pending', [ReportStatus.READY]: 'ready' };
/** Server messages that mean "this API cannot store reports" rather than a failed request. */
const UNSUPPORTED_MESSAGES = new Set(['reports-schema-unavailable', 'reports-storage-unavailable']);
const MISSING_MESSAGES = new Set(['report-not-found', 'report-object-missing']);

/** Maps a failed call to a reason; server text is a stable code and never reaches the screen. Every method throws only these. */
export function reportFailure(error: unknown): ReportStorageError {
  if (error instanceof ReportStorageError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new ReportStorageError('cancelled');
  if (!(error instanceof ConnectError)) return new ReportStorageError('failed');
  if (error.code === Code.Canceled) return new ReportStorageError('cancelled');
  if (error.code === Code.Unimplemented || UNSUPPORTED_MESSAGES.has(error.rawMessage)) return new ReportStorageError('unsupported');
  if (error.rawMessage === 'report-quota-exceeded') return new ReportStorageError('quota');
  if (MISSING_MESSAGES.has(error.rawMessage)) return new ReportStorageError('missing');
  if (error.code === Code.Unauthenticated) return new ReportStorageError('session');
  return new ReportStorageError('failed');
}

async function call<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { throw reportFailure(error); }
}

/** Only well-formed records reach the screens; anything else is an invalid answer. */
function storedReport(report: Report | undefined): StoredReport {
  const kind = report ? KINDS[report.kind] : undefined;
  const status = report ? STATUSES[report.status] : undefined;
  const createdAt = isoFromTimestamp(report?.createTime);
  if (!report || !kind || !status || !createdAt || !report.id || !SHA256_HEX.test(report.sha256)
    || report.sizeBytes < 1 || report.sizeBytes > REPORT_STORAGE_LIMITS.maxReportBytes) throw new ReportStorageError('failed');
  return { id: report.id, projectId: report.projectId, kind, sizeBytes: report.sizeBytes, sha256: report.sha256, status, createdAt };
}

/** Signed Storage URLs are absolute HTTP(S) addresses without credentials. */
function signedUrl(value: string): string {
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href;
  } catch { /* falls through to the refusal below */ }
  throw new ReportStorageError('failed');
}

function session(token: string): string {
  if (!token.trim()) throw new ReportStorageError('session');
  return token;
}

/** Owner reports through ReportService; the API never receives the file, only its size and fingerprint. */
export function createReportStorageClient(baseUrl: string, fetchImplementation?: FetchLike) {
  const client = createRpcClient(ReportService, baseUrl, fetchImplementation);
  return {
    reserve: async (input: { kind: StoredReportKind; sizeBytes: number; sha256: string; projectId: string }, token: string, signal?: AbortSignal) => {
      const response = await call(() => client.createReportUpload({ kind: WIRE_KINDS[input.kind], sizeBytes: input.sizeBytes, sha256: input.sha256, projectId: input.projectId }, callOptions(signal, session(token))));
      if (!response.contentType) throw new ReportStorageError('failed');
      return { report: storedReport(response.report), uploadUrl: signedUrl(response.uploadUrl), contentType: response.contentType };
    },
    complete: async (id: string, token: string, signal?: AbortSignal): Promise<StoredReport> => {
      const response = await call(() => client.completeReport({ id }, callOptions(signal, session(token))));
      return storedReport(response.report);
    },
    list: async (token: string, signal?: AbortSignal): Promise<StoredReport[]> => {
      const response = await call(() => client.listReports({ pageSize: REPORT_LIST_PAGE_SIZE }, callOptions(signal, session(token))));
      return response.reports.map(storedReport);
    },
    download: async (id: string, token: string, signal?: AbortSignal) => {
      const response = await call(() => client.createReportDownload({ id }, callOptions(signal, session(token))));
      return { report: storedReport(response.report), url: signedUrl(response.downloadUrl) };
    },
    remove: async (id: string, token: string, signal?: AbortSignal): Promise<void> => {
      await call(() => client.deleteReport({ id }, callOptions(signal, session(token))));
    },
  };
}
export type ReportStorageClient = ReturnType<typeof createReportStorageClient>;
