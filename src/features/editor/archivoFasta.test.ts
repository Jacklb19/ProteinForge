import { describe, expect, it } from 'vitest';
import { esquemaArchivoFasta, TAMANO_MAXIMO_FASTA } from './archivoFasta';

describe('esquemaArchivoFasta', () => {
  it('admite un archivo de exactamente 5 MB', () => {
    const archivo = new File([new Uint8Array(TAMANO_MAXIMO_FASTA)], 'limite.fa');
    expect(esquemaArchivoFasta.safeParse(archivo).success).toBe(true);
  });

  it('rechaza un archivo mayor y una entrada que no sea File', () => {
    const archivo = new File([new Uint8Array(TAMANO_MAXIMO_FASTA + 1)], 'grande.fa');
    expect(esquemaArchivoFasta.safeParse(archivo).success).toBe(false);
    expect(esquemaArchivoFasta.safeParse({ size: 10 }).success).toBe(false);
  });
});
