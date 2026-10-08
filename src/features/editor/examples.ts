import { FastaParser } from './fasta';
import type { FastaEntry } from './fasta';

/** First entry of a bundled FASTA example, or `undefined` when the text has none. */
export function exampleEntry(fasta: string): FastaEntry | undefined {
  const parser = new FastaParser();
  return [...parser.addChunk(fasta), ...parser.finish()][0];
}
