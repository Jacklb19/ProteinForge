import type { Locale } from '../../i18n/config';
import type { ProjectWrite } from '../projects/contracts';
export type ReportFormat = 'pdf' | 'json' | 'profile' | 'alignment';
export interface ReportRequest { id: number; format: ReportFormat; input: ProjectWrite; locale: Locale }
export type ReportResponse = { id: number; blob: Blob; error?: never } | { id: number; error: true; blob?: never };
