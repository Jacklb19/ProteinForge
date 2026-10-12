import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createProteinForgeApi } from './apiClient';
import { API_TIMEOUT_MS, readApiBaseUrl } from './config';

afterEach(() => { vi.useRealTimers(); });

describe('configured API contracts', () => {
  it('rejects malformed URLs and URL credentials, preserving the explicit base path', () => {
    for (const value of ['', 'invalid', 'javascript:alert(1)', 'https://user:password@example.com', 'https://example.com?key=secret', 'https://example.com/#token']) {
      expect(readApiBaseUrl({ VITE_API_BASE_URL: value } as ImportMetaEnv)).toBeNull();
    }
    expect(readApiBaseUrl({ VITE_API_BASE_URL: ' https://example.com/api/ ' } as ImportMetaEnv)).toBe('https://example.com/api');
  });

  it('validates health and sends the session only to /me, without redirects or cookies', async () => {
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ status: 'ok', version: '0.1.0', identity: true }))
      .mockResolvedValueOnce(Response.json({ id: 'test-user', email: 'test@example.com' }));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    expect(await api.health()).toEqual({ status: 'ok', version: '0.1.0', identity: true });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error' });
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
    expect(await api.me('test-token')).toEqual({ id: 'test-user', email: 'test@example.com' });
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://api.example.com/v1/me');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  });

  it('rejects invalid successful responses and empty sessions', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'ok', identity: 'true' }));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    await expect(api.health()).rejects.toMatchObject({ code: 'invalid-response' });
    await expect(api.me('')).rejects.toMatchObject({ code: 'session' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('classifies RFC 9457 errors without surfacing provider details', async () => {
    const api = createProteinForgeApi('https://api.example.com', vi.fn().mockResolvedValue(Response.json({ detail: 'private-test-value', requestId: 'test-reference' }, { status: 401 })));
    const error: unknown = await api.me('test-token').catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'session', requestId: 'test-reference', message: 'session' });
    expect(JSON.stringify(error)).not.toContain('private-test-value');
  });

  it('distinguishes a network failure from an unavailable or non-JSON service', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('unexpected html'));
    const api = createProteinForgeApi('https://api.example.com', fetcher);
    await expect(api.health()).rejects.toMatchObject({ code: 'network' });
    await expect(api.health()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(api.health()).rejects.toMatchObject({ code: 'invalid-response' });
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
