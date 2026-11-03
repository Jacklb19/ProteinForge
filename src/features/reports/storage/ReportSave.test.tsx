import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { MessageInitShape } from '@bufbuild/protobuf';
import {
  CompleteReportResponseSchema, CreateReportUploadRequestSchema, CreateReportUploadResponseSchema, DeleteReportResponseSchema,
  ListReportsResponseSchema, ReportKind, ReportStatus,
} from '../../../gen/proteinforge/report/v1/report_service_pb';
import type { ReportSchema } from '../../../gen/proteinforge/report/v1/report_service_pb';
import { timestampFromIso } from '../../api/timestamps';
import { AuthContext } from '../../auth/authContext';
import type { AuthContextValue } from '../../auth/authContext';
import { AlignmentDraftProvider } from '../../alignment/AlignmentDraftProvider';
import { SequenceDraftProvider } from '../../editor/SequenceDraftProvider';
import { useSequenceDraft } from '../../editor/sequenceDraft';
import { spanish } from '../../../i18n/es';
import { languageTags } from '../../../i18n/locale';
import { translate } from '../../../i18n/translate';
import type { TranslationKey, TranslationVariables } from '../../../i18n/translate';
import { signedInFixture } from '../../../test/authFixture';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../../test/grpcWeb';
import { ReportActions } from '../ReportActions';
import type { ReportRequest, ReportResponse } from '../reportMessages';
import { REPORT_FIRST_SAVE_KEY_PREFIX, REPORT_STORAGE_LIMITS } from './config';
import { forgetSavedReports } from './useSavedReports';

const t = (key: TranslationKey, variables?: TranslationVariables): string => translate('es', key, variables);
const SHA = 'ee90c51c40a75a576d84a4556224f3ef57235a7e929c04420146c1b22cfb5245';
const ID = '00000000-0000-4000-8000-000000000101';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<ReportResponse>) => void) | null = null; onerror: (() => void) | null = null;
  terminate = vi.fn(); postMessage = vi.fn<(value: ReportRequest) => void>();
  constructor() { TestWorker.instances.push(this); }
  send(value: ReportResponse): void { this.onmessage?.({ data: value } as MessageEvent<ReportResponse>); }
}
class TestRequest {
  static instances: TestRequest[] = [];
  url = ''; timeout = 0; withCredentials = true; status = 0;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null; onerror: (() => void) | null = null; ontimeout: (() => void) | null = null; onabort: (() => void) | null = null;
  abort = vi.fn(() => { this.onabort?.(); });
  constructor() { TestRequest.instances.push(this); }
  open(_method: string, url: string): void { this.url = url; }
  setRequestHeader(): void { /* the header itself is covered by uploadReport.test.ts */ }
  send(): void { /* answered by the test */ }
  progress(fraction: number): void { this.upload.onprogress?.({ lengthComputable: true, loaded: fraction * 100, total: 100 } as ProgressEvent); }
  finish(status: number): void { this.status = status; this.onload?.(); }
}

type Record = MessageInitShape<typeof ReportSchema>;
type Answer = (method: string) => Response | undefined;
const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
const calls = (): string[] => fetcher.mock.calls.map((call) => call[0].split('/').at(-1) ?? '');
function record(overrides: Record = {}): Record {
  return { id: ID, kind: ReportKind.PDF, sizeBytes: 3, sha256: SHA, status: ReportStatus.READY, createTime: timestampFromIso('2026-11-02T09:42:00Z'), ...overrides };
}
function answer(reports: Record[] = [], override?: Answer): void {
  fetcher.mockImplementation((input) => {
    const method = input.split('/').at(-1) ?? '';
    const custom = override?.(method);
    if (custom) return Promise.resolve(custom);
    if (method === 'ListReports') return Promise.resolve(grpcWebResponse(ListReportsResponseSchema, { reports: reports.map((item) => record(item)) }));
    if (method === 'CreateReportUpload') return Promise.resolve(grpcWebResponse(CreateReportUploadResponseSchema, { report: record({ status: ReportStatus.PENDING }), uploadUrl: 'https://storage.example/upload?token=t', contentType: 'application/pdf' }));
    if (method === 'CompleteReport') return Promise.resolve(grpcWebResponse(CompleteReportResponseSchema, { report: record() }));
    if (method === 'DeleteReport') return Promise.resolve(grpcWebResponse(DeleteReportResponseSchema, {}));
    return Promise.resolve(grpcWebError(GRPC_CODES.unimplemented, 'unimplemented'));
  });
}

function Draft() { const draft = useSequenceDraft(); return <input aria-label="draft" value={draft.text} onChange={(event) => { draft.setText(event.target.value); }} />; }
function renderMenu(auth: AuthContextValue = signedInFixture) {
  return render(<MemoryRouter><AuthContext.Provider value={auth}><SequenceDraftProvider><AlignmentDraftProvider><Draft /><ReportActions /></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider></MemoryRouter>);
}
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('draft'), 'ACD');
  await user.click(screen.getByText(spanish['report.export']));
}
async function lastWorker(): Promise<TestWorker> {
  await waitFor(() => { expect(TestWorker.instances.length).toBeGreaterThan(0); });
  const worker = TestWorker.instances.at(-1);
  if (!worker) throw new Error('Missing Worker');
  return worker;
}
async function lastUpload(): Promise<TestRequest> {
  await waitFor(() => { expect(TestRequest.instances.length).toBeGreaterThan(0); });
  const request = TestRequest.instances.at(-1);
  if (!request) throw new Error('Missing upload');
  return request;
}
const saveButton = () => screen.getByRole('button', { name: spanish['report.saveToAccount'] });

beforeAll(async () => { await import('../../projects/contracts'); });
beforeEach(() => {
  forgetSavedReports(); fetcher.mockReset(); localStorage.clear(); TestWorker.instances = []; TestRequest.instances = [];
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example'); vi.stubEnv('VITE_REPORT_STORAGE', 'enabled');
  vi.stubGlobal('fetch', fetcher); vi.stubGlobal('Worker', TestWorker); vi.stubGlobal('XMLHttpRequest', TestRequest);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('separates downloads from saving, leaves the properties CSV out and shows destination and usage', async () => {
  answer([{ sizeBytes: 82_000 }]);
  const user = userEvent.setup(); renderMenu();
  await user.type(screen.getByLabelText('draft'), 'ACD');
  // Visiting the screen asks nothing; the list is read when the menu first opens.
  expect(fetcher).not.toHaveBeenCalled();
  await user.click(screen.getByText(spanish['report.export']));
  expect(await screen.findByRole('group', { name: spanish['report.downloadGroup'] })).toContainElement(screen.getByRole('button', { name: spanish['report.pdf'] }));
  const save = screen.getByRole('group', { name: spanish['report.saveToAccount'] });
  expect(save).toHaveTextContent(spanish['report.destinationNone']);
  expect(await screen.findByText(t('report.usage', { count: '1', max: '20', used: '82 KB', limit: '25 MB' }))).toBeInTheDocument();
  expect(screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([spanish['report.formatPdf'], spanish['report.formatJson'], spanish['report.formatProfile']]);
});

it('invites to sign in without a session and leaves the downloads as they are', async () => {
  answer();
  const user = userEvent.setup(); renderMenu({ ...signedInFixture, status: 'anonymous', session: null }); await openMenu(user);
  expect(screen.getByText(spanish['report.signedOut'])).toBeInTheDocument();
  expect(screen.getByRole('link', { name: spanish['shell.signIn'] })).toHaveAttribute('href', '/sign-in');
  expect(screen.getByRole('link', { name: spanish['auth.signUpAction'] })).toHaveAttribute('href', '/sign-up');
  expect(screen.queryByRole('button', { name: spanish['report.saveToAccount'] })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: spanish['report.pdf'] })).toBeEnabled();
  expect(fetcher).not.toHaveBeenCalled();
});

it('asks once per account and browser, then saves with progress and links to Projects', async () => {
  answer();
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(saveButton());
  expect(screen.getByText(spanish['report.firstSaveTitle'])).toBeInTheDocument();
  await waitFor(() => { expect(screen.getByRole('button', { name: spanish['projects.cancel'] })).toHaveFocus(); });
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  expect(localStorage.getItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`)).toBeNull();
  await user.click(saveButton());
  await user.click(screen.getByRole('button', { name: spanish['report.saveToAccount'] }));
  expect(localStorage.getItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`)).not.toBeNull();
  const worker = await lastWorker();
  expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({ format: 'pdf', input: { activeSequence: 'ACD' } });
  act(() => { worker.send({ id: 1, blob: new Blob(['pdf']), sha256: SHA }); });
  const upload = await lastUpload();
  expect(grpcWebRequest(CreateReportUploadRequestSchema, fetcher.mock.calls[calls().indexOf('CreateReportUpload')]?.[1]?.body as Uint8Array)).toMatchObject({ kind: ReportKind.PDF, sizeBytes: 3, sha256: SHA, projectId: '' });
  expect(upload.url).toBe('https://storage.example/upload?token=t');
  act(() => { upload.progress(0.64); });
  expect(screen.getByText(t('report.saving', { format: spanish['report.pdf'], percent: new Intl.NumberFormat(languageTags.es, { style: 'percent' }).format(0.64) }))).toBeInTheDocument();
  await waitFor(() => { expect(screen.getByRole('button', { name: spanish['projects.cancel'] })).toHaveFocus(); });
  act(() => { upload.finish(200); });
  expect(await screen.findByText(t('report.saved', { format: spanish['report.pdf'] }))).toBeInTheDocument();
  await waitFor(() => { expect(screen.getByRole('link', { name: spanish['report.viewInProjects'] })).toHaveFocus(); });
  expect(await screen.findByText(t('report.usage', { count: '1', max: '20', used: '0 KB', limit: '25 MB' }))).toBeInTheDocument();
  // Already told in this browser: the next save starts at once.
  await user.click(saveButton());
  expect(screen.queryByText(spanish['report.firstSaveTitle'])).not.toBeInTheDocument();
});

it('cancelling an upload removes the reservation and saves nothing', async () => {
  localStorage.setItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`, 'seen');
  answer();
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(saveButton());
  const worker = await lastWorker();
  act(() => { worker.send({ id: 1, blob: new Blob(['pdf']), sha256: SHA }); });
  const upload = await lastUpload();
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  expect(upload.abort).toHaveBeenCalled();
  expect(await screen.findByText(spanish['report.cancelled'])).toBeInTheDocument();
  expect(calls()).toContain('DeleteReport');
  expect(calls()).not.toContain('CompleteReport');
  await waitFor(() => { expect(saveButton()).toHaveFocus(); });
});

it('refuses a file over the limit before reserving and offers to download it instead', async () => {
  localStorage.setItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`, 'seen');
  answer();
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(saveButton());
  const worker = await lastWorker();
  act(() => { worker.send({ id: 1, blob: new Blob([new Uint8Array(REPORT_STORAGE_LIMITS.maxReportBytes + 1)]), sha256: SHA }); });
  expect(await screen.findByRole('alert')).toHaveTextContent(t('report.tooLarge', { size: '5 MB', limit: '5 MB' }));
  expect(calls()).not.toContain('CreateReportUpload');
  const download = screen.getByRole('button', { name: t('report.downloadFormat', { format: spanish['report.pdf'] }) });
  await waitFor(() => { expect(download).toHaveFocus(); });
  await user.click(download);
  await waitFor(() => { expect(TestWorker.instances).toHaveLength(2); });
  expect(TestWorker.instances[1]?.postMessage.mock.calls[0]?.[0]?.format).toBe('pdf');
});

it('with the account full there is no save button, only the way to choose reports to remove', async () => {
  answer(Array.from({ length: REPORT_STORAGE_LIMITS.maxReports }, (_, index) => ({ id: `r${String(index)}`, sizeBytes: 15_600 })));
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  expect(await screen.findByRole('alert')).toHaveTextContent(t('report.quotaCount', { max: '20' }));
  expect(screen.queryByRole('button', { name: spanish['report.saveToAccount'] })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: spanish['report.chooseToRemove'] })).toHaveAttribute('href', '/projects');
});

it('a refused reservation explains the quota and a failed one offers to try again', async () => {
  localStorage.setItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`, 'seen');
  let refusal = grpcWebError(GRPC_CODES.resourceExhausted, 'report-quota-exceeded');
  answer([], (method) => method === 'CreateReportUpload' ? refusal : undefined);
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(saveButton());
  const first = await lastWorker();
  act(() => { first.send({ id: 1, blob: new Blob(['pdf']), sha256: SHA }); });
  expect(await screen.findByRole('alert')).toHaveTextContent(t('report.quotaBytes', { used: '0 KB', limit: '25 MB' }));
  await waitFor(() => { expect(screen.getByRole('link', { name: spanish['report.chooseToRemove'] })).toHaveFocus(); });
  refusal = grpcWebError(GRPC_CODES.unavailable, 'reports-storage-error');
  await user.click(saveButton());
  await waitFor(() => { expect(TestWorker.instances).toHaveLength(2); });
  act(() => { TestWorker.instances[1]?.send({ id: 1, blob: new Blob(['pdf']), sha256: SHA }); });
  expect(await screen.findByText(spanish['report.saveError'])).toBeInTheDocument();
  await waitFor(() => { expect(screen.getByRole('button', { name: spanish['report.retry'] })).toHaveFocus(); });
  expect(calls()).not.toContain('DeleteReport');
});

/** Holds the next call of one method until the test releases it; every other call keeps its answer. */
function hold(method: string): { release: (response: Response) => void } {
  const base = fetcher.getMockImplementation();
  let release: (response: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => { release = resolve; });
  let used = false;
  fetcher.mockImplementation((input, init) => {
    if (!used && input.endsWith(`/${method}`)) {
      used = true;
      // Like the browser's fetch, a cancelled request ends at once instead of waiting for its answer.
      const signal = init?.signal;
      return signal ? Promise.race([held, new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => { reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      })]) : held;
    }
    return base ? base(input, init) : Promise.reject(new Error('No answer'));
  });
  return { release: (response) => { release(response); } };
}

it('offers saving only once the list has answered, so quota is never checked against nothing', async () => {
  answer([{ sizeBytes: 82_000 }]);
  const list = hold('ListReports');
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await waitFor(() => { expect(calls()).toContain('ListReports'); });
  expect(screen.queryByRole('group', { name: spanish['report.saveToAccount'] })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: spanish['report.saveToAccount'] })).not.toBeInTheDocument();
  act(() => { list.release(grpcWebResponse(ListReportsResponseSchema, { reports: [record({ sizeBytes: 82_000 })] })); });
  expect(await screen.findByRole('button', { name: spanish['report.saveToAccount'] })).toBeInTheDocument();
});

it('a quota refusal reads the list again and names the limit the account actually reached', async () => {
  localStorage.setItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`, 'seen');
  let lists = 0;
  answer([], (method) => {
    if (method === 'CreateReportUpload') return grpcWebError(GRPC_CODES.resourceExhausted, 'report-quota-exceeded');
    // Another device filled the account after this menu read the list.
    if (method === 'ListReports' && ++lists > 1) return grpcWebResponse(ListReportsResponseSchema, { reports: Array.from({ length: REPORT_STORAGE_LIMITS.maxReports }, (_, index) => record({ id: `r${String(index)}` })) });
    return undefined;
  });
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(await screen.findByRole('button', { name: spanish['report.saveToAccount'] }));
  const worker = await lastWorker();
  act(() => { worker.send({ id: 1, blob: new Blob(['pdf']), sha256: SHA }); });
  await waitFor(() => { expect(screen.getAllByRole('alert')[0]).toHaveTextContent(t('report.quotaCount', { max: '20' })); });
  expect(lists).toBe(2);
});

it('cancelling while the reservation is on its way waits for it and then releases it', async () => {
  localStorage.setItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}owner`, 'seen');
  answer();
  const reserve = hold('CreateReportUpload');
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(await screen.findByRole('button', { name: spanish['report.saveToAccount'] }));
  const worker = await lastWorker();
  act(() => { worker.send({ id: 1, blob: new Blob(['pdf']), sha256: SHA }); });
  await waitFor(() => { expect(calls()).toContain('CreateReportUpload'); });
  await user.click(screen.getByRole('button', { name: spanish['projects.cancel'] }));
  act(() => { reserve.release(grpcWebResponse(CreateReportUploadResponseSchema, { report: record({ status: ReportStatus.PENDING }), uploadUrl: 'https://storage.example/upload?token=t', contentType: 'application/pdf' })); });
  expect(await screen.findByText(spanish['report.cancelled'])).toBeInTheDocument();
  expect(calls()).toContain('DeleteReport');
  expect(TestRequest.instances).toHaveLength(0);
});

it('the first-save notice saves the format chosen when it is accepted', async () => {
  answer();
  const user = userEvent.setup(); renderMenu(); await openMenu(user);
  await user.click(await screen.findByRole('button', { name: spanish['report.saveToAccount'] }));
  await user.click(screen.getByRole('radio', { name: spanish['report.formatJson'] }));
  await user.click(screen.getByRole('button', { name: spanish['report.saveToAccount'] }));
  const worker = await lastWorker();
  expect(worker.postMessage.mock.calls[0]?.[0]?.format).toBe('json');
});

it('a notice raised for one account does not carry over to another', async () => {
  answer();
  const user = userEvent.setup(); const rendered = renderMenu(); await openMenu(user);
  await user.click(await screen.findByRole('button', { name: spanish['report.saveToAccount'] }));
  expect(screen.getByText(spanish['report.firstSaveTitle'])).toBeInTheDocument();
  const session = signedInFixture.session;
  if (!session) throw new Error('Missing session');
  const other: AuthContextValue = { ...signedInFixture, session: { ...session, user: { id: 'other', email: 'b@example.org' } } };
  rendered.rerender(<MemoryRouter><AuthContext.Provider value={other}><SequenceDraftProvider><AlignmentDraftProvider><Draft /><ReportActions /></AlignmentDraftProvider></SequenceDraftProvider></AuthContext.Provider></MemoryRouter>);
  // Once the other account's list has answered, its save group starts from nothing.
  expect(await screen.findByRole('group', { name: spanish['report.saveToAccount'] })).toBeInTheDocument();
  expect(screen.queryByText(spanish['report.firstSaveTitle'])).not.toBeInTheDocument();
  expect(localStorage.getItem(`${REPORT_FIRST_SAVE_KEY_PREFIX}other`)).toBeNull();
});
