import { describe, expect, it, vi } from 'vitest';
import { english } from './en';
import { spanish } from './es';

describe('interface catalogs', () => {
  it('ship the default language and fetch another one only when it is asked for', async () => {
    // A fresh module: the shared test setup has already loaded English into the usual instance.
    vi.resetModules();
    const catalogs = await import('./catalogs');
    expect(catalogs.isCatalogLoaded('es')).toBe(true);
    expect(catalogs.isCatalogLoaded('en')).toBe(false);
    expect(() => catalogs.translateLoaded('en', 'app.title')).toThrow(spanish['errors.catalogMissing'].replace('{{locale}}', 'en'));
    await catalogs.loadCatalog('en');
    await catalogs.loadCatalog('en');
    expect(catalogs.isCatalogLoaded('en')).toBe(true);
    expect(catalogs.translateLoaded('en', 'app.title')).toBe(english['app.title']);
    expect(catalogs.translateLoaded('es', 'errors.missingProvider', { name: 'Proyectos' })).toBe(spanish['errors.missingProvider'].replace('{{name}}', 'Proyectos'));
  });
});
