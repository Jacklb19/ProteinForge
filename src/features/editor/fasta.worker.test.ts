import { afterEach, describe, expect, it, vi } from 'vitest';

interface MockWorkerContext {
  onmessage: ((event: MessageEvent<unknown>) => Promise<void>) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

async function setupWorker(): Promise<MockWorkerContext> {
  const context: MockWorkerContext = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal('self', context);
  vi.resetModules();
  await import('./fasta.worker');
  return context;
}

function fileWithStream(content: string): File {
  const file = new File([content], 'prueba.fa');
  const bytes = new TextEncoder().encode(content);
  Object.defineProperty(file, 'stream', {
    value: () => new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  });
  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('fasta.worker', () => {
  it('publishes entries and confirms completion', async () => {
    const context = await setupWorker();
    await context.onmessage?.(new MessageEvent('message', { data: fileWithStream('>uno\nac\n>dos\nWX') }));
    expect(context.postMessage).toHaveBeenCalledWith({
      type: 'entries',
      entries: [{ number: 1, header: 'uno', sequence: 'AC', invalidPositions: [] }],
    });
    expect(context.postMessage).toHaveBeenCalledWith({ type: 'complete' });
  });

  it('rejects files larger than 5 MB before reading', async () => {
    const context = await setupWorker();
    const file = new File([new Uint8Array(5_000_001)], 'grande.fa');
    await context.onmessage?.(new MessageEvent('message', { data: file }));
    expect(context.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: 'El archivo supera el límite de 5 MB.',
    });
  });

  it('reports format errors explicitly', async () => {
    const context = await setupWorker();
    await context.onmessage?.(new MessageEvent('message', { data: fileWithStream('AC\n') }));
    expect(context.postMessage).toHaveBeenCalledWith({
      type: 'error',
      message: expect.stringContaining('cabecera FASTA') as string,
    });
  });
});
