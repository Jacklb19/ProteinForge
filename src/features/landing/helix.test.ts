import { describe, expect, it } from 'vitest';
import { helixAtoms, projectAtoms } from './helix';
import { HELIX_GEOMETRY } from './config';

describe('ideal helix geometry', () => {
  it('keeps every Cα on the helix radius with the configured rise and twist', () => {
    const atoms = helixAtoms(HELIX_GEOMETRY);
    expect(atoms).toHaveLength(HELIX_GEOMETRY.residues);
    for (const atom of atoms) expect(Math.hypot(atom.x, atom.z)).toBeCloseTo(HELIX_GEOMETRY.radiusAngstrom, 6);
    const first = atoms[0];
    const second = atoms[1];
    if (!first || !second) throw new Error('Expected atoms.');
    expect(second.y - first.y).toBeCloseTo(HELIX_GEOMETRY.risePerResidueAngstrom, 6);
    const angle = (Math.atan2(second.z, second.x) - Math.atan2(first.z, first.x)) * (180 / Math.PI);
    expect(angle).toBeCloseTo(HELIX_GEOMETRY.degreesPerResidue, 6);
    // 3.6 residues per turn: residue 18 sits five turns later, directly above residue 0.
    const aligned = atoms[18];
    if (!aligned) throw new Error('Expected atom 18.');
    expect(aligned.x).toBeCloseTo(first.x, 6);
    expect(aligned.z).toBeCloseTo(first.z, 6);
  });

  it('projects inside the viewport and keeps nearer atoms with a higher depth', () => {
    const projected = projectAtoms(helixAtoms(HELIX_GEOMETRY), { rotation: 0.4, tilt: 0.3, scale: 5, width: 400, height: 300, perspective: 90 });
    for (const atom of projected) {
      expect(atom.x).toBeGreaterThan(0);
      expect(atom.x).toBeLessThan(400);
      expect(atom.depth).toBeGreaterThanOrEqual(0);
      expect(atom.depth).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...projected.map((atom) => atom.depth))).toBe(1);
    expect(Math.min(...projected.map((atom) => atom.depth))).toBe(0);
  });
});
