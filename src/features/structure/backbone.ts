import data from './fixtures/1trz-backbone.json';
import { DISULFIDE_MAX_DISTANCE, SPLINE_STEPS, STAGE_FIT, STAGE_PADDING, TUBE_MIN_WIDTH, TUBE_WIDTH_RATIO } from './config';

export type Point = readonly [number, number, number];

export interface BackboneResidue { number: number; name: string; ca: number[]; sg?: number[] }
export interface BackboneChain { id: string; residues: BackboneResidue[] }
export interface BackboneModel { id: string; source: string; method: string; resolution: number; chains: BackboneChain[] }

/** Experimental Cα trace of mature human insulin; see `scripts/build-backbone.mjs` for its provenance. */
export const INSULIN_BACKBONE: BackboneModel = data;

const ONE_LETTER: Readonly<Record<string, string>> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
};

/** One-letter sequence observed in a chain of the model. */
export function chainSequence(chain: BackboneChain): string {
  return chain.residues.map((residue) => ONE_LETTER[residue.name] ?? 'X').join('');
}

export function oneLetter(name: string): string {
  return ONE_LETTER[name] ?? 'X';
}

export type SegmentKind = 'tube' | 'bridge' | 'sulfur';

/** A short stroke of the drawing in screen pixels; `depth` runs from 0 (far) to 1 (near). */
export interface SceneSegment {
  kind: SegmentKind;
  before: readonly [number, number];
  from: readonly [number, number];
  to: readonly [number, number];
  depth: number;
  chain: string;
  residue: BackboneResidue;
}

export interface SceneAnchor { chain: string; residue: BackboneResidue; x: number; y: number; depth: number }

export interface BackboneScene {
  /** Sorted from far to near, ready to paint. */
  segments: SceneSegment[];
  /** Screen position of every Cα, used for labels and picking. */
  anchors: SceneAnchor[];
  tubeWidth: number;
}

interface View { yaw: number; pitch: number; width: number; height: number }

function toPoint(values: number[]): Point {
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

/** Centroid and bounding radius of the Cα atoms; the radius keeps the scale steady while turning. */
function frame(model: BackboneModel): { center: Point; radius: number } {
  const atoms = model.chains.flatMap((chain) => chain.residues.map((residue) => toPoint(residue.ca)));
  const sum = atoms.reduce<[number, number, number]>((total, atom) => [total[0] + atom[0], total[1] + atom[1], total[2] + atom[2]], [0, 0, 0]);
  const count = Math.max(1, atoms.length);
  const center: Point = [sum[0] / count, sum[1] / count, sum[2] / count];
  const radius = Math.max(1, ...atoms.map((atom) => Math.hypot(atom[0] - center[0], atom[1] - center[1], atom[2] - center[2])));
  return { center, radius };
}

/** Rotates around the vertical axis (yaw) and then the horizontal one (pitch). */
export function turn(point: Point, center: Point, yaw: number, pitch: number): Point {
  const x = point[0] - center[0];
  const y = point[1] - center[1];
  const z = point[2] - center[2];
  const turnedX = x * Math.cos(yaw) + z * Math.sin(yaw);
  const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return [turnedX, y * Math.cos(pitch) - depth * Math.sin(pitch), y * Math.sin(pitch) + depth * Math.cos(pitch)];
}

/** Centripetal-free Catmull–Rom point between `second` and `third`. */
function spline(first: Point, second: Point, third: Point, fourth: Point, t: number): Point {
  const square = t * t;
  const cube = square * t;
  const axis = (index: 0 | 1 | 2): number => 0.5 * (
    2 * second[index]
    + (-first[index] + third[index]) * t
    + (2 * first[index] - 5 * second[index] + 4 * third[index] - fourth[index]) * square
    + (-first[index] + 3 * second[index] - 3 * third[index] + fourth[index]) * cube
  );
  return [axis(0), axis(1), axis(2)];
}

/** Projects the model for one orientation and canvas size. Pure: the same input gives the same scene. */
export function layoutBackbone(model: BackboneModel, view: View): BackboneScene {
  const { center, radius } = frame(model);
  // The farthest atoms are chain ends, so the sphere may exceed the stage a little without clipping the fold.
  const scale = (Math.max(1, Math.min(view.width, view.height) / 2 - STAGE_PADDING) / radius) * STAGE_FIT;
  const screen = (point: Point): readonly [number, number] => [view.width / 2 + point[0] * scale, view.height / 2 + point[1] * scale];
  const depthOf = (point: Point): number => (point[2] + radius) / (2 * radius);
  const turned = (values: number[]): Point => turn(toPoint(values), center, view.yaw, view.pitch);

  const segments: SceneSegment[] = [];
  const anchors: SceneAnchor[] = [];
  for (const chain of model.chains) {
    const points = chain.residues.map((residue) => turned(residue.ca));
    chain.residues.forEach((residue, index) => {
      const point = points[index];
      if (!point) return;
      const [x, y] = screen(point);
      anchors.push({ chain: chain.id, residue, x, y, depth: depthOf(point) });
    });
    for (let index = 0; index < points.length - 1; index += 1) {
      const second = points[index];
      const third = points[index + 1];
      if (!second || !third) continue;
      const first = points[index - 1] ?? second;
      const fourth = points[index + 2] ?? third;
      let before = second;
      let previous = second;
      for (let step = 1; step <= SPLINE_STEPS; step += 1) {
        const t = step / SPLINE_STEPS;
        const current = spline(first, second, third, fourth, t);
        const residue = chain.residues[t < 0.5 ? index : index + 1];
        if (residue) {
          segments.push({
            kind: 'tube', before: screen(before), from: screen(previous), to: screen(current),
            depth: depthOf([0, 0, (previous[2] + current[2]) / 2]), chain: chain.id, residue,
          });
        }
        before = previous;
        previous = current;
      }
    }
  }

  const sulfurs = model.chains.flatMap((chain) => chain.residues
    .filter((residue) => residue.sg)
    .map((residue) => ({ chain: chain.id, residue, raw: toPoint(residue.sg ?? []), ca: turned(residue.ca), sg: turned(residue.sg ?? []) })));
  for (let first = 0; first < sulfurs.length; first += 1) {
    for (let second = first + 1; second < sulfurs.length; second += 1) {
      const a = sulfurs[first];
      const b = sulfurs[second];
      if (!a || !b) continue;
      if (Math.hypot(a.raw[0] - b.raw[0], a.raw[1] - b.raw[1], a.raw[2] - b.raw[2]) > DISULFIDE_MAX_DISTANCE) continue;
      const strokes: readonly (readonly [Point, Point, typeof a])[] = [[a.ca, a.sg, a], [a.sg, b.sg, a], [b.sg, b.ca, b]];
      for (const [from, to, owner] of strokes) {
        segments.push({ kind: 'bridge', before: screen(from), from: screen(from), to: screen(to), depth: depthOf([0, 0, (from[2] + to[2]) / 2]), chain: owner.chain, residue: owner.residue });
      }
      for (const end of [a, b]) {
        segments.push({ kind: 'sulfur', before: screen(end.sg), from: screen(end.sg), to: screen(end.sg), depth: depthOf(end.sg), chain: end.chain, residue: end.residue });
      }
    }
  }
  segments.sort((first, second) => first.depth - second.depth);
  return { segments, anchors, tubeWidth: Math.max(TUBE_MIN_WIDTH, Math.min(view.width, view.height) * TUBE_WIDTH_RATIO) };
}

/** Nearest Cα within `radius` pixels of a pointer position, preferring atoms closer to the viewer. */
export function pickAnchor(scene: BackboneScene, x: number, y: number, radius: number): SceneAnchor | null {
  let best: SceneAnchor | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const anchor of scene.anchors) {
    const distance = Math.hypot(anchor.x - x, anchor.y - y);
    if (distance > radius) continue;
    const score = distance - anchor.depth * radius;
    if (score < bestScore) { best = anchor; bestScore = score; }
  }
  return best;
}
