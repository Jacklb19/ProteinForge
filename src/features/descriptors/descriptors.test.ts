import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import references from './fixtures/protparam.json';
import { calculateDescriptors } from './descriptors';

function readSequence(accession: string): string {
  return readFileSync(resolve('src/features/descriptors/fixtures', `${accession}.fasta`), 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .join('')
    .trim();
}

describe('physicochemical descriptors against ProtParam', () => {
  for (const reference of references) {
    it(`${reference.accession}: five descriptors for ${String(reference.length)} residues`, () => {
      const result = calculateDescriptors(readSequence(reference.accession));
      expect(result.length).toBe(reference.length);
      expect(Math.abs(result.massDa - reference.massDa)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(result.isoelectricPoint - reference.isoelectricPoint)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(result.instabilityIndex - reference.instabilityIndex)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(result.aliphaticIndex - reference.aliphaticIndex)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(result.gravy - reference.gravy)).toBeLessThanOrEqual(0.01);
    });
  }

  it('rejects empty strings and invalid characters without dropping them', () => {
    expect(() => calculateDescriptors('')).toThrow(RangeError);
    expect(() => calculateDescriptors('ACXDE')).toThrow(RangeError);
    expect(() => calculateDescriptors('acde')).toThrow(RangeError);
  });
});
