import { GENERATOR_HISTORY_CONFIG } from './config';

/** A commit identifier as stored with a generator run, or null when it is not a plain lowercase hash. */
export function normalizeAppBuild(value: string | null | undefined): string | null {
  const commit = value?.trim().toLowerCase() ?? '';
  return GENERATOR_HISTORY_CONFIG.appBuildPattern.test(commit) ? commit : null;
}

export interface GitState { commit: string; dirty: boolean }

/**
 * Build identity for vite.config.ts. Vercel exposes the deployed commit; otherwise a clean local
 * checkout gives HEAD. Uncommitted changes, or no git at all, give null rather than a commit that
 * does not describe the code that ran.
 */
export function resolveBuildCommit(environment: Readonly<Record<string, string | undefined>>, readGit: () => GitState | null): string | null {
  const deployed = normalizeAppBuild(environment.VERCEL_GIT_COMMIT_SHA);
  if (deployed) return deployed;
  let git: GitState | null;
  try { git = readGit(); } catch { git = null; }
  return git && !git.dirty ? normalizeAppBuild(git.commit) : null;
}
