import type { TranslationKey, TranslationVariables } from './translate';

/**
 * Text produced where the visitor's language is unknown (Workers, scientific code). It travels as
 * a catalog key with raw values; the interface translates and formats it in the active language.
 * This module stays free of the catalogs, so every Worker that imports it ships without them.
 */
export interface LocalizedText {
  key: TranslationKey;
  variables?: TranslationVariables;
}

let describeFailure: ((text: LocalizedText) => string) | null = null;

/**
 * Lets a thread that already holds the catalogs write failure messages in the default language.
 * Elsewhere, such as in a Worker, the message is the catalog key: it is only read in logs.
 */
export function describeFailuresWith(describe: (text: LocalizedText) => string): void {
  describeFailure = describe;
}

function failureMessage(text: LocalizedText): string {
  return describeFailure?.(text) ?? text.key;
}

interface Localized { readonly text: LocalizedText }

/** Failure with a catalog key. The message is only for logs and tests; the interface shows `text`. */
export class LocalizedError extends Error implements Localized {
  readonly text: LocalizedText;
  constructor(key: TranslationKey, variables?: TranslationVariables) {
    super(failureMessage({ key, variables }));
    this.name = 'LocalizedError';
    this.text = { key, variables };
  }
}

/** Invalid scientific input, with a catalog key. */
export class LocalizedRangeError extends RangeError implements Localized {
  readonly text: LocalizedText;
  constructor(key: TranslationKey, variables?: TranslationVariables) {
    super(failureMessage({ key, variables }));
    this.name = 'LocalizedRangeError';
    this.text = { key, variables };
  }
}

/** The localized text of a failure, or the fallback when it carries none. */
export function localizedFailure(error: unknown, fallback: TranslationKey): LocalizedText {
  return error instanceof LocalizedError || error instanceof LocalizedRangeError ? error.text : { key: fallback };
}
