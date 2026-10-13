import { useId } from 'react';
import { useTranslation } from '../../i18n';
import { PROFILE_MINIMUM_HALF_RANGE, SKETCH_HEIGHT_UNITS, SKETCH_INSET_UNITS, SKETCH_POSITION_STEP } from './config';
import type { ProfilePoint } from './profile';

interface Props {
  points: readonly ProfilePoint[];
  /** Residues in the sequence; positions without a complete window stay empty at both ends. */
  length: number;
  label: string;
}

/** A small, static reading of a hydropathy profile: above zero avoids water, below zero seeks it. */
export function ProfileSketch({ points, length, label }: Props): React.JSX.Element {
  const { formatNumber } = useTranslation();
  const clip = useId();
  const drawn = points.filter((point): point is { position: number; value: number } => point.value !== null);
  const extent = Math.max(PROFILE_MINIMUM_HALF_RANGE, ...drawn.map((point) => Math.abs(point.value)));
  const tick = Math.max(1, Math.floor(extent));
  const half = SKETCH_HEIGHT_UNITS / 2;
  const x = (position: number): number => position - 0.5;
  const y = (value: number): number => half - (value / extent) * (half - SKETCH_INSET_UNITS);
  const line = drawn.map((point, index) => `${index === 0 ? 'M' : 'L'}${String(x(point.position))} ${y(point.value).toFixed(2)}`).join(' ');
  const first = drawn[0];
  const last = drawn.at(-1);
  const area = first && last ? `${line} L${String(x(last.position))} ${String(half)} L${String(x(first.position))} ${String(half)} Z` : '';
  const positions: number[] = [];
  for (let position = SKETCH_POSITION_STEP; position <= length; position += SKETCH_POSITION_STEP) positions.push(position);
  const percent = (fraction: number): string => `${String(fraction * 100)}%`;
  return (
    <div className="profile-sketch">
      <div className="sketch-plot">
        <svg viewBox={`0 0 ${String(length)} ${String(SKETCH_HEIGHT_UNITS)}`} preserveAspectRatio="none" role="img" aria-label={label}>
          <defs>
            <clipPath id={`${clip}-above`}><rect x="0" y="0" width={length} height={half} /></clipPath>
            <clipPath id={`${clip}-below`}><rect x="0" y={half} width={length} height={half} /></clipPath>
          </defs>
          {[-tick, tick].map((value) => <line key={value} className="sketch-grid" x1="0" x2={length} y1={y(value)} y2={y(value)} />)}
          <path className="sketch-above" d={area} clipPath={`url(#${clip}-above)`} />
          <path className="sketch-below" d={area} clipPath={`url(#${clip}-below)`} />
          <line className="sketch-zero" x1="0" x2={length} y1={half} y2={half} />
          <path className="sketch-line" d={line} />
        </svg>
        {[tick, 0, -tick].map((value) => (
          <span key={value} className="sketch-tick sketch-tick-y" style={{ top: percent(y(value) / SKETCH_HEIGHT_UNITS) }} aria-hidden="true">{value > 0 ? '+' : ''}{formatNumber(value)}</span>
        ))}
        {positions.map((position, index) => (
          <span key={position} className={`sketch-tick sketch-tick-x${index % 2 === 0 ? ' is-minor' : ''}`} style={{ left: percent(x(position) / length) }} aria-hidden="true">{formatNumber(position)}</span>
        ))}
      </div>
    </div>
  );
}
