import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MULTIPLE_MAX_RESIDUES, MULTIPLE_MAX_SEQUENCES } from './config';
import { alignMultiple } from './multiple';
import { MultipleAlignment, MultipleRows } from './MultipleAlignment';
import { readEntries } from './multipleInput';

const fasta = (...records: [string, string][]): string => records.map(([name, sequence]) => `>${name}\n${sequence}`).join('\n');

describe('readEntries', () => {
  it('reads named records and accepts three to eight valid sequences', () => {
    const read = readEntries(fasta(['humana', 'ACDEF'], ['bovina', 'ACDEW'], ['porcina', 'ACDEY']));
    expect(read.problem).toBeNull();
    expect(read.entries).toEqual([{ name: 'humana', sequence: 'ACDEF' }, { name: 'bovina', sequence: 'ACDEW' }, { name: 'porcina', sequence: 'ACDEY' }]);
  });
  it('names the first reason the records cannot be aligned together', () => {
    expect(readEntries(fasta(['a', 'ACD'], ['b', 'ACD'])).problem).toEqual({ kind: 'count', count: 2 });
    const many = Array.from({ length: MULTIPLE_MAX_SEQUENCES + 1 }, (_, index): [string, string] => [String(index), 'ACD']);
    expect(readEntries(fasta(...many)).problem).toEqual({ kind: 'count', count: MULTIPLE_MAX_SEQUENCES + 1 });
    expect(readEntries(fasta(['a', 'ACD'], ['b', 'AC1D'], ['c', 'ACD'])).problem).toEqual({ kind: 'invalid', name: 'b' });
    expect(readEntries(fasta(['a', 'ACD'], ['b', 'ACD'], ['c', 'A'.repeat(MULTIPLE_MAX_RESIDUES + 1)])).problem).toEqual({ kind: 'length', name: 'c' });
  });
});

describe('MultipleAlignment', () => {
  it('starts from the pair being compared and says what is missing before running anything', () => {
    render(<MultipleAlignment initial={[{ name: 'Insulina humana', sequence: 'ACDEF' }, { name: 'Insulina bovina', sequence: 'ACDEW' }]} matrix="BLOSUM62" />);
    fireEvent.click(screen.getByText('Comparar más de dos secuencias'));
    const input = screen.getByLabelText('Secuencias en formato FASTA');
    expect(input).toHaveValue('>Insulina humana\nACDEF\n>Insulina bovina\nACDEW');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear todas' }));
    expect(screen.getByRole('status')).toHaveTextContent('Hay 2 secuencias. Se necesitan entre 3 y 8.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: fasta(['a', 'ACD'], ['b', 'AC?D'], ['c', 'ACD']) } });
    expect(input).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Alinear todas' }));
    expect(screen.getByRole('status')).toHaveTextContent('«b» tiene caracteres que no son residuos.');
  });
});

describe('MultipleRows', () => {
  it('lists the names once, marks the reference and numbers each aligned row', async () => {
    const result = await alignMultiple([{ name: 'ref', sequence: 'MKTAYIAKQRQISFVK' }, { name: 'sub', sequence: 'MKTAYIAKQRQISWVK' }, { name: 'del', sequence: 'MKTAYIAQRQISFVK' }]);
    render(<MultipleRows result={result} />);
    const names = screen.getAllByRole('listitem').map(item => item.textContent);
    expect(names).toHaveLength(3);
    expect(names.filter(name => name.includes('referencia del alineamiento'))).toHaveLength(1);
    const block = screen.getByLabelText('Columnas 1 a 16');
    expect(block.textContent.split('\n')).toEqual(result.rows.map((row, index) => `${String(index + 1)} ${row.aligned}`));
  });
});
