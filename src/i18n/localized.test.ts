import { describe, expect, it } from 'vitest';
import { LocalizedError, LocalizedRangeError, localize, localizedFailure } from './localized';
import { english } from './en';
import { spanish } from './es';

describe('localized texts from Workers and scientific code', () => {
  it('translate and format numbers in the language chosen when they are shown', () => {
    const text = { key: 'errors.emptyFastaHeader', variables: { line: 1200 } } as const;
    expect(localize('es', text)).toBe('La cabecera de la línea 1.200 está vacía.');
    expect(localize('en', text)).toBe('The header on line 1,200 is empty.');
    expect(localize('en', { key: 'errors.fastaLimit', variables: { limit: 5 } })).toBe('The file exceeds the 5 MB limit.');
  });

  it('keep the catalog key on errors and fall back for anything else', () => {
    const range = new LocalizedRangeError('errors.invalidResidues');
    expect(range).toBeInstanceOf(RangeError);
    expect(range.message).toBe(spanish['errors.invalidResidues']);
    expect(localizedFailure(range, 'descriptors.error')).toEqual({ key: 'errors.invalidResidues', variables: undefined });
    expect(localizedFailure(new LocalizedError('errors.workerStopped'), 'descriptors.error').key).toBe('errors.workerStopped');
    expect(localizedFailure(new Error('internal detail'), 'descriptors.error')).toEqual({ key: 'descriptors.error' });
    expect(localize('en', localizedFailure('not an error', 'errors.fastaRead'))).toBe(english['errors.fastaRead']);
  });
});
