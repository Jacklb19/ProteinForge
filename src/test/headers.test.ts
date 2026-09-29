import { describe, expect, it } from 'vitest';
import configuracion from '../../vercel.json';

const cabeceras = new Map(
  configuracion.headers[0]?.headers.map(({ key, value }) => [key, value]) ?? [],
);

describe('Cabeceras de la aplicación desplegada', () => {
  it('activa aislamiento de origen cruzado en todas las rutas', () => {
    expect(configuracion.headers[0]?.source).toBe('/(.*)');
    expect(cabeceras.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(cabeceras.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  });

  it('permite WebAssembly, Workers propios y BinaryCIF público', () => {
    const csp = cabeceras.get('Content-Security-Policy') ?? '';
    expect(csp).toMatch(/script-src[^;]*'wasm-unsafe-eval'/);
    expect(csp).toMatch(/worker-src 'self' blob:/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/models\.rcsb\.org/);
  });
});
