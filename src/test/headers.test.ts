import { describe, expect, it } from 'vitest';
import configuration from '../../vercel.json';

const headers = new Map(
  configuration.headers[0]?.headers.map(({ key, value }) => [key, value]) ?? [],
);

describe('deployed application headers', () => {
  it('enables cross-origin isolation on every route', () => {
    expect(configuration.headers[0]?.source).toBe('/(.*)');
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  });

  it('allows WebAssembly, same-origin workers, and public BinaryCIF', () => {
    const csp = headers.get('Content-Security-Policy') ?? '';
    expect(csp).toMatch(/script-src[^;]*'wasm-unsafe-eval'/);
    expect(csp).toMatch(/worker-src 'self' blob:/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/models\.rcsb\.org/);
  });
});
