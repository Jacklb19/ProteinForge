import { describe, expect, it, vi } from 'vitest';
import { spanish } from '../../i18n/es';
import { ModelError, findPredictedModel } from './alphafold';
import { ALPHAFOLD_API_URL, ALPHAFOLD_FILES_URL, STOP_GROUP_OF, STOP_KINDS, STOP_KIND_LABEL_KEYS, STOP_KIND_MEANING_KEYS } from './config';
import { groupStops, stopPositions, stopSize, stopsAt, stopsFrom } from './stops';

const feature = (kind: string, begin: number, end: number, paired = false) => ({ kind, description: '', begin, end, paired });

describe('stops of a protein', () => {
  it('keeps the kinds it can explain, inside the sequence, in tour order', () => {
    const stops = stopsFrom([feature('variant', 2, 2), feature('disulfide', 1, 9, true), feature('future-kind', 1, 2), feature('domain', 3, 40), feature('active-site', 5, 5), feature('region', 0, 3), feature('region', 5, 4)], 10);
    expect(stops.map(stop => stop.kind)).toEqual(['variant', 'disulfide', 'active-site']);
    expect(new Set(stops.map(stop => stop.id)).size).toBe(stops.length);
    expect(groupStops(stops).map(group => [group.group, group.stops.map(stop => stop.kind)])).toEqual([['function', ['active-site']], ['chemistry', ['disulfide']], ['variants', ['variant']]]);
  });

  it('marks the two ends of a bond and every residue of a span', () => {
    const [bond, span] = stopsFrom([feature('disulfide', 2, 8, true), feature('signal', 1, 4)], 10);
    if (!bond || !span) throw new Error('Missing stops');
    expect([stopPositions(bond), stopSize(bond)]).toEqual([[2, 8], 2]);
    expect([stopPositions(span), stopSize(span)]).toEqual([[1, 2, 3, 4], 4]);
    expect(stopsAt([bond, span], 2).map(stop => stop.kind)).toEqual(['disulfide', 'signal']);
    // A bond does not include what lies between its two residues.
    expect(stopsAt([bond, span], 5)).toEqual([]);
  });

  it('gives every kind a group, a name and an explanation in the catalogue', () => {
    for (const kind of STOP_KINDS) {
      expect(STOP_GROUP_OF[kind]).toBeTruthy();
      expect(spanish[STOP_KIND_LABEL_KEYS[kind]]).toBeTruthy();
      expect(spanish[STOP_KIND_MEANING_KEYS[kind]]).toBeTruthy();
    }
  });
});

describe('predicted model lookup', () => {
  const sequence = 'ACDEFG';
  const prediction = { bcifUrl: `${ALPHAFOLD_FILES_URL}AF-P00698-F1-model_v6.bcif`, latestVersion: 6, globalMetricValue: 93.88, sequence, sequenceStart: 1, sequenceEnd: sequence.length };
  type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
  const answer = (body: unknown, status = 200) => vi.fn<Fetcher>().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  const find = (fetcher: Fetcher, accession = 'P00698') => findPredictedModel(accession, sequence, new AbortController().signal, fetcher);

  it('asks for one accession without credentials and returns the model of the whole chain', async () => {
    const fetcher = answer([prediction]);
    await expect(find(fetcher)).resolves.toEqual({ url: prediction.bcifUrl, version: 6, confidence: 93.88 });
    expect(fetcher).toHaveBeenCalledWith(`${ALPHAFOLD_API_URL}P00698`, expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
  });

  it('refuses models that are missing, fragmented, of another sequence or served from elsewhere', async () => {
    const cases: [Fetcher, string][] = [
      [answer({ error: 'none' }, 404), 'missing'], [answer([]), 'missing'], [answer([prediction, prediction]), 'partial'],
      [answer([{ ...prediction, sequenceEnd: 5 }]), 'partial'], [answer([{ ...prediction, sequence: 'ACDEFH' }]), 'mismatch'],
      [answer([{ ...prediction, bcifUrl: 'https://elsewhere.example/model.bcif' }]), 'unavailable'], [answer({}, 500), 'unavailable'],
      [vi.fn<Fetcher>().mockRejectedValue(new TypeError('network')), 'unavailable'],
    ];
    for (const [fetcher, reason] of cases) await expect(find(fetcher)).rejects.toMatchObject({ reason });
  });

  it('never sends anything that is not an accession', async () => {
    const fetcher = answer([prediction]);
    await expect(find(fetcher, '../private')).rejects.toBeInstanceOf(ModelError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
