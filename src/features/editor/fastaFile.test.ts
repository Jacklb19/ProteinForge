import { describe, expect, it } from 'vitest';
import { fastaFileSchema, MAX_FASTA_BYTES } from './fastaFile';

describe('fastaFileSchema', () => {
  it('accepts a file of exactly 5 MB', () => {
    const file = new File([new Uint8Array(MAX_FASTA_BYTES)], 'limite.fa');
    expect(fastaFileSchema.safeParse(file).success).toBe(true);
  });

  it('rejects a larger file and a value that is not a File', () => {
    const file = new File([new Uint8Array(MAX_FASTA_BYTES + 1)], 'grande.fa');
    expect(fastaFileSchema.safeParse(file).success).toBe(false);
    expect(fastaFileSchema.safeParse({ size: 10 }).success).toBe(false);
  });
});
