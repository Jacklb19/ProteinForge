import { describe, expect, it } from 'vitest';
import { FastaParser } from './fasta';

describe('FastaParser', () => {
  it('reads multiple entries when a chunk splits a line', () => {
    const parser = new FastaParser();
    expect(parser.addChunk('>primera\nac\nd')).toEqual([]);
    expect(parser.addChunk('e\n>segunda anotación\nWXY\n')).toEqual([
      { number: 1, header: 'primera', sequence: 'ACDE', invalidPositions: [] },
    ]);
    expect(parser.finish()).toEqual([
      { number: 2, header: 'segunda anotación', sequence: 'WXY', invalidPositions: [] },
    ]);
  });

  it('rejects content without a header and empty entries', () => {
    expect(() => new FastaParser().addChunk('AC\n')).toThrow(/cabecera FASTA/);
    const parser = new FastaParser();
    parser.addChunk('>vacía\n');
    expect(() => parser.finish()).toThrow(/no contiene secuencia/);
  });

  it('rejects empty headers', () => {
    expect(() => new FastaParser().addChunk('>\n')).toThrow(/cabecera.*vacía/);
  });

  it('accepts a CRLF line break split across chunks', () => {
    const parser = new FastaParser();
    parser.addChunk('>uno\r');
    parser.addChunk('\nAC\r');
    parser.addChunk('\n');
    expect(parser.finish()[0]?.sequence).toBe('AC');
  });

  it('retains and reports invalid Unicode residues', () => {
    const parser = new FastaParser();
    parser.addChunk('>uno\naıC\n');
    expect(parser.finish()[0]).toMatchObject({
      sequence: 'AıC',
      invalidPositions: [1],
    });
  });

  it('removes the terminal asterisk from an entry', () => {
    const parser = new FastaParser();
    parser.addChunk('>uno\nACX*\n');
    expect(parser.finish()[0]).toMatchObject({ sequence: 'ACX', invalidPositions: [] });
  });
});
