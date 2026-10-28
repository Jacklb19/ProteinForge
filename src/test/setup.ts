import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Release mounted trees after each test.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
});

afterEach(() => {
  cleanup();
});

// jsdom does not implement native dialogs. Browser E2E checks actual focus containment and Escape.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
  close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
});

// Failure messages raised in tests read in the default language, as on the interface thread.
import '../i18n/localize';

// Components under test may show either language; the English catalog is otherwise loaded on demand.
import { loadCatalog } from '../i18n/catalogs';
await loadCatalog('en');
