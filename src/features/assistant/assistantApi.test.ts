import { expect, it, vi } from 'vitest';
import { grpcWebError, grpcWebResponse, GRPC_CODES } from '../../test/grpcWeb';
import { InterpretResponseSchema } from '../../gen/proteinforge/assistant/v1/assistant_service_pb';
import { createAssistantApi } from './assistantApi';

it.each([
  [GRPC_CODES.failedPrecondition, 'assistant-not-configured', 'unavailable'],
  [GRPC_CODES.unavailable, 'assistant-provider-error', 'unavailable'],
  [GRPC_CODES.unavailable, 'assistant-unreachable', 'unavailable'],
  [GRPC_CODES.unavailable, 'assistant-invalid-response', 'unavailable'],
  [GRPC_CODES.unavailable, 'assistant-incomplete', 'unavailable'],
  [GRPC_CODES.unavailable, 'assistant-unverified-figure', 'unavailable'],
  [GRPC_CODES.resourceExhausted, 'assistant-rate-limit', 'rate-limit'],
  [GRPC_CODES.unauthenticated, 'invalid-token', 'session'],
] as const)('classifies assistant failure %s/%s without exposing server details', async (status, detail, category) => {
  const fetcher = vi.fn().mockResolvedValue(grpcWebError(status, detail, { 'X-Request-Id': 'reading-reference' }));
  const api = createAssistantApi('https://api.example.com', fetcher);
  const error: unknown = await api.interpret('analysis', 'es', [{ label: 'Longitud', value: '110' }], 'test-token')
    .catch((failure: unknown) => failure);
  expect(error).toMatchObject({ code: category, message: category, requestId: 'reading-reference' });
  expect(JSON.stringify(error)).not.toContain(detail);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

function delayedReading(delayMs: number) {
  return vi.fn((_input: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Request aborted', 'AbortError')); };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(grpcWebResponse(InterpretResponseSchema, {
        text: 'Estos son los resultados calculados.', model: 'openai/gpt-oss-120b', provider: 'groq',
        createTime: { seconds: 1_793_016_000n, nanos: 0 },
      }));
    }, delayMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  }));
}

it.each([12_000, 34_000])('accepts a reading after %s ms within the backend identity and provider budget', async (delayMs) => {
  vi.useFakeTimers();
  try {
    const fetcher = delayedReading(delayMs);
    const api = createAssistantApi('https://api.example.com', fetcher);
    const result = api.interpret('analysis', 'es', [{ label: 'Longitud', value: '110' }], 'test-token')
      .then((reading) => ({ reading }), (error: unknown) => ({ error }));
    await vi.advanceTimersByTimeAsync(delayMs);
    expect(await result).toMatchObject({ reading: { text: 'Estos son los resultados calculados.', provider: 'groq' } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it('still times out a stalled reading after forty seconds without retrying', async () => {
  vi.useFakeTimers();
  try {
    const fetcher = delayedReading(45_000);
    const api = createAssistantApi('https://api.example.com', fetcher);
    let settled = false;
    const result = api.interpret('analysis', 'es', [{ label: 'Longitud', value: '110' }], 'test-token')
      .catch((error: unknown) => error).finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(39_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ code: 'timeout' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it('cancels a delayed reading immediately when its caller leaves', async () => {
  vi.useFakeTimers();
  try {
    const fetcher = delayedReading(12_000);
    const api = createAssistantApi('https://api.example.com', fetcher);
    const controller = new AbortController();
    const result = api.interpret('analysis', 'es', [{ label: 'Longitud', value: '110' }], 'test-token', controller.signal)
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(5_000);
    controller.abort();
    expect(await result).toMatchObject({ code: 'cancelled' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
