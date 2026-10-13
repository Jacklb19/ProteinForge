import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { ResiduePropensity } from './chouFasman';
import { PROPENSITY_STRIP_FLOOR, PROPENSITY_STRIP_SPAN, STRIP_MINIMUM_OPACITY } from './config';

const STRIPS: readonly { key: 'helix' | 'sheet' | 'turn'; labelKey: TranslationKey }[] = [
  { key: 'helix', labelKey: 'profile.helixFull' },
  { key: 'sheet', labelKey: 'profile.sheetFull' },
  { key: 'turn', labelKey: 'profile.turn' },
];

/** Chou–Fasman propensities as three strips along the sequence: the darker a cell, the stronger the tendency. */
export function PropensityStrips({ propensities }: { propensities: readonly ResiduePropensity[] }): React.JSX.Element {
  const { t } = useTranslation();
  const opacity = (value: number | null): number => (value === null
    ? STRIP_MINIMUM_OPACITY
    : Math.max(STRIP_MINIMUM_OPACITY, Math.min(1, (value - PROPENSITY_STRIP_FLOOR) / PROPENSITY_STRIP_SPAN)));
  return (
    <div className="strips" style={{ '--ribbon-columns': propensities.length } as React.CSSProperties} aria-hidden="true">
      {STRIPS.map((strip) => (
        <div key={strip.key} className="strip">
          <span className="strip-name">{t(strip.labelKey)}</span>
          <span className="strip-cells">
            {propensities.map((row) => <span key={row.position} style={{ opacity: opacity(row[strip.key]) }} />)}
          </span>
        </div>
      ))}
    </div>
  );
}
