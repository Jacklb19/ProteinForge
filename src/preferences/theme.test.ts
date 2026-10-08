import { describe, expect, it } from 'vitest';
import { resolveTheme, toggledTheme } from './theme';

describe('theme resolution', () => {
  it('follows the device only for the system choice', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('toggles to the explicit opposite of what is shown', () => {
    expect(toggledTheme('system', true)).toBe('light');
    expect(toggledTheme('system', false)).toBe('dark');
    expect(toggledTheme('dark', false)).toBe('light');
  });
});
