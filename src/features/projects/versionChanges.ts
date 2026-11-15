import type { TranslationKey, TranslationVariables } from '../../i18n/translate';
import type { ProjectPreview, ProjectVersion } from './contracts';

export interface Phrase { key: TranslationKey; variables?: TranslationVariables }
/** What a version holds against the current content: one sentence of parts, the same content, or nothing to say. */
export type VersionChanges = { kind: 'parts'; parts: Phrase[] } | { kind: 'same' } | { kind: 'unknown' };

type Comparison = ProjectPreview['alignment'];

function sameComparison(version: Comparison, current: Comparison): boolean {
  if (!version || !current) return !version && !current;
  return version.firstLength === current.firstLength && version.secondLength === current.secondLength
    && version.firstPrefix === current.firstPrefix && version.secondPrefix === current.secondPrefix
    && version.matrix === current.matrix && version.mode === current.mode;
}

/** Sequence part, from the server's full comparison and the preview lengths; null when it cannot be told. */
function sequencePhrase(sameSequence: boolean | undefined, version: number, current: number): Phrase | null {
  if (sameSequence === true) return { key: 'versions.sameSequence' };
  const difference = Math.abs(current - version);
  if (version < current) return difference === 1 ? { key: 'versions.fewerResidueOne' } : { key: 'versions.fewerResidues', variables: { count: difference } };
  if (version > current) return difference === 1 ? { key: 'versions.moreResidueOne' } : { key: 'versions.moreResidues', variables: { count: difference } };
  // Equal lengths say nothing about the residues unless the server compared them.
  return sameSequence === false ? { key: 'versions.sameLengthDifferent' } : null;
}

/**
 * Compares a version's preview with the project's current one. Residues that differ are not counted:
 * the server says only whether the whole sequence is the same, and lengths come from the previews.
 */
export function versionChanges(version: ProjectVersion, current: ProjectPreview | null | undefined): VersionChanges {
  const saved = version.preview;
  if (!saved || !current) return { kind: 'unknown' };
  const comparisonKept = sameComparison(saved.alignment, current.alignment);
  if (version.sameSequence === true && comparisonKept) return { kind: 'same' };
  const parts: Phrase[] = [];
  const sequence = sequencePhrase(version.sameSequence, saved.sequenceLength, current.sequenceLength);
  if (sequence) parts.push(sequence);
  if (!comparisonKept) parts.push(saved.alignment ? { key: 'versions.hadComparison', variables: { count: saved.alignment.secondLength } } : { key: 'versions.noComparison' });
  return parts.length ? { kind: 'parts', parts } : { kind: 'unknown' };
}
