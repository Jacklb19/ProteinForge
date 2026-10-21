import { z } from 'zod';
import { ensure, LAB_CONFIG as C, LabError , required } from './config';
import { parseFasta, parsePdb, superpose } from './geometry';
import {verifyLabConstraints} from './constraints';
import { readZip, safePath, sha256 } from './zip';
import type { ExpansionBudget } from './zip';
import type { LabDataset, LabImportResult, LabProgress, LabReference, LabVariant } from './types';
const decoder = new TextDecoder('utf-8', { fatal: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sequence = z.string().min(3).max(C.maximumResidues).regex(/^[ACDEFGHIKLMNPQRSTVWY]+$/);
const point = z.tuple([z.number(), z.number(), z.number()]);
const keys = z.array(z.object({ chain: z.string().length(1), number: z.number().int(), insertion: z.string().regex(/^[A-Za-z]?$/) })).max(C.maximumResidues);
const referenceSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/), chain: z.string().regex(/^[A-Za-z0-9]$/), sequence, sha256: hash, url: z.string().startsWith('https://').max(300) });
const designSchema = z.object({ revision: z.literal(C.mpnnRevision), model: z.literal('v_48_020'), seed: z.number().int().nonnegative(), samples: z.number().int().min(1).max(C.maximumVariants), selectedSample: z.number().int().min(1).max(C.maximumVariants), temperature: z.number().positive().max(10), maxLength: z.number().int().min(3).max(C.maximumResidues), constraints:z.object({draftSha256:hash}).strict().optional() });
const predictionConfig = z.object({ model: z.literal(C.foldingModel), revision: z.literal(C.foldingRevision) });
const configSchema = z.object({ schemaVersion: z.literal(1), reference: referenceSchema, design: designSchema, prediction: predictionConfig });
const manifestSchema = z.object({ schemaVersion: z.literal(1), status: z.enum(['completed','incomplete']), files: z.array(z.object({ path: z.string(), bytes: z.number().int().nonnegative().max(C.maximumEntryBytes), sha256: hash })).max(C.maximumEntries) });
const candidateSchema = z.object({ sequence, sample: z.number().int().min(1).max(C.maximumVariants), selectedBeforePrediction: z.literal(true), sequenceSha256: hash });
const predictionSchema = z.object({ sequence, sequenceSha256: hash, model: z.literal(C.foldingModel), revision: z.literal(C.foldingRevision), chain: z.literal('A'), residueCount: z.number().int(), atomCount: z.number().int(), plddtRawScale: z.tuple([z.literal(0), z.literal(1)]), plddtExportScale: z.tuple([z.literal(0), z.literal(100)]), caPlddt: z.array(z.number().min(0).max(100)).max(C.maximumResidues), meanCaPlddt: z.number().min(0).max(100), ptm: z.number().min(0).max(1) });
const designSummarySchema = z.object({ repeatSequencesEqual: z.literal(true), candidates: z.array(z.object({ sequence })).min(1).max(C.maximumVariants) });
function decode<T>(bytes: Uint8Array | undefined, schema: z.ZodType<T>): T {
    ensure(bytes, 'incomplete');
    let value: unknown;
    try {
        value = JSON.parse(decoder.decode(bytes));
    }
    catch {
        throw new LabError('schema');
    }
    const parsed = schema.safeParse(value);
    ensure(parsed.success, 'schema');
    return parsed.data;
}
const text = (files: Map<string, Uint8Array>, name: string): string => { const bytes = files.get(name); ensure(bytes, 'incomplete'); return decoder.decode(bytes); };
async function verifyManifest(files: Map<string, Uint8Array>): Promise<void> {
    const manifest = decode(files.get('result-manifest.json'), manifestSchema);
    ensure(manifest.status==='completed','incomplete');
    const paths = new Set<string>();
    for (const entry of manifest.files) {
        safePath(entry.path);
        ensure(!paths.has(entry.path) && entry.path !== 'result-manifest.json', 'path');
        paths.add(entry.path);
        const bytes = files.get(entry.path);
        ensure(bytes && bytes.length === entry.bytes && await sha256(bytes) === entry.sha256, 'hash');
    }
    ensure(paths.size + 1 === files.size && [...files.keys()].every(name => name === 'result-manifest.json' || paths.has(name)), 'hash');
}
/** Numeric .npy payload only: no pickle or executable object arrays are accepted. */
async function verifyPae(bytes: Uint8Array | undefined, length: number, budget: ExpansionBudget): Promise<void> {
    ensure(bytes, 'incomplete');
    const files = await readZip(bytes, budget);
    const array = files.get('pae.npy');
    ensure(array && files.size === 1 && array.length >= 12 && array[0] === 0x93 && decoder.decode(array.subarray(1, 6)) === 'NUMPY', 'confidence');
    const view = new DataView(array.buffer, array.byteOffset, array.byteLength), version = array[6];
    ensure(version === 1 || version === 2 || version === 3, 'confidence');
    const start = version === 1 ? 10 : 12, headerLength = version === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
    ensure(start + headerLength <= array.length && headerLength <= 4096, 'confidence');
    const header = decoder.decode(array.subarray(start, start + headerLength));
    const dtype = /['"]descr['"]\s*:\s*['"](<f[48])['"]/.exec(header)?.[1];
    const shape = /['"]shape['"]\s*:\s*\(\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/.exec(header);
    ensure(dtype && shape && Number(shape[1]) === length && Number(shape[2]) === length && /['"]fortran_order['"]\s*:\s*False/.test(header), 'confidence');
    const width = dtype === '<f4' ? 4 : 8, offset = start + headerLength;
    ensure(offset + length * length * width === array.length, 'confidence');
    for (let i = offset; i < array.length; i += width) {
        const value = width === 4 ? view.getFloat32(i, true) : view.getFloat64(i, true);
        ensure(Number.isFinite(value) && value >= 0, 'confidence');
    }
}
interface ValidatedCase {
    reference: LabReference;
    variant: LabVariant;
    sequences: string[];
}
async function validateCase(files: Map<string, Uint8Array>, budget: ExpansionBudget): Promise<ValidatedCase> {
    await verifyManifest(files);
    decode(files.get('validation.json'), z.object({ status: z.literal('completed'), missing: z.array(z.never()), exactCandidateSequence: z.literal(true), finiteCoordinates: z.literal(true), completeBackbone: z.literal(true), repeatedDesign: z.literal(true) }));
    const config = decode(files.get('config.json'), configSchema);
    const provenance = decode(files.get('provenance.json'), z.object({ experiment: z.literal('known-backbone-sequence-redesign'), reference: referenceSchema, design: designSchema, prediction: predictionConfig }));
    ensure(JSON.stringify(provenance.reference) === JSON.stringify(config.reference) && JSON.stringify(provenance.design) === JSON.stringify(config.design) && JSON.stringify(provenance.prediction) === JSON.stringify(config.prediction), 'schema');
    const environment = decode(files.get('environment.json'), z.object({ experimentScriptSha256: hash, configSha256: hash }));
    ensure(await sha256(files.get('experiment.py') ?? new Uint8Array()) === environment.experimentScriptSha256 && await sha256(required(files.get('config.json'))) === environment.configSha256, 'hash');
    ensure(config.reference.sequence.length <= config.design.maxLength && config.design.selectedSample <= config.design.samples, 'schema');
    const candidate = decode(files.get('candidate.json'), candidateSchema), prediction = decode(files.get('prediction.json'), predictionSchema);
    const digest = await sha256(new TextEncoder().encode(candidate.sequence));
    ensure(candidate.sequence === prediction.sequence && candidate.sequence.length === config.reference.sequence.length && digest === candidate.sequenceSha256 && digest === prediction.sequenceSha256 && candidate.sample === config.design.selectedSample, 'sequence');
    const reference = parsePdb(text(files, 'reference.pdb'), config.reference.chain, config.reference.sequence);
    const model = parsePdb(text(files, 'prediction.pdb'), prediction.chain, candidate.sequence);
    const referenceRecord = decode(files.get('reference.json'), z.object({ chain: z.string(), sequence, residueKeys: z.array(z.tuple([z.number().int(), z.string()])), ca: z.array(point), atomCount: z.number().int() }));
    ensure(referenceRecord.chain === config.reference.chain && referenceRecord.sequence === reference.sequence && referenceRecord.atomCount === reference.atomCount && JSON.stringify(referenceRecord.residueKeys) === JSON.stringify(reference.keys.map(key => [key.number, key.insertion])) && JSON.stringify(referenceRecord.ca) === JSON.stringify(reference.ca), 'pdb');
    ensure(prediction.residueCount === candidate.sequence.length && prediction.atomCount === model.atomCount && prediction.caPlddt.length === model.ca.length, 'confidence');
    ensure(prediction.caPlddt.every((value, i) => Math.abs(value - required(model.caConfidence[i])) <= C.pdbConfidenceTolerance), 'confidence');
    ensure(Math.abs(prediction.caPlddt.reduce((a, b) => a + b, 0) / model.ca.length - prediction.meanCaPlddt) <= C.confidenceMeanTolerance, 'confidence');
    const sequences = parseFasta(text(files, 'design/seqs/reference.fa'));
    const repeat = parseFasta(text(files, 'design-repeat/seqs/reference.fa'));
    const design = decode(files.get('design-summary.json'), designSummarySchema);
    ensure(JSON.stringify(sequences) === JSON.stringify(repeat) && sequences.length === config.design.samples + 1 && sequences.every(value=>value.length===reference.sequence.length) && sequences[candidate.sample] === candidate.sequence && JSON.stringify(design.candidates.map(item => item.sequence)) === JSON.stringify(sequences.slice(1)), 'sequence');
    const constraints=await verifyLabConstraints(files,config.design.constraints,{id:config.reference.id,chain:config.reference.chain,sequence:reference.sequence,keys:reference.keys,ca:reference.ca},sequences,config.design.samples);
    ensure(parseFasta(text(files, 'candidate.fasta')).join() === candidate.sequence && parseFasta(text(files, 'reference.fasta')).join() === reference.sequence, 'sequence');
    const fit = superpose(reference.ca, model.ca);
    const comparison = decode(files.get('comparison.json'), z.object({ residuesCompared: z.number().int(), caRmsdAngstrom: z.number().nonnegative() }));
    ensure(comparison.residuesCompared === model.ca.length && Math.abs(fit.rmsd - comparison.caRmsdAngstrom) <= C.rmsdTolerance, 'comparison');
    await verifyPae(files.get('predicted-aligned-error.npz'), model.ca.length, budget);
    return {
        reference: { id: config.reference.id, chain: config.reference.chain, sequence: reference.sequence, keys: reference.keys, ca: reference.ca },
        variant: { id: digest, sample: candidate.sample, sequence: candidate.sequence, keys: model.keys, ca: model.ca, alignedCa: fit.aligned, plddt: prediction.caPlddt, meanPlddt: prediction.meanCaPlddt, ptm: prediction.ptm, rmsd: fit.rmsd, identicalPositions: Array.from(candidate.sequence).filter((aa, i) => aa === reference.sequence[i]).length, pdb: text(files, 'prediction.pdb'), model: prediction.model, revision: prediction.revision, designRevision: config.design.revision, ...(constraints?{constraints}:{}) }, sequences,
    };
}
const campaignSchema = z.object({ status: z.literal('completed'), sameGeneratedSequenceSet: z.literal(true), samples: z.array(z.object({ sample: z.number().int().min(1).max(C.maximumVariants), sequence, sequenceSha256: hash, meanCaPlddt: z.number().min(0).max(100), ptm: z.number().min(0).max(1), caRmsdAngstrom: z.number().nonnegative(), archive: z.string(), archiveBytes: z.number().int().positive().max(C.maximumArchiveBytes), archiveSha256: hash })).min(1).max(C.maximumVariants) });
export async function importArchive(bytes: ArrayBuffer, progress: (value: LabProgress) => void = () => undefined): Promise<LabImportResult> {
    ensure(bytes.byteLength <= C.maximumArchiveBytes, 'size');
    const budget = { used: 0 };
    const files = await readZip(new Uint8Array(bytes), budget);
    const variants: ValidatedCase[] = [];
    if (files.has('campaign-summary.json')) {
        const campaign = decode(files.get('campaign-summary.json'), campaignSchema);
        const seen = new Set<string>();
        ensure(files.size === campaign.samples.length + 2 && files.has('campaign.py'), 'schema');
        for (const entry of campaign.samples) {
            safePath(entry.archive);
            ensure(!seen.has(entry.archive), 'path');
            seen.add(entry.archive);
            const archive = files.get(entry.archive);
            ensure(archive && archive.length === entry.archiveBytes && await sha256(archive) === entry.archiveSha256, 'hash');
            const validated = await validateCase(await readZip(archive, budget), budget), variant = validated.variant;
            ensure(variant.sample === entry.sample && variant.sequence === entry.sequence && variant.id === entry.sequenceSha256 && Math.abs(variant.meanPlddt - entry.meanCaPlddt) <= C.confidenceMeanTolerance && Math.abs(variant.ptm - entry.ptm) < 1e-8 && Math.abs(variant.rmsd - entry.caRmsdAngstrom) <= C.rmsdTolerance, 'schema');
            variants.push(validated);
            progress({ completed: variants.length, total: campaign.samples.length });
        }
    }
    else {
        variants.push(await validateCase(files, budget));
        progress({ completed: 1, total: 1 });
    }
    const first = required(variants[0]);
    ensure(new Set(variants.map(item => item.variant.sample)).size === variants.length && new Set(variants.map(item => item.variant.id)).size === variants.length, 'sequence');
    ensure(variants.every(item => JSON.stringify(item.reference) === JSON.stringify(first.reference) && JSON.stringify(item.sequences) === JSON.stringify(first.sequences)), 'sequence');
    const id = await sha256(new Uint8Array(bytes));
    return { dataset: { id, source: 'import', reference: first.reference, variants: variants.map(item => item.variant).sort((a, b) => a.sample - b.sample) }, archive: bytes, saved: null };
}
const exampleSchema = z.object({ schemaVersion: z.literal(1), id: z.literal(C.exampleId), sourceArchiveSha256: hash,
    reference: z.object({ id: z.string(), chain: z.string().length(1), sequence, keys, ca: z.array(point).max(C.maximumResidues) }),
    samples: z.array(z.object({ sample: z.number().int().min(1).max(3), sequence, sequenceSha256: hash, keys, ca: z.array(point).max(C.maximumResidues), plddt: z.array(z.number().min(0).max(100)).max(C.maximumResidues), meanPlddt: z.number().min(0).max(100), ptm: z.number().min(0).max(1), rmsd: z.number().nonnegative(), model: z.literal(C.foldingModel), revision: z.literal(C.foldingRevision), designRevision: z.literal(C.mpnnRevision) })).length(3),
});
/** The curated example is a derived Cα teaching fixture, not an imported all-atom PDB. */
export async function loadExample(): Promise<LabImportResult> {
    const module = await import('./fixtures/ubiquitin.json');
    const parsed = exampleSchema.safeParse(module.default);
    ensure(parsed.success, 'schema');
    const example = parsed.data;
    ensure(example.reference.ca.length === example.reference.sequence.length && example.reference.keys.length === example.reference.sequence.length, 'pdb');
    const variants: LabVariant[] = [];
    for (const sample of example.samples) {
        ensure(sample.ca.length === sample.sequence.length && sample.keys.length === sample.sequence.length && sample.plddt.length === sample.sequence.length && sample.sequence.length === example.reference.sequence.length, 'sequence');
        ensure(await sha256(new TextEncoder().encode(sample.sequence)) === sample.sequenceSha256, 'hash');
        const fit = superpose(example.reference.ca, sample.ca);
        ensure(Math.abs(fit.rmsd - sample.rmsd) <= C.rmsdTolerance, 'comparison');
        variants.push({ ...sample, id: sample.sequenceSha256, alignedCa: fit.aligned, identicalPositions: Array.from(sample.sequence).filter((aa, i) => aa === example.reference.sequence[i]).length, pdb: null });
    }
    const dataset: LabDataset = { id: C.exampleId, source: 'example', reference: example.reference, variants };
    return { dataset, archive: null, saved: null };
}
