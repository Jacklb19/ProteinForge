import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RespuestaDescriptores, SolicitudDescriptores } from './messages';

interface ContextoSimulado {
  onmessage: ((evento: MessageEvent<SolicitudDescriptores>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Worker de descriptores', () => {
  it('devuelve el cálculo y rechaza entradas inválidas en la frontera', async () => {
    const contexto: ContextoSimulado = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal('self', contexto);
    await import('./descriptors.worker');
    contexto.onmessage?.(new MessageEvent('message', { data: { id: 1, secuencia: 'ACDE' } }));
    contexto.onmessage?.(new MessageEvent('message', { data: { id: 2, secuencia: 'ACXDE' } }));
    const primera = contexto.postMessage.mock.calls[0]?.[0] as RespuestaDescriptores;
    const segunda = contexto.postMessage.mock.calls[1]?.[0] as RespuestaDescriptores;
    expect(primera.id).toBe(1);
    expect(primera.resultado?.longitud).toBe(4);
    expect(segunda.id).toBe(2);
    expect(segunda.error).toMatch(/aminoácidos estándar/i);
  });
});
