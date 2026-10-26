import { describe, expect, it, vi } from 'vitest';
import { GetEntryResponseSchema, GetResidueMappingRequestSchema, GetResidueMappingResponseSchema, SearchEntriesRequestSchema, SearchEntriesResponseSchema } from '../../gen/proteinforge/reference/v1/reference_service_pb';
import { timestampFromIso } from '../api/timestamps';
import { GRPC_CODES, grpcWebError, grpcWebRequest, grpcWebResponse } from '../../test/grpcWeb';
import { annotatedCoverage, createLibraryApi, entrySchema } from './libraryApi';
import { REFERENCE_CATALOG } from './catalog';
import { validateSequence } from '../editor/sequence';
import { mappingEvidence } from '../../test/residueMappingFixture';
import { MAX_MAPPING_RESIDUES } from './residueMapping';

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
  it('rejects an oversized decoded row list before mapping or cloning its members', async () => {
    const response = grpcWebResponse(GetResidueMappingResponseSchema, { mapping: { rows: Array.from({ length: MAX_MAPPING_RESIDUES + 1 }, () => ({})) } });
    const api = createLibraryApi('https://api.example', vi.fn().mockResolvedValue(response));
    const map = vi.spyOn(Array.prototype, 'map');
    try {
      await expect(api.mapping({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 }, 'user-token', new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-response' });
      expect(map.mock.contexts.some(context => Array.isArray(context) && context.length > MAX_MAPPING_RESIDUES)).toBe(false);
    } finally { map.mockRestore(); }
  });
  it('decodes typed mapping defaults and sends only the three public identifiers with a dedicated timeout', async () => {
    const data = mappingEvidence();
    const message = { mapping: { ...data.mapping, rows: data.mapping.rows.map(row => ({ ...row, authSeqId: row.authSeqId ?? undefined })) }, referenceSequenceVersion: data.reference_sequence_version, referenceSequenceSha256: data.reference_sequence_sha256 };
    const fetcher = vi.fn().mockResolvedValue(grpcWebResponse(GetResidueMappingResponseSchema, message));
    const api = createLibraryApi('https://api.example', fetcher);
    const result = await api.mapping({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 }, 'user-token', new AbortController().signal);
    expect(result.mapping.rows[0]).toMatchObject({ insertionCode: 'B', notObserved: false });
    expect(result.mapping.rows[2]?.authSeqId).toBeNull();
    expect(result.reference_sequence_sha256).toBe(data.reference_sequence_sha256);
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(grpcWebRequest(GetResidueMappingRequestSchema, request.body)).toMatchObject({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 });
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer user-token');
    expect(new Headers(request.headers).get('grpc-timeout')).toMatch(/^2[0-5]\d{3}m$/);
    expect(request.credentials).toBe('omit');
  });
  it.each([
    [GRPC_CODES.failedPrecondition, 'sifts-reference-version', { reason: 'version' }],
    [GRPC_CODES.failedPrecondition, 'sifts-reference-mismatch', { reason: 'mismatch' }],
    [GRPC_CODES.resourceExhausted, 'sifts-response-too-large', { reason: 'size' }],
    [GRPC_CODES.resourceExhausted, 'uniprot-rate-limit', { code: 'rate-limit' }],
    [GRPC_CODES.notFound, 'sifts-not-found', { code: 'not-found' }],
  ])('preserves mapping domain failures without exposing raw messages: %s %s', async (code, message, expected) => {
    const api = createLibraryApi('https://api.example', vi.fn().mockResolvedValue(grpcWebError(code, message)));
    await expect(api.mapping({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 }, 'user-token', new AbortController().signal)).rejects.toMatchObject(expected);
  });
  it('rejects cross-entry or cross-accession mapping responses and unknown reference evidence', async () => {
    const data = mappingEvidence();
    const fetcher = vi.fn(); const api = createLibraryApi('https://api.example', fetcher);
    for (const mapping of [{ ...data.mapping, pdbId: '2XYZ' }, { ...data.mapping, rows: data.mapping.rows.map(row => ({ ...row, accession: 'P01317' })) }]) {
      fetcher.mockResolvedValueOnce(grpcWebResponse(GetResidueMappingResponseSchema, { mapping: { ...mapping, rows: mapping.rows.map(row => ({ ...row, authSeqId: row.authSeqId ?? undefined })) }, referenceSequenceVersion: 1, referenceSequenceSha256: data.reference_sequence_sha256 }));
      await expect(api.mapping({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 }, 'user-token', new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-response' });
    }
    fetcher.mockResolvedValueOnce(grpcWebResponse(GetResidueMappingResponseSchema, {}));
    await expect(api.mapping({ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 }, 'user-token', new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-response' });
  });
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
