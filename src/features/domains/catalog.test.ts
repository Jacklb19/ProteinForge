import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import catalog from './catalog.json';

// The catalogue is data gathered from public sources, not computed here. These checks guard what the
// app will rely on and what its provenance claims: every interval is the recorded slice of its entry,
// every sequence matches its digest, and every criterion the file states about itself holds.

const { criteria, domains } = catalog;
const alphabet = new RegExp(`^[${criteria.alphabet}]+$`);
const span = (start: number, end: number): number => end - start + 1;

describe('teaching domain catalogue', () => {
  it('states its own shape, criteria and provenance note in both languages', () => {
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.domains.length).toBeGreaterThanOrEqual(30);
    expect(criteria.reviewedOnly).toBe(true);
    expect(criteria.minOverlapOfShorter).toBeGreaterThan(criteria.minOverlapOfLonger);
    expect(catalog.summaryNote.es.length).toBeGreaterThan(0);
    expect(catalog.summaryNote.en.length).toBeGreaterThan(0);
  });

  it('identifies every entry once', () => {
    const ids = domains.map((domain) => domain.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(domains.map((domain) => [domain.id, domain] as const))('%s keeps its sequence, digest and interval', (_id, domain) => {
    expect(domain.sequence).toMatch(alphabet);
    expect(domain.sequence).toHaveLength(span(domain.feature.start, domain.feature.end));
    expect(createHash('sha256').update(domain.sequence, 'utf8').digest('hex')).toBe(domain.sequenceSha256);
    expect(domain.feature.start).toBeGreaterThan(0);
    expect(domain.entryVersion).toBeGreaterThan(0);
    expect(domain.sequenceVersion).toBeGreaterThan(0);
    expect(domain.summary.es.length).toBeGreaterThan(0);
    expect(domain.summary.en.length).toBeGreaterThan(0);
  });

  it.each(domains.map((domain) => [domain.id, domain] as const))('%s cites every source with its licence and digest', (_id, domain) => {
    expect(domain.sources.length).toBeGreaterThan(0);
    for (const source of domain.sources) {
      expect(source.url.startsWith('https://')).toBe(true);
      expect(source.licence.length).toBeGreaterThan(0);
      expect(source.licenceUrl.startsWith('https://')).toBe(true);
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isNaN(Date.parse(source.retrievedAt))).toBe(false);
    }
  });

  it('overlaps each family with its interval by the margins the file states', () => {
    for (const domain of domains.filter((entry) => entry.family)) {
      const family = domain.family;
      if (!family) continue;
      const overlap = Math.max(0, Math.min(domain.feature.end, family.end) - Math.max(domain.feature.start, family.start) + 1);
      const sizes = [span(domain.feature.start, domain.feature.end), span(family.start, family.end)];
      expect(overlap / Math.min(...sizes), `${domain.id} over the shorter side`).toBeGreaterThanOrEqual(criteria.minOverlapOfShorter);
      expect(overlap / Math.max(...sizes), `${domain.id} over the longer side`).toBeGreaterThanOrEqual(criteria.minOverlapOfLonger);
    }
  });

  it('keeps every reference structure within the stated resolution and covering its interval', () => {
    for (const domain of domains.filter((entry) => entry.structure)) {
      const structure = domain.structure;
      if (!structure) continue;
      expect(structure.pdb, `${domain.id} structure id`).toMatch(/^[0-9A-Za-z]{4}$/);
      if (structure.resolutionAngstrom !== null) {
        expect(structure.resolutionAngstrom, `${domain.id} resolution`).toBeLessThanOrEqual(criteria.maxResolutionAngstrom);
      }
      expect(structure.start, `${domain.id} chain start`).toBeLessThanOrEqual(domain.feature.start);
      expect(structure.end, `${domain.id} chain end`).toBeGreaterThanOrEqual(domain.feature.end);
    }
  });

  it('covers several kinds, so the catalogue is not one family repeated', () => {
    expect(new Set(domains.map((domain) => domain.kind)).size).toBeGreaterThanOrEqual(10);
  });
});
