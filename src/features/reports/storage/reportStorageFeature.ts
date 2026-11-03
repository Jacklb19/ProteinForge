/**
 * Saving reports to the account needs the report storage migration and a published backend. Until
 * then builds leave the feature off: production must never offer a save that the deployed API
 * refuses. Local builds against a local API turn it on explicitly.
 */
export function readReportStorageEnabled(environment: ImportMetaEnv = import.meta.env): boolean {
  return environment.VITE_REPORT_STORAGE?.trim() === 'enabled';
}
