import { expect, it, vi } from 'vitest';
import { grpcWebError, GRPC_CODES } from '../../test/grpcWeb';
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
