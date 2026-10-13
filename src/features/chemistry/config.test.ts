import { describe, expect, it } from 'vitest';
import { STANDARD_AMINO_ACIDS, ADDITIONAL_AMINO_ACIDS } from '../editor/sequence';
import { annotationsFor, disulfidePartner, regionAt } from '../editor/annotations';
import { DEFAULT_EXAMPLE } from '../editor/examples';
import { RESIDUE_CLASSES, RESIDUE_CLASS_MEMBERS, RESIDUE_NAMES, classComposition, residueClass } from './config';

describe('residue chemistry', () => {
  it('assigns every standard residue to exactly one class and leaves ambiguous codes unclassified', () => {
    const members = RESIDUE_CLASSES.map((name) => RESIDUE_CLASS_MEMBERS[name]).join('');
    expect(Array.from(members).sort().join('')).toBe(Array.from(STANDARD_AMINO_ACIDS).sort().join(''));
    for (const residue of STANDARD_AMINO_ACIDS) {
      expect(residueClass(residue), residue).toBeDefined();
      expect(RESIDUE_NAMES[residue], residue).toMatch(/^[A-Z][a-z]{2}$/);
    }
    for (const residue of ADDITIONAL_AMINO_ACIDS) expect(residueClass(residue), residue).toBeUndefined();
  });

  it('counts the composition of human insulin by class', () => {
    const counts = classComposition(DEFAULT_EXAMPLE.text);
    expect(counts).toEqual({ hydrophobic: 45, polar: 22, acidic: 10, basic: 9, special: 18, cysteine: 6 });
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(DEFAULT_EXAMPLE.text.length);
    expect(classComposition('ACXU')).toMatchObject({ hydrophobic: 1, cysteine: 1 });
  });
});

describe('reference annotations', () => {
  const annotations = annotationsFor(DEFAULT_EXAMPLE.source);

  it('annotates only exact bundled references', () => {
    expect(annotations?.accession).toBe('P01308');
    expect(annotationsFor(null)).toBeNull();
    expect(annotationsFor(DEFAULT_EXAMPLE.source ? { ...DEFAULT_EXAMPLE.source, accession: 'P00698' } : null)).toBeNull();
  });

  it('keeps regions ordered, inside the sequence and bridges between cysteines', () => {
    expect(annotations).not.toBeNull();
    if (!annotations) return;
    let previousEnd = 0;
    for (const region of annotations.regions) {
      expect(region.start).toBeGreaterThan(previousEnd);
      expect(region.end).toBeLessThanOrEqual(DEFAULT_EXAMPLE.text.length);
      previousEnd = region.end;
    }
    for (const [first, second] of annotations.disulfides) {
      expect(DEFAULT_EXAMPLE.text[first - 1]).toBe('C');
      expect(DEFAULT_EXAMPLE.text[second - 1]).toBe('C');
      expect(disulfidePartner(annotations, first)).toBe(second);
      expect(disulfidePartner(annotations, second)).toBe(first);
    }
    expect(disulfidePartner(annotations, 1)).toBeUndefined();
    expect(regionAt(annotations, annotations.highlight)?.chain).toBe('A');
    expect(regionAt(annotations, 55)).toBeUndefined();
  });
});
