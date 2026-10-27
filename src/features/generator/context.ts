import { createContext } from 'react';
import { useRequiredContext } from '../../shared/useRequiredContext';
import { searchParametersSchema } from './search';
import type { SearchProgress, SearchResult } from './search';
export const INITIAL_SEARCH_FORM = { length: '40', budget: '1000', seed: '42', gravyEnabled: true, gravyMinimum: '-0.5', gravyMaximum: '0.5', massEnabled: false, massMinimum: '3000', massMaximum: '6000' };
export type SearchForm = typeof INITIAL_SEARCH_FORM;
export function parseSearchForm(form: SearchForm): ReturnType<typeof searchParametersSchema.safeParse> {
  if ([form.length, form.budget, form.seed, form.gravyMinimum, form.gravyMaximum, form.massMinimum, form.massMaximum].some((value) => value.trim() === '')) return searchParametersSchema.safeParse(null);
  return searchParametersSchema.safeParse({ length: Number(form.length), budget: Number(form.budget), seed: Number(form.seed), gravy: { enabled: form.gravyEnabled, minimum: Number(form.gravyMinimum), maximum: Number(form.gravyMaximum) }, massDa: { enabled: form.massEnabled, minimum: Number(form.massMinimum), maximum: Number(form.massMaximum) } });
}
export interface GeneratorState {
  form: SearchForm; setForm: (changes: Partial<SearchForm>) => void;
  result: SearchResult | null; progress: SearchProgress | null;
  status: 'idle' | 'running' | 'done' | 'cancelled' | 'error' | 'invalid';
  run: () => void; cancel: () => void;
  /** Shows a saved result with its own conditions, without searching again. */
  restore: (result: SearchResult) => void;
}
export const GeneratorContext = createContext<GeneratorState | null>(null);
export function useGenerator(): GeneratorState { return useRequiredContext(GeneratorContext, 'GeneratorProvider'); }
