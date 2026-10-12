import { calculateDescriptors } from '../descriptors/descriptors';
import { calculateProfile } from '../descriptors/profile';
import { calculatePropensities } from '../descriptors/chouFasman';
import { splitStandardResidues } from '../editor/sequence';
import { DESCRIPTOR_METHOD_VERSION } from '../projects/config';
import type { ProjectWrite } from '../projects/contracts';
import { REPORT_METHOD_LINKS, REPORT_SCHEMA_VERSION } from './config';

async function sha256(sequence: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sequence));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** All scientific recomputation and serialization runs in a Worker in the application. */
export async function createReport(input: ProjectWrite) {
  const sequence = input.activeSequence;
  const residues = splitStandardResidues(sequence);
  const alignment = input.workspace.alignment;
  const hashes = await Promise.all([sha256(sequence), sha256(alignment.first), sha256(alignment.second)]);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION, application: 'ProteinForge', generatedAt: new Date().toISOString(),
    name: input.name, sequence, sequenceSha256: hashes[0], source: input.workspace.source ?? null,
    descriptorMethodVersion: DESCRIPTOR_METHOD_VERSION,
    descriptors: residues.standard ? calculateDescriptors(residues.standard) : null,
    excluded: residues.excluded,
    profile: { method: 'Kyte-Doolittle (1982)', window: input.workspace.profileWindow, points: sequence ? calculateProfile(sequence, input.workspace.profileWindow) : [] },
    propensities: sequence ? calculatePropensities(sequence) : [],
    alignment: alignment.result ? { ...alignment, firstSha256: hashes[1], secondSha256: hashes[2] } : null,
    references: REPORT_METHOD_LINKS,
  };
}
export type ScientificReport = Awaited<ReturnType<typeof createReport>>;

function csv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}
export function profileCsv(report: ScientificReport): string {
  const values = new Map(report.profile.points.map((point) => [point.position, point.value]));
  return csv([
    ['position', 'residue', 'window', 'hydropathy', 'hydropathy_status', 'helix_propensity', 'sheet_propensity', 'turn_propensity', 'sequence_sha256'],
    ...report.propensities.map((row) => [row.position, row.residue, report.profile.window, values.get(row.position) ?? null, !values.has(row.position) ? 'incomplete-window' : values.get(row.position) === null ? 'non-standard-residue' : 'complete', row.helix, row.sheet, row.turn, report.sequenceSha256]),
  ]);
}
export function alignmentCsv(report: ScientificReport): string {
  const alignment = report.alignment;
  if (!alignment?.result) throw new Error('No current alignment');
  const { result } = alignment;
  return csv([
    ['column', 'first', 'conservation', 'second', 'matrix', 'mode', 'gap_open', 'gap_extend', 'terminal_gaps'],
    ...Array.from({ length: result.columns }, (_, index) => [index + 1, result.alignedFirst[index] ?? '', result.marks[index] ?? '', result.alignedSecond[index] ?? '', result.parameters.matrix, result.parameters.mode, result.parameters.gapOpen, result.parameters.gapExtend, result.parameters.terminalGaps]),
  ]);
}
