import { expect, it } from 'vitest';
import { projectSchema } from './contracts';
import { calculateDescriptors } from '../descriptors/descriptors';
import { alignSequences } from '../alignment/gotoh';
import { bundledSequenceSource } from '../editor/source';

const base = { id: '00000000-0000-4000-8000-000000000010', name: 'Study', status: 'draft', createdAt: '2026-10-12T08:00:00Z', updatedAt: '2026-10-12T08:00:00.123456Z', activeSequence: 'ACDX', workspace: { schemaVersion: 1, profileWindow: 9, source: null, descriptors: { sequence: 'ACDX', excluded: 1, methodVersion: 'proteinforge-descriptors-v1', result: calculateDescriptors('ACD') }, alignment: { first: 'ACD', second: 'ACE', matrix: 'BLOSUM62', mode: 'global', result: null } } };
it('rejects descriptor/source association mismatches and preserves optional legacy provenance', () => {
  expect(projectSchema.safeParse(base).success).toBe(true);
  const source = { origin: 'uniprot', accession: 'P01308', sequence: 'ACDX', entryVersion: 284, sequenceVersion: 1, retrievedAt: '2026-10-12T08:00:00Z' };
  expect(projectSchema.safeParse({ ...base, workspace: { ...base.workspace, source } }).success).toBe(true);
  expect(projectSchema.safeParse({ ...base, workspace: { ...base.workspace, source: { ...source, sequence: 'ACD' } } }).success).toBe(false);
  for (const changes of [{ sequence: 'ACE' }, { excluded: 0 }, { result: calculateDescriptors('ACDE') }]) expect(projectSchema.safeParse({ ...base, workspace: { ...base.workspace, descriptors: { ...base.workspace.descriptors, ...changes } } }).success).toBe(false);
  expect(projectSchema.safeParse({ ...base, workspace: { ...base.workspace, descriptors: null, source: undefined } }).success).toBe(true);
});
it('verifies exact global association, counts, mode/matrix and local substring association', async () => {
  const result = await alignSequences('ACD', 'ACE');
  const alignment = { ...base.workspace.alignment, result };
  const check = (changes: Record<string, unknown>): boolean => projectSchema.safeParse({ ...base, workspace: { ...base.workspace, alignment: { ...alignment, ...changes } } }).success;
  expect(check({})).toBe(true);
  for (const changes of [{ matrix: 'BLOSUM80' }, { mode: 'local' }, { first: '' }, { second: 'EEE' }, { result: { ...result, marks: '|||' } }, { result: { ...result, columns: 100 } }, { result: { ...result, parameters: { ...result.parameters, terminalGaps: 'not-applicable' } } }]) expect(check(changes)).toBe(false);
  const local = await alignSequences('AAAAACD', 'ACDFFFF', { matrix: 'BLOSUM62', mode: 'local' });
  expect(check({ first: 'AAAAACD', second: 'ACDFFFF', mode: 'local', result: local })).toBe(true);
  expect(check({ first: 'AAAAAAA', second: 'ACDFFFF', mode: 'local', result: local })).toBe(false);
  const substituted = await alignSequences('CK', 'CK');
  expect(check({ first: 'UO', second: 'CK', result: substituted })).toBe(true);
});
it('labels only bundled canonical headers and keeps unknown versions explicitly absent', () => {
  const fasta = { sequence: 'ACD', number: 1, invalidPositions: [] };
  expect(bundledSequenceSource({ ...fasta, header: 'User private name' })).toBeNull();
  expect(bundledSequenceSource({ ...fasta, header: 'sp|P01308|INS_HUMAN SV=1' })).toMatchObject({ accession: 'P01308', sequenceVersion: 1, retrievedAt: null });
  expect(bundledSequenceSource({ ...fasta, header: 'sp|P01308|INS_HUMAN' })).toMatchObject({ sequenceVersion: null });
});
