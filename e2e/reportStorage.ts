import { createHash } from 'node:crypto';
import type { Page, Route } from '@playwright/test';
import {
  CompleteReportRequestSchema, CompleteReportResponseSchema, CreateReportDownloadRequestSchema, CreateReportDownloadResponseSchema,
  CreateReportUploadRequestSchema, CreateReportUploadResponseSchema, DeleteReportRequestSchema, DeleteReportResponseSchema,
  ListReportsResponseSchema, ReportKind, ReportStatus,
} from '../src/gen/proteinforge/report/v1/report_service_pb';
import { timestampFromIso } from '../src/features/api/timestamps';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

/** Signed Storage addresses of the suite: a reserved domain, answered only by this mock. */
export const STORAGE_ORIGIN = 'https://storage.e2e.invalid';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
const CONTENT_TYPES: Record<ReportKind, string> = { [ReportKind.UNSPECIFIED]: 'application/octet-stream', [ReportKind.PDF]: 'application/pdf', [ReportKind.JSON]: 'application/json', [ReportKind.PROFILE_CSV]: 'text/csv', [ReportKind.ALIGNMENT_CSV]: 'text/csv' };

export interface StoredFile { id: string; projectId: string; kind: ReportKind; bytes: Buffer; sha256: string; status: ReportStatus; createdAt: string }
interface Options {
  /** Reports the account already holds. */
  reports?: StoredFile[];
  /** Answer of CreateReportUpload instead of a reservation, for refusals. */
  refuseReserve?: { code: number; message: string };
  /** Bytes served for downloads instead of the stored ones, to test the fingerprint check. */
  tamper?: boolean;
}

export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
export function storedFile(id: string, projectId: string, kind: ReportKind, text: string, status = ReportStatus.READY): StoredFile {
  const bytes = Buffer.from(text);
  return { id, projectId, kind, bytes, sha256: sha256(bytes), status, createdAt: '2026-11-02T09:42:00.000000Z' };
}
function wire(file: StoredFile) {
  return { id: file.id, projectId: file.projectId, kind: file.kind, sizeBytes: file.bytes.byteLength, sha256: file.sha256, status: file.status, createTime: timestampFromIso(file.createdAt) };
}

/**
 * ReportService and the signed Storage addresses, answered locally. Registered after a screen's own
 * RPC mock, it takes the report calls and passes every other request on.
 */
export async function mockReportStorage(page: Page, options: Options = {}) {
  const files = new Map((options.reports ?? []).map((file) => [file.id, file]));
  const uploads: { contentType: string; size: number }[] = [];
  const deleted: string[] = [];
  let next = 0;
  await page.route(STORAGE_ORIGIN + '/**', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const id = new URL(request.url()).pathname.split('/').at(-1) ?? '';
    const file = files.get(id);
    if (request.method() === 'PUT' && file) {
      const body = request.postDataBuffer() ?? Buffer.alloc(0);
      uploads.push({ contentType: request.headers()['content-type'] ?? '', size: body.byteLength });
      files.set(id, { ...file, bytes: body });
      return route.fulfill({ status: 200, headers: CORS, json: { Key: id } });
    }
    if (request.method() === 'GET' && file) return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': CONTENT_TYPES[file.kind] }, body: options.tamper ? Buffer.from('tampered') : file.bytes });
    return route.fulfill({ status: 404, headers: CORS });
  });
  await page.route(isRpc, async (route) => {
    const method = rpcMethod(route);
    if (!method.startsWith('ReportService/')) return route.fallback();
    if (method === 'ReportService/ListReports') return fulfillRpc(route, ListReportsResponseSchema, { reports: [...files.values()].reverse().map(wire) });
    if (method === 'ReportService/CreateReportUpload') {
      if (options.refuseReserve) return fulfillRpcError(route, options.refuseReserve.code, options.refuseReserve.message);
      const request = rpcRequest(route, CreateReportUploadRequestSchema);
      const file: StoredFile = { id: `00000000-0000-4000-8000-${String(500 + ++next).padStart(12, '0')}`, projectId: request.projectId, kind: request.kind, bytes: Buffer.alloc(0), sha256: request.sha256, status: ReportStatus.PENDING, createdAt: '2026-11-02T10:05:00.000000Z' };
      files.set(file.id, file);
      return fulfillRpc(route, CreateReportUploadResponseSchema, { report: { ...wire(file), sizeBytes: request.sizeBytes }, uploadUrl: `${STORAGE_ORIGIN}/object/upload/sign/reports/${file.id}`, contentType: CONTENT_TYPES[request.kind] });
    }
    if (method === 'ReportService/CompleteReport') {
      const file = files.get(rpcRequest(route, CompleteReportRequestSchema).id);
      if (!file || sha256(file.bytes) !== file.sha256) return fulfillRpcError(route, GRPC_CODES.failedPrecondition, 'report-upload-missing');
      const ready = { ...file, status: ReportStatus.READY };
      files.set(file.id, ready);
      return fulfillRpc(route, CompleteReportResponseSchema, { report: wire(ready) });
    }
    if (method === 'ReportService/CreateReportDownload') {
      const file = files.get(rpcRequest(route, CreateReportDownloadRequestSchema).id);
      if (!file) return fulfillRpcError(route, GRPC_CODES.notFound, 'report-not-found');
      return fulfillRpc(route, CreateReportDownloadResponseSchema, { report: wire(file), downloadUrl: `${STORAGE_ORIGIN}/object/sign/reports/${file.id}`, fileName: 'proteinforge-report.pdf' });
    }
    if (method === 'ReportService/DeleteReport') {
      const { id } = rpcRequest(route, DeleteReportRequestSchema);
      deleted.push(id);
      return files.delete(id) ? fulfillRpc(route, DeleteReportResponseSchema, {}) : fulfillRpcError(route, GRPC_CODES.notFound, 'report-not-found');
    }
    return fulfillRpcError(route, GRPC_CODES.unimplemented, 'unimplemented');
  });
  return { files, uploads, deleted };
}
