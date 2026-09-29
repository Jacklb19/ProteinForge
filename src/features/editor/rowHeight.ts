export interface RowHeight {
  pixels: number;
  emergencyFallback: boolean;
}

function parsePixels(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?px$/.test(text)) return null;
  const pixels = Number.parseFloat(text);
  return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
}

/** Uses a valid CSS value, its fallback token, or a safe minimum height. */
export function resolveRowHeight(cssValue: string, fallbackCss: string): RowHeight {
  const primary = parsePixels(cssValue);
  if (primary !== null) return { pixels: primary, emergencyFallback: false };
  const fallback = parsePixels(fallbackCss);
  if (fallback !== null) return { pixels: fallback, emergencyFallback: false };
  return { pixels: 1, emergencyFallback: true };
}
