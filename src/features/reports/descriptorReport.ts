import type { Descriptors } from '../descriptors/descriptors';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import { validateSequence } from '../editor/sequence';
import { CSV_LINE_ENDING, CSV_MIME_TYPE, CSV_SEPARATOR, DESCRIPTOR_REPORT_FILENAME, FASTA_FILENAME, FASTA_HEADER_MAX_LENGTH, FASTA_LINE_WIDTH, FASTA_MIME_TYPE } from './config';

/** Export only a validated sequence and Worker results; numeric cells keep decimal points in every locale. */
export function descriptorCsv(sequence: string, result: Descriptors, excluded: number, methods: Readonly<Record<string, string>>): string {
  const validated = validateSequence(sequence);
  if (validated.invalidPositions.length > 0 || !validated.sequence) throw new Error('Invalid report sequence.');
  const rows: (string | number)[][] = [
    ['field', 'value', 'method'], ['sequence', validated.sequence, 'amino-acid sequence'],
    ['standard_residues', result.length, 'descriptors use standard residues only'], ['excluded_residues', excluded, 'non-standard residues excluded from descriptors'],
    ...DESCRIPTOR_FIELDS.map((field) => [field.key, result[field.key], methods[field.key] ?? '']),
    ['scope', 'Sequence descriptors do not establish biological function or folding.', 'ProteinForge'],
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(CSV_SEPARATOR)).join(CSV_LINE_ENDING) + CSV_LINE_ENDING;
}

/**
 * The validated sequence as a FASTA record. The header is one line of printable text: the accession when the
 * sequence still matches its source, then the name; a header cannot start a second record or break the line.
 */
export function sequenceFasta(sequence: string, name: string, accession: string | null = null): string {
  const validated = validateSequence(sequence);
  if (validated.invalidPositions.length > 0 || !validated.sequence) throw new Error('Invalid sequence.');
  const clean = (value: string): string => value.replace(/[\p{Cc}>]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const header = [accession ? clean(accession) : '', clean(name)].filter(Boolean).join(' ').slice(0, FASTA_HEADER_MAX_LENGTH) || 'sequence';
  const lines = validated.sequence.match(new RegExp(`.{1,${String(FASTA_LINE_WIDTH)}}`, 'g')) ?? [];
  return `>${header}\n${lines.join('\n')}\n`;
}

export function downloadSequenceFasta(fasta: string): void { download(fasta, FASTA_FILENAME, FASTA_MIME_TYPE); }
export function downloadDescriptorCsv(csv: string): void { download(csv, DESCRIPTOR_REPORT_FILENAME, CSV_MIME_TYPE); }

/** A deliberate local download; no report or sequence is sent to a service. */
function download(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Let the browser capture the Blob before releasing it.
  setTimeout(() => { URL.revokeObjectURL(url); }, 0);
}
