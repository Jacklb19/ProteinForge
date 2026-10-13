import { useTranslation } from '../../i18n';
import type { SequenceAnnotations } from '../editor/annotations';
import { RIBBON_ARC, residueClass } from './config';

interface Props {
  sequence: string;
  annotations?: SequenceAnnotations | null;
  /** Letters need room; narrow ribbons show colored cells only. */
  letters?: boolean;
  /** Disulfide bridges drawn as arcs above the cells. */
  bridges?: boolean;
  selected?: number | null;
  onSelect?: (position: number) => void;
  label: string;
}

/** The whole sequence on one line: a cell per residue, its named regions below and its bridges above. */
export function SequenceRibbon({ sequence, annotations = null, letters = false, bridges = false, selected = null, onSelect, label }: Props): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const length = sequence.length;
  const columns = { '--ribbon-columns': length } as React.CSSProperties;
  const isCut = (position: number): boolean => annotations !== null
    && !annotations.regions.some((region) => region.mature && position >= region.start && position <= region.end);
  return (
    <div className="ribbon" style={columns}>
      {bridges && annotations && annotations.disulfides.length > 0 && (
        <svg className="ribbon-arcs" viewBox={`0 0 ${String(length)} ${String(RIBBON_ARC.height)}`} preserveAspectRatio="none" aria-hidden="true">
          {annotations.disulfides.map(([first, second]) => {
            const from = first - 0.5;
            const to = second - 0.5;
            const control = RIBBON_ARC.height - Math.min(RIBBON_ARC.limit, RIBBON_ARC.base + (to - from) * RIBBON_ARC.slope) * RIBBON_ARC.control;
            return <path key={`${String(first)}-${String(second)}`} d={`M${String(from)} ${String(RIBBON_ARC.height)} C${String(from)} ${String(control)} ${String(to)} ${String(control)} ${String(to)} ${String(RIBBON_ARC.height)}`} />;
          })}
        </svg>
      )}
      <div
        className={`ribbon-row${letters ? '' : ' is-bare'}`}
        role="img"
        aria-label={label}
        onClick={onSelect ? (event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>('[data-position]');
          if (target?.dataset.position) onSelect(Number(target.dataset.position));
        } : undefined}
      >
        {Array.from(sequence, (residue, index) => (
          <span
            key={index}
            className={`residue${isCut(index + 1) ? ' is-cut' : ''}${selected === index + 1 ? ' is-selected' : ''}`}
            data-chem={residueClass(residue)}
            data-position={index + 1}
            aria-hidden="true"
          >{letters ? residue : ''}</span>
        ))}
      </div>
      {annotations && (
        <ul className="ribbon-regions">
          {annotations.regions.map((region) => (
            <li key={region.start} data-mature={region.mature} style={{ gridColumn: `${String(region.start)} / ${String(region.end + 1)}` }}>
              <span className="region-long">{t(region.labelKey)} <span className="region-range">{formatNumber(region.start)}–{formatNumber(region.end)}</span></span>
              <span className="region-short" aria-hidden="true">{t(region.shortKey)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
