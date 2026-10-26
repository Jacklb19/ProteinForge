import { z } from 'zod';
import { Code, ConnectError } from '@connectrpc/connect';
import { ReferenceService } from '../../gen/proteinforge/reference/v1/reference_service_pb';
import type { EntrySummary as EntrySummaryMessage } from '../../gen/proteinforge/reference/v1/reference_service_pb';
import { ApiError, validated } from '../api/apiClient';
import { callOptions, createRpcClient, rpc, toApiError } from '../api/rpc';
import { isoFromTimestamp } from '../api/timestamps';
import { MAX_MAPPING_RESIDUES, residueMappingSchema } from './residueMapping';
import { ResidueMappingError } from './mappingTypes';
import type { ResidueMappingRequest } from './mappingTypes';

export const entrySummarySchema = z.object({ accession: z.string().regex(/^[A-Z0-9]{6,10}$/), name: z.string().min(1).max(2000), organism: z.string().min(1).max(500), length: z.number().int().positive().max(100_000), reviewed: z.boolean() });
export const pdbReferenceSchema = z.object({ id: z.string().regex(/^[0-9][A-Z0-9]{3}$/), method: z.string(), resolution: z.string().nullable(), chains: z.string().nullable() });
export const entrySchema = entrySummarySchema.extend({ sequence: z.string().max(100_000).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]+$/), entryVersion: z.number().int().positive(), sequenceVersion: z.number().int().positive(), retrievedAt: z.iso.datetime({ offset: true }), function: z.string().nullable(), structures: z.array(pdbReferenceSchema) }).refine((entry) => entry.sequence.length === entry.length);
export const searchSchema = z.object({ items: z.array(entrySummarySchema).max(10), limit: z.number().int().positive(), truncated: z.boolean(), retrievedAt: z.iso.datetime({ offset: true }) });
export type EntrySummary = z.infer<typeof entrySummarySchema>;
export type UniProtEntry = z.infer<typeof entrySchema>;
export type PdbReference = z.infer<typeof pdbReferenceSchema>;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function summaryDocument(summary: EntrySummaryMessage | undefined) {
  return { accession: summary?.accession, name: summary?.name, organism: summary?.organism, length: summary?.length, reviewed: summary?.reviewed };
}

/** UniProt references through ReferenceService; the API bounds and validates every query. */
export function createLibraryApi(baseUrl: string, fetchImplementation?: FetchLike) {
  const client = createRpcClient(ReferenceService, baseUrl, fetchImplementation);
  return {
    mapping: async (request: ResidueMappingRequest, token: string, signal: AbortSignal) => {
      if (!token) throw new ApiError('session');
      try {
        // Acquisition can use 20 seconds; keep its wait independent from ordinary lookups.
        const response = await client.getResidueMapping(request, { ...callOptions(signal, token), timeoutMs: 25_000 });
        const document = response.mapping;
        if (document && document.rows.length > MAX_MAPPING_RESIDUES) throw new ApiError('invalid-response');
        const mapping = validated(residueMappingSchema, document ? {
          version: document.version, pdbId: document.pdbId,
          provenance: document.provenance ? { provider: document.provenance.provider, xmlUrl: document.provenance.xmlUrl, residueListingUrl: document.provenance.residueListingUrl, retrievedAt: document.provenance.retrievedAt, releaseDate: document.provenance.releaseDate } : undefined,
          rows: document.rows.map(row => ({ entityId: row.entityId, labelAsymId: row.labelAsymId, authAsymId: row.authAsymId, labelSeqId: row.labelSeqId, authSeqId: row.authSeqId ?? null, insertionCode: row.insertionCode, segmentId: row.segmentId, accession: row.accession, position: row.position, residue: row.residue, notObserved: row.notObserved })),
        } : undefined);
        if (mapping.pdbId !== request.pdbId || mapping.rows.some(row => row.accession !== request.accession)) throw new ApiError('invalid-response');
        return validated(z.object({ mapping: residueMappingSchema, reference_sequence_version: z.number().int().positive(), reference_sequence_sha256: z.string().regex(/^[a-f0-9]{64}$/) }), {
          mapping, reference_sequence_version: response.referenceSequenceVersion, reference_sequence_sha256: response.referenceSequenceSha256,
        });
      } catch (error) {
        if (error instanceof ConnectError) {
          if (error.code === Code.FailedPrecondition && error.rawMessage === 'sifts-reference-version') throw new ResidueMappingError('version');
          if (error.code === Code.FailedPrecondition && error.rawMessage === 'sifts-reference-mismatch') throw new ResidueMappingError('mismatch');
          if (error.code === Code.ResourceExhausted && error.rawMessage === 'sifts-response-too-large') throw new ResidueMappingError('size');
        }
        throw error instanceof ResidueMappingError ? error : toApiError(error);
      }
    },
    async search(query: string, token: string, signal: AbortSignal) {
      if (!token) throw new ApiError('session');
      const response = await rpc(() => client.searchEntries({ query }, callOptions(signal, token)));
      return validated(searchSchema, { items: response.entries.map(summaryDocument), limit: response.limit, truncated: response.truncated, retrievedAt: isoFromTimestamp(response.retrieveTime) });
    },
    async detail(accession: string, token: string, signal: AbortSignal) {
      if (!token) throw new ApiError('session');
      const { entry } = await rpc(() => client.getEntry({ accession }, callOptions(signal, token)));
      const parsed = validated(entrySchema, {
        ...summaryDocument(entry?.summary), sequence: entry?.sequence, entryVersion: entry?.entryVersion, sequenceVersion: entry?.sequenceVersion,
        retrievedAt: isoFromTimestamp(entry?.retrieveTime), function: entry?.function ?? null,
        structures: entry?.structures.map((item) => ({ id: item.id, method: item.method, resolution: item.resolution ?? null, chains: item.chains ?? null })),
      });
      if (parsed.accession !== accession) throw new ApiError('invalid-response');
      return parsed;
    },
  };
}

/** Coverage is an annotation span, not a count of coordinates or an SIFTS residue mapping. */
export function annotatedCoverage(chains: string | null, sequenceLength: number): number | null {
  if (!chains) return null;
  const ranges = [...chains.matchAll(/=([0-9]+)-([0-9]+)/g)].map((match) => [Number(match[1]), Number(match[2])] as const);
  if (!ranges.length || ranges.some(([start, end]) => start < 1 || end < start || end > sequenceLength)) return null;
  const covered = new Set<number>();
  for (const [start, end] of ranges) for (let index = start; index <= end; index += 1) covered.add(index);
  return covered.size;
}
