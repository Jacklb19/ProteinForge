import { HYDROPATHY } from '../descriptors/descriptors';
import { calculateProfile } from '../descriptors/profile';
import type { HydropathyWindow } from '../descriptors/config';

export interface ChainBox { width: number; height: number; paddingX: number; paddingY: number }

export interface ChainBead {
  position: number;
  residue: string;
  x: number;
  y: number;
  hydrophobic: boolean;
}

export interface ChainLayout {
  /** SVG path of the windowed profile through every plotted position. */
  path: string;
  beads: ChainBead[];
  zeroY: number;
  minValue: number;
  maxValue: number;
}

/**
 * Lays out a real hydropathy profile as a chain of residue beads sitting on their windowed value.
 * Residues without a complete window are not drawn, as in the analysis chart.
 */
export function buildChainLayout(sequence: string, windowSize: HydropathyWindow, box: ChainBox): ChainLayout {
  const points = calculateProfile(sequence, windowSize).filter((point): point is { position: number; value: number } => point.value !== null);
  if (points.length === 0) return { path: '', beads: [], zeroY: box.height / 2, minValue: 0, maxValue: 0 };
  const values = points.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const span = Math.max(maxValue - minValue, 1);
  const plotWidth = Math.max(1, box.width - 2 * box.paddingX);
  const plotHeight = Math.max(1, box.height - 2 * box.paddingY);
  const first = points[0]?.position ?? 0;
  const last = points.at(-1)?.position ?? first;
  const x = (position: number) => last === first ? box.width / 2 : box.paddingX + ((position - first) / (last - first)) * plotWidth;
  const y = (value: number) => box.paddingY + ((maxValue - value) / span) * plotHeight;
  const beads = points.map((point) => ({
    position: point.position,
    residue: sequence[point.position - 1] ?? '',
    x: round(x(point.position)),
    y: round(y(point.value)),
    hydrophobic: (HYDROPATHY[sequence[point.position - 1] ?? ''] ?? 0) > 0,
  }));
  const path = beads.map((bead, index) => `${index === 0 ? 'M' : 'L'}${String(bead.x)} ${String(bead.y)}`).join(' ');
  return { path, beads, zeroY: round(y(0)), minValue, maxValue };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
