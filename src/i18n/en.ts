import { spanish } from './es';

/** Pending translations remain visibly marked until Sprint 7. */
export const english = Object.fromEntries(
  Object.entries(spanish).map(([key, value]) => [key, `[EN pending] ${value}`]),
) as { [Key in keyof typeof spanish]: string };
