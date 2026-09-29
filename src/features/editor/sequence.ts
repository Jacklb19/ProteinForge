/** Residues accepted by the editor; ambiguous residues keep their original position. */
export const STANDARD_AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';
export const ADDITIONAL_AMINO_ACIDS = 'UOBZX';
const ALLOWED_AMINO_ACIDS = new Set(STANDARD_AMINO_ACIDS + ADDITIONAL_AMINO_ACIDS);

export interface ValidationResult {
  invalidPositions: number[];
  sequence: string;
}

/** Validates a sequence without React or browser dependencies. Positions index the original text. */
export function validateSequence(text: string): ValidationResult {
  const invalidPositions: number[] = [];
  const residues: string[] = [];
  const lastResidue = text.search(/\*?[\r\n]*$/);

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\n' || character === '\r' || (character === '*' && index === lastResidue)) continue;
    const code = character?.charCodeAt(0) ?? -1;
    const uppercase = code >= 97 && code <= 122
      ? String.fromCharCode(code - 32)
      : character ?? '';
    if (ALLOWED_AMINO_ACIDS.has(uppercase)) {
      residues.push(uppercase);
    } else {
      invalidPositions.push(index);
    }
  }

  return { invalidPositions, sequence: residues.join('') };
}

/** Extracts residues with defined physicochemical parameters and counts exclusions. */
export function splitStandardResidues(sequence: string): { standard: string; excluded: number } {
  let standard = '';
  let excluded = 0;
  for (const residue of sequence) {
    if (STANDARD_AMINO_ACIDS.includes(residue)) standard += residue;
    else excluded += 1;
  }
  return { standard, excluded };
}

/** Revalidates the changed span and shifts subsequent positions. */
export function updateInvalidPositions(
  previous: string,
  next: string,
  previousPositions: readonly number[],
): number[] {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) {
    start += 1;
  }

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > start && nextEnd > start && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const offset = nextEnd - previousEnd;
  const retainedBefore = previousPositions.filter((position) => position < start);
  const changed = validateSequence(next.slice(start, nextEnd)).invalidPositions.map(
    (position) => position + start,
  );
  const retainedAfter = previousPositions
    .filter((position) => position >= previousEnd)
    .map((position) => position + offset);

  return [...retainedBefore, ...changed, ...retainedAfter];
}
