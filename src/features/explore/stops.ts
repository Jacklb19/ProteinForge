import { STOP_GROUPS, STOP_GROUP_OF, STOP_KINDS } from './config';
import type { StopGroup, StopKind } from './config';

/** One place of the protein worth visiting: a positional annotation of its reference entry. */
export interface Stop {
  readonly id: string;
  readonly kind: StopKind;
  readonly description: string;
  readonly begin: number;
  readonly end: number;
  /** Two bonded residues rather than the span between them. */
  readonly paired: boolean;
}

interface FeatureLike { kind: string; description: string; begin: number; end: number; paired: boolean }

const KNOWN = new Set<string>(STOP_KINDS);

/** Annotations the page can explain, inside the sequence; a kind from a newer service is left out, not guessed. */
export function stopsFrom(features: readonly FeatureLike[], sequenceLength: number): Stop[] {
  return features
    .filter(feature => KNOWN.has(feature.kind) && feature.begin >= 1 && feature.begin <= feature.end && feature.end <= sequenceLength)
    .map((feature, index) => ({
      id: `${feature.kind}-${String(feature.begin)}-${String(feature.end)}-${String(index)}`,
      kind: feature.kind as StopKind, description: feature.description, begin: feature.begin, end: feature.end, paired: feature.paired,
    }));
}

/** Stops by group, in tour order; a group without stops is absent. */
export function groupStops(stops: readonly Stop[]): { group: StopGroup; stops: Stop[] }[] {
  return STOP_GROUPS
    .map(group => ({ group, stops: stops.filter(stop => STOP_GROUP_OF[stop.kind] === group) }))
    .filter(item => item.stops.length > 0);
}

/** Sequence positions a stop marks: its two ends when paired, otherwise every residue of its span. */
export function stopPositions(stop: Pick<Stop, 'begin' | 'end' | 'paired'>): number[] {
  if (stop.paired) return [stop.begin, stop.end];
  return Array.from({ length: stop.end - stop.begin + 1 }, (_, index) => stop.begin + index);
}

/** How many residues a stop marks. */
export function stopSize(stop: Pick<Stop, 'begin' | 'end' | 'paired'>): number {
  return stop.paired ? 2 : stop.end - stop.begin + 1;
}

/** Stops that mark one position, in tour order. */
export function stopsAt(stops: readonly Stop[], position: number): Stop[] {
  return stops.filter(stop => stop.paired ? stop.begin === position || stop.end === position : stop.begin <= position && position <= stop.end);
}
