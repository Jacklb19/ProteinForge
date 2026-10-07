/** Horizontal layout shared by the worker drawing and the main-thread selection overlay. */
export interface ProfileAxis {
  first: number;
  last: number;
  width: number;
  margin: number;
}

/** Maps a one-based residue position to a horizontal coordinate in CSS pixels. */
export function profileX(position: number, axis: ProfileAxis): number {
  const { first, last, width, margin } = axis;
  if (last === first) return width / 2;
  const plotWidth = Math.max(1, width - 2 * margin);
  return margin + ((position - first) / (last - first)) * plotWidth;
}

/** Inverse of `profileX`, rounded and clamped to the plotted positions. */
export function positionAtX(x: number, axis: ProfileAxis): number {
  const { first, last, width, margin } = axis;
  if (last === first) return first;
  const plotWidth = Math.max(1, width - 2 * margin);
  const position = first + ((x - margin) / plotWidth) * (last - first);
  return Math.min(last, Math.max(first, Math.round(position)));
}

/** Residue range averaged into the value plotted at `position`, clipped to the sequence. */
export function windowRange(position: number, windowSize: number, length: number): { start: number; end: number } {
  const half = Math.floor(windowSize / 2);
  return { start: Math.max(1, position - half), end: Math.min(length, position + half) };
}
