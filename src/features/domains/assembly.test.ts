import { describe, expect, it } from 'vitest';
import { assemble, assemblyFasta, filterDomains, movePart, removePart, togglePart } from './assembly';
import { loadDomainCatalog } from './catalog';
import { DOMAINS_CONFIG, DOMAIN_KIND_LABELS, DOMAIN_SOURCE_LABELS } from './config';

const { domains } = await loadDomainCatalog();
const [first, second, third] = domains;
if (!first || !second || !third) throw new Error('The catalogue needs at least three parts.');

describe('domain catalogue filters', () => {
  it('keeps everything without a filter and narrows by kind', () => {
    expect(filterDomains(domains, { kind: '', query: '  ' })).toHaveLength(domains.length);
    const sh3 = filterDomains(domains, { kind: 'sh3', query: '' });
    expect(sh3.length).toBeGreaterThan(0);
    expect(sh3.every((domain) => domain.kind === 'sh3')).toBe(true);
  });

  it('matches every word of the text, ignoring case, across accession, protein, organism and family', () => {
    expect(filterDomains(domains, { kind: '', query: first.accession.toLowerCase() }).map((domain) => domain.accession)).toContain(first.accession);
    const human = filterDomains(domains, { kind: '', query: 'HOMO sapiens' });
    expect(human.length).toBeGreaterThan(0);
    expect(human.every((domain) => domain.organism === 'Homo sapiens')).toBe(true);
    expect(filterDomains(domains, { kind: 'sh3', query: 'no-such-part' })).toEqual([]);
  });
});

describe('assembly order', () => {
  it('adds a part once and takes it out when chosen again', () => {
    expect(togglePart([], first.id)).toEqual([first.id]);
    expect(togglePart([first.id, second.id], first.id)).toEqual([second.id]);
    expect(removePart([first.id, second.id], second.id)).toEqual([first.id]);
  });

  it('moves a part one place and leaves the ends as they are', () => {
    const ids = [first.id, second.id, third.id];
    expect(movePart(ids, third.id, -1)).toEqual([first.id, third.id, second.id]);
    expect(movePart(ids, first.id, 1)).toEqual([second.id, first.id, third.id]);
    expect(movePart(ids, first.id, -1)).toEqual(ids);
    expect(movePart(ids, third.id, 1)).toEqual(ids);
    expect(movePart(ids, 'missing', 1)).toEqual(ids);
  });
});

describe('joined sequence', () => {
  it('joins the parts in order and marks where each one starts and ends', () => {
    const assembly = assemble(domains, [second.id, 'missing', first.id]);
    expect(assembly.parts.map((part) => part.id)).toEqual([second.id, first.id]);
    expect(assembly.sequence).toBe(second.sequence + first.sequence);
    expect(assembly.length).toBe(second.sequence.length + first.sequence.length);
    expect(assembly.bounds).toEqual([
      { id: second.id, start: 1, end: second.sequence.length },
      { id: first.id, start: second.sequence.length + 1, end: assembly.length },
    ]);
    expect(assemble(domains, [])).toEqual({ parts: [], sequence: '', length: 0, bounds: [] });
  });

  it('writes one FASTA record citing accession, entry version and stretch of each part', () => {
    const assembly = assemble(domains, [first.id, second.id]);
    const [header, ...lines] = assemblyFasta(assembly).trimEnd().split('\n');
    expect(header).toBe(`>${DOMAINS_CONFIG.fastaRecord} ${first.accession}|${first.entryName}|v${String(first.entryVersion)}|${String(first.feature.start)}-${String(first.feature.end)} ${second.accession}|${second.entryName}|v${String(second.entryVersion)}|${String(second.feature.start)}-${String(second.feature.end)}`);
    expect(lines.join('')).toBe(assembly.sequence);
    expect(lines.every((line) => line.length <= DOMAINS_CONFIG.fastaLineWidth)).toBe(true);
  });
});

describe('interface labels', () => {
  it('names every kind and every source of the catalogue', () => {
    for (const domain of domains) {
      expect(DOMAIN_KIND_LABELS[domain.kind], domain.kind).toBeDefined();
      for (const source of domain.sources) expect(DOMAIN_SOURCE_LABELS[source.name], source.name).toBeDefined();
    }
  });
});
