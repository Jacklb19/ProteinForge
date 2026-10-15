import { describe, expect, it, vi } from 'vitest';
import { GetEntryResponseSchema, SearchEntriesRequestSchema, SearchEntriesResponseSchema } from '../../gen/proteinforge/reference/v1/reference_service_pb';
import { timestampFromIso } from '../api/timestamps';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { annotatedCoverage, createLibraryApi, entrySchema } from './libraryApi';
import { REFERENCE_CATALOG } from './catalog';
import { validateSequence } from '../editor/sequence';

describe('reference integrity', () => {
  it('keeps full versioned references valid and identifiable by canonical accession', () => {
    expect(REFERENCE_CATALOG.map((entry) => entry.accession)).toEqual(['P01308', 'P01317', 'P00698', 'P13569']);
    for (const reference of REFERENCE_CATALOG) expect(validateSequence(reference.sequence).invalidPositions).toEqual([]);
    expect(REFERENCE_CATALOG.map((entry) => entry.sequence.length)).toEqual([110, 105, 147, 1480]);
  });
  it('counts unique annotation positions across duplicate chains without claiming coordinates', () => {
    expect(annotatedCoverage('A/C=90-110, B/D=25-54', 110)).toBe(51);
    expect(annotatedCoverage('A=1-10, B=5-15', 20)).toBe(15);
    expect(annotatedCoverage('A=1-200', 110)).toBeNull();
    expect(annotatedCoverage('A=?', 110)).toBeNull();
    expect(annotatedCoverage(null, 110)).toBeNull();
  });
  it('rejects inconsistent sequence lengths and untrusted PDB identifiers at the boundary', () => {
    const record = { accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', length: 3, reviewed: true, sequence: 'ACD', entryVersion: 284, sequenceVersion: 1, retrievedAt: '2026-10-12T08:00:00Z', function: null, structures: [{ id: '1TRZ', method: 'X-ray', resolution: '1.60 A', chains: 'A=1-3' }] };
    expect(entrySchema.safeParse(record).success).toBe(true);
    expect(entrySchema.safeParse({ ...record, sequence: 'AC' }).success).toBe(false);
    expect(entrySchema.safeParse({ ...record, structures: [{ ...record.structures[0], id: '../../private' }] }).success).toBe(false);
  });
});

describe('reference transport', () => {
  it('searches and opens entries through ReferenceService with the session', async () => {
    const retrieveTime = timestampFromIso('2026-10-12T08:00:00Z');
    const summary = { accession: 'P01308', name: 'Insulin', organism: 'Homo sapiens', length: 3, reviewed: true };
    const fetcher = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(grpcWebResponse(SearchEntriesResponseSchema, { entries: [summary], limit: 10, truncated: false, retrieveTime }))
      .mockResolvedValueOnce(grpcWebResponse(GetEntryResponseSchema, { entry: { summary, sequence: 'ACD', entryVersion: 284, sequenceVersion: 1, retrieveTime, structures: [{ id: '1TRZ', method: 'X-ray', chains: 'A=1-3' }] } }))
      .mockResolvedValueOnce(grpcWebError(GRPC_CODES.invalidArgument, 'uniprot-accession'));
    const api = createLibraryApi('https://api.example', fetcher);
    const signal = new AbortController().signal;
    expect(await api.search('insulin', 'user-token', signal)).toEqual({ items: [summary], limit: 10, truncated: false, retrievedAt: '2026-10-12T08:00:00Z' });
    expect(grpcWebRequest(SearchEntriesRequestSchema, fetcher.mock.calls[0]?.[1]?.body as Uint8Array).query).toBe('insulin');
    expect(await api.detail('P01308', 'user-token', signal)).toMatchObject({ sequence: 'ACD', function: null, structures: [{ id: '1TRZ', resolution: null, chains: 'A=1-3' }] });
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://api.example/proteinforge.reference.v1.ReferenceService/GetEntry');
    await expect(api.detail('nope', 'user-token', signal)).rejects.toMatchObject({ code: 'validation' });
    await expect(api.search('insulin', '', signal)).rejects.toMatchObject({ code: 'session' });
  });
});
