import { describe, expect, it } from 'vitest';
import { APP_BUILD } from './appBuild';
import { normalizeAppBuild, resolveBuildCommit } from './buildCommit';

const commit = 'a4f5001c0ffee0123456789abcdef0123456789a';
const clean = () => ({ commit, dirty: false });

describe('build identity of saved generator runs', () => {
  it('prefers the commit Vercel deploys and normalizes its case', () => {
    expect(resolveBuildCommit({ VERCEL_GIT_COMMIT_SHA: commit.toUpperCase() }, () => { throw new Error('git must not be needed'); })).toBe(commit);
  });

  it('uses HEAD of a clean checkout and null for uncommitted changes, missing git or invalid values', () => {
    expect(resolveBuildCommit({}, clean)).toBe(commit);
    expect(resolveBuildCommit({}, () => ({ commit, dirty: true }))).toBeNull();
    expect(resolveBuildCommit({}, () => { throw new Error('git not found'); })).toBeNull();
    expect(resolveBuildCommit({}, () => null)).toBeNull();
    expect(resolveBuildCommit({ VERCEL_GIT_COMMIT_SHA: 'main' }, () => ({ commit: 'not-a-commit', dirty: false }))).toBeNull();
  });

  it('accepts only 7 to 40 lowercase hexadecimal characters, the backend contract', () => {
    expect(normalizeAppBuild(' A4F5001 ')).toBe('a4f5001');
    for (const value of ['a4f500', `${commit}0`, 'g4f5001', '', undefined, null]) expect(normalizeAppBuild(value)).toBeNull();
  });

  it('has no build identity under test, where vite.config.ts does not inject one', () => {
    expect(APP_BUILD).toBeNull();
  });
});
