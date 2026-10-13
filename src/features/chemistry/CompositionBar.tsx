import { useTranslation } from '../../i18n';
import { RESIDUE_CLASSES, RESIDUE_CLASS_LABEL_KEYS, classComposition } from './config';

/** How many residues of each chemistry class a sequence has, as one stacked bar and its counts. */
export function CompositionBar({ sequence }: { sequence: string }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const counts = classComposition(sequence);
  return (
    <div className="composition">
      <div className="composition-bar" aria-hidden="true">
        {RESIDUE_CLASSES.filter((name) => counts[name] > 0).map((name) => <span key={name} data-chem={name} style={{ flexGrow: counts[name] }} />)}
      </div>
      <dl className="composition-list">
        {RESIDUE_CLASSES.map((name) => (
          <div key={name}><dt><span className="swatch" data-chem={name} aria-hidden="true" />{t(RESIDUE_CLASS_LABEL_KEYS[name])}</dt><dd>{formatNumber(counts[name])}</dd></div>
        ))}
      </dl>
    </div>
  );
}
