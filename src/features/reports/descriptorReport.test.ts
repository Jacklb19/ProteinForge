import { describe, expect, it } from 'vitest';
import { descriptorCsv } from './descriptorReport';
import { calculateDescriptors } from '../descriptors/descriptors';

describe('descriptor CSV', () => {
  it('exports the normalized sequence, full precision values, exclusions and escaped methods', () => {
    const result = calculateDescriptors('ACDE');
    const csv = descriptorCsv('AC\nDEU', result, 1, { massDa: 'Method, "reference"' });
    expect(csv).toContain('"sequence","ACDEU"');
    expect(csv).toContain(`"massDa","${String(result.massDa)}","Method, ""reference"""`);
    expect(csv).toContain('"excluded_residues","1"');
    expect(csv).toContain('"standard_residues","4"');
    expect(csv).toContain('do not establish biological function');
    expect(csv.split('\r\n')).toHaveLength(11);
  });
  it('rejects empty and invalid sequences rather than producing a misleading report', () => {
    const result = calculateDescriptors('ACDE');
    for (const sequence of ['', '=HYPERLINK()', 'AC-DE']) expect(() => descriptorCsv(sequence, result, 0, {})).toThrow('Invalid report sequence.');
  });
});
