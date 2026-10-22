import { Code, ConnectError, createClient } from '@connectrpc/connect';
import type { CallOptions, Client } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import type { DescService } from '@bufbuild/protobuf';
import { ApiError } from './apiClient';
import type { ApiErrorCode } from './apiClient';
import { API_TIMEOUT_MS, REQUEST_ID_HEADER, RPC_DETAIL_CODES } from './config';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const GRPC_WEB_CONTENT_TYPE = 'application/grpc-web';

/** A successful HTTP answer that is not gRPC-Web (a proxy page, a misrouted URL). */
class NotGrpcWeb extends Error {}

/** gRPC status codes as the safe categories the interface already explains. */
const CODE_CATEGORIES: Partial<Record<Code, ApiErrorCode>> = {
  [Code.Canceled]: 'cancelled',
  [Code.DeadlineExceeded]: 'timeout',
  [Code.Unauthenticated]: 'session',
  [Code.PermissionDenied]: 'forbidden',
  [Code.NotFound]: 'not-found',
  [Code.Aborted]: 'conflict',
  [Code.InvalidArgument]: 'validation',
  [Code.Unavailable]: 'unavailable',
  [Code.ResourceExhausted]: 'rate-limit',
  [Code.Internal]: 'unavailable',
  [Code.Unimplemented]: 'unavailable',
};

/**
 * gRPC-Web client for one service of the configured API. Requests never carry cookies or follow
 * redirects; the session token is added per call and only to this origin.
 */
export function createRpcClient<Service extends DescService>(service: Service, baseUrl: string, fetchImplementation: FetchLike = (input, init) => fetch(input, init)): Client<Service> {
  const transport = createGrpcWebTransport({
    baseUrl,
    useBinaryFormat: true,
    fetch: async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const response = await fetchImplementation(url, { ...init, credentials: 'omit', cache: 'no-store', redirect: 'error' });
      if (response.ok && !response.headers.get('Content-Type')?.startsWith(GRPC_WEB_CONTENT_TYPE)) throw new NotGrpcWeb();
      return response;
    },
  });
  return createClient(service, transport);
}

/** Per-call options: correlation id, optional session, cancellation and a bounded wait. */
export function callOptions(signal?: AbortSignal, token?: string): CallOptions {
  const headers: Record<string, string> = { [REQUEST_ID_HEADER]: crypto.randomUUID() };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers, signal, timeoutMs: API_TIMEOUT_MS };
}

/** Converts any failure of an RPC into an ApiError; server messages are stable codes, never shown. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof ConnectError)) return new ApiError('unknown');
  const requestId = error.metadata.get(REQUEST_ID_HEADER) ?? undefined;
  const detail = RPC_DETAIL_CODES[error.rawMessage];
  if (detail) return new ApiError(detail, requestId);
  if (error.code === Code.Unknown) return new ApiError(error.cause instanceof TypeError ? 'network' : 'invalid-response', requestId);
  return new ApiError(CODE_CATEGORIES[error.code] ?? 'unknown', requestId);
}

/** Runs one RPC and reports failures only as ApiError categories. */
export async function rpc<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toApiError(error);
  }
}
