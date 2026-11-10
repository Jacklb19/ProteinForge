import { describe, expect, it } from 'vitest';
import { descriptorCsv, sequenceFasta } from './descriptorReport';
import { calculateDescriptors } from '../descriptors/descriptors';

describe('sequenceFasta', () => {
  it('writes one header and the sequence in sixty-residue lines', () => {
    const sequence = 'ACDEFGHIKLMNPQRSTVWY'.repeat(7);
    const [header, ...lines] = sequenceFasta(sequence, 'Insulina humana', 'P01308').trimEnd().split('\n');
    expect(header).toBe('>P01308 Insulina humana');
    expect(lines.map(line => line.length)).toEqual([60, 60, 20]);
    expect(lines.join('')).toBe(sequence);
  });
  it('keeps a hostile name on one line and out of a second record', () => {
    expect(sequenceFasta('ACD', 'bad\n>second\trecord')).toBe('>bad second record\nACD\n');
    expect(sequenceFasta('ACD', '  ')).toBe('>sequence\nACD\n');
  });
  it('refuses an invalid or empty sequence', () => {
    expect(() => sequenceFasta('AC1D', 'x')).toThrow();
    expect(() => sequenceFasta('', 'x')).toThrow();
  });
});

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
