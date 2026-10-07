import { describe, expect, it } from 'vitest';
import { nextReaderPosition, readerLines } from './readerLayout';

describe('residue reader layout', () => {
  it('renders only lines near the viewport once measured', () => {
    const window = { length: 5000, perLine: 60, lineHeight: 44, viewportHeight: 256, overscan: 3 };
    expect(readerLines({ ...window, scrollTop: 0 })).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const middle = readerLines({ ...window, scrollTop: 44 * 40 });
    expect(middle[0]).toBe(37);
    expect(middle.length).toBeLessThan(15);
    expect(readerLines({ ...window, scrollTop: 44 * 200 }).at(-1)).toBe(Math.ceil(5000 / 60) - 1);
  });

  it('renders a single line before layout is known and nothing for empty sequences', () => {
    expect(readerLines({ length: 110, perLine: 10, lineHeight: 0, scrollTop: 0, viewportHeight: 0, overscan: 3 })).toEqual([0]);
    expect(readerLines({ length: 0, perLine: 10, lineHeight: 44, scrollTop: 0, viewportHeight: 200, overscan: 3 })).toEqual([]);
  });

  it('moves the selection with arrow keys, Home and End within the sequence', () => {
    expect(nextReaderPosition('ArrowRight', null, 60, 110)).toBe(1);
    expect(nextReaderPosition('ArrowRight', 110, 60, 110)).toBe(110);
    expect(nextReaderPosition('ArrowLeft', 1, 60, 110)).toBe(1);
    expect(nextReaderPosition('ArrowDown', 42, 60, 110)).toBe(102);
    expect(nextReaderPosition('ArrowDown', 80, 60, 110)).toBe(110);
    expect(nextReaderPosition('ArrowUp', 42, 60, 110)).toBe(1);
    expect(nextReaderPosition('Home', 42, 60, 110)).toBe(1);
    expect(nextReaderPosition('End', 42, 60, 110)).toBe(110);
    expect(nextReaderPosition('Enter', 42, 60, 110)).toBeNull();
    expect(nextReaderPosition('ArrowRight', null, 60, 0)).toBeNull();
  });
});
