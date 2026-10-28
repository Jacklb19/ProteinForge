import type { DomainEntry } from './catalog';
import { DOMAINS_CONFIG } from './config';

export interface DomainFilter { kind: string; query: string }

/** Matches the kind exactly and the text against what a reader would search for, ignoring case. */
export function filterDomains(domains: readonly DomainEntry[], filter: DomainFilter): DomainEntry[] {
  const words = filter.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return domains.filter((domain) => {
    if (filter.kind && domain.kind !== filter.kind) return false;
    if (!words.length) return true;
    const haystack = [domain.accession, domain.entryName, domain.protein, domain.gene, domain.organism, domain.kind,
      domain.feature.description ?? '', domain.family?.name ?? '', domain.family?.accession ?? '', domain.structure?.pdb ?? '']
      .join(' ').toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Each part enters the assembly once; choosing it again takes it out. */
export function togglePart(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function removePart(ids: readonly string[], id: string): string[] {
  return ids.filter((item) => item !== id);
}

/** Moves a part one place up (-1) or down (+1); at either end the order stays as it is. */
export function movePart(ids: readonly string[], id: string, step: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to] as string, next[from] as string];
  return next;
}

export interface AssemblyBound { id: string; start: number; end: number }
export interface Assembly { parts: DomainEntry[]; sequence: string; length: number; bounds: AssemblyBound[] }

/** Joins the chosen parts in order; bounds are 1-based positions in the joined sequence. */
export function assemble(domains: readonly DomainEntry[], ids: readonly string[]): Assembly {
  const byId = new Map(domains.map((domain) => [domain.id, domain]));
  const parts = ids.map((id) => byId.get(id)).filter((domain): domain is DomainEntry => domain !== undefined);
  const bounds: AssemblyBound[] = [];
  let position = 0;
  for (const part of parts) {
    bounds.push({ id: part.id, start: position + 1, end: position + part.sequence.length });
    position += part.sequence.length;
  }
  return { parts, sequence: parts.map((part) => part.sequence).join(''), length: position, bounds };
}

/** One record whose header names accession, entry version and stretch of each part, in order. */
export function assemblyFasta(assembly: Assembly): string {
  const provenance = assembly.parts.map((part) => `${part.accession}|${part.entryName}|v${String(part.entryVersion)}|${String(part.feature.start)}-${String(part.feature.end)}`);
  const lines = [`>${[DOMAINS_CONFIG.fastaRecord, ...provenance].join(' ')}`];
  for (let index = 0; index < assembly.sequence.length; index += DOMAINS_CONFIG.fastaLineWidth) {
    lines.push(assembly.sequence.slice(index, index + DOMAINS_CONFIG.fastaLineWidth));
  }
  return `${lines.join('\n')}\n`;
}
