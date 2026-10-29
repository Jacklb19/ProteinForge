// Distribution-free statistics for repeated load timings. Pure functions, no I/O.
// Order-statistic intervals make no normality assumption: load times here are skewed by host contention.

const sorted = values => [...values].sort((a, b) => a - b);

export function median(values) {
  if (!values.length) return null;
  const list = sorted(values);
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

/** Nearest-rank quantile, the convention of `audit-performance.mjs` for its p75. */
export function quantile(values, q) {
  if (!values.length) return null;
  const list = sorted(values);
  return list[Math.min(list.length, Math.max(1, Math.ceil(list.length * q))) - 1];
}

/** Median absolute deviation scaled to estimate a standard deviation; robust to the odd stalled load. */
export function robustSpread(values) {
  if (values.length < 2) return null;
  const center = median(values);
  return 1.4826 * median(values.map(value => Math.abs(value - center)));
}

function binomialCdf(n, q) {
  const cdf = [];
  let probability = (1 - q) ** n;
  let total = 0;
  for (let k = 0; k <= n; k++) {
    total += probability;
    cdf.push(Math.min(1, total));
    probability *= ((n - k) / (k + 1)) * (q / (1 - q));
  }
  return cdf;
}

/**
 * Confidence interval for the q-quantile from order statistics: the number of samples below the true
 * quantile is Binomial(n, q). A bound that the sample cannot support is null (too few loads).
 */
export function quantileInterval(values, q, confidence = 0.95) {
  const list = sorted(values);
  const n = list.length;
  const alpha = (1 - confidence) / 2;
  const cdf = binomialCdf(n, q);
  const below = k => (k <= 0 ? 0 : cdf[k - 1]);
  let lower = 0;
  for (let k = 1; k <= n; k++) if (below(k) <= alpha) lower = k;
  let upper = n + 1;
  for (let k = n; k >= 1; k--) if (below(k) >= 1 - alpha) upper = k;
  const coverage = (upper <= n ? below(upper) : 1) - (lower >= 1 ? below(lower) : 0);
  return { low: lower >= 1 ? list[lower - 1] : null, high: upper <= n ? list[upper - 1] : null, coverage };
}

export function describe(values) {
  return {
    n: values.length,
    median: median(values),
    p75: quantile(values, 0.75),
    iqr: values.length ? quantile(values, 0.75) - quantile(values, 0.25) : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    spread: robustSpread(values),
    medianInterval: quantileInterval(values, 0.5),
    p75Interval: quantileInterval(values, 0.75),
  };
}

const Z95 = 1.959964;
// Asymptotic efficiency of the median against the mean under normal noise is 2/π; its SE is √(π/2) σ/√n.
const MEDIAN_SE_FACTOR = Math.sqrt(Math.PI / 2);
// SE of the 0.75 quantile under normal noise: √(q(1−q)) / φ(z₀.₇₅) · σ/√n.
const P75_SE_FACTOR = Math.sqrt(0.75 * 0.25) / (Math.exp(-(0.6744898 ** 2) / 2) / Math.sqrt(2 * Math.PI));

/** Pairs needed so the 95 % interval of the median paired difference is narrower than ±effect. */
export function pairsToResolve(spread, effect) {
  if (!(spread > 0) || !(effect > 0)) return null;
  return Math.ceil(((Z95 * MEDIAN_SE_FACTOR * spread) / effect) ** 2);
}

/** Loads needed so the 95 % interval of the p75 stays on one side of a target `margin` ms away. */
export function loadsToSeparate(spread, margin) {
  if (!(spread > 0) || !(Math.abs(margin) > 0)) return null;
  return Math.ceil(((Z95 * P75_SE_FACTOR * spread) / Math.abs(margin)) ** 2);
}

/** Against a threshold the measure must stay below: met, not met, or not distinguishable from it. */
export function verdict(interval, threshold) {
  if (interval.high !== null && interval.high < threshold) return 'met';
  if (interval.low !== null && interval.low >= threshold) return 'not-met';
  return 'inconclusive';
}

/** Paired comparison of B against A; negative differences mean B is faster. */
export function comparePairs(pairs, effects) {
  const differences = pairs.map(([a, b]) => b - a);
  const spread = robustSpread(differences);
  return {
    pairs: differences.length,
    medianDifference: median(differences),
    interval: quantileInterval(differences, 0.5),
    faster: differences.filter(value => value < 0).length,
    slower: differences.filter(value => value > 0).length,
    spread,
    pairsToResolve: Object.fromEntries(effects.map(effect => [effect, pairsToResolve(spread, effect)])),
  };
}
