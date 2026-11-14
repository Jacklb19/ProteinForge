import { describe, expect, it } from 'vitest';
import { PALETTE_KEY, paletteShortcut } from './paletteEntries';

describe('the shortcut beside "Go to…"', () => {
  it('shows Command on Apple systems and Control elsewhere, with the same key the frame listens for', () => {
    const key = PALETTE_KEY.toUpperCase();
    for (const platform of ['MacIntel', 'iPhone', 'iPad']) expect(paletteShortcut(platform)).toEqual({ label: `⌘ ${key}`, aria: `Meta+${key}` });
    for (const platform of ['Win32', 'Linux x86_64', '']) expect(paletteShortcut(platform)).toEqual({ label: `Ctrl ${key}`, aria: `Control+${key}` });
  });
});
