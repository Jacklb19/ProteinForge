import { describe, expect, it } from 'vitest';
import { resolveRowHeight } from './rowHeight';

describe('resolveRowHeight', () => {
  it.each(['0px', 'NaN', ''])('uses the fallback token when CSS height is %s', (value) => {
    expect(resolveRowHeight(value, '44px')).toEqual({
      pixels: 44,
      emergencyFallback: false,
    });
  });

  it('keeps a positive height when the fallback token is also missing', () => {
    expect(resolveRowHeight('', '')).toEqual({
      pixels: 1,
      emergencyFallback: true,
    });
  });
});
