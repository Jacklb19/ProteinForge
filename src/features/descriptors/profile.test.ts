import { describe, expect, it } from 'vitest';
import reference from './fixtures/protscale.json';
import { calculateProfile } from './profile';

describe('Kyte–Doolittle hydropathy profile', () => {
  it('matches ProtScale values and uses one-based center positions', () => {
    const profile = calculateProfile(reference.sequence, 9);
    expect(profile).toHaveLength(reference.values.length);
    for (const [index, point] of profile.entries()) {
      expect(point.position).toBe(index + 5);
      expect(Math.abs((point.value ?? NaN) - (reference.values[index] ?? NaN))).toBeLessThanOrEqual(0.001);
    }
  });

  it('requires complete windows and handles shorter sequences', () => {
    expect(calculateProfile('ACDEFGHI', 9)).toEqual([]);
    expect(calculateProfile('ACDEFGHIKLMNPQRSTVW', 19)).toHaveLength(1);
    expect(calculateProfile('ACDEFGHIKLMNPQRSTVWY', 19)[0]?.position).toBe(10);
  });

  it('rejects invalid characters and unsupported windows', () => {
    expect(() => calculateProfile('AC-DEFGHI', 9)).toThrow(RangeError);
    expect(() => calculateProfile('ACDEFGHIK', 11 as 9)).toThrow(RangeError);
  });

  it('retains positions and marks windows with additional residues as missing', () => {
    const points = calculateProfile('ACDEFGHIKXACDEFGHIK', 9);
    expect(points).toHaveLength(11);
    expect(points[0]?.value).not.toBeNull();
    expect(points[1]?.value).toBeNull();
    expect(points.at(-1)?.value).not.toBeNull();
  });
});
