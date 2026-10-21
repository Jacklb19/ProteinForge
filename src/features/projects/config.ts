import type { ApiErrorCode } from '../api/apiClient';
import type { TranslationKey } from '../../i18n';

export const MAX_PROJECT_NAME_LENGTH = 120;
export const MAX_PROJECT_SEQUENCE_LENGTH = 100_000;
export const PROJECT_PAGE_SIZE = 30;
export const PROJECT_PREVIEW_RESIDUES = 40;
export const PROJECT_ORDERS = ['recent', 'name'] as const;
export type ProjectOrder = (typeof PROJECT_ORDERS)[number];
export interface ProjectQuery { query: string; order: ProjectOrder }
export const DEFAULT_PROJECT_QUERY: ProjectQuery = { query: '', order: PROJECT_ORDERS[0] };
export const PROJECT_ORDER_KEYS = { recent: 'projects.orderRecent', name: 'projects.orderName' } as const satisfies Record<ProjectOrder, TranslationKey>;
export const PROJECT_RELATIVE_INTERVALS = [
  { seconds: 31_536_000, unit: 'year' }, { seconds: 2_592_000, unit: 'month' },
  { seconds: 86_400, unit: 'day' }, { seconds: 3_600, unit: 'hour' }, { seconds: 60, unit: 'minute' },
] as const;
export const PROJECT_RELATIVE_NOW_SECONDS = 60;
export const PROJECT_MASS_DA_PER_KDA = 1_000;
export const PROJECT_PREVIEW_PRECISION = { mass: 2, pi: 2, gravy: 3, percent: 1 } as const;
export const PROJECT_POINTER_PREFIX = 'proteinforge:last-project:';
export const DESCRIPTOR_METHOD_VERSION = 'proteinforge-descriptors-v1';
export const PROJECT_ERROR_KEYS: Record<ApiErrorCode, TranslationKey> = {
  'laboratory-size':'lab.projectSize',
  network: 'projects.network', timeout: 'projects.timeout', cancelled: 'projects.cancelled', session: 'projects.session',
  unavailable: 'projects.unavailable', 'invalid-response': 'projects.invalidResponse', unknown: 'projects.error',
  conflict: 'projects.conflict', 'not-found': 'projects.notFound', validation: 'projects.validation', schema: 'projects.schema', forbidden: 'projects.forbidden',
};
