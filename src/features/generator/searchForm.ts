import { searchParametersSchema } from './search';
import type { SearchForm } from './context';
import type { TranslationKey } from '../../i18n/translate';

/**
 * Validation of the search form, apart from `context.ts` so that holding the form's state does not
 * pull zod into the initial download: `GeneratorProvider` and the public page both read the initial
 * form, and neither needs to validate anything to paint. The provider loads this with the first
 * search; the generator screen, which is its own file already, reads it directly.
 */
export function parseSearchForm(form: SearchForm): ReturnType<typeof searchParametersSchema.safeParse> {
  if ([form.length, form.budget, form.seed, form.gravyMinimum, form.gravyMaximum, form.massMinimum, form.massMaximum].some((value) => value.trim() === '')) return searchParametersSchema.safeParse(null);
  return searchParametersSchema.safeParse({ length: Number(form.length), budget: Number(form.budget), seed: Number(form.seed), gravy: { enabled: form.gravyEnabled, minimum: Number(form.gravyMinimum), maximum: Number(form.gravyMaximum) }, massDa: { enabled: form.massEnabled, minimum: Number(form.massMinimum), maximum: Number(form.massMaximum) } });
}

/** A rule the form breaks that the browser's own number checks cannot see, with the fields it involves. */
export interface SearchFormProblem { messageKey: TranslationKey; rangeKey?: TranslationKey; fields: readonly (keyof SearchForm)[] }

/** Cross-field problems, so the screen can name them instead of a general message: no range on, or a minimum above its maximum. */
export function searchFormProblems(form: SearchForm): SearchFormProblem[] {
  const problems: SearchFormProblem[] = [];
  if (!form.gravyEnabled && !form.massEnabled) problems.push({ messageKey: 'generator.invalidNoRange', fields: ['gravyEnabled', 'massEnabled'] });
  const ranges = [
    { enabled: form.gravyEnabled, minimum: 'gravyMinimum', maximum: 'gravyMaximum', rangeKey: 'generator.gravy' },
    { enabled: form.massEnabled, minimum: 'massMinimum', maximum: 'massMaximum', rangeKey: 'generator.mass' },
  ] as const;
  for (const range of ranges) {
    if (range.enabled && Number(form[range.minimum]) > Number(form[range.maximum])) problems.push({ messageKey: 'generator.invalidOrder', rangeKey: range.rangeKey, fields: [range.minimum, range.maximum] });
  }
  return problems;
}
