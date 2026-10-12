interface LineWindow {
  length: number;
  perLine: number;
  lineHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
}

/** Indices of the reader lines to render; only the first line before layout is measured. */
export function readerLines({ length, perLine, lineHeight, scrollTop, viewportHeight, overscan }: LineWindow): number[] {
  const count = Math.ceil(length / Math.max(1, perLine));
  if (count === 0) return [];
  if (lineHeight <= 0 || viewportHeight <= 0) return [0];
  // A stale scroll offset (for example after the sequence shrinks) still shows the last lines.
  const first = Math.min(Math.max(0, Math.floor(scrollTop / lineHeight) - overscan), count - 1);
  const last = Math.min(count, Math.ceil((scrollTop + viewportHeight) / lineHeight) + overscan);
  return Array.from({ length: Math.max(0, last - first) }, (_, offset) => first + offset);
}

/** Position reached with a navigation key, or null when the key does not move the selection. */
export function nextReaderPosition(key: string, selected: number | null, perLine: number, length: number): number | null {
  if (length === 0) return null;
  const clamp = (position: number) => Math.min(length, Math.max(1, position));
  switch (key) {
    case 'ArrowRight': return clamp(selected === null ? 1 : selected + 1);
    case 'ArrowLeft': return clamp(selected === null ? 1 : selected - 1);
    case 'ArrowDown': return clamp(selected === null ? 1 : selected + perLine);
    case 'ArrowUp': return clamp(selected === null ? 1 : selected - perLine);
    case 'Home': return 1;
    case 'End': return length;
    default: return null;
  }
}
