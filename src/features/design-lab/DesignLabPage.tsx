import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { PageHeading } from '../../shared/PageHeading';
import { ROUTES } from '../../shared/navigation';
import { useLab } from './context';
import { LAB_CONFIG as C, LAB_ERROR_KEYS } from './config';
import { downloadLabFile } from './download';
import { draftDocument, tracePdb } from './presentation';
import { LabViewer } from './LabViewer';
import { LabSequence } from './LabSequence';
import { LabInspector } from './LabInspector';
import { LabVariantsTable } from './LabVariantsTable';
import { LabProjectControls } from './LabProjectControls';

function ReplaceDialog({ onClose, onConfirm, returnFocus }: {
  onClose: () => void;
  onConfirm: () => void;
  returnFocus: HTMLElement | null;
}): React.JSX.Element {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { element?.close(); if (returnFocus?.isConnected) returnFocus.focus(); };
  }, [returnFocus]);
  return (
    <dialog className="project-dialog" ref={dialog} aria-labelledby="lab-dialog-title" aria-describedby="lab-dialog-description" onCancel={event => { event.preventDefault(); onClose(); }}>
      <form className="lab-dialog-content" onSubmit={event => { event.preventDefault(); onConfirm(); }}>
        <h2 id="lab-dialog-title">{t('lab.dialogTitle')}</h2>
        <p id="lab-dialog-description">{t('lab.replaceWarning')}</p>
        <div className="actions">
          <button type="button" autoFocus className="button button-secondary" onClick={onClose}>{t('lab.keepCurrent')}</button>
          <button type="submit" className="button button-primary">{t('lab.confirmOpen')}</button>
        </div>
      </form>
    </dialog>
  );
}

export function DesignLabPage(): React.JSX.Element {
  const lab = useLab();
  const { t, formatNumber } = useTranslation();
  const file = useRef<HTMLInputElement>(null), undo = useRef<HTMLButtonElement>(null), openButton = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<{ value: File | 'example'; returnFocus: HTMLElement | null } | null>(null);
  const [replacement, setReplacement] = useState('A');
  const { openExample } = lab;
  useEffect(() => { if (lab.dataset === null && lab.status === 'idle') openExample(); }, [lab.dataset, lab.status, openExample]);

  const dataset = lab.dataset;
  const variant = dataset?.variants.find(item => item.id === lab.activeId);
  const draft = lab.drafts[lab.activeId];
  const busy = lab.status === 'loading' || lab.status === 'exporting';
  const modified = Boolean(variant && draft && variant.sequence !== draft.sequence);
  const number = (value: number, digits = 2): string => formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  /** Opening replaces the current work, so an edited laboratory asks first. */
  function open(value: File | 'example'): void {
    if (lab.dirty) {
      const active = document.activeElement;
      setPending({ value, returnFocus: active instanceof HTMLElement && active !== document.body ? active : openButton.current });
      return;
    }
    if (value === 'example') lab.openExample(); else lab.openFile(value);
  }
  function jump(id: string): void {
    const heading = document.getElementById(id);
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  }
  function restore(): void { lab.restore(); undo.current?.focus({ preventScroll: true }); }
  function exportPdb(): void {
    if (!variant || modified) return;
    // The imported original, or an explicit Cα trace; no atom is ever invented.
    downloadLabFile(variant.pdb ?? tracePdb(variant), `proteinforge-variant-${String(variant.sample)}${variant.pdb ? '' : '-ca-trace'}.pdb`, 'chemical/x-pdb');
  }
  function downloadDraft(): void {
    if (!dataset || !variant || !draft) return;
    downloadLabFile(JSON.stringify(draftDocument(dataset.reference, variant, draft), null, 2), C.constraintsFilename, 'application/json');
  }

  const headingName = dataset?.reference.id === '1UBQ' && dataset.reference.sequence === C.ubiquitinSequence ? t('lab.ubiquitin') : dataset?.reference.id ?? '';
  const selectedKey = variant?.keys[lab.selected];
  const aa = draft?.sequence[lab.selected];

  return (
    <main className="page lab-page">
      <Link className="lab-breadcrumb" to={ROUTES.generate}>{t('lab.backToGenerator')}</Link>
      <PageHeading
        titleKey={dataset ? 'lab.title' : 'lab.pageTitle'}
        titleVariables={{ reference: headingName }}
        introduction={dataset ? 'lab.introduction' : 'lab.emptyIntroduction'}
        introductionVariables={{ reference: dataset?.reference.id ?? '', chain: dataset?.reference.chain ?? '', length: dataset?.reference.sequence.length ?? 0 }}
      >
        <button ref={openButton} type="button" className="button button-secondary" disabled={busy} onClick={() => { file.current?.click(); }}>{t('lab.openFile')}</button>
        <button type="button" className="button button-secondary" disabled={!dataset || busy} onClick={lab.save}>{t('lab.saveFile')}</button>
        <LabProjectControls />
      </PageHeading>

      <input
        ref={file} type="file" accept=".zip,.json,application/zip,application/json" hidden aria-label={t('lab.openFile')}
        onChange={event => { const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (selected) open(selected); }}
      />
      <p className="field-help">{dataset ? t(dataset.source === 'example' ? 'lab.exampleScope' : 'lab.importScope') : t('lab.noResult')}</p>

      {busy && (
        <div className="lab-import-status">
          <p role="status">{t(lab.status === 'exporting' ? 'lab.exporting' : 'lab.loading')}</p>
          {lab.progress && (
            <label>
              {t('lab.progress', { done: lab.progress.completed, total: lab.progress.total })}
              <progress max={lab.progress.total} value={lab.progress.completed} />
            </label>
          )}
          <button type="button" className="button button-secondary" onClick={lab.cancel}>{t('lab.cancel')}</button>
        </div>
      )}
      {lab.error && <p className="status-message" role="alert" data-state="error">{t(LAB_ERROR_KEYS[lab.error])}</p>}
      {lab.status === 'cancelled' && <p className="status-message" role="status">{t('lab.cancelled')}</p>}
      {lab.exported && <p className="status-message" role="status">{t('lab.exportReady')}</p>}

      {dataset && variant && draft && selectedKey && aa && <>
        <nav className="lab-section-links" aria-label={t('lab.sectionNavigation')}>
          <button type="button" onClick={() => { jump('lab-structure'); }}>{t('lab.structureTab')}</button>
          <button type="button" onClick={() => { jump('lab-variants-title'); }}>{t('lab.comparisonTab')}</button>
          <button type="button" onClick={() => { jump('lab-file-tools'); }}>{t('lab.provenanceTab')}</button>
        </nav>

        <div className="lab-workbench">
          <LabViewer reference={dataset.reference} variant={variant} selected={lab.selected} modified={modified} busy={busy} onSelect={lab.selectResidue} onRestore={restore} />
          <LabInspector
            reference={dataset.reference} variant={variant} draft={draft} selected={lab.selected}
            modified={modified} busy={busy} number={number}
            replacement={replacement} onReplacementChange={setReplacement}
            onProtect={lab.protect} onSubstitute={() => { lab.substitute(replacement); }}
            onUndo={lab.undo} onRestore={restore} undoRef={undo} onExportPdb={exportPdb}
          />
        </div>

        <LabSequence sequence={draft.sequence} reference={dataset.reference.sequence} selected={lab.selected} protectedPositions={draft.protectedPositions} disabled={busy} onSelect={lab.selectResidue} />
        <LabVariantsTable dataset={dataset} drafts={lab.drafts} activeId={lab.activeId} busy={busy} number={number} onSelect={lab.selectVariant} />

        <section className="lab-file-tools" id="lab-file-tools" tabIndex={-1}>
          <h2>{t('lab.fileTools')}</h2>
          <div className="actions">
            <button type="button" className="button button-secondary" disabled={busy} onClick={downloadDraft}>{t('lab.downloadDraft')}</button>
            <a className="button button-secondary" href={C.colabNotebookPath} download>{t('lab.downloadNotebook')}</a>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => { open('example'); }}>{t('lab.openExample')}</button>
          </div>
          <p className="field-help">{variant.constraints ? t('lab.executedConstraints', { count: variant.constraints.protectedPositions.length }) : t('lab.editScope')}</p>
          <p className="field-help">{t('lab.colabHint')}</p>
          <p className="field-help">{t('lab.saveScope')}</p>
          <p className="field-help">{t('lab.fileLimits', { zip: number(C.maximumArchiveBytes / 1000000, 0), workspace: number(C.maximumWorkspaceBytes / 1000000, 0) })}</p>
          {lab.dirty && <p className="field-help" role="status">{t('lab.unsaved')}</p>}
          {dataset.source === 'example' && <p className="field-help">{t('lab.exampleTrace')}</p>}

          <details className="disclosure">
            <summary>{t('lab.provenanceTitle')}</summary>
            <p>{t('lab.provenanceMethod')}</p>
            <p className="numeric lab-source">{variant.model} · {variant.revision}</p>
            <p className="numeric lab-source">{variant.designRevision}</p>
            {!modified && <p>{t('lab.ptm')}: {number(variant.ptm, 3)}</p>}
            <p className="field-help">{t('lab.provenanceScope')}</p>
          </details>
        </section>
      </>}

      {!dataset && <button type="button" className="button button-secondary" disabled={busy} onClick={lab.openExample}>{t('lab.openExample')}</button>}
      {pending && (
        <ReplaceDialog
          returnFocus={pending.returnFocus}
          onClose={() => { setPending(null); }}
          onConfirm={() => { const next = pending.value; setPending(null); if (next === 'example') lab.openExample(); else lab.openFile(next); }}
        />
      )}
    </main>
  );
}
