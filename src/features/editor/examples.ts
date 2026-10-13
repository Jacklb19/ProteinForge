import { FastaParser } from './fasta';
import type { FastaEntry } from './fasta';
import { EXAMPLE_SEQUENCES } from './config';
import { bundledSequenceSource } from './source';
import type { SequenceSource } from './source';

/** First entry of a bundled FASTA example, or `undefined` when the text has none. */
export function exampleEntry(fasta: string): FastaEntry | undefined {
  const parser = new FastaParser();
  return [...parser.addChunk(fasta), ...parser.finish()][0];
}

/** The protein every work screen opens with; visitors replace it with their own sequence. */
export const DEFAULT_EXAMPLE: { text: string; source: SequenceSource | null } = (() => {
  const entry = EXAMPLE_SEQUENCES[0] ? exampleEntry(EXAMPLE_SEQUENCES[0].fasta) : undefined;
  return entry ? { text: entry.sequence, source: bundledSequenceSource(entry) } : { text: '', source: null };
})();
