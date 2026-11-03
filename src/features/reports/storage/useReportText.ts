import { useTranslation } from '../../../i18n';
import { REPORT_BYTES_PER_KILOBYTE, REPORT_BYTES_PER_MEGABYTE, REPORT_DATE_FORMAT, REPORT_HASH_EDGE, REPORT_SIZE_DIGITS, REPORT_STORAGE_LIMITS } from './config';
import type { ReportUsage } from './useSavedReports';

/** Sizes in the decimal units of the limits, device-local dates and the abbreviated fingerprint. */
export function useReportText() {
  const { t, formatNumber, formatDate } = useTranslation();
  const size = (bytes: number): string => {
    const digits = { maximumFractionDigits: REPORT_SIZE_DIGITS };
    return bytes >= REPORT_BYTES_PER_MEGABYTE
      ? t('report.megabytes', { value: formatNumber(bytes / REPORT_BYTES_PER_MEGABYTE, digits) })
      : t('report.kilobytes', { value: formatNumber(bytes / REPORT_BYTES_PER_KILOBYTE, digits) });
  };
  return {
    size,
    date: (iso: string): string => formatDate(new Date(iso), REPORT_DATE_FORMAT),
    hash: (sha256: string): string => `${sha256.slice(0, REPORT_HASH_EDGE)}…${sha256.slice(-REPORT_HASH_EDGE)}`,
    usage: (usage: ReportUsage): string => t('report.usage', {
      count: formatNumber(usage.count), max: formatNumber(REPORT_STORAGE_LIMITS.maxReports),
      used: size(usage.bytes), limit: size(REPORT_STORAGE_LIMITS.maxOwnerBytes),
    }),
  };
}
