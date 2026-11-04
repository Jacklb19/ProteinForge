import { afterEach, describe, expect, it } from 'vitest';
import { AFTER_SIGN_IN_ROUTE, ROUTES } from '../../shared/navigation';
import { OAUTH_DESTINATION_STORAGE_KEY } from './config';
import { destinationAfterSignIn, destinationTitle, rememberDestination, takeRememberedDestination } from './destination';

afterEach(() => { sessionStorage.clear(); });

describe('return address after signing in', () => {
  it('keeps a page of the application with its query and fragment', () => {
    expect(destinationAfterSignIn({ from: '/library?view=uniprot#search' })).toBe('/library?view=uniprot#search');
    expect(destinationTitle('/library?view=uniprot#search')).toBe('nav.library');
  });

  it('never leads to another site or back to an access page', () => {
    for (const from of ['//evil.example', '/\\evil.example', 'https://evil.example', ROUTES.signIn, `${ROUTES.confirm}?x=1`, 42, undefined]) {
      expect(destinationAfterSignIn({ from })).toBe(AFTER_SIGN_IN_ROUTE);
    }
    expect(destinationAfterSignIn(null)).toBe(AFTER_SIGN_IN_ROUTE);
  });

  it('carries only the path across the Google redirect, once', () => {
    rememberDestination('/projects');
    expect(sessionStorage.getItem(OAUTH_DESTINATION_STORAGE_KEY)).toBe('/projects');
    expect(takeRememberedDestination()).toBe('/projects');
    expect(takeRememberedDestination()).toBe(AFTER_SIGN_IN_ROUTE);
    sessionStorage.setItem(OAUTH_DESTINATION_STORAGE_KEY, '//evil.example');
    expect(takeRememberedDestination()).toBe(AFTER_SIGN_IN_ROUTE);
  });
});
