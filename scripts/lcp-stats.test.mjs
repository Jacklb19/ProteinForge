import { describe as group, expect, it } from 'vitest';
import { comparePairs, describe, loadsToSeparate, median, pairsToResolve, quantile, quantileInterval, robustSpread, verdict } from './lcp-stats.mjs';

const ranks = n => Array.from({ length: n }, (_, index) => index + 1);

group('load timing statistics', () => {
  it('uses the audit conventions for the median and the nearest-rank p75', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(quantile(ranks(7), 0.75)).toBe(6);
    expect(quantile(ranks(20), 0.75)).toBe(15);
    expect(median([])).toBeNull();
  });

  it('gives the textbook order-statistic interval of the median', () => {
    // Binomial(20, ½): ranks 6 and 15 cover 95.86 %.
    const interval = quantileInterval(ranks(20), 0.5);
    expect(interval.low).toBe(6);
    expect(interval.high).toBe(15);
    expect(interval.coverage).toBeCloseTo(0.9586, 4);
  });

  it('refuses a bound that too few loads cannot support', () => {
    // With five loads the two-sided 95 % interval of the median is unbounded on both sides.
    expect(quantileInterval(ranks(5), 0.5)).toMatchObject({ low: null, high: null });
    // With seven loads the p75 has no upper bound: one cannot claim it stays below a target.
    expect(quantileInterval(ranks(7), 0.75).high).toBeNull();
  });

  it('keeps the coverage of every interval at or above the requested level', () => {
    for (const n of [8, 13, 20, 31, 60]) for (const q of [0.5, 0.75]) {
      const interval = quantileInterval(ranks(n), q);
      expect(interval.coverage).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('estimates spread robustly against a stalled load', () => {
    const steady = [100, 102, 98, 101, 99, 100, 103, 97];
    expect(robustSpread(steady)).toBeCloseTo(robustSpread([...steady.slice(0, -1), 5000]) ?? 0, -1);
    expect(robustSpread([1])).toBeNull();
  });

  it('decides a threshold only when the whole interval is on one side', () => {
    expect(verdict({ low: 2300, high: 2450 }, 2500)).toBe('met');
    expect(verdict({ low: 2500, high: 2600 }, 2500)).toBe('not-met');
    expect(verdict({ low: 2400, high: 2520 }, 2500)).toBe('inconclusive');
    expect(verdict({ low: 2300, high: null }, 2500)).toBe('inconclusive');
  });

  it('sizes a study from the observed noise', () => {
    // Halving the effect to resolve needs four times the pairs.
    const coarse = pairsToResolve(40, 20) ?? 0;
    expect(pairsToResolve(40, 10)).toBeGreaterThanOrEqual(4 * coarse - 4);
    expect(pairsToResolve(0, 10)).toBeNull();
    expect(loadsToSeparate(30, 15)).toBeGreaterThan(loadsToSeparate(30, 60) ?? Infinity);
  });

  it('reports paired differences as B minus A', () => {
    const result = comparePairs([[100, 90], [100, 95], [100, 105], [100, 80]], [10]);
    expect(result.medianDifference).toBe(-7.5);
    expect(result.faster).toBe(3);
    expect(result.slower).toBe(1);
    expect(describe([1, 2, 3, 4]).iqr).toBe(2);
  });
});
