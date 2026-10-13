import { describe, expect, it } from 'vitest';
import { annotationsForAccession } from '../editor/annotations';
import { DEFAULT_EXAMPLE } from '../editor/examples';
import { INSULIN_BACKBONE, chainSequence, layoutBackbone, pickAnchor, turn } from './backbone';
import { DISULFIDE_MAX_DISTANCE, INITIAL_PITCH, INITIAL_YAW } from './config';

const VIEW = { yaw: INITIAL_YAW, pitch: INITIAL_PITCH, width: 600, height: 400 };

describe('insulin backbone', () => {
  it('holds the measured chains whose sequences match the annotated mature regions of P01308', () => {
    const annotations = annotationsForAccession('P01308');
    expect(annotations).not.toBeNull();
    expect(INSULIN_BACKBONE.id).toBe('1TRZ');
    for (const chain of INSULIN_BACKBONE.chains) {
      const region = annotations?.regions.find((entry) => entry.chain === chain.id);
      expect(region, `region for chain ${chain.id}`).toBeDefined();
      if (!region) continue;
      expect(chainSequence(chain)).toBe(DEFAULT_EXAMPLE.text.slice(region.start - 1, region.end));
      expect(chain.residues.map((residue) => residue.number)).toEqual(Array.from({ length: region.end - region.start + 1 }, (_, index) => index + 1));
    }
  });

  it('places sulfur atoms of every annotated disulfide within bonding distance', () => {
    const annotations = annotationsForAccession('P01308');
    const sulfur = (position: number): number[] | undefined => {
      const region = annotations?.regions.find((entry) => entry.chain && position >= entry.start && position <= entry.end);
      const chain = INSULIN_BACKBONE.chains.find((entry) => entry.id === region?.chain);
      return chain?.residues.find((residue) => residue.number === position - (region?.start ?? 0) + 1)?.sg;
    };
    expect(annotations?.disulfides).toHaveLength(3);
    for (const [first, second] of annotations?.disulfides ?? []) {
      const a = sulfur(first);
      const b = sulfur(second);
      expect(a && b, `sulfurs of ${String(first)}–${String(second)}`).toBeTruthy();
      if (!a || !b) continue;
      expect(Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))).toBeLessThan(DISULFIDE_MAX_DISTANCE);
    }
  });
});

describe('backbone layout', () => {
  it('keeps distances when turning and returns to the start after a full turn', () => {
    const center = [1, 2, 3] as const;
    const point = [4, -2, 9] as const;
    const turned = turn(point, center, 0.7, -0.4);
    const length = (value: readonly number[]): number => Math.hypot(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
    expect(length(turned)).toBeCloseTo(length([3, -4, 6]), 10);
    const full = turn(point, center, Math.PI * 2, 0);
    expect(full[0]).toBeCloseTo(3, 10);
    expect(full[1]).toBeCloseTo(-4, 10);
    expect(full[2]).toBeCloseTo(6, 10);
  });

  it('projects every residue, draws the three bridges and paints far segments first', () => {
    const scene = layoutBackbone(INSULIN_BACKBONE, VIEW);
    expect(scene.anchors).toHaveLength(51);
    expect(scene.segments.filter((segment) => segment.kind === 'sulfur')).toHaveLength(6);
    expect(scene.segments.filter((segment) => segment.kind === 'bridge')).toHaveLength(9);
    const depths = scene.segments.map((segment) => segment.depth);
    expect(depths).toEqual([...depths].sort((first, second) => first - second));
    expect(Math.min(...depths)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...depths)).toBeLessThanOrEqual(1);
    // The same input always gives the same scene, and the scale does not change while turning.
    expect(layoutBackbone(INSULIN_BACKBONE, VIEW)).toEqual(scene);
    expect(layoutBackbone(INSULIN_BACKBONE, { ...VIEW, yaw: 2 }).tubeWidth).toBe(scene.tubeWidth);
  });

  it('picks the residue under the pointer and nothing away from the molecule', () => {
    const scene = layoutBackbone(INSULIN_BACKBONE, VIEW);
    const target = scene.anchors.find((anchor) => anchor.chain === 'A' && anchor.residue.number === 7);
    expect(target).toBeDefined();
    if (!target) return;
    const picked = pickAnchor(scene, target.x, target.y, 4);
    expect(picked?.x).toBeCloseTo(target.x, 6);
    expect(picked?.y).toBeCloseTo(target.y, 6);
    expect(pickAnchor(scene, -500, -500, 10)).toBeNull();
  });
});
