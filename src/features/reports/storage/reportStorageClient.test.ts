import { describe, expect, it, vi } from 'vitest';
import {
  CompleteReportResponseSchema, CreateReportDownloadResponseSchema, CreateReportUploadRequestSchema, CreateReportUploadResponseSchema,
  DeleteReportResponseSchema, ListReportsRequestSchema, ListReportsResponseSchema, ReportKind, ReportStatus,
} from '../../../gen/proteinforge/report/v1/report_service_pb';
import { timestampFromIso } from '../../api/timestamps';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../../test/grpcWeb';
import { REPORT_LIST_PAGE_SIZE } from './config';
import { createReportStorageClient } from './reportStorageClient';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const BASE = 'https://api.example';
const SHA = 'ee90c51c40a75a576d84a4556224f3ef57235a7e929c04420146c1b22cfb5245';
const CREATED = '2026-11-02T09:42:00.123456Z';
const wireReport = { id: '00000000-0000-4000-8000-000000000101', projectId: '', kind: ReportKind.PDF, sizeBytes: 8200, sha256: SHA, status: ReportStatus.READY, createTime: timestampFromIso(CREATED) };

describe('report storage transport', () => {
  it('reserves with the fingerprint and size only, and returns the signed upload address', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(CreateReportUploadResponseSchema, {
      report: { ...wireReport, status: ReportStatus.PENDING }, uploadUrl: 'https://storage.example/object/upload/sign/reports/a.pdf?token=t', contentType: 'application/pdf',
    }));
    const reserved = await createReportStorageClient(BASE, fetcher).reserve({ kind: 'profile-csv', sizeBytes: 8200, sha256: SHA, projectId: 'p1' }, 'owner-token');
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${BASE}/proteinforge.report.v1.ReportService/CreateReportUpload`);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer owner-token');
    expect(grpcWebRequest(CreateReportUploadRequestSchema, fetcher.mock.calls[0]?.[1]?.body as Uint8Array)).toMatchObject({ kind: ReportKind.PROFILE_CSV, sizeBytes: 8200, sha256: SHA, projectId: 'p1' });
    expect(reserved).toMatchObject({ uploadUrl: 'https://storage.example/object/upload/sign/reports/a.pdf?token=t', contentType: 'application/pdf', report: { status: 'pending', kind: 'pdf', createdAt: CREATED } });
  });

  it('lists one page that holds every report and keeps pending and unlinked ones', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(ListReportsResponseSchema, { reports: [wireReport, { ...wireReport, id: 'r2', projectId: 'p1', kind: ReportKind.ALIGNMENT_CSV, status: ReportStatus.PENDING }] }));
    const reports = await createReportStorageClient(BASE, fetcher).list('owner-token');
    expect(grpcWebRequest(ListReportsRequestSchema, fetcher.mock.calls[0]?.[1]?.body as Uint8Array).pageSize).toBe(REPORT_LIST_PAGE_SIZE);
    expect(reports.map((report) => [report.kind, report.status, report.projectId])).toEqual([['pdf', 'ready', ''], ['alignment-csv', 'pending', 'p1']]);
  });

  it('refuses malformed records and unsafe signed addresses as failures', async () => {
    for (const report of [{ ...wireReport, kind: ReportKind.UNSPECIFIED }, { ...wireReport, sha256: 'ABC' }, { ...wireReport, sizeBytes: 5_000_001 }, { ...wireReport, createTime: undefined }]) {
      const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(ListReportsResponseSchema, { reports: [report] }));
      await expect(createReportStorageClient(BASE, fetcher).list('owner-token')).rejects.toMatchObject({ reason: 'failed' });
    }
    for (const downloadUrl of ['javascript:alert(1)', 'https://user:pass@storage.example/a', 'storage/a']) {
      const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(CreateReportDownloadResponseSchema, { report: wireReport, downloadUrl, fileName: 'proteinforge-report.pdf' }));
      await expect(createReportStorageClient(BASE, fetcher).download(wireReport.id, 'owner-token')).rejects.toMatchObject({ reason: 'failed' });
    }
  });

  it('explains stable server codes without showing them, and hides the feature where the API has none', async () => {
    const cases: [Response, string][] = [
      [grpcWebError(GRPC_CODES.resourceExhausted, 'report-quota-exceeded'), 'quota'],
      [grpcWebError(GRPC_CODES.resourceExhausted, 'rate-limited'), 'failed'],
      [grpcWebError(GRPC_CODES.notFound, 'report-not-found'), 'missing'],
      [grpcWebError(GRPC_CODES.notFound, 'report-object-missing'), 'missing'],
      [grpcWebError(GRPC_CODES.unimplemented, 'unimplemented'), 'unsupported'],
      [grpcWebError(GRPC_CODES.failedPrecondition, 'reports-schema-unavailable'), 'unsupported'],
      [grpcWebError(GRPC_CODES.unauthenticated, 'unauthenticated'), 'session'],
      [grpcWebError(GRPC_CODES.unavailable, 'reports-storage-error'), 'failed'],
      [new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }), 'failed'],
    ];
    for (const [response, reason] of cases) {
      const fetcher = vi.fn<Fetcher>().mockResolvedValue(response);
      await expect(createReportStorageClient(BASE, fetcher).remove(wireReport.id, 'owner-token')).rejects.toMatchObject({ reason });
    }
    await expect(createReportStorageClient(BASE, vi.fn<Fetcher>()).list(' ')).rejects.toMatchObject({ reason: 'session' });
  });

  it('completes, signs downloads and deletes by id', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(CompleteReportResponseSchema, { report: wireReport }))
      .mockResolvedValueOnce(grpcWebResponse(CreateReportDownloadResponseSchema, { report: wireReport, downloadUrl: 'https://storage.example/object/sign/reports/a.pdf?token=d', fileName: 'proteinforge-report.pdf' }))
      .mockResolvedValueOnce(grpcWebResponse(DeleteReportResponseSchema, {}));
    const api = createReportStorageClient(BASE, fetcher);
    expect((await api.complete(wireReport.id, 'owner-token')).status).toBe('ready');
    expect((await api.download(wireReport.id, 'owner-token')).url).toBe('https://storage.example/object/sign/reports/a.pdf?token=d');
    await api.remove(wireReport.id, 'owner-token');
    expect(fetcher.mock.calls.map((call) => call[0].split('/').at(-1))).toEqual(['CompleteReport', 'CreateReportDownload', 'DeleteReport']);
  });
});
