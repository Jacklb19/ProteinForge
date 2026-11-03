import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListReportsResponseSchema, ReportKind, ReportStatus } from '../../../gen/proteinforge/report/v1/report_service_pb';
import { AuthContext } from '../../auth/authContext';
import type { AuthContextValue } from '../../auth/authContext';
import { timestampFromIso } from '../../api/timestamps';
import { signedInFixture } from '../../../test/authFixture';
import { GRPC_CODES, grpcWebError, grpcWebResponse } from '../../../test/grpcWeb';
import { REPORT_STORAGE_LIMITS } from './config';
import type { StoredReport } from './reportStorageClient';
import { addSavedReport, forgetSavedReports, groupByProject, loadSavedReports, quotaReason, reportUsage, useSavedReports } from './useSavedReports';

const SHA = 'a'.repeat(64);
const report = (id: string, projectId: string, sizeBytes = 1_000, status: StoredReport['status'] = 'ready'): StoredReport => ({ id, projectId, kind: 'pdf', sizeBytes, sha256: SHA, status, createdAt: '2026-11-02T09:00:00Z' });

describe('saved report helpers', () => {
  it('groups by project, keeps unlinked ones under the empty key and counts pending reservations', () => {
    const reports = [report('a', 'p1'), report('b', ''), report('c', 'p1', 2_000, 'pending')];
    expect([...groupByProject(reports).entries()].map(([key, items]) => [key, items.map((item) => item.id)])).toEqual([['p1', ['a', 'c']], ['', ['b']]]);
    expect(reportUsage(reports)).toEqual({ count: 3, bytes: 4_000 });
  });

  it('names the limit a new file would cross, the count first', () => {
    const many = Array.from({ length: REPORT_STORAGE_LIMITS.maxReports }, (_, index) => report(String(index), ''));
    expect(quotaReason(many, 1)).toBe('count');
    expect(quotaReason([report('big', '', REPORT_STORAGE_LIMITS.maxOwnerBytes - 10)], 11)).toBe('bytes');
    expect(quotaReason([report('big', '', REPORT_STORAGE_LIMITS.maxOwnerBytes - 10)], 10)).toBeNull();
  });
});

function Probe() {
  const saved = useSavedReports();
  return <p>{`${saved.mode}:${saved.status}:${String(saved.reports.length)}`}</p>;
}
const renderProbe = (auth: AuthContextValue) => render(<AuthContext.Provider value={auth}><Probe /></AuthContext.Provider>);
const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

describe('one list per account', () => {
  beforeEach(() => {
    forgetSavedReports(); fetcher.mockReset();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example'); vi.stubEnv('VITE_REPORT_STORAGE', 'enabled'); vi.stubGlobal('fetch', fetcher);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('loads once for every screen of the signed-in owner', async () => {
    fetcher.mockResolvedValue(grpcWebResponse(ListReportsResponseSchema, { reports: [{ id: 'r1', kind: ReportKind.JSON, sizeBytes: 10, sha256: SHA, status: ReportStatus.READY, createTime: timestampFromIso('2026-11-02T09:00:00Z') }] }));
    render(<AuthContext.Provider value={signedInFixture}><Probe /><Probe /></AuthContext.Provider>);
    await act(async () => { await Promise.resolve(); });
    expect(await screen.findAllByText('ready:ready:1')).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('offers nothing where the API cannot store reports, and only the invitation when signed out', async () => {
    fetcher.mockResolvedValue(grpcWebError(GRPC_CODES.unimplemented, 'unimplemented'));
    const rendered = renderProbe(signedInFixture);
    expect(await screen.findByText('hidden:unsupported:0')).toBeInTheDocument();
    rendered.unmount();
    renderProbe({ ...signedInFixture, status: 'anonymous', session: null });
    expect(screen.getByText('signed-out:idle:0')).toBeInTheDocument();
  });

  it('stays hidden when the build leaves the feature off', () => {
    vi.stubEnv('VITE_REPORT_STORAGE', '');
    renderProbe(signedInFixture);
    expect(screen.getByText('hidden:idle:0')).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('a list that answers after a save', () => {
  beforeEach(() => {
    forgetSavedReports(); fetcher.mockReset();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example'); vi.stubEnv('VITE_REPORT_STORAGE', 'enabled'); vi.stubGlobal('fetch', fetcher);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('keeps the report saved while it was on its way', async () => {
    let answerList: (response: Response) => void = () => undefined;
    fetcher.mockReturnValue(new Promise<Response>((resolve) => { answerList = resolve; }));
    const loaded = loadSavedReports('owner', 'owner-token', true);
    addSavedReport('owner', report('new', 'p1'));
    answerList(grpcWebResponse(ListReportsResponseSchema, { reports: [{ id: 'old', kind: ReportKind.PDF, sizeBytes: 10, sha256: SHA, status: ReportStatus.READY, createTime: timestampFromIso('2026-11-01T09:00:00Z') }] }));
    expect((await loaded)?.map((item) => item.id)).toEqual(['new', 'old']);
  });
});
