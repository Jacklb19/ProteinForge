import { searchParametersSchema } from './search';
import { GENERATOR_FIELD_BOUNDS } from './config';
import type { GeneratorNumberField } from './config';
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

/** A rule the form breaks, with the fields it involves and, for a number out of bounds, the accepted bounds. */
export interface SearchFormProblem {
  messageKey: TranslationKey;
  rangeKey?: TranslationKey;
  fields: readonly (keyof SearchForm)[];
  bounds?: { minimum: number; maximum: number };
}

/** True when the text is a number inside the field's bounds, whole where the field counts whole units. */
function withinBounds(field: GeneratorNumberField, text: string): boolean {
  const { minimum, maximum, step } = GENERATOR_FIELD_BOUNDS[field];
  if (text.trim() === '') return false;
  const value = Number(text);
  return Number.isFinite(value) && value >= minimum && value <= maximum && (step !== 1 || Number.isInteger(value));
}

/**
 * Every problem of the form, so the screen can name each one next to its field instead of a general
 * message: a number out of its bounds, no range on, or a minimum above its maximum. The form does not
 * rely on the browser's own number checks, which only show a bubble that disappears.
 */
export function searchFormProblems(form: SearchForm): SearchFormProblem[] {
  const problems: SearchFormProblem[] = [];
  for (const field of Object.keys(GENERATOR_FIELD_BOUNDS) as GeneratorNumberField[]) {
    if (withinBounds(field, form[field])) continue;
    const { minimum, maximum, step } = GENERATOR_FIELD_BOUNDS[field];
    const messageKey: TranslationKey = field === 'length' ? 'generator.lengthRange' : step === 1 ? 'generator.fieldWhole' : 'generator.fieldRange';
    problems.push({ messageKey, fields: [field], bounds: { minimum, maximum } });
  }
  if (!form.gravyEnabled && !form.massEnabled) problems.push({ messageKey: 'generator.invalidNoRange', fields: ['gravyEnabled', 'massEnabled'] });
  const ranges = [
    { enabled: form.gravyEnabled, minimum: 'gravyMinimum', maximum: 'gravyMaximum', rangeKey: 'generator.gravy' },
    { enabled: form.massEnabled, minimum: 'massMinimum', maximum: 'massMaximum', rangeKey: 'generator.mass' },
  ] as const;
  for (const range of ranges) {
    if (range.enabled && withinBounds(range.minimum, form[range.minimum]) && withinBounds(range.maximum, form[range.maximum]) && Number(form[range.minimum]) > Number(form[range.maximum])) problems.push({ messageKey: 'generator.orderShort', rangeKey: range.rangeKey, fields: [range.minimum, range.maximum] });
  }
  return problems;
}
