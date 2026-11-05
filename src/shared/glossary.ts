import type { TranslationKey } from '../i18n';

/**
 * Terms of structural biology that Library and the 3D laboratory use without explaining. Each one has the
 * phrase as it appears in the screen's sentences, the name that opens its definition, and the definition.
 */
export const GLOSSARY = {
  asymmetricUnit: { phrase: 'glossary.asymmetricUnitPhrase', name: 'glossary.asymmetricUnitName', definition: 'glossary.asymmetricUnit' },
  authorChain: { phrase: 'glossary.authorChainPhrase', name: 'glossary.authorChainName', definition: 'glossary.authorChain' },
  internalPosition: { phrase: 'glossary.internalPositionPhrase', name: 'glossary.internalPositionName', definition: 'glossary.internalPosition' },
  plddt: { phrase: 'glossary.plddtPhrase', name: 'glossary.plddtName', definition: 'glossary.plddt' },
  rmsd: { phrase: 'glossary.rmsdPhrase', name: 'glossary.rmsdName', definition: 'glossary.rmsd' },
  trace: { phrase: 'glossary.tracePhrase', name: 'glossary.traceName', definition: 'glossary.trace' },
} as const satisfies Record<string, { phrase: TranslationKey; name: TranslationKey; definition: TranslationKey }>;
export type GlossaryTerm = keyof typeof GLOSSARY;
