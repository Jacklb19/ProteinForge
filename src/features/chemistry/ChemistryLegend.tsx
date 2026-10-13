import { useTranslation } from '../../i18n';
import { RESIDUE_CLASSES, RESIDUE_CLASS_LABEL_KEYS } from './config';

/** Key to the residue colors used across sequences, structures and charts. */
export function ChemistryLegend(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ul className="chemistry-legend" aria-label={t('chemistry.legend')}>
      {RESIDUE_CLASSES.map((name) => (
        <li key={name}><span className="swatch" data-chem={name} aria-hidden="true" />{t(RESIDUE_CLASS_LABEL_KEYS[name])}</li>
      ))}
    </ul>
  );
}
