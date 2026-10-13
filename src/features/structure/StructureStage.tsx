import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { SegmentedControl } from '../../shared/SegmentedControl';
import { RESIDUE_NAMES } from '../chemistry/config';
import { regionAt } from '../editor/annotations';
import type { SequenceAnnotations } from '../editor/annotations';
import { BackboneView } from './BackboneView';
import type { ResidueSelection } from './BackboneView';
import { INSULIN_BACKBONE, oneLetter } from './backbone';
import { COLOR_MODES, COLOR_MODE_LABEL_KEYS, DEFAULT_COLOR_MODE } from './config';
import type { ColorMode } from './config';

interface Props {
  /** Size and furniture of the stage; `rail` is a compact companion without the color selector. */
  variant: 'hero' | 'rail' | 'library';
  /** Reference whose mature chains this structure shows; maps chain residues to sequence positions. */
  annotations: SequenceAnnotations;
  /** Selected one-based position in the reference sequence. */
  selected?: number | null;
  onSelect?: (position: number) => void;
  /** Replaces the caption text, for example with a link to the full viewer. */
  caption?: ReactNode;
}

/** Sequence position ↔ chain residue, through the annotated mature chains. */
function toChain(annotations: SequenceAnnotations, position: number): ResidueSelection | null {
  const region = regionAt(annotations, position);
  return region?.chain ? { chain: region.chain, number: position - region.start + 1 } : null;
}
function toPosition(annotations: SequenceAnnotations, selection: ResidueSelection): number | null {
  const region = annotations.regions.find((entry) => entry.chain === selection.chain);
  return region ? region.start + selection.number - 1 : null;
}

/** The measured backbone of the example protein, turnable and linked to its sequence. */
export function StructureStage({ variant, annotations, selected = null, onSelect, caption }: Props): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const [mode, setMode] = useState<ColorMode>(DEFAULT_COLOR_MODE);
  const hint = useId();
  const model = INSULIN_BACKBONE;
  const selection = selected === null ? null : toChain(annotations, selected);
  const residue = selection ? model.chains.find((chain) => chain.id === selection.chain)?.residues.find((entry) => entry.number === selection.number) : undefined;
  const selectedLabel = selection && residue ? `${RESIDUE_NAMES[oneLetter(residue.name)] ?? residue.name} ${selection.chain}${formatNumber(selection.number)}` : undefined;
  const description = t('structure.caption', { name: t(annotations.nameKey), id: model.id, resolution: formatNumber(model.resolution, { minimumFractionDigits: 2 }) });
  return (
    <figure className={`stage stage-${variant}`}>
      <BackboneView
        label={t('structure.label', { name: t(annotations.nameKey), id: model.id })}
        describedBy={hint}
        colorMode={variant === 'rail' ? DEFAULT_COLOR_MODE : mode}
        selected={selection}
        selectedLabel={selectedLabel}
        onSelect={onSelect ? (next) => { const position = toPosition(annotations, next); if (position !== null) onSelect(position); } : undefined}
        showEnds={variant !== 'rail'}
        idleTurn={variant === 'hero'}
      />
      <span id={hint} className={variant === 'rail' ? 'visually-hidden' : 'stage-hint'}>{t('structure.hint')}</span>
      <figcaption className="stage-caption">
        <span>{caption ?? description}</span>
        {variant !== 'rail' && (
          <div className="segmented-bare">
            <SegmentedControl
              legend={t('structure.modeLabel')}
              options={COLOR_MODES.map((value) => ({ value, label: t(COLOR_MODE_LABEL_KEYS[value]) }))}
              value={mode}
              onChange={setMode}
            />
          </div>
        )}
      </figcaption>
    </figure>
  );
}
