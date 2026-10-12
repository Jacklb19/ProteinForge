import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReport, profileCsv, alignmentCsv } from './reportModel';
import { reportPdf } from './reportPdf';
import { captureWorkspace } from '../projects/snapshot';
import { alignSequences } from '../alignment/gotoh';
import type { AlignmentDraftState } from '../alignment/alignmentDraft';

const empty: AlignmentDraftState = { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null, resultInput: null, warnings: [] };
afterEach(() => { vi.unstubAllGlobals(); });
describe('reproducible local report', () => {
  it('retains exact sequence/hash, excludes ambiguity only from descriptors and preserves missing windows', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const report = await createReport({ name: 'Study', ...captureWorkspace('AAAAAAAAAX', empty, 9) });
    expect(report.descriptors?.length).toBe(9); expect(report.excluded).toBe(1);
    expect(report.sequence).toBe('AAAAAAAAAX'); expect(report.sequenceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.profile.points.map((point) => point.position)).toEqual([5, 6]);
    expect(report.profile.points[0]?.value).toBeCloseTo(1.8, 12);
    expect(report.profile.points[1]?.value).toBeNull();
    const csv = profileCsv(report);
    expect(csv).toContain(`"5","A","9","${String(report.profile.points[0]?.value)}","complete"`);
    expect(csv).toContain('"6","A","9","","non-standard-residue"');
    expect(csv).toContain('incomplete-window'); expect(csv).toContain(report.sequenceSha256);
    const again = await createReport({ name: 'Study', ...captureWorkspace('AAAAAAAAAX', empty, 9) });
    expect(again.sequenceSha256).toBe(report.sequenceSha256);
    expect(again.descriptors).toEqual(report.descriptors);
  });
  it('exports current alignment columns/parameters and paginates a real PDF without dropping input', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const input = { first: 'ACD', second: 'ACE', matrix: 'BLOSUM62', mode: 'global' } as const;
    const result = await alignSequences(input.first, input.second);
    const report = await createReport({ name: 'Study', ...captureWorkspace('A'.repeat(500), { ...empty, ...input, result, resultInput: input }, 9) });
    expect(report.alignment?.result).toEqual(result);
    expect(alignmentCsv(report)).toContain('"BLOSUM62","global","10","0.5","free"');
    const pdf = reportPdf(report, 'es');
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toContain('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });
  it('omits stale comparisons and refuses a CSV that would imply a current alignment', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const result = await alignSequences('ACD', 'ACD');
    const report = await createReport({ name: 'Study', ...captureWorkspace('ACD', { ...empty, first: 'ACD', second: 'ACE', result, resultInput: { first: 'ACD', second: 'ACD', matrix: 'BLOSUM62', mode: 'global' } }, 9) });
    expect(report.alignment).toBeNull(); expect(() => alignmentCsv(report)).toThrow('No current alignment');
  });
});
