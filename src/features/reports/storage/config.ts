import type { TranslationKey } from '../../../i18n';
import type { ReportFormat } from '../reportMessages';

/**
 * Bounds of reports stored in the owner's account. The backend (`app/report_config.py`) is the source
 * and its migration repeats them; `config.test.ts` keeps these in step with both.
 */
export const REPORT_STORAGE_LIMITS = { maxReportBytes: 5_000_000, maxReports: 20, maxOwnerBytes: 25_000_000 } as const;
/** One page holds every report an owner can have, so a single list call serves every screen. */
export const REPORT_LIST_PAGE_SIZE = 50;
/** A 5 MB file on a slow connection still fits; a stalled upload ends as a failure, never hangs. */
export const REPORT_UPLOAD_TIMEOUT_MS = 120_000;
/** Remembers, per account and browser, that the owner was told the report leaves this device. */
export const REPORT_FIRST_SAVE_KEY_PREFIX = 'proteinforge:report-first-save:';
/** Characters of the fingerprint shown at each end; the full value goes to screen readers. */
export const REPORT_HASH_EDGE = 4;
/** Sizes in decimal units, the same ones the limits are written in. */
export const REPORT_BYTES_PER_KILOBYTE = 1_000;
export const REPORT_BYTES_PER_MEGABYTE = 1_000_000;
export const REPORT_SIZE_DIGITS = 1;
/** Saved date and time in the device's zone and the interface language. */
export const REPORT_DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
export const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Kinds of the storage contract; the properties CSV is a local download only. */
export const STORED_REPORT_KINDS = ['pdf', 'json', 'profile-csv', 'alignment-csv'] as const;
export type StoredReportKind = (typeof STORED_REPORT_KINDS)[number];
export const REPORT_KIND_FORMATS = { pdf: 'pdf', json: 'json', 'profile-csv': 'profile', 'alignment-csv': 'alignment' } as const satisfies Record<StoredReportKind, ReportFormat>;
export const REPORT_FORMAT_KINDS = { pdf: 'pdf', json: 'json', profile: 'profile-csv', alignment: 'alignment-csv' } as const satisfies Record<ReportFormat, StoredReportKind>;
/** Type of the verified file handed to the browser; the same types the bucket accepts. */
export const REPORT_CONTENT_TYPES = { pdf: 'application/pdf', json: 'application/json', 'profile-csv': 'text/csv', 'alignment-csv': 'text/csv' } as const satisfies Record<StoredReportKind, string>;
/** An opened report keeps its local address this long, enough for the new tab to read it. */
export const REPORT_OPEN_URL_LIFETIME_MS = 60_000;
/** Kinds a browser tab can show; the CSV files are only downloaded. */
export const OPENABLE_REPORT_KINDS: readonly StoredReportKind[] = ['pdf', 'json'];

/** Full name of each format (rows, messages) and its short label in the format chooser. */
export const REPORT_FORMAT_NAMES = { pdf: 'report.pdf', json: 'report.json', profile: 'report.profileCsv', alignment: 'report.alignmentCsv' } as const satisfies Record<ReportFormat, TranslationKey>;
export const REPORT_FORMAT_LABELS = { pdf: 'report.formatPdf', json: 'report.formatJson', profile: 'report.formatProfile', alignment: 'report.formatAlignment' } as const satisfies Record<ReportFormat, TranslationKey>;
/** Formats offered for saving on each screen, before the ones the current input cannot produce are left out. */
export const SAVE_FORMATS = { analyze: ['pdf', 'json', 'profile'], alignment: ['pdf', 'json', 'alignment'] } as const satisfies Record<string, readonly ReportFormat[]>;
export type ReportScreen = keyof typeof SAVE_FORMATS;
