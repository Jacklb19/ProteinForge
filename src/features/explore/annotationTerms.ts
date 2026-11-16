import type { Locale } from '../../i18n/config';
import { PUBMED_CITATION } from './config';

/** UniProt separates the parts of a short annotation with this mark; each part is translated on its own. */
const PART_SEPARATOR = '; ';

type Rule = readonly [pattern: RegExp, replacement: string];

/**
 * UniProt publishes its annotations only in English. The short, repeated ones (modified residues, sugars,
 * membrane topology, catalytic roles, variant notes) have fixed wording, so a phrase list translates them
 * exactly; anything not on the list is shown as UniProt wrote it.
 */
const SPANISH_RULES: readonly Rule[] = [
  [/^Phosphoserine$/, 'Fosfoserina'],
  [/^Phosphothreonine$/, 'Fosfotreonina'],
  [/^Phosphotyrosine$/, 'Fosfotirosina'],
  [/^N-linked \(GlcNAc\.\.\.\) asparagine$/, 'Asparagina con N-glicano (GlcNAc...)'],
  [/^O-linked \(GalNAc\.\.\.\) serine$/, 'Serina con O-glicano (GalNAc...)'],
  [/^O-linked \(GalNAc\.\.\.\) threonine$/, 'Treonina con O-glicano (GalNAc...)'],
  [/^N6-acetyllysine$/, 'N6-acetil-lisina'],
  [/^N-acetylmethionine$/, 'N-acetilmetionina'],
  [/^Pyrrolidone carboxylic acid$/, 'Ácido piroglutámico'],
  [/^Helical$/, 'Hélice'],
  [/^Discontinuously helical$/, 'Hélice discontinua'],
  [/^Beta stranded$/, 'Hebra beta'],
  [/^Disordered$/, 'Región desordenada'],
  [/^Cytoplasmic$/, 'Citoplasmática'],
  [/^Extracellular$/, 'Extracelular'],
  [/^Lumenal$/, 'Luminal'],
  [/^Nucleophile$/, 'Nucleófilo'],
  [/^Proton donor$/, 'Donador de protones'],
  [/^Proton acceptor$/, 'Aceptor de protones'],
  [/^Proton donor\/acceptor$/, 'Donador y aceptor de protones'],
  [/^Charge relay system$/, 'Sistema de relevo de carga'],
  [/^[Ss]ubstrate$/, 'sustrato'],
  [/^Interchain$/, 'Entre cadenas'],
  [/^Redox-active$/, 'Activo en oxidorreducción'],
  [/^uncertain significance$/, 'significado incierto'],
  [/^mild$/, 'leve'],
  [/^in dbSNP:(.+)$/, 'dbSNP:$1'],
  [/^in (.+)$/, 'en $1'],
  [/^by (.+)$/, 'por $1'],
  [/^Interaction with (.+)$/, 'Interacción con $1'],
  [/^Name=(.+)$/, 'n.º $1'],
];

const RULES: Partial<Record<Locale, readonly Rule[]>> = { es: SPANISH_RULES };

function translatePart(part: string, rules: readonly Rule[]): string {
  for (const [pattern, replacement] of rules) if (pattern.test(part)) return part.replace(pattern, replacement).replace(/ and /g, ' y ');
  return part;
}

/** A short UniProt annotation in the interface language where its wording is known; otherwise unchanged. */
export function translateAnnotation(text: string, locale: Locale): string {
  const rules = RULES[locale];
  if (!rules || !text) return text;
  return text.split(PART_SEPARATOR).map(part => translatePart(part, rules)).join(PART_SEPARATOR);
}

/** UniProt's function text without its literature references, which are not readable on this page. */
export function withoutCitations(text: string): string {
  return text.replace(PUBMED_CITATION, '').replace(/\s+([.,;])/g, '$1').trim();
}
