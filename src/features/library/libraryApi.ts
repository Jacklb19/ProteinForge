import { z } from 'zod';
import { ApiError, createApiTransport } from '../api/apiClient';
import { UNIPROT_ENDPOINT } from './config';

export const entrySummarySchema = z.object({ accession: z.string().regex(/^[A-Z0-9]{6,10}$/), name: z.string().min(1).max(2000), organism: z.string().min(1).max(500), length: z.number().int().positive().max(100_000), reviewed: z.boolean() });
export const pdbReferenceSchema = z.object({ id: z.string().regex(/^[0-9][A-Z0-9]{3}$/), method: z.string(), resolution: z.string().nullable(), chains: z.string().nullable() });
export const entrySchema = entrySummarySchema.extend({ sequence: z.string().max(100_000).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]+$/), entryVersion: z.number().int().positive(), sequenceVersion: z.number().int().positive(), retrievedAt: z.iso.datetime({ offset: true }), function: z.string().nullable(), structures: z.array(pdbReferenceSchema) }).refine((entry) => entry.sequence.length === entry.length);
export const searchSchema = z.object({ items: z.array(entrySummarySchema).max(10), limit: z.number().int().positive(), truncated: z.boolean(), retrievedAt: z.iso.datetime({ offset: true }) });
export type EntrySummary = z.infer<typeof entrySummarySchema>;
export type UniProtEntry = z.infer<typeof entrySchema>;
export type PdbReference = z.infer<typeof pdbReferenceSchema>;

export function createLibraryApi(baseUrl: string) {
  const request = createApiTransport(baseUrl);
  return {
    async search(query: string, token: string, signal: AbortSignal) {
      if (!token) throw new ApiError('session');
      const parsed = searchSchema.safeParse(await request(`${UNIPROT_ENDPOINT}/search?query=${encodeURIComponent(query)}`, signal, token));
      if (!parsed.success) throw new ApiError('invalid-response');
      return parsed.data;
    },
    async detail(accession: string, token: string, signal: AbortSignal) {
      if (!token) throw new ApiError('session');
      const parsed = entrySchema.safeParse(await request(`${UNIPROT_ENDPOINT}/${encodeURIComponent(accession)}`, signal, token));
      if (!parsed.success || parsed.data.accession !== accession) throw new ApiError('invalid-response');
      return parsed.data;
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
