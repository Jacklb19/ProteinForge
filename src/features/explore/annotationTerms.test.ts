import { describe, expect, it } from 'vitest';
import { translateAnnotation, withoutCitations } from './annotationTerms';

describe('UniProt annotation wording', () => {
  it('translates the known parts of a short annotation and keeps the rest as UniProt wrote it', () => {
    expect(translateAnnotation('Phosphoserine; by PKA', 'es')).toBe('Fosfoserina; por PKA');
    expect(translateAnnotation('Helical; Name=8', 'es')).toBe('Hélice; n.º 8');
    expect(translateAnnotation('N-linked (GlcNAc...) asparagine', 'es')).toBe('Asparagina con N-glicano (GlcNAc...)');
    expect(translateAnnotation('R > W; in CF and CBAVD; uncertain significance; dbSNP:rs115545701', 'es'))
      .toBe('R > W; en CF y CBAVD; significado incierto; dbSNP:rs115545701');
    expect(translateAnnotation('S > G; in dbSNP:rs1800080', 'es')).toBe('S > G; dbSNP:rs1800080');
    expect(translateAnnotation('ABC transporter 1', 'es')).toBe('ABC transporter 1');
    expect(translateAnnotation('Phosphoserine; by PKA', 'en')).toBe('Phosphoserine; by PKA');
    expect(translateAnnotation('', 'es')).toBe('');
  });

  it('removes literature references from a function text without leaving stray spaces', () => {
    expect(withoutCitations('Transports chloride (PubMed:10792060, PubMed:11524016). Gated by ATP (PubMed:8910473).'))
      .toBe('Transports chloride. Gated by ATP.');
    expect(withoutCitations('No references here.')).toBe('No references here.');
  });
});
