import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPORT_UPLOAD_TIMEOUT_MS } from './config';
import { uploadReport } from './uploadReport';

class TestRequest {
  static last: TestRequest | null = null;
  method = ''; url = ''; status = 0; timeout = 0; withCredentials = true; headers: Record<string, string> = {}; body: Blob | null = null;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null; onerror: (() => void) | null = null; ontimeout: (() => void) | null = null; onabort: (() => void) | null = null;
  abort = vi.fn(() => { this.onabort?.(); });
  constructor() { TestRequest.last = this; }
  open(method: string, url: string): void { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string): void { this.headers[name] = value; }
  send(body: Blob): void { this.body = body; }
  progress(loaded: number, total: number): void { this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent); }
  finish(status: number): void { this.status = status; this.onload?.(); }
}
function sent(): TestRequest {
  if (!TestRequest.last) throw new Error('No upload');
  return TestRequest.last;
}

beforeEach(() => { TestRequest.last = null; vi.stubGlobal('XMLHttpRequest', TestRequest); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('upload to the signed address', () => {
  it('puts the exact bytes with the reserved type, without cookies or the session, and reports progress', async () => {
    const progress = vi.fn<(fraction: number) => void>();
    const file = new Blob(['a,b\r\n'], { type: 'text/csv;charset=utf-8' });
    const upload = uploadReport('https://storage.example/upload?token=t', file, 'text/csv', { signal: new AbortController().signal, onProgress: progress });
    const request = sent();
    expect(request).toMatchObject({ method: 'PUT', url: 'https://storage.example/upload?token=t', withCredentials: false, timeout: REPORT_UPLOAD_TIMEOUT_MS, headers: { 'Content-Type': 'text/csv' } });
    expect(request.headers).not.toHaveProperty('Authorization');
    expect(request.body?.type).toBe('text/csv');
    expect(await request.body?.text()).toBe('a,b\r\n');
    request.progress(2, 5); request.finish(200);
    await expect(upload).resolves.toBeUndefined();
    expect(progress.mock.calls.map((call) => call[0])).toEqual([0.4, 1]);
  });

  it('turns refusals, network failures and time limits into failures and cancellation into cancelled', async () => {
    for (const end of [(request: TestRequest) => { request.finish(403); }, (request: TestRequest) => { request.onerror?.(); }, (request: TestRequest) => { request.ontimeout?.(); }]) {
      const upload = uploadReport('https://storage.example/u', new Blob(['x']), 'application/pdf', { signal: new AbortController().signal, onProgress: vi.fn() });
      end(sent());
      await expect(upload).rejects.toMatchObject({ reason: 'failed' });
    }
    const controller = new AbortController();
    const upload = uploadReport('https://storage.example/u', new Blob(['x']), 'application/pdf', { signal: controller.signal, onProgress: vi.fn() });
    controller.abort();
    await expect(upload).rejects.toMatchObject({ reason: 'cancelled' });
    expect(sent().abort).toHaveBeenCalled();
    TestRequest.last = null;
    await expect(uploadReport('https://storage.example/u', new Blob(['x']), 'application/pdf', { signal: controller.signal, onProgress: vi.fn() })).rejects.toMatchObject({ reason: 'cancelled' });
    expect(TestRequest.last).toBeNull();
  });
});
