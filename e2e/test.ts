import { test as base, expect } from '@playwright/test';
import { signInWithEmptyAccount } from './helpers';

/**
 * Every tool needs a session, so each test starts signed in with an account that owns no projects and
 * whose identity and API requests are answered locally. A test that needs its own answers registers
 * routes afterwards, which take precedence; a test of the public site or the access pages sets
 * `test.use({ signedIn: false })`.
 */
export const test = base.extend<{ signedIn: boolean; account: undefined }>({
  signedIn: [true, { option: true }],
  account: [async ({ page, signedIn }, use) => {
    if (signedIn) await signInWithEmptyAccount(page);
    await use(undefined);
  }, { auto: true }],
});

export { expect };
