import type { Route } from '@playwright/test';
import type { DescMessage, MessageInitShape, MessageShape } from '@bufbuild/protobuf';
import { GRPC_CODES, GRPC_WEB_CONTENT_TYPE, grpcWebBody, grpcWebErrorBody, grpcWebRequest } from '../src/test/grpcWeb';

export { GRPC_CODES };

/** RPC paths of the API: /<package>.<Service>/<Method>. Supabase Auth requests do not match. */
export function isRpc(url: URL): boolean {
  return url.pathname.startsWith('/proteinforge.');
}

/** "Service/Method", for example "ProjectService/ListProjects". */
export function rpcMethod(route: Route): string {
  const [service = '', method = ''] = new URL(route.request().url()).pathname.split('/').slice(-2);
  return `${service.split('.').at(-1) ?? ''}/${method}`;
}

const headers = (requestId?: string): Record<string, string> => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'X-Request-Id, Grpc-Status, Grpc-Message',
  ...(requestId ? { 'X-Request-Id': requestId } : {}),
});

export function fulfillRpc<Desc extends DescMessage>(route: Route, schema: Desc, message: MessageInitShape<Desc>): Promise<void> {
  return route.fulfill({ status: 200, contentType: GRPC_WEB_CONTENT_TYPE, headers: headers(), body: Buffer.from(grpcWebBody(schema, message)) });
}

export function fulfillRpcError(route: Route, code: number, message: string, requestId?: string): Promise<void> {
  return route.fulfill({ status: 200, contentType: GRPC_WEB_CONTENT_TYPE, headers: headers(requestId), body: Buffer.from(grpcWebErrorBody(code, message)) });
}

export function rpcRequest<Desc extends DescMessage>(route: Route, schema: Desc): MessageShape<Desc> {
  return grpcWebRequest(schema, route.request().postDataBuffer());
}
