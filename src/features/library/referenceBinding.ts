import { z } from 'zod';
import { createResidueMapping, MAX_MAPPING_RESIDUES } from './residueMapping';
import type { CoordinateResidue, MappingSelection } from './residueMapping';

// Internal adapter for the already proposed envelope; no transport or wire schema is added.
const evidenceSchema = z.object({
  mapping: z.unknown(), reference_sequence_version: z.number().int().positive(),
  reference_sequence_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const referenceSchema = z.object({
  accession: z.string().regex(/^(?:[A-Z0-9]{6}|[A-Z0-9]{10})(?:-[1-9][0-9]*)?$/),
  sequence: z.string().min(1).max(MAX_MAPPING_RESIDUES).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]+$/),
  sequenceVersion: z.number().int().positive().nullable(),
});
export type ReferenceBindingStatus = 'idle' | 'verifying' | 'ready' | 'version-missing' | 'version-mismatch' | 'hash-mismatch' | 'mapping-mismatch' | 'cancelled' | 'error';
export type ReferenceBindingSelection = MappingSelection | { readonly status: 'unverified'; readonly candidates: readonly [] };
const unverified: ReferenceBindingSelection = Object.freeze({ status: 'unverified', candidates: Object.freeze([] as const) });

async function sequenceHash(sequence: string): Promise<string> {
  // The schema requires exact canonical ASCII. Do not trim, uppercase or hash only mapped positions.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sequence));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

/** Selection stays closed until version and full reference digest agree. Rebinding clears it
 * immediately; late digests cannot replace a newer reference/model. No sequence leaves the device.
 */
export function createVerifiedResidueBinding() {
  let generation = 0;
  let status: ReferenceBindingStatus = 'idle';
  let mapping: ReturnType<typeof createResidueMapping> | null = null;
  let activeSignal: AbortSignal | undefined;

  function refresh(): void {
    if (activeSignal?.aborted) { mapping = null; status = 'cancelled'; }
  }
  return {
    get status(): ReferenceBindingStatus { refresh(); return status; },
    clear(): void { generation += 1; mapping = null; activeSignal = undefined; status = 'idle'; },
    async bind(evidenceInput: unknown, referenceInput: unknown, coordinatesInput: unknown, modelNum: number, signal?: AbortSignal): Promise<ReferenceBindingStatus | 'superseded'> {
      const ticket = ++generation;
      mapping = null; activeSignal = signal; status = 'verifying';
      if (signal?.aborted) { status = 'cancelled'; return status; }
      try {
        const evidence = evidenceSchema.parse(evidenceInput);
        const reference = referenceSchema.parse(referenceInput);
        if (reference.sequenceVersion === null) { status = 'version-missing'; return status; }
        if (reference.sequenceVersion !== evidence.reference_sequence_version) { status = 'version-mismatch'; return status; }
        // Build an immutable snapshot before awaiting WebCrypto. Mutating input objects later
        // cannot change the model/reference which this digest will enable.
        const prepared = createResidueMapping(evidence.mapping, reference, coordinatesInput, modelNum);
        if (prepared.fromSequence(1).status === 'sequence-mismatch') { status = 'mapping-mismatch'; return status; }
        const hash = await sequenceHash(reference.sequence);
        if (ticket !== generation) return 'superseded';
        if (signal?.aborted) { status = 'cancelled'; return status; }
        if (hash !== evidence.reference_sequence_sha256) { status = 'hash-mismatch'; return status; }
        mapping = prepared; status = 'ready'; return status;
      } catch (error) {
        if (ticket !== generation) return 'superseded';
        status = signal?.aborted ? 'cancelled' : 'error';
        throw error;
      }
    },
    fromSequence(position: number, labelAsymId?: string): ReferenceBindingSelection {
      refresh(); return status === 'ready' && mapping ? mapping.fromSequence(position, labelAsymId) : unverified;
    },
    fromStructure(address: CoordinateResidue): ReferenceBindingSelection {
      refresh(); return status === 'ready' && mapping ? mapping.fromStructure(address) : unverified;
    },
  };
}
