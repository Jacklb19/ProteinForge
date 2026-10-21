import { required } from './config';
import { RESIDUE_NAMES } from '../chemistry/config';
import type { BackboneModel } from '../structure/backbone';
import type { Coordinates, LabDraftSnapshot, LabReference, LabResidueKey, LabVariant } from './types';
export function traceModel(id: string, sequence: string, keys: LabResidueKey[], ca: Coordinates[]): BackboneModel {
    const chains = new Map<string, BackboneModel['chains'][number]>();
    keys.forEach((key, index) => {
        let chain = chains.get(key.chain);
        if (!chain) {
            chain = { id: key.chain, residues: [] };
            chains.set(key.chain, chain);
        }
        chain.residues.push({ number: key.number, insertion: key.insertion, name: (RESIDUE_NAMES[required(sequence[index])] ?? '').toUpperCase(), ca: required(ca[index]) });
    });
    // Resolution is not displayed for this predicted trace; StructureStage owns experimental resolution captions.
    return { id, source: 'verified-design-lab-result', method: 'C-alpha trace', resolution: 0, chains: [...chains.values()] };
}
/** Export only the measured Cα coordinates retained by the curated example; no backbone atoms are invented. */
export function tracePdb(variant: LabVariant): string {
    const lines = ['REMARK 200 C-ALPHA TRACE ONLY; OTHER ATOMS ARE NOT INCLUDED', 'REMARK 200 COMPUTATIONAL ESMFOLD RESULT; NOT EXPERIMENTALLY VALIDATED'];
    variant.keys.forEach((key, index) => {
        const coordinates = required(variant.ca[index]);
        lines.push(['ATOM  ', String(index + 1).padStart(5), ' ', ' CA ', ' ', required(RESIDUE_NAMES[required(variant.sequence[index])]).toUpperCase(), ' ', key.chain, String(key.number).padStart(4), key.insertion || ' ', '   ', ...coordinates.map(value => value.toFixed(3).padStart(8)), '  1.00', required(variant.plddt[index]).toFixed(2).padStart(6), '          ', ' C', '  '].join(''));
    });
    return lines.join('\n') + '\nTER\nEND\n';
}
export function draftDocument(reference: LabReference, variant: LabVariant, draft: LabDraftSnapshot): object {
    return { kind: 'proteinforge-design-draft', schemaVersion: 1, sequence: draft.sequence,
        source: { referenceId: reference.id, referenceChain: reference.chain, variantSequenceSha256: variant.id, sample: variant.sample },
        structureStatus: draft.sequence === variant.sequence ? 'associated-result' : 'requires-new-prediction',
        constraintStatus: 'not-executed',
        protectedPositions: draft.protectedPositions.map(index => ({ chainPosition: index + 1, residue: draft.sequence[index], referenceKey: reference.keys[index], predictionKey: variant.keys[index] })),
    };
}
