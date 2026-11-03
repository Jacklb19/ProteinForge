import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageInitShape } from '@bufbuild/protobuf';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CreateReportDownloadResponseSchema, DeleteReportResponseSchema, ListReportsResponseSchema, ReportKind, ReportStatus,
} from '../../../gen/proteinforge/report/v1/report_service_pb';
import type { ReportSchema } from '../../../gen/proteinforge/report/v1/report_service_pb';
import { timestampFromIso } from '../../api/timestamps';
import { AuthContext } from '../../auth/authContext';
import { spanish } from '../../../i18n/es';
import { translate } from '../../../i18n/translate';
import type { TranslationKey, TranslationVariables } from '../../../i18n/translate';
import { signedInFixture } from '../../../test/authFixture';
import { GRPC_CODES, grpcWebError, grpcWebResponse } from '../../../test/grpcWeb';
import { fingerprint } from './fingerprint';
import { ProjectReports, UnlinkedReports } from './SavedReportList';
import { forgetSavedReports } from './useSavedReports';

type Record = MessageInitShape<typeof ReportSchema>;
const t = (key: TranslationKey, variables?: TranslationVariables): string => translate('es', key, variables);
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4 report');
let pdfSha = '';
const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
const calls = (): string[] => fetcher.mock.calls.map((call) => call[0].split('/').at(-1)?.split('?')[0] ?? '');

function record(id: string, overrides: Record = {}): Record {
  return { id, projectId: 'p1', kind: ReportKind.PDF, sizeBytes: PDF_BYTES.byteLength, sha256: pdfSha, status: ReportStatus.READY, createTime: timestampFromIso('2026-11-02T09:42:00Z'), ...overrides };
}
function answer(reports: Record[], stored: Uint8Array = PDF_BYTES, refusal?: Response): void {
  fetcher.mockImplementation((input) => {
    const method = input.split('/').at(-1)?.split('?')[0] ?? '';
    if (input.startsWith('https://storage.example/')) return Promise.resolve(new Response(stored.slice()));
    if (method === 'ListReports') return Promise.resolve(grpcWebResponse(ListReportsResponseSchema, { reports }));
    if (refusal) return Promise.resolve(refusal);
    if (method === 'CreateReportDownload') return Promise.resolve(grpcWebResponse(CreateReportDownloadResponseSchema, { report: reports[0], downloadUrl: 'https://storage.example/object/sign/reports/a.pdf?token=d', fileName: 'proteinforge-report.pdf' }));
    if (method === 'DeleteReport') return Promise.resolve(grpcWebResponse(DeleteReportResponseSchema, {}));
    return Promise.resolve(grpcWebError(GRPC_CODES.unimplemented, 'unimplemented'));
  });
}
function renderLists(projectIds: string[] | null = ['p1']) {
  return render(<AuthContext.Provider value={signedInFixture}><ProjectReports projectId="p1" name="Insulina humana" /><UnlinkedReports projectIds={projectIds} /></AuthContext.Provider>);
}
const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
const createUrl = vi.fn<(blob: Blob | MediaSource) => string>().mockReturnValue('blob:verified');
const openTab = vi.fn<() => Window>();
const anchorClick = vi.fn<() => void>();

beforeEach(async () => {
  pdfSha = await fingerprint(PDF_BYTES.slice().buffer);
  forgetSavedReports(); fetcher.mockReset(); tab.close.mockClear(); tab.location.href = ''; createUrl.mockClear();
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example'); vi.stubEnv('VITE_REPORT_STORAGE', 'enabled'); vi.stubGlobal('fetch', fetcher);
  openTab.mockReset().mockReturnValue(tab as unknown as Window); anchorClick.mockReset();
  vi.spyOn(window, 'open').mockImplementation(openTab);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createUrl); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClick);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('groups rows by project, lists unlinked and unfinished reports apart with the total usage', async () => {
  answer([record('a'), record('b', { kind: ReportKind.PROFILE_CSV }), record('c', { projectId: '' }), record('d', { projectId: '', status: ReportStatus.PENDING, kind: ReportKind.JSON })]);
  renderLists();
  const summary = await screen.findByText(t('report.showSaved', { count: '2' }));
  await userEvent.setup().click(summary);
  const projectList = screen.getByRole('list', { name: t('report.savedOf', { project: 'Insulina humana' }) });
  expect(within(projectList).getAllByRole('listitem')).toHaveLength(2);
  // The profile CSV can only be downloaded; a PDF can also be opened.
  expect(within(projectList).getAllByRole('button', { name: /^Abrir/ })).toHaveLength(1);
  const unlinked = screen.getByRole('region', { name: spanish['report.unlinkedTitle'] });
  expect(unlinked).toHaveTextContent(t('report.usage', { count: '4', max: '20', used: '0,1 KB', limit: '25 MB' }));
  const pending = within(unlinked).getAllByRole('listitem')[1];
  expect(pending).toHaveTextContent(spanish['report.pending']);
  expect(within(pending as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual([spanish['report.remove']]);
  expect(screen.getAllByText(`${pdfSha.slice(0, 4)}…${pdfSha.slice(-4)}`)[0]).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getAllByText(t('report.fingerprint', { hash: pdfSha }))[0]).toHaveClass('visually-hidden');
});

it('a report whose project is no longer listed counts as unlinked once every project is loaded', async () => {
  answer([record('a', { projectId: 'deleted' })]);
  const rendered = renderLists(null);
  await waitFor(() => { expect(calls()).toContain('ListReports'); });
  expect(screen.queryByRole('region', { name: spanish['report.unlinkedTitle'] })).not.toBeInTheDocument();
  rendered.rerender(<AuthContext.Provider value={signedInFixture}><UnlinkedReports projectIds={['p1']} /></AuthContext.Provider>);
  expect(screen.getByRole('region', { name: spanish['report.unlinkedTitle'] })).toBeInTheDocument();
});

it('opens and downloads only bytes that match the saved fingerprint', async () => {
  answer([record('a')]);
  const user = userEvent.setup(); renderLists();
  await user.click(await screen.findByText(t('report.showSaved', { count: '1' })));
  await user.click(screen.getByRole('button', { name: /^Abrir Informe PDF del/ }));
  await waitFor(() => { expect(tab.location.href).toBe('blob:verified'); });
  expect(openTab).toHaveBeenCalledWith('', '_blank');
  expect(tab.opener).toBeNull();
  expect(createUrl.mock.calls[0]?.[0]).toMatchObject({ type: 'application/pdf', size: PDF_BYTES.byteLength });
  await user.click(screen.getByRole('button', { name: /^Descargar Informe PDF del/ }));
  await waitFor(() => { expect(anchorClick).toHaveBeenCalledTimes(1); });
  expect(fetcher.mock.calls.filter((call) => call[0].startsWith('https://storage.example/')).every((call) => call[1]?.credentials === 'omit')).toBe(true);
});

it('opens nothing when the bytes differ, and says when the report is gone', async () => {
  answer([record('a')], new TextEncoder().encode('tampered'));
  const user = userEvent.setup(); const rendered = renderLists();
  await user.click(await screen.findByText(t('report.showSaved', { count: '1' })));
  await user.click(screen.getByRole('button', { name: /^Abrir Informe PDF del/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(spanish['report.hashMismatch']);
  expect(tab.close).toHaveBeenCalled();
  expect(createUrl).not.toHaveBeenCalled();
  rendered.unmount(); forgetSavedReports();
  answer([record('a')], PDF_BYTES, grpcWebError(GRPC_CODES.notFound, 'report-object-missing'));
  renderLists();
  await user.click(await screen.findByText(t('report.showSaved', { count: '1' })));
  await user.click(screen.getByRole('button', { name: /^Descargar Informe PDF del/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(spanish['report.missing']);
});

it('removes after an in-row confirmation and moves the focus to the next row, then to a note that none remain', async () => {
  answer([record('a'), record('b', { kind: ReportKind.JSON })]);
  const user = userEvent.setup(); renderLists();
  const summary = await screen.findByText(t('report.showSaved', { count: '2' }));
  await user.click(summary);
  const remove = screen.getByRole('button', { name: /^Quitar Informe PDF del/ });
  await user.click(remove);
  expect(screen.getByRole('heading', { name: spanish['report.removeTitle'] })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: spanish['report.keep'] })).toHaveFocus();
  await user.keyboard('{Escape}');
  await waitFor(() => { expect(screen.getByRole('button', { name: /^Quitar Informe PDF del/ })).toHaveFocus(); });
  expect(calls()).not.toContain('DeleteReport');
  await user.click(screen.getByRole('button', { name: /^Quitar Informe PDF del/ }));
  await user.click(screen.getByRole('button', { name: spanish['report.remove'] }));
  await waitFor(() => { expect(screen.getByRole('button', { name: /^Abrir Informe reproducible JSON del/ })).toHaveFocus(); });
  expect(screen.getByText(spanish['report.removed'])).toBeInTheDocument();
  expect(screen.getByText(t('report.showSaved', { count: '1' }))).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Quitar Informe reproducible JSON del/ }));
  await user.click(screen.getByRole('button', { name: spanish['report.remove'] }));
  await waitFor(() => { expect(screen.getByText(spanish['report.emptyProject'])).toHaveFocus(); });
  expect(screen.queryByText(t('report.showSaved', { count: '0' }))).not.toBeInTheDocument();
  expect(calls().filter((name) => name === 'DeleteReport')).toHaveLength(2);
});
