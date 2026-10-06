import { FastaParser, type FastaEntry } from './fasta';

/** Decodes and parses a FASTA stream without buffering the full file. */
export async function loadFasta(
  stream: ReadableStream<Uint8Array>,
  publish: (entries: FastaEntry[]) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parser = new FastaParser();

  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const entries = parser.addChunk(decoder.decode(chunk.value, { stream: true }));
      if (entries.length > 0) publish(entries);
    }
    const remaining = decoder.decode();
    if (remaining) {
      const entries = parser.addChunk(remaining);
      if (entries.length > 0) publish(entries);
    }
    const lastEntries = parser.finish();
    if (lastEntries.length > 0) publish(lastEntries);
  } finally {
    reader.releaseLock();
  }
}
