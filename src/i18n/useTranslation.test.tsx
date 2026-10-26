import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from './LocaleProvider';
import type { Locale } from './config';
import { languageTags } from './config';
import { useTranslation } from './useTranslation';

afterEach(() => { vi.restoreAllMocks(); });

it('reuses number formatters across values and renders without changing native output', () => {
  const NativeFormatter = Intl.NumberFormat;
  const constructor = vi.spyOn(Intl, 'NumberFormat');
  const { result, rerender } = renderHook(() => useTranslation());
  const options = { maximumFractionDigits: 2 };
  for (const value of [0, -0, 1234.567, -34.56, Infinity, NaN]) {
    expect(result.current.formatNumber(value)).toBe(new NativeFormatter('es-CO').format(value));
    expect(result.current.formatNumber(value, { ...options })).toBe(new NativeFormatter('es-CO', options).format(value));
  }
  rerender();
  result.current.formatNumber(8);
  expect(constructor).toHaveBeenCalledTimes(2);
});

it('keeps locale, unit and changed options separate', () => {
  let locale: Locale = 'es';
  const { result, rerender } = renderHook(() => useTranslation(), {
    wrapper: ({ children }) => <LocaleProvider locale={locale}>{children}</LocaleProvider>,
  });
  const options = { minimumFractionDigits: 1 };
  for (const next of ['es', 'en'] as const) {
    locale = next; rerender();
    expect(result.current.formatNumber(1234.5, options)).toBe(new Intl.NumberFormat(languageTags[next], options).format(1234.5));
    expect(result.current.formatUnit(4, 'second')).toBe(new Intl.NumberFormat(languageTags[next], { style: 'unit', unit: 'second' }).format(4));
  }
  options.minimumFractionDigits = 3;
  expect(result.current.formatNumber(1234.5, options)).toBe(new Intl.NumberFormat('en-US', options).format(1234.5));
});
