import { z } from 'zod';

export const MAX_MAPPING_RESIDUES = 100_000;
export const MAX_SIFTS_XML_CHARACTERS = 10_000_000;
const identifier = z.string().min(1).max(128);
const accession = z.string().regex(/^(?:[A-Z0-9]{6}|[A-Z0-9]{10})(?:-[1-9][0-9]*)?$/);
const positive = z.number().int().positive().max(MAX_MAPPING_RESIDUES);
const pdbId = z.string().regex(/^[0-9][A-Z0-9]{3}$/);

/** Internal polymer numbering is independent of author numbering and insertion codes. */
export const residueAddressSchema = z.object({
  entityId: identifier, labelAsymId: identifier, authAsymId: identifier,
  labelSeqId: positive, authSeqId: identifier.nullable(), insertionCode: z.string().max(16),
}).strict();
export type ResidueAddress = z.infer<typeof residueAddressSchema>;
export const coordinateResidueSchema = residueAddressSchema.extend({ modelNum: positive }).strict();
export type CoordinateResidue = z.infer<typeof coordinateResidueSchema>;
const coordinateContextSchema = z.object({ pdbId, coordinates: z.array(coordinateResidueSchema).max(MAX_MAPPING_RESIDUES) });

const rowSchema = residueAddressSchema.extend({
  segmentId: identifier, accession, position: positive,
  residue: z.string().regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]$/), notObserved: z.boolean(),
}).strict();
export type ResidueMappingRow = z.infer<typeof rowSchema>;
export const residueMappingSchema = z.object({
  version: z.literal(1), pdbId,
  provenance: z.object({
    provider: z.literal('PDBe/SIFTS'), xmlUrl: z.url(), residueListingUrl: z.url(),
    retrievedAt: z.iso.datetime({ offset: true }), releaseDate: z.iso.date(),
  }).strict(),
  rows: z.array(rowSchema).max(MAX_MAPPING_RESIDUES),
}).strict();
export type ResidueMappingDocument = z.infer<typeof residueMappingSchema>;

const referenceSchema = z.object({ accession, sequence: z.string().min(1).max(MAX_MAPPING_RESIDUES).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]+$/) });
export interface ResidueMatch {
  readonly address: ResidueAddress;
  readonly position: number;
  readonly accession: string;
  readonly observed: boolean;
  readonly segmentIds: readonly string[];
}
export interface ReferenceChain { readonly labelAsymId: string; readonly authAsymId: string }
export interface MappingSelection {
  readonly status: 'mapped' | 'ambiguous' | 'unmapped' | 'unobserved' | 'sequence-mismatch';
  readonly candidates: readonly ResidueMatch[];
}

export function residueAddressKey(address: ResidueAddress): string {
  return JSON.stringify([address.entityId, address.labelAsymId, address.authAsymId, address.labelSeqId, address.authSeqId, address.insertionCode]);
}

function assertBounded(input: unknown, field: string): void {
  if (typeof input !== 'object' || input === null || !(field in input)) return;
  const value = (input as Record<string, unknown>)[field];
  if (Array.isArray(value) && value.length > MAX_MAPPING_RESIDUES) throw new Error('Too many residue records');
}

/** A label chain and internal position identify one residue, regardless of author numbering. */
function assertIdentities(rows: readonly (ResidueAddress & { modelNum?: number })[]): void {
  const chains = new Map<string, string>();
  const residues = new Map<string, string>();
  for (const row of rows) {
    const chainKey = JSON.stringify([row.modelNum ?? null, row.labelAsymId]);
    const chainIdentity = JSON.stringify([row.entityId, row.authAsymId]);
    const residueKey = JSON.stringify([chainKey, row.labelSeqId]);
    const identity = residueAddressKey(row);
    if ((chains.has(chainKey) && chains.get(chainKey) !== chainIdentity) || (residues.has(residueKey) && residues.get(residueKey) !== identity)) throw new Error('Conflicting structural residue identity');
    chains.set(chainKey, chainIdentity); residues.set(residueKey, identity);
  }
}

function assertCorrespondences(rows: readonly ResidueMappingRow[]): void {
  const observations = new Map<string, boolean>();
  const residues = new Map<string, string>();
  for (const row of rows) {
    const address = residueAddressKey(row);
    const position = JSON.stringify([row.accession, row.position]);
    if (observations.has(address) && observations.get(address) !== row.notObserved) throw new Error('Conflicting residue observation');
    if (residues.has(position) && residues.get(position) !== row.residue) throw new Error('Conflicting UniProt residue identity');
    observations.set(address, row.notObserved); residues.set(position, row.residue);
  }
}

const noMatches: readonly ResidueMatch[] = Object.freeze([]);

/** Bind a validated correspondence to one exact reference and one displayed coordinate model.
 * All positions are one-based. No ranges are expanded or aligned by index.
 */
export function createResidueMapping(input: unknown, referenceInput: unknown, coordinatesInput: unknown, modelNum: number) {
  // Reject oversized arrays before Zod visits/clones their members.
  assertBounded(input, 'rows'); assertBounded(coordinatesInput, 'coordinates');
  const document = residueMappingSchema.parse(input);
  const reference = referenceSchema.parse(referenceInput);
  const context = coordinateContextSchema.parse(coordinatesInput);
  if (context.pdbId !== document.pdbId) throw new Error('Mapping and coordinates belong to different PDB entries');
  const coordinates = context.coordinates;
  positive.parse(modelNum);
  assertIdentities(document.rows); assertIdentities(coordinates); assertCorrespondences(document.rows);
  const observed = new Set(coordinates.filter(row => row.modelNum === modelNum).map(residueAddressKey));
  const rows = document.rows.filter(row => row.accession === reference.accession);
  // A disagreement invalidates the whole binding, including otherwise matching positions.
  const mismatch = rows.some(row => reference.sequence[row.position - 1] !== row.residue);
  const byPosition = new Map<number, ResidueMatch[]>();
  const byAddress = new Map<string, ResidueMatch[]>();
  const chains = new Map<string, ReferenceChain>();
  const seen = new Map<string, { match: ResidueMatch; segments: Set<string>; notObserved: boolean }>();
  for (const row of rows) {
    chains.set(row.labelAsymId, Object.freeze({ labelAsymId: row.labelAsymId, authAsymId: row.authAsymId }));
    const key = residueAddressKey(row);
    const rowKey = JSON.stringify([key, row.position]);
    const existing = seen.get(rowKey);
    if (existing) {
      if (existing.notObserved !== row.notObserved) throw new Error('Conflicting residue observation');
      if (!existing.segments.has(row.segmentId)) {
        existing.segments.add(row.segmentId); (existing.match.segmentIds as string[]).push(row.segmentId);
      }
      continue;
    }
    const match: ResidueMatch = {
      address: {
        entityId: row.entityId, labelAsymId: row.labelAsymId, authAsymId: row.authAsymId,
        labelSeqId: row.labelSeqId, authSeqId: row.authSeqId, insertionCode: row.insertionCode,
      },
      position: row.position, accession: row.accession, observed: !row.notObserved && observed.has(key), segmentIds: [row.segmentId],
    };
    seen.set(rowKey, { match, segments: new Set([row.segmentId]), notObserved: row.notObserved });
    const addressMatches = byAddress.get(key) ?? [];
    addressMatches.push(match); byAddress.set(key, addressMatches);
    const positionMatches = byPosition.get(row.position) ?? [];
    positionMatches.push(match); byPosition.set(row.position, positionMatches);
  }
  // Consumers cannot change a later selection by mutating a previous result.
  for (const matches of byAddress.values()) for (const match of matches) {
    Object.freeze(match.address); Object.freeze(match.segmentIds); Object.freeze(match);
  }
  for (const matches of byAddress.values()) Object.freeze(matches);
  for (const matches of byPosition.values()) Object.freeze(matches);
  function result(matches: readonly ResidueMatch[]): MappingSelection {
    const candidates = Object.freeze(matches);
    const ambiguous = matches.length > 1 || matches.some(match => (byAddress.get(residueAddressKey(match.address))?.length ?? 0) > 1);
    return Object.freeze({ status: mismatch ? 'sequence-mismatch' : !matches.length ? 'unmapped' : ambiguous ? 'ambiguous' : matches[0]?.observed ? 'mapped' : 'unobserved', candidates: mismatch ? noMatches : candidates });
  }
  return {
    pdbId: document.pdbId,
    modelNum,
    chains: Object.freeze([...chains.values()]),
    provenance: Object.freeze(document.provenance),
    fromSequence(position: number, labelAsymId?: string): MappingSelection {
      if (!Number.isSafeInteger(position) || position < 1 || position > reference.sequence.length) return result(noMatches);
      const matches = byPosition.get(position) ?? noMatches;
      return result(labelAsymId === undefined ? matches : matches.filter(match => match.address.labelAsymId === labelAsymId));
    },
    fromStructure(input: CoordinateResidue): MappingSelection {
      const address = coordinateResidueSchema.parse(input);
      return result(address.modelNum === modelNum ? byAddress.get(residueAddressKey(address)) ?? noMatches : noMatches);
    },
  };
}
