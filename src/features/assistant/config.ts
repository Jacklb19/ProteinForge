import type { TranslationKey } from '../../i18n';
import type { ApiErrorCode } from '../api/apiClient';

/** Screens that can be read; the service adapter maps them to wire subjects on demand. */
export const READING_SUBJECTS = ['analysis', 'laboratory'] as const;
export type ReadingSubject = (typeof READING_SUBJECTS)[number];

/** Limits of the contract, checked here so an oversized request never leaves the browser. */
export const MAX_FACTS = 80;
export const MAX_LABEL_LENGTH = 120;
export const MAX_VALUE_LENGTH = 200;
export const MAX_UNIT_LENGTH = 40;
export const MAX_READING_LENGTH = 4000;
/** Identity may take 5 s and the provider 30 s; leave 5 s for transport and validation. */
export const READING_TIMEOUT_MS = 40_000;

/** Safe categories of a failed reading, as the screen explains them. */
export const ASSISTANT_ERROR_KEYS: Record<ApiErrorCode, TranslationKey> = {
  network: 'assistant.network', timeout: 'assistant.timeout', cancelled: 'assistant.cancelled',
  session: 'assistant.session', unavailable: 'assistant.unavailable', 'invalid-response': 'assistant.unavailable',
  'rate-limit': 'assistant.rateLimit', validation: 'assistant.validation', unknown: 'assistant.error',
  conflict: 'assistant.error', 'not-found': 'assistant.error', schema: 'assistant.unavailable',
  forbidden: 'assistant.session', 'laboratory-size': 'assistant.validation', 'draft-changed': 'assistant.error',
  'generator-history-size': 'assistant.validation', 'requires-current-client': 'assistant.error',
};
