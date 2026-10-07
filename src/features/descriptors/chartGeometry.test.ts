import { describe, expect, it } from 'vitest';
import { positionAtX, profileX, windowRange } from './chartGeometry';

const axis = { first: 5, last: 106, width: 400, margin: 36 };

describe('profile chart geometry', () => {
  it('maps the plotted range to the inner chart width', () => {
    expect(profileX(axis.first, axis)).toBe(axis.margin);
    expect(profileX(axis.last, axis)).toBe(axis.width - axis.margin);
    expect(profileX(1, { ...axis, first: 1, last: 1 })).toBe(axis.width / 2);
  });

  it('inverts the mapping and clamps to plotted positions', () => {
    for (const position of [5, 42, 106]) expect(positionAtX(profileX(position, axis), axis)).toBe(position);
    expect(positionAtX(-50, axis)).toBe(axis.first);
    expect(positionAtX(axis.width + 50, axis)).toBe(axis.last);
  });

  it('returns the residues averaged into a window and clips at the ends', () => {
    expect(windowRange(42, 9, 110)).toEqual({ start: 38, end: 46 });
    expect(windowRange(42, 19, 110)).toEqual({ start: 33, end: 51 });
    expect(windowRange(2, 9, 110)).toEqual({ start: 1, end: 6 });
    expect(windowRange(109, 9, 110)).toEqual({ start: 105, end: 110 });
  });
});
