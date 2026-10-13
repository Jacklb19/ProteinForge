import { useTranslation } from '../../i18n';
import type { SequenceAnnotations } from '../editor/annotations';
import { COLUMN_KIND_LABEL_KEYS, GAP_CHARACTER } from './config';
import { columnKinds } from './columns';
import type { ColumnKind } from './columns';
import type { AlignmentResult } from './gotoh';

interface Props {
  result: AlignmentResult;
  /** Regions of the first sequence, drawn only when its columns map one to one onto its positions. */
  annotations?: SequenceAnnotations | null;
  label: string;
}

const KEY_ORDER: readonly ColumnKind[] = ['identical', 'similar', 'different', 'gap'];

/** Every alignment column as one cell: where two sequences agree and where they part. */
export function AlignmentMap({ result, annotations = null, label }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const kinds = columnKinds(result);
  const aligned = annotations !== null && !result.alignedFirst.includes(GAP_CHARACTER) && result.parameters.mode === 'global';
  return (
    <div className="alignment-map" style={{ '--ribbon-columns': kinds.length } as React.CSSProperties}>
      {aligned && (
        <ul className="ribbon-regions">
          {annotations.regions.map((region) => (
            <li key={region.start} data-mature={region.mature} style={{ gridColumn: `${String(region.start)} / ${String(region.end + 1)}` }}>
              <span className="region-long">{t(region.labelKey)}</span>
              <span className="region-short" aria-hidden="true">{t(region.shortKey)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="map-row" role="img" aria-label={label}>
        {kinds.map((kind, index) => <span key={index} data-kind={kind} />)}
      </div>
    </div>
  );
}

/** Key for the map; shown once below it. */
export function AlignmentMapKey(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ul className="map-key">
      {KEY_ORDER.map((kind) => <li key={kind}><i data-kind={kind} aria-hidden="true" />{t(COLUMN_KIND_LABEL_KEYS[kind])}</li>)}
    </ul>
  );
}
