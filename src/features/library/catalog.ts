import insulin from '../descriptors/fixtures/P01308.fasta?raw';
import bovineInsulin from '../descriptors/fixtures/P01317.fasta?raw';
import lysozyme from '../descriptors/fixtures/P00698.fasta?raw';
import cftr from '../descriptors/fixtures/P13569.fasta?raw';
import { exampleEntry } from '../editor/examples';
import type { TranslationKey } from '../../i18n';

/** Existing versioned fixtures. These are full references, not a domain assembly catalogue. */
const REFERENCES: readonly { accession: string; label: TranslationKey; organism: string; fasta: string }[] = [
  { accession: 'P01308', label: 'library.insulin', organism: 'Homo sapiens', fasta: insulin },
  { accession: 'P01317', label: 'library.bovineInsulin', organism: 'Bos taurus', fasta: bovineInsulin },
  { accession: 'P00698', label: 'library.lysozyme', organism: 'Gallus gallus', fasta: lysozyme },
  { accession: 'P13569', label: 'library.cftr', organism: 'Homo sapiens', fasta: cftr },
];
export const REFERENCE_CATALOG = REFERENCES.map((reference) => {
  const entry = exampleEntry(reference.fasta);
  if (!entry) throw new Error('Invalid bundled reference');
  const version = entry.header.match(/\bSV=(\d+)/)?.[1];
  return { ...reference, sequence: entry.sequence, sequenceVersion: version ? Number(version) : null };
});
