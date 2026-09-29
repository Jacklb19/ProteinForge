import { afterEach, describe, expect, it, vi } from 'vitest';

interface ContextoSimulado {
  onmessage: ((evento: MessageEvent<unknown>) => Promise<void>) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

async function prepararWorker(): Promise<ContextoSimulado> {
  const contexto: ContextoSimulado = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal('self', contexto);
  vi.resetModules();
  await import('./fasta.worker');
  return contexto;
}

function archivoConFlujo(contenido: string): File {
  const archivo = new File([contenido], 'prueba.fa');
  const bytes = new TextEncoder().encode(contenido);
  Object.defineProperty(archivo, 'stream', {
    value: () => new ReadableStream<Uint8Array>({
      start(controlador) {
        controlador.enqueue(bytes);
        controlador.close();
      },
    }),
  });
  return archivo;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('fasta.worker', () => {
  it('publica las entradas y confirma la carga', async () => {
    const contexto = await prepararWorker();
    await contexto.onmessage?.(new MessageEvent('message', { data: archivoConFlujo('>uno\nac\n>dos\nWX') }));
    expect(contexto.postMessage).toHaveBeenCalledWith({
      tipo: 'entradas',
      entradas: [{ numero: 1, encabezado: 'uno', secuencia: 'AC', posicionesInvalidas: [] }],
    });
    expect(contexto.postMessage).toHaveBeenCalledWith({ tipo: 'completo' });
  });

  it('rechaza archivos mayores a 5 MB antes de leerlos', async () => {
    const contexto = await prepararWorker();
    const archivo = new File([new Uint8Array(5_000_001)], 'grande.fa');
    await contexto.onmessage?.(new MessageEvent('message', { data: archivo }));
    expect(contexto.postMessage).toHaveBeenCalledWith({
      tipo: 'error',
      mensaje: 'El archivo supera el límite de 5 MB.',
    });
  });

  it('informa errores de formato sin silenciarlos', async () => {
    const contexto = await prepararWorker();
    await contexto.onmessage?.(new MessageEvent('message', { data: archivoConFlujo('AC\n') }));
    expect(contexto.postMessage).toHaveBeenCalledWith({
      tipo: 'error',
      mensaje: expect.stringContaining('cabecera FASTA') as string,
    });
  });
});
