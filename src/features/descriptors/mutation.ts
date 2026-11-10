/** The sequence with one residue replaced; `position` counts from 1. Null when the position is outside it. */
export function substitute(sequence: string, position: number, residue: string): string | null {
  if (!Number.isInteger(position) || position < 1 || position > sequence.length) return null;
  return `${sequence.slice(0, position - 1)}${residue}${sequence.slice(position)}`;
}
