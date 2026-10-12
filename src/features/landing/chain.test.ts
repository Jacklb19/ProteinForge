import { describe, expect, it } from 'vitest';
import { buildChainLayout } from './chain';
import { calculateProfile } from '../descriptors/profile';
import { HYDROPATHY } from '../descriptors/descriptors';
import { HERO_BOX, HERO_EXAMPLE, HERO_WINDOW } from './config';
import { exampleEntry } from '../editor/examples';

describe('hero chain layout', () => {
  it('places one bead per plotted position on its real windowed value', () => {
    const sequence = HERO_EXAMPLE ? exampleEntry(HERO_EXAMPLE.fasta)?.sequence ?? '' : '';
    const points = calculateProfile(sequence, HERO_WINDOW).filter((point) => point.value !== null);
    const layout = buildChainLayout(sequence, HERO_WINDOW, HERO_BOX);
    expect(layout.beads).toHaveLength(points.length);
    expect(layout.beads[0]?.position).toBe(points[0]?.position);
    for (const bead of layout.beads) {
      expect(bead.x).toBeGreaterThanOrEqual(HERO_BOX.paddingX);
      expect(bead.x).toBeLessThanOrEqual(HERO_BOX.width - HERO_BOX.paddingX);
      expect(bead.y).toBeGreaterThanOrEqual(HERO_BOX.paddingY);
      expect(bead.y).toBeLessThanOrEqual(HERO_BOX.height - HERO_BOX.paddingY);
      expect(bead.hydrophobic).toBe((HYDROPATHY[bead.residue] ?? 0) > 0);
    }
    expect(layout.path.startsWith('M')).toBe(true);
    expect(layout.path.split(' L')).toHaveLength(points.length);
  });

  it('keeps higher hydropathy higher on the drawing and the zero line inside the box', () => {
    const layout = buildChainLayout('IIIIIIIIIDDDDDDDDD', 9, HERO_BOX);
    const first = layout.beads[0];
    const last = layout.beads.at(-1);
    if (!first || !last) throw new Error('Expected beads.');
    expect(first.y).toBeLessThan(last.y);
    expect(layout.zeroY).toBeGreaterThan(first.y);
    expect(layout.zeroY).toBeLessThan(last.y);
  });

  it('returns an empty layout for sequences shorter than the window', () => {
    expect(buildChainLayout('ACD', 9, HERO_BOX)).toEqual({ path: '', beads: [], zeroY: HERO_BOX.height / 2, minValue: 0, maxValue: 0 });
  });
});
