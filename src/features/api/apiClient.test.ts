import { afterEach, describe, expect, it, vi } from 'vitest';
import { GetMeResponseSchema, GetStatusResponseSchema } from '../../gen/proteinforge/account/v1/account_service_pb';
import { GRPC_CODES, grpcWebError, grpcWebResponse } from '../../test/grpcWeb';
import { ApiError, createProteinForgeApi } from './apiClient';
import { API_TIMEOUT_MS, readApiBaseUrl } from './config';
import { isoFromTimestamp, timestampFromIso } from './timestamps';

afterEach(() => { vi.useRealTimers(); });

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const ACCOUNT = 'https://api.example.com/proteinforge.account.v1.AccountService';

describe('configured API contracts', () => {
  it('rejects malformed URLs and URL credentials, preserving the explicit base path', () => {
    for (const value of ['', 'invalid', 'javascript:alert(1)', 'https://user:password@example.com', 'https://example.com?key=secret', 'https://example.com/#token']) {
      expect(readApiBaseUrl({ VITE_API_BASE_URL: value } as ImportMetaEnv)).toBeNull();
    }
    expect(readApiBaseUrl({ VITE_API_BASE_URL: ' https://example.com/api/ ' } as ImportMetaEnv)).toBe('https://example.com/api');
  });

  it('calls AccountService over gRPC-Web and sends the session only to GetMe, without redirects or cookies', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockResolvedValueOnce(grpcWebResponse(GetStatusResponseSchema, { status: 'ok', version: '0.1.0', identityConfigured: true }))
      .mockResolvedValueOnce(grpcWebResponse(GetMeResponseSchema, { id: 'test-user', email: 'test@example.com' }));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    expect(await api.health()).toEqual({ status: 'ok', version: '0.1.0', identity: true });
    const [statusUrl, statusInit] = fetcher.mock.calls[0] ?? [];
    expect(statusUrl).toBe(`${ACCOUNT}/GetStatus`);
    expect(statusInit).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store' });
    const statusHeaders = new Headers(statusInit?.headers);
    expect(statusHeaders.get('Content-Type')).toBe('application/grpc-web+proto');
    expect(statusHeaders.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(statusHeaders.has('Authorization')).toBe(false);
    expect(await api.me('test-token')).toEqual({ id: 'test-user', email: 'test@example.com' });
    expect(fetcher.mock.calls[1]?.[0]).toBe(`${ACCOUNT}/GetMe`);
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('rejects invalid successful responses and empty sessions', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(grpcWebResponse(GetStatusResponseSchema, { status: 'starting', version: '0.1.0' }));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    await expect(api.health()).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(api.me('')).rejects.toMatchObject({ code: 'session' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('classifies gRPC status codes without surfacing server details', async () => {
    const api = createProteinForgeApi('https://api.example.com', vi.fn<Fetcher>().mockResolvedValue(grpcWebError(GRPC_CODES.unauthenticated, 'private-test-value', { 'X-Request-Id': 'test-reference' })));
    const error: unknown = await api.me('test-token').catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'session', requestId: 'test-reference', message: 'session' });
    expect(JSON.stringify(error)).not.toContain('private-test-value');
  });

  it('distinguishes a network failure from an unavailable or non-gRPC service', async () => {
    const fetcher = vi.fn<Fetcher>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('unexpected html', { headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(grpcWebError(GRPC_CODES.failedPrecondition, 'identity-not-configured'));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    await expect(api.health()).rejects.toMatchObject({ code: 'network' });
    await expect(api.health()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(api.health()).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(api.me('test-token')).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('cancels an obsolete request and bounds the wait for a service', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_input: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    const controller = new AbortController();
    const cancelled = expect(api.health(controller.signal)).rejects.toMatchObject({ code: 'cancelled' });
    controller.abort();
    await cancelled;
    const timeout = expect(api.health()).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    await timeout;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('wire timestamps', () => {
  it('keep every fractional digit, so saved revisions match exactly', () => {
    expect(isoFromTimestamp(timestampFromIso('2026-10-12T08:00:00.123456+00:00'))).toBe('2026-10-12T08:00:00.123456Z');
    expect(isoFromTimestamp(timestampFromIso('2026-10-12T10:00:00.5+02:00'))).toBe('2026-10-12T08:00:00.5Z');
    expect(isoFromTimestamp(timestampFromIso('2026-10-12T08:00:00Z'))).toBe('2026-10-12T08:00:00Z');
    expect(isoFromTimestamp(undefined)).toBeNull();
    expect(() => timestampFromIso('not a date')).toThrow(RangeError);
  });
});
