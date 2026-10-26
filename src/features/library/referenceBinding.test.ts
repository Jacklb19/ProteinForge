import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVerifiedResidueBinding } from './referenceBinding';

const reference = { accession: 'P01308', sequence: 'ACDEFG', sequenceVersion: 1 };
const address = { entityId: '1', labelAsymId: 'A', authAsymId: 'A', labelSeqId: 1, authSeqId: '-2', insertionCode: 'A', modelNum: 1 };
function evidence() {
  const residue = { entityId: address.entityId, labelAsymId: address.labelAsymId, authAsymId: address.authAsymId, labelSeqId: address.labelSeqId, authSeqId: address.authSeqId, insertionCode: address.insertionCode };
  return {
    reference_sequence_version: 1,
    reference_sequence_sha256: createHash('sha256').update('ACDEFG', 'ascii').digest('hex'),
    mapping: { version: 1, pdbId: '1TRZ', provenance: { provider: 'PDBe/SIFTS', xmlUrl: 'https://example.org/sifts', residueListingUrl: 'https://example.org/residues', retrievedAt: '2026-10-25T15:00:00Z', releaseDate: '2026-10-18' }, rows: [{ ...residue, segmentId: 'fragment', accession: 'P01308', position: 2, residue: 'C', notObserved: false }] },
  };
}
const coordinates = () => ({ pdbId: '1TRZ', coordinates: [address] });
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Uninitialized promise'); };
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const digestBytes = () => Uint8Array.from(Buffer.from(evidence().reference_sequence_sha256, 'hex')).buffer;

beforeEach(() => { vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('full-reference residue binding', () => {
  it('keeps both selection directions closed until the full digest is verified', async () => {
    const digest = deferred<ArrayBuffer>();
    vi.spyOn(crypto.subtle, 'digest').mockReturnValueOnce(digest.promise);
    const binding = createVerifiedResidueBinding();
    expect(binding.status).toBe('idle');
    const pending = binding.bind(evidence(), reference, coordinates(), 1);
    expect(binding.status).toBe('verifying');
    expect(binding.fromSequence(2).status).toBe('unverified');
    expect(binding.fromStructure(address).status).toBe('unverified');
    digest.resolve(digestBytes());
    expect(await pending).toBe('ready');
    expect(binding.fromSequence(2)).toMatchObject({ status: 'mapped', candidates: [{ position: 2 }] });
    expect(binding.fromStructure(address)).toMatchObject({ status: 'mapped', candidates: [{ position: 2 }] });
  });

  it('rejects a mutation outside the mapped fragment despite identical mapped residues and version', async () => {
    const binding = createVerifiedResidueBinding();
    expect(await binding.bind(evidence(), { ...reference, sequence: 'ACDEFA' }, coordinates(), 1)).toBe('hash-mismatch');
    expect(binding.fromSequence(2).status).toBe('unverified');
    expect(binding.fromStructure(address).status).toBe('unverified');
  });

  it('requires a known matching sequence version even when all sequence bytes agree', async () => {
    const binding = createVerifiedResidueBinding();
    expect(await binding.bind(evidence(), { ...reference, sequenceVersion: null }, coordinates(), 1)).toBe('version-missing');
    expect(await binding.bind(evidence(), { ...reference, sequenceVersion: 2 }, coordinates(), 1)).toBe('version-mismatch');
    expect(binding.fromSequence(2).status).toBe('unverified');
  });

  it('hashes the exact whole canonical sequence and never normalizes user text to manufacture agreement', async () => {
    const binding = createVerifiedResidueBinding();
    expect(await binding.bind(evidence(), reference, coordinates(), 1)).toBe('ready');
    for (const sequence of ['acdefg', 'ACD EFG', 'ACDEFG\n']) {
      await expect(binding.bind(evidence(), { ...reference, sequence }, coordinates(), 1)).rejects.toThrow();
      expect(binding.status).toBe('error'); expect(binding.fromSequence(2).status).toBe('unverified');
    }
  });

  it('rejects incoherent residue annotations even when the full reference digest matches', async () => {
    const data = evidence();
    const row = data.mapping.rows[0];
    if (!row) throw new Error('Missing fixture');
    row.residue = 'A';
    const binding = createVerifiedResidueBinding();
    expect(await binding.bind(data, reference, coordinates(), 1)).toBe('mapping-mismatch');
    expect(binding.fromSequence(2).status).toBe('unverified');
  });

  it('clears the old model immediately on rebinding and ignores a late digest for a previous reference', async () => {
    const oldDigest = deferred<ArrayBuffer>();
    vi.spyOn(crypto.subtle, 'digest').mockReturnValueOnce(oldDigest.promise);
    const binding = createVerifiedResidueBinding();
    const old = binding.bind(evidence(), reference, coordinates(), 1);
    const model2 = { ...address, modelNum: 2 };
    expect(await binding.bind(evidence(), reference, { pdbId: '1TRZ', coordinates: [model2] }, 2)).toBe('ready');
    oldDigest.resolve(digestBytes());
    expect(await old).toBe('superseded');
    expect(binding.status).toBe('ready');
    expect(binding.fromStructure(address).status).toBe('unmapped');
    expect(binding.fromStructure(model2).status).toBe('mapped');
  });

  it('does not resurrect a cleared binding or use caller mutations made during hashing', async () => {
    const digest = deferred<ArrayBuffer>();
    const digestSpy = vi.spyOn(crypto.subtle, 'digest').mockReturnValueOnce(digest.promise);
    const data = evidence(); const source = { ...reference }; const context = coordinates();
    const binding = createVerifiedResidueBinding();
    const pending = binding.bind(data, source, context, 1);
    source.sequence = 'AAAAAA'; data.reference_sequence_version = 2; data.mapping.rows.length = 0; context.coordinates.length = 0;
    digest.resolve(digestBytes());
    expect(await pending).toBe('ready');
    expect(binding.fromSequence(2).status).toBe('mapped');
    const delayed = deferred<ArrayBuffer>(); digestSpy.mockReturnValueOnce(delayed.promise);
    const cleared = binding.bind(evidence(), reference, coordinates(), 1);
    expect(binding.fromSequence(2).status).toBe('unverified');
    binding.clear(); delayed.resolve(digestBytes());
    expect(await cleared).toBe('superseded'); expect(binding.status).toBe('idle');
    expect(binding.fromSequence(2).status).toBe('unverified');
  });

  it('cancels before, during and after verification without leaving selectable residues', async () => {
    const binding = createVerifiedResidueBinding();
    const before = new AbortController(); before.abort();
    expect(await binding.bind(evidence(), reference, coordinates(), 1, before.signal)).toBe('cancelled');
    const during = new AbortController(); const digest = deferred<ArrayBuffer>();
    vi.spyOn(crypto.subtle, 'digest').mockReturnValueOnce(digest.promise);
    const pending = binding.bind(evidence(), reference, coordinates(), 1, during.signal);
    during.abort(); digest.resolve(digestBytes());
    expect(await pending).toBe('cancelled'); expect(binding.fromSequence(2).status).toBe('unverified');
    const after = new AbortController();
    expect(await binding.bind(evidence(), reference, coordinates(), 1, after.signal)).toBe('ready');
    after.abort(); expect(binding.status).toBe('cancelled');
    expect(binding.fromStructure(address).status).toBe('unverified');
  });

  it('fails closed for invalid metadata, missing WebCrypto or digest failure, without a fallback hash', async () => {
    const binding = createVerifiedResidueBinding();
    await expect(binding.bind({ ...evidence(), reference_sequence_sha256: 'bad' }, reference, coordinates(), 1)).rejects.toThrow();
    const spy = vi.spyOn(crypto.subtle, 'digest').mockRejectedValueOnce(new Error('Unavailable'));
    await expect(binding.bind(evidence(), reference, coordinates(), 1)).rejects.toThrow('Unavailable');
    expect(binding.status).toBe('error'); expect(binding.fromSequence(2).status).toBe('unverified');
    spy.mockRestore(); vi.stubGlobal('crypto', {});
    await expect(binding.bind(evidence(), reference, coordinates(), 1)).rejects.toThrow();
    expect(binding.status).toBe('error');
  });
});
