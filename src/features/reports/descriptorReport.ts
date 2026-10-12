import type { Descriptors } from '../descriptors/descriptors';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import { validateSequence } from '../editor/sequence';
import { CSV_LINE_ENDING, CSV_MIME_TYPE, CSV_SEPARATOR, DESCRIPTOR_REPORT_FILENAME } from './config';

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

/** A deliberate local download; no report or sequence is sent to a service. */
export function downloadDescriptorCsv(csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: CSV_MIME_TYPE }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = DESCRIPTOR_REPORT_FILENAME;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Let the browser capture the Blob before releasing it.
  setTimeout(() => { URL.revokeObjectURL(url); }, 0);
}
