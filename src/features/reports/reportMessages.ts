import type { Locale } from '../../i18n/config';
import type { ProjectWrite } from '../projects/contracts';
export type ReportFormat = 'pdf' | 'json' | 'profile' | 'alignment';
export interface ReportRequest { id: number; format: ReportFormat; input: ProjectWrite; locale: Locale }
/** `sha256`: lowercase hexadecimal fingerprint of the exact file bytes, computed in the Worker. */
export type ReportResponse = { id: number; blob: Blob; sha256: string; error?: never } | { id: number; error: true; blob?: never; sha256?: never };
