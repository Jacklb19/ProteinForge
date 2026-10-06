import { describe, expect, it } from 'vitest';
import { loadFasta } from './loadFasta';
import type { FastaEntry } from './fasta';

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('loadFasta', () => {
  it('publishes entries as they arrive without waiting for the full file', async () => {
    const encoder = new TextEncoder();
    const published: FastaEntry[][] = [];
    await loadFasta(streamOf([
      encoder.encode('>uno\nAC\n>dos\n'),
      encoder.encode('DE'),
    ]), (entries) => { published.push(entries); });
    expect(published).toHaveLength(2);
    expect(published[0]?.[0]?.sequence).toBe('AC');
    expect(published[1]?.[0]?.sequence).toBe('DE');
  });

  it('rejects invalid UTF-8 bytes', async () => {
    await expect(loadFasta(streamOf([new Uint8Array([0xff])]), () => {})).rejects.toThrow();
  });

  it('parses a 5 MB FASTA with multiple entries in chunks', async () => {
    const base = Array.from({ length: 1000 }, (_, index) =>
      `>entrada ${String(index + 1)}\n${'ACDE'.repeat(1240)}\n`).join('');
    const lastHeader = '>ultima\n';
    const content = base + lastHeader + 'A'.repeat(5_000_000 - base.length - lastHeader.length);
    const bytes = new TextEncoder().encode(content);
    const chunks: Uint8Array[] = [];
    for (let index = 0; index < bytes.length; index += 65_536) {
      chunks.push(bytes.slice(index, index + 65_536));
    }
    let count = 0;
    await loadFasta(streamOf(chunks), (entries) => { count += entries.length; });
    expect(bytes.length).toBe(5_000_000);
    expect(count).toBe(1001);
  });
});
