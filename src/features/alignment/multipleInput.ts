import { FastaParser } from '../editor/fasta';
import { MULTIPLE_MAX_RESIDUES, MULTIPLE_MAX_SEQUENCES, MULTIPLE_MIN_SEQUENCES } from './config';
import type { MultipleEntry } from './multiple';

export type MultipleProblem = { kind: 'format' } | { kind: 'count'; count: number } | { kind: 'invalid' | 'length' | 'empty'; name: string };

/** Reads several FASTA records and says the first reason they cannot be aligned together, if any. */
export function readEntries(text: string): { entries: MultipleEntry[]; problem: MultipleProblem | null } {
  let parsed;
  try { const parser = new FastaParser(); parsed = [...parser.addChunk(text), ...parser.finish()]; }
  catch { return { entries: [], problem: { kind: 'format' } }; }
  const entries = parsed.map((entry, index) => ({ name: entry.header.trim() || String(index + 1), sequence: entry.sequence }));
  if (entries.length < MULTIPLE_MIN_SEQUENCES || entries.length > MULTIPLE_MAX_SEQUENCES) return { entries, problem: { kind: 'count', count: entries.length } };
  for (const [index, entry] of parsed.entries()) {
    const name = entries[index]?.name ?? '';
    if (entry.invalidPositions.length > 0) return { entries, problem: { kind: 'invalid', name } };
    if (entry.sequence.length === 0) return { entries, problem: { kind: 'empty', name } };
    if (entry.sequence.length > MULTIPLE_MAX_RESIDUES) return { entries, problem: { kind: 'length', name } };
  }
  return { entries, problem: null };
}
