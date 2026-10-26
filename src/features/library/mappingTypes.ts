export interface ResidueMappingRequest { pdbId: string; accession: string; sequenceVersion: number }
export type MappingLoader = (request: ResidueMappingRequest, token: string, signal: AbortSignal) => Promise<unknown>;

/** Stable domain categories; provider details and private response bodies never reach the interface. */
export class ResidueMappingError extends Error {
  constructor(readonly reason: 'version' | 'mismatch' | 'size') { super(reason); this.name = 'ResidueMappingError'; }
}
