import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { RESIDUE_NAMES, residueClass } from '../chemistry/config';
import { useLab } from './context';
import { LAB_CONFIG as C, LAB_ERROR_KEYS , required } from './config';
import { downloadLabFile } from './download';
import { draftDocument, tracePdb } from './presentation';
import { LabViewer } from './LabViewer';
import { LabSequence } from './LabSequence';
import { LabProjectControls } from './LabProjectControls';
function ReplaceDialog({ onClose, onConfirm, returnFocus }: {
    onClose: () => void;
    onConfirm: () => void;
    returnFocus: HTMLElement|null;
}): React.JSX.Element {
    const { t } = useTranslation();
    const dialog = useRef<HTMLDialogElement>(null);
    useLayoutEffect(() => { const element = dialog.current; if (element && !element.open)
        element.showModal(); return () => { element?.close(); if (returnFocus?.isConnected)
        returnFocus.focus(); }; }, [returnFocus]);
    return <dialog className="project-dialog" ref={dialog} aria-labelledby="lab-dialog-title" aria-describedby="lab-dialog-description" onCancel={event => { event.preventDefault(); onClose(); }}><form className="lab-dialog-content" onSubmit={event => { event.preventDefault(); onConfirm(); }}><h2 id="lab-dialog-title">{t('lab.dialogTitle')}</h2><p id="lab-dialog-description">{t('lab.replaceWarning')}</p><div className="actions"><button type="button" autoFocus className="button button-secondary" onClick={onClose}>{t('lab.keepCurrent')}</button><button type="submit" className="button button-primary">{t('lab.confirmOpen')}</button></div></form></dialog>;
}
export function DesignLabPage(): React.JSX.Element {
    const lab = useLab();
    const { t, formatNumber } = useTranslation();
    const file = useRef<HTMLInputElement>(null), undo = useRef<HTMLButtonElement>(null), openButton=useRef<HTMLButtonElement>(null);
    const [pending, setPending] = useState<{value:File|'example';returnFocus:HTMLElement|null}|null>(null), [replacement, setReplacement] = useState('A');
    const { openExample } = lab;
    useEffect(() => { if (lab.dataset === null && lab.status === 'idle')
        openExample(); }, [lab.dataset, lab.status, openExample]);
    const dataset = lab.dataset, variant = dataset?.variants.find(item => item.id === lab.activeId), draft = lab.drafts[lab.activeId];
    const busy = lab.status === 'loading' || lab.status === 'exporting', modified = Boolean(variant && draft && variant.sequence !== draft.sequence);
    const number = (value: number, digits = 2): string => formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    function open(value: File | 'example'): void { if (lab.dirty) {
        setPending({value,returnFocus:document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:openButton.current});
        return;
    } if (value === 'example')
        lab.openExample();
    else
        lab.openFile(value); }
    function jump(id: string): void { const heading = document.getElementById(id); heading?.scrollIntoView({ block: 'start' }); heading?.focus({ preventScroll: true }); }
    function restore(): void { lab.restore(); undo.current?.focus({ preventScroll: true }); }
    function exportPdb(): void { if (variant && !modified)
        downloadLabFile(variant.pdb ?? tracePdb(variant), `proteinforge-variant-${String(variant.sample)}${variant.pdb ? '' : '-ca-trace'}.pdb`, 'chemical/x-pdb'); }
    const headingName = dataset?.reference.id === '1UBQ' && dataset.reference.sequence === C.ubiquitinSequence ? t('lab.ubiquitin') : dataset?.reference.id ?? '';
    const selectedKey = variant?.keys[lab.selected], aa = draft?.sequence[lab.selected], protectedPosition = draft?.protectedPositions.includes(lab.selected) ?? false;
    return <main className="page lab-page">
    <Link className="lab-breadcrumb" to={ROUTES.generate}>{t('lab.backToGenerator')}</Link>
    <PageHeading titleKey={dataset ? 'lab.title' : 'lab.pageTitle'} titleVariables={{ reference: headingName }} introduction={dataset ? 'lab.introduction' : 'lab.emptyIntroduction'} introductionVariables={{ reference: dataset?.reference.id ?? '', chain: dataset?.reference.chain ?? '', length: dataset?.reference.sequence.length ?? 0 }}>
      <button ref={openButton} type="button" className="button button-secondary" disabled={busy} onClick={() => { file.current?.click(); }}>{t('lab.openFile')}</button><button type="button" className="button button-secondary" disabled={!dataset || busy} onClick={lab.save}>{t('lab.saveFile')}</button><LabProjectControls/>
    </PageHeading>
    <input ref={file} type="file" accept=".zip,.json,application/zip,application/json" hidden aria-label={t('lab.openFile')} onChange={event => { const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (selected)
        open(selected); }}/>
    <p className="field-help">{dataset ? t(dataset.source === 'example' ? 'lab.exampleScope' : 'lab.importScope') : t('lab.noResult')}</p>
    {busy && <div className="lab-import-status"><p role="status">{t(lab.status === 'exporting' ? 'lab.exporting' : 'lab.loading')}</p>{lab.progress && <label>{t('lab.progress', { done: lab.progress.completed, total: lab.progress.total })}<progress max={lab.progress.total} value={lab.progress.completed}/></label>}<button type="button" className="button button-secondary" onClick={lab.cancel}>{t('lab.cancel')}</button></div>}
    {lab.error && <p className="status-message" role="alert" data-state="error">{t(LAB_ERROR_KEYS[lab.error])}</p>}
    {lab.status === 'cancelled' && <p className="status-message" role="status">{t('lab.cancelled')}</p>}
    {lab.exported && <p className="status-message" role="status">{t('lab.exportReady')}</p>}
    {dataset && variant && draft && selectedKey && aa && <>
      <nav className="lab-section-links" aria-label={t('lab.sectionNavigation')}><button type="button" onClick={() => { jump('lab-structure'); }}>{t('lab.structureTab')}</button><button type="button" onClick={() => { jump('lab-variants-title'); }}>{t('lab.comparisonTab')}</button><button type="button" onClick={() => { jump('lab-file-tools'); }}>{t('lab.provenanceTab')}</button></nav>
      <div className="lab-workbench">
        <LabViewer reference={dataset.reference} variant={variant} selected={lab.selected} modified={modified} busy={busy} onSelect={lab.selectResidue} onRestore={restore}/>
        <aside className="lab-inspector" aria-labelledby="lab-variant-title"><div className="section-header"><h2 id="lab-variant-title">{t('lab.variant', { sample: variant.sample })}</h2><button type="button" className="button button-secondary" disabled={busy || modified} onClick={exportPdb}>{t(variant.pdb ? 'lab.exportPdb' : 'lab.exportTrace')}</button></div>
          <div className="lab-metrics"><div><strong className="numeric">{modified ? '—' : number(variant.meanPlddt)}</strong><span>{t('lab.meanConfidence')}</span></div><div><strong className="numeric">{modified ? '—' : `${number(variant.rmsd, 3)} Å`}</strong><span>{t('lab.rmsd', { count: variant.sequence.length })}</span></div></div>
          <p className="field-help">{modified ? t('lab.draftHint') : t('lab.scientificScope')}</p>
          <section className="lab-residue-inspector"><h3>{t('lab.selectedResidue')}</h3><div className="lab-residue-readout" role="status"><span className="residue" data-chem={residueClass(aa)} aria-hidden="true">{aa}</span><div><strong>{t('lab.residueName', { name: RESIDUE_NAMES[aa] ?? aa, chain: selectedKey.chain, number: selectedKey.number, insertion: selectedKey.insertion })}</strong><p className="field-help">{t('lab.referenceResidue', { residue: dataset.reference.sequence[lab.selected] ?? '', confidence: modified ? t('lab.noPrediction') : number(required(variant.plddt[lab.selected]), 1) })}</p></div></div>
            <button type="button" className="button button-secondary" aria-pressed={protectedPosition} disabled={busy} onClick={lab.protect}>{t(protectedPosition ? 'lab.unprotect' : 'lab.protect')}</button>
            <div className="lab-substitution"><label className="field"><span>{t('lab.replaceWith')}</span><select className="text-input" value={replacement} disabled={busy || protectedPosition} onChange={event => { setReplacement(event.target.value); }}>{Object.entries(RESIDUE_NAMES).map(([letter, name]) => <option key={letter} value={letter}>{letter} · {name}</option>)}</select></label><button type="button" className="button button-secondary" disabled={busy || protectedPosition || replacement === aa} onClick={() => { lab.substitute(replacement); }}>{t('lab.applyReplacement')}</button><button ref={undo} type="button" className="button button-secondary" disabled={busy || draft.history.length === 0} onClick={lab.undo}>{t('lab.undo')}</button></div>
            <p className="field-help">{t('lab.protectedCount', { count: draft.protectedPositions.length })}</p>{modified && <button type="button" className="button button-secondary" disabled={busy} onClick={restore}>{t('lab.restore')}</button>}
          </section>
        </aside>
      </div>
      <LabSequence sequence={draft.sequence} reference={dataset.reference.sequence} selected={lab.selected} protectedPositions={draft.protectedPositions} disabled={busy} onSelect={lab.selectResidue}/>
      <section className="lab-variants" aria-labelledby="lab-variants-title"><div className="section-header"><h2 id="lab-variants-title" tabIndex={-1}>{t('lab.variantsTitle')}</h2><p className="field-help">{t('lab.variantsNote')}</p></div><div className="lab-table-scroll"><table className="lab-table"><caption className="visually-hidden">{t('lab.tableCaption')}</caption><thead><tr><th scope="col">{t('lab.sampleHeader')}</th><th scope="col" className="lab-table-optional">{t('lab.lengthHeader')}</th><th scope="col">{t('lab.confidenceHeader')}</th><th scope="col">{t('lab.rmsdHeader')}</th><th scope="col" className="lab-table-optional">{t('lab.identityHeader')}</th></tr></thead><tbody>{dataset.variants.map(item => { const itemDraft = required(lab.drafts[item.id]), changed = itemDraft.sequence !== item.sequence; return <tr key={item.id} data-active={lab.activeId === item.id}><th scope="row"><button type="button" className="button button-secondary" aria-pressed={lab.activeId === item.id} disabled={busy} onClick={() => { lab.selectVariant(item.id); }}>{t('lab.variant', { sample: item.sample })}</button><span className="field-help">{t(changed ? 'lab.draftState' : 'lab.resultState')}</span></th><td className="numeric lab-table-optional">{item.sequence.length}</td><td className="numeric">{changed ? '—' : number(item.meanPlddt)}</td><td className="numeric">{changed ? '—' : `${number(item.rmsd, 3)} Å`}</td><td className="numeric lab-table-optional">{Array.from(itemDraft.sequence).filter((residue, index) => residue === dataset.reference.sequence[index]).length}/{item.sequence.length}</td></tr>; })}</tbody></table></div></section>
      <section className="lab-file-tools" id="lab-file-tools" tabIndex={-1}><h2>{t('lab.fileTools')}</h2><div className="actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => { downloadLabFile(JSON.stringify(draftDocument(dataset.reference, variant, draft), null, 2), C.constraintsFilename, 'application/json'); }}>{t('lab.downloadDraft')}</button><a className="button button-secondary" href={C.colabNotebookPath} download>{t('lab.downloadNotebook')}</a><button type="button" className="button button-secondary" disabled={busy} onClick={() => { open('example'); }}>{t('lab.openExample')}</button></div><p className="field-help">{variant.constraints ? t('lab.executedConstraints', {count:variant.constraints.protectedPositions.length}) : t('lab.editScope')}</p><p className="field-help">{t('lab.colabHint')}</p><p className="field-help">{t('lab.saveScope')}</p><p className="field-help">{t('lab.fileLimits', { zip: number(C.maximumArchiveBytes / 1000000, 0), workspace: number(C.maximumWorkspaceBytes / 1000000, 0) })}</p>{lab.dirty && <p className="field-help" role="status">{t('lab.unsaved')}</p>}
        {dataset.source==='example'&&<p className="field-help">{t('lab.exampleTrace')}</p>}
        <details className="disclosure"><summary>{t('lab.provenanceTitle')}</summary><p>{t('lab.provenanceMethod')}</p><p className="numeric lab-source">{variant.model} · {variant.revision}</p><p className="numeric lab-source">{variant.designRevision}</p>{!modified&&<p>{t('lab.ptm')}: {number(variant.ptm, 3)}</p>}<p className="field-help">{t('lab.provenanceScope')}</p></details>
      </section>
    </>}
    {!dataset && <button type="button" className="button button-secondary" disabled={busy} onClick={lab.openExample}>{t('lab.openExample')}</button>}
    {pending && <ReplaceDialog returnFocus={pending.returnFocus} onClose={() => { setPending(null); }} onConfirm={() => { const next = pending.value; setPending(null); if (next === 'example')
        lab.openExample();
    else
        lab.openFile(next); }}/>}
  </main>;
}
