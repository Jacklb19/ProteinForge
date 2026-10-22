import { useTranslation } from '../../i18n';
import { RESIDUE_NAMES, residueClass } from '../chemistry/config';
import { required } from './config';
import type { LabDraft, LabReference, LabVariant } from './types';

interface Props {
  reference: LabReference;
  variant: LabVariant;
  draft: LabDraft;
  selected: number;
  modified: boolean;
  busy: boolean;
  number: (value: number, digits?: number) => string;
  replacement: string;
  onReplacementChange: (residue: string) => void;
  onProtect: () => void;
  onSubstitute: () => void;
  onUndo: () => void;
  onRestore: () => void;
  undoRef: React.RefObject<HTMLButtonElement | null>;
  onExportPdb: () => void;
}

/** Measurements of the active variant and the editing controls of the selected position. */
export function LabInspector({ reference, variant, draft, selected, modified, busy, number, replacement, onReplacementChange, onProtect, onSubstitute, onUndo, onRestore, undoRef, onExportPdb }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const key = required(variant.keys[selected]);
  const aa = required(draft.sequence[selected]);
  const isProtected = draft.protectedPositions.includes(selected);
  return (
    <aside className="lab-inspector" aria-labelledby="lab-variant-title">
      <div className="section-header">
        <h2 id="lab-variant-title">{t('lab.variant', { sample: variant.sample })}</h2>
        <button type="button" className="button button-secondary" disabled={busy || modified} onClick={onExportPdb}>
          {t(variant.pdb ? 'lab.exportPdb' : 'lab.exportTrace')}
        </button>
      </div>

      {/* A substitution invalidates the figures of a past run until a new prediction exists. */}
      <div className="lab-metrics">
        <div>
          <strong className="numeric">{modified ? '—' : number(variant.meanPlddt)}</strong>
          <span>{t('lab.meanConfidence')}</span>
        </div>
        <div>
          <strong className="numeric">{modified ? '—' : `${number(variant.rmsd, 3)} Å`}</strong>
          <span>{t('lab.rmsd', { count: variant.sequence.length })}</span>
        </div>
      </div>
      <p className="field-help">{modified ? t('lab.draftHint') : t('lab.scientificScope')}</p>

      <section className="lab-residue-inspector">
        <h3>{t('lab.selectedResidue')}</h3>
        <div className="lab-residue-readout" role="status">
          <span className="residue" data-chem={residueClass(aa)} aria-hidden="true">{aa}</span>
          <div>
            <strong>{t('lab.residueName', { name: RESIDUE_NAMES[aa] ?? aa, chain: key.chain, number: key.number, insertion: key.insertion })}</strong>
            <p className="field-help">
              {t('lab.referenceResidue', {
                residue: reference.sequence[selected] ?? '',
                confidence: modified ? t('lab.noPrediction') : number(required(variant.plddt[selected]), 1),
              })}
            </p>
          </div>
        </div>

        <button type="button" className="button button-secondary" aria-pressed={isProtected} disabled={busy} onClick={onProtect}>
          {t(isProtected ? 'lab.unprotect' : 'lab.protect')}
        </button>

        <div className="lab-substitution">
          <label className="field">
            <span>{t('lab.replaceWith')}</span>
            <select className="text-input" value={replacement} disabled={busy || isProtected} onChange={event => { onReplacementChange(event.target.value); }}>
              {Object.entries(RESIDUE_NAMES).map(([letter, name]) => <option key={letter} value={letter}>{letter} · {name}</option>)}
            </select>
          </label>
          <button type="button" className="button button-secondary" disabled={busy || isProtected || replacement === aa} onClick={onSubstitute}>
            {t('lab.applyReplacement')}
          </button>
          <button ref={undoRef} type="button" className="button button-secondary" disabled={busy || draft.history.length === 0} onClick={onUndo}>
            {t('lab.undo')}
          </button>
        </div>

        <p className="field-help">{t('lab.protectedCount', { count: draft.protectedPositions.length })}</p>
        {modified && <button type="button" className="button button-secondary" disabled={busy} onClick={onRestore}>{t('lab.restore')}</button>}
      </section>
    </aside>
  );
}
