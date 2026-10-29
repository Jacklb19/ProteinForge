import { searchParametersSchema } from './search';
import type { SearchForm } from './context';

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
