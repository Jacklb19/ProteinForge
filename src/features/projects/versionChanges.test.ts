import { describe, expect, it } from 'vitest';
import { translate } from '../../i18n/translate';
import type { ProjectPreview, ProjectVersion } from './contracts';
import { versionChanges } from './versionChanges';
import type { VersionChanges } from './versionChanges';

const preview = (sequenceLength: number, alignment: ProjectPreview['alignment'] = null): ProjectPreview => ({
  sequenceLength, sequencePrefix: 'A'.repeat(Math.min(sequenceLength, 40)), excluded: 0, descriptors: null, source: null, alignment,
});
const comparison = (secondLength: number): NonNullable<ProjectPreview['alignment']> => ({
  firstLength: 110, secondLength, firstPrefix: 'A'.repeat(40), secondPrefix: 'C'.repeat(40), matrix: 'BLOSUM62', mode: 'global', result: null,
});
const version = (saved: ProjectPreview | null, sameSequence?: boolean): ProjectVersion => ({
  id: '00000000-0000-4000-8000-000000000020', savedAt: '2026-11-12T16:10:00Z', preview: saved, ...(sameSequence === undefined ? {} : { sameSequence }),
});
function sentence(changes: VersionChanges, locale: 'es' | 'en' = 'es'): string | null {
  if (changes.kind === 'unknown') return null;
  if (changes.kind === 'same') return translate(locale, 'versions.sameAsCurrent');
  const parts = changes.parts.map(part => translate(locale, part.key, part.variables));
  return translate(locale, 'versions.againstCurrent', { changes: parts.join(translate(locale, 'versions.partSeparator')) });
}

describe('a version against the current content', () => {
  it('says how many residues fewer or more, from the preview lengths', () => {
    expect(sentence(versionChanges(version(preview(51), false), preview(110)))).toBe('Frente a la actual: 59 residuos menos.');
    expect(sentence(versionChanges(version(preview(115), false), preview(110)))).toBe('Frente a la actual: 5 residuos más.');
    expect(sentence(versionChanges(version(preview(109), false), preview(110)))).toBe('Frente a la actual: 1 residuo menos.');
    expect(sentence(versionChanges(version(preview(111), false), preview(110)), 'en')).toBe('Compared with the current one: 1 more residue.');
  });

  it('tells a different sequence of the same length apart only when the server compared them', () => {
    expect(sentence(versionChanges(version(preview(110), false), preview(110)))).toBe('Frente a la actual: la misma longitud, secuencia distinta.');
    // An older server sends no comparison: equal lengths alone say nothing.
    expect(versionChanges(version(preview(110)), preview(110))).toEqual({ kind: 'unknown' });
  });

  it('adds what changed in the comparison, present or absent', () => {
    expect(sentence(versionChanges(version(preview(110, comparison(105)), true), preview(110))))
      .toBe('Frente a la actual: la misma secuencia; además tenía una comparación con otra de 105 residuos.');
    expect(sentence(versionChanges(version(preview(51), false), preview(110, comparison(105)))))
      .toBe('Frente a la actual: 59 residuos menos; no tenía la comparación que tiene ahora.');
    expect(sentence(versionChanges(version(preview(110, comparison(105)), true), preview(110, comparison(98))), 'en'))
      .toBe('Compared with the current one: the same sequence; it also had a comparison with one of 105 residues.');
  });

  it('says in a sentence of its own when nothing that can be compared differs', () => {
    expect(versionChanges(version(preview(110), true), preview(110))).toEqual({ kind: 'same' });
    expect(versionChanges(version(preview(110, comparison(105)), true), preview(110, comparison(105)))).toEqual({ kind: 'same' });
    expect(sentence({ kind: 'same' }, 'en')).toBe('Same as the current one in sequence and comparison.');
  });

  it('says nothing without both previews', () => {
    expect(versionChanges(version(null, true), preview(110))).toEqual({ kind: 'unknown' });
    expect(versionChanges(version(preview(110), true), null)).toEqual({ kind: 'unknown' });
  });
});
