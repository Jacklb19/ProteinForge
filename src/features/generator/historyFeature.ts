/**
 * Saving generator searches in Projects needs a backend that accepts workspace version 3. Until that
 * backend and its migration are published, builds leave the feature off: production must never offer
 * a save that the deployed API refuses. Local builds against a local API turn it on explicitly.
 */
export function readGeneratorHistoryEnabled(environment: ImportMetaEnv = import.meta.env): boolean {
  return environment.VITE_GENERATOR_HISTORY?.trim() === 'enabled';
}
