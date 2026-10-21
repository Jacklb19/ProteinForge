import { required } from './config';
import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import { BackboneView } from '../structure/BackboneView';
import { RESIDUE_NAMES } from '../chemistry/config';
import { traceModel } from './presentation';
import type { LabReference, LabVariant } from './types';
interface Props {
    reference: LabReference;
    variant: LabVariant;
    selected: number;
    modified: boolean;
    busy: boolean;
    onSelect: (index: number) => void;
    onRestore: () => void;
}
export function LabViewer({ reference, variant, selected, modified, busy, onSelect, onRestore }: Props): React.JSX.Element {
    const { t } = useTranslation();
    const [overlay, setOverlay] = useState(true), [revision, setRevision] = useState(0);
    const model = useMemo(() => traceModel(variant.id, variant.sequence, variant.keys, variant.alignedCa), [variant]);
    const backdrop = useMemo(() => traceModel(reference.id, reference.sequence, reference.keys, reference.ca), [reference]);
    const residue = required(variant.keys[selected]);
    return <section className="lab-viewer" id="lab-structure" tabIndex={-1} aria-label={t('lab.structureTitle', { sample: variant.sample })}>
    <div className="lab-viewer-heading"><h2>{t('lab.structureTitle', { sample: variant.sample })}</h2><span className="field-help">{t('lab.traceCaption')}</span></div>
    <div className="lab-figure">{modified ? <div className="lab-draft-empty" role="status"><h3>{t('lab.draftTitle')}</h3><p>{t('lab.draftHint')}</p><button type="button" className="button button-secondary" disabled={busy} onClick={onRestore}>{t('lab.restore')}</button></div> : <BackboneView key={revision} label={t('lab.viewerLabel', { reference: reference.id, sample: variant.sample })} describedBy="lab-view-instructions" colorMode="chemistry" model={model} reference={overlay ? backdrop : undefined} selected={residue} selectedLabel={t('lab.residueName', { name: RESIDUE_NAMES[required(variant.sequence[selected])] ?? '', chain: residue.chain, number: residue.number, insertion: residue.insertion })} onSelect={busy ? undefined : selection => { const index = variant.keys.findIndex(key => key.chain === selection.chain && key.number === selection.number && key.insertion === (selection.insertion ?? '')); if (index >= 0)
        onSelect(index); }}/>}</div>
    <div className="lab-viewer-actions"><label className="checkbox-option"><input type="checkbox" checked={overlay} disabled={modified || busy} onChange={event => { setOverlay(event.target.checked); }}/><span>{t('lab.overlay')}</span></label><button className="button button-secondary" type="button" disabled={modified || busy} onClick={() => { setRevision(value => value + 1); }}>{t('lab.resetView')}</button></div>
    <p className="lab-viewer-caption">{t('lab.referenceCaption', { reference: reference.id, chain: reference.chain })}</p><p id="lab-view-instructions" className="visually-hidden">{t('lab.viewInstructions')}</p>
  </section>;
}
