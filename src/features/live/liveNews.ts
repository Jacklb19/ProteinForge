import type { LiveChange } from './liveChannel';

const NANOS_DIGITS = 9;
const FRACTION = /\.(\d+)/;

/** The same moment written by PostgreSQL (+00:00, microseconds) and by the API (Z) compares equal. */
function instant(value: string): string | null {
  const milliseconds = Date.parse(value.replace(FRACTION, ''));
  if (!Number.isFinite(milliseconds)) return null;
  return `${String(milliseconds)}.${(FRACTION.exec(value)?.[1] ?? '').slice(0, NANOS_DIGITS).padEnd(NANOS_DIGITS, '0')}`;
}

export function sameInstant(first: string, second: string): boolean {
  const moment = instant(first);
  return moment !== null && moment === instant(second);
}

/**
 * Whether a notice says something this tab does not already show. A tab hears about its own saves too;
 * those match the versions it holds and need no second request.
 */
export function isNews(change: LiveChange, known: readonly { id: string; updatedAt: string }[]): boolean {
  if (change.changed === null) return true;
  if (change.removed.some(id => known.some(item => item.id === id))) return true;
  return change.changed.some(({ id, updatedAt }) => {
    const moment = instant(updatedAt);
    return moment === null || !known.some(item => item.id === id && instant(item.updatedAt) === moment);
  });
}
