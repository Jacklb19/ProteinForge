import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import type { DescMessage, MessageInitShape, MessageShape } from '@bufbuild/protobuf';

/**
 * gRPC-Web wire format for tests: unit tests answer `fetch` with it and E2E routes fulfil
 * requests with it, so every check exercises the real browser protocol.
 */
export const GRPC_WEB_CONTENT_TYPE = 'application/grpc-web+proto';
const MESSAGE_FLAG = 0x00;
const TRAILER_FLAG = 0x80;
const HEADER_BYTES = 5;

/** Numeric gRPC codes used by the API (same values as Code in @connectrpc/connect). */
export const GRPC_CODES = { ok: 0, invalidArgument: 3, notFound: 5, permissionDenied: 7, aborted: 10, unimplemented: 12, failedPrecondition: 9, unavailable: 14, unauthenticated: 16 } as const;

function frame(flag: number, payload: Uint8Array): Uint8Array {
  const output = new Uint8Array(HEADER_BYTES + payload.length);
  output[0] = flag;
  new DataView(output.buffer).setUint32(1, payload.length);
  output.set(payload, HEADER_BYTES);
  return output;
}

function trailer(code: number, message = ''): Uint8Array {
  return frame(TRAILER_FLAG, new TextEncoder().encode(`grpc-status:${String(code)}\r\ngrpc-message:${encodeURIComponent(message)}\r\n`));
}

function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

/** Body of a successful unary response: one message frame and an OK trailer. */
export function grpcWebBody<Desc extends DescMessage>(schema: Desc, message: MessageInitShape<Desc>): Uint8Array<ArrayBuffer> {
  return join([frame(MESSAGE_FLAG, toBinary(schema, create(schema, message))), trailer(GRPC_CODES.ok)]);
}

/** Body of a failed call: only a trailer with the status code and the stable server message. */
export function grpcWebErrorBody(code: number, message: string): Uint8Array<ArrayBuffer> {
  return join([trailer(code, message)]);
}

export function grpcWebResponse<Desc extends DescMessage>(schema: Desc, message: MessageInitShape<Desc>, headers: Record<string, string> = {}): Response {
  return new Response(grpcWebBody(schema, message), { headers: { 'Content-Type': GRPC_WEB_CONTENT_TYPE, ...headers } });
}

export function grpcWebError(code: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(grpcWebErrorBody(code, message), { headers: { 'Content-Type': GRPC_WEB_CONTENT_TYPE, ...headers } });
}

/** Decodes the single request message sent by the client. */
export function grpcWebRequest<Desc extends DescMessage>(schema: Desc, body: BodyInit | Uint8Array | null | undefined): MessageShape<Desc> {
  if (!(body instanceof Uint8Array)) throw new TypeError('Expected a binary gRPC-Web request body');
  const length = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(1);
  return fromBinary(schema, body.subarray(HEADER_BYTES, HEADER_BYTES + length));
}
