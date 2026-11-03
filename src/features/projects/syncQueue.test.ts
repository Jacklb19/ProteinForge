import { describe, expect, it } from 'vitest';
import { SYNC_MAX_ENTRIES, SYNC_RETRY_DELAYS_MS } from './config';
import type { Project, ProjectWrite } from './contracts';
import type { GeneratorRun } from '../generator/history';
import { afterFailure, due, enqueue, laboratoryVariants, newKey, nextRetry, pendingSummary, sameContent } from './syncQueue';
import type { SyncChange, SyncEntry } from './syncQueue';

const stored: Project = { id: '00000000-0000-4000-8000-000000000010', name: 'Insulina', activeSequence: 'ACD', status: 'draft', createdAt: '2026-11-02T08:00:00Z', updatedAt: '2026-11-02T08:00:00.123456Z', workspace: { schemaVersion: 1, profileWindow: 9, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } } };
const write = (activeSequence: string): ProjectWrite => ({ name: 'Insulina', activeSequence, workspace: stored.workspace });
const change = (changes: Partial<SyncChange> = {}): SyncChange => ({ owner: 'owner', email: 'a@example.org', name: 'Insulina', kind: 'analysis', projectId: stored.id, base: stored, write: write('ACDE'), uncertain: false, ...changes });
const run = (id: string) => ({ id }) as GeneratorRun;
const NOW = 1_000_000;

function queued(changes: Partial<SyncChange> = {}, entries: SyncEntry[] = []): SyncEntry[] {
  const result = enqueue(entries, change(changes), NOW, null, 'request-1');
  if (!result) throw new Error('queue full');
  return result.entries;
}

describe('sync queue', () => {
  it('keeps one entry per project: a second save replaces the content and adds new searches once', () => {
    const first = queued({ run: run('a') });
    const second = enqueue(first, change({ write: write('ACDEF'), run: run('a') }), NOW + 5, null, 'request-2');
    expect(second?.entries).toHaveLength(1);
    expect(second?.entries[0]).toMatchObject({ key: stored.id, write: { activeSequence: 'ACDEF' }, changedAt: NOW + 5, requestId: 'request-1' });
    expect(second?.entries[0]?.runs.map(item => item.id)).toEqual(['a']);
    const third = enqueue(second?.entries ?? [], change({ write: undefined, kind: 'search', run: run('b') }), NOW + 6, null, 'request-3');
    // A search alone keeps the waiting analysis and goes on top of it.
    expect(third?.entries[0]).toMatchObject({ kind: 'search', write: { activeSequence: 'ACDEF' } });
    expect(third?.entries[0]?.runs.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('keys a new project by its request id and merges later saves through the bound key', () => {
    const created = enqueue([], change({ projectId: null, base: null }), NOW, null, 'request-1');
    expect(created?.key).toBe(newKey('request-1'));
    const again = enqueue(created?.entries ?? [], change({ projectId: null, base: null, write: write('MK') }), NOW, created?.key ?? null, 'request-2');
    expect(again?.entries).toHaveLength(1);
    expect(again?.entries[0]).toMatchObject({ requestId: 'request-1', write: { activeSequence: 'MK' } });
    // Unbound, another new project is another entry.
    expect(enqueue(again?.entries ?? [], change({ projectId: null, base: null }), NOW, null, 'request-3')?.entries).toHaveLength(2);
  });

  it('never mixes accounts and refuses beyond the limit, making room from saved entries first', () => {
    const other = queued({ owner: 'other' });
    expect(queued({}, other)).toHaveLength(2);
    let entries: SyncEntry[] = [];
    for (let index = 0; index < SYNC_MAX_ENTRIES; index++) entries = enqueue(entries, change({ projectId: null, base: null }), NOW, null, `request-${String(index)}`)?.entries ?? entries;
    expect(enqueue(entries, change({ projectId: null, base: null }), NOW, null, 'one-more')).toBeNull();
    const savedOne = entries.map((entry, index) => index === 0 ? { ...entry, state: 'saved' as const } : entry);
    expect(enqueue(savedOne, change({ projectId: null, base: null }), NOW, null, 'one-more')?.entries).toHaveLength(SYNC_MAX_ENTRIES);
  });

  it('retries transient failures after each delay, then stops; other failures stop at once', () => {
    let entry = queued({ failed: 'network' })[0];
    if (!entry) throw new Error('missing');
    expect(entry).toMatchObject({ attempts: 1, retryAt: NOW + SYNC_RETRY_DELAYS_MS[0], error: 'network' });
    expect(due([entry], 'owner', NOW)).toEqual([]);
    expect(nextRetry([entry], 'owner', NOW)).toBe(NOW + SYNC_RETRY_DELAYS_MS[0]);
    expect(nextRetry([entry], 'other', NOW)).toBeNull();
    entry = afterFailure(entry, 'timeout', NOW, true);
    expect(entry).toMatchObject({ state: 'pending', attempts: 2, retryAt: NOW + SYNC_RETRY_DELAYS_MS[1] });
    entry = afterFailure(entry, 'unavailable', NOW, true);
    expect(entry).toMatchObject({ state: 'pending', attempts: 3, retryAt: NOW + SYNC_RETRY_DELAYS_MS[2] });
    expect(afterFailure(entry, 'rate-limit', NOW, true)).toMatchObject({ state: 'failed', error: 'rate-limit' });
    const fresh = queued()[0];
    if (!fresh) throw new Error('missing');
    expect(due([fresh], 'owner', NOW)).toEqual([fresh]);
    expect(afterFailure(fresh, 'validation', NOW, true)).toMatchObject({ state: 'failed', error: 'validation' });
    // A create without request ids is never repeated on its own.
    expect(afterFailure(fresh, 'network', NOW, false)).toMatchObject({ state: 'failed', error: 'network' });
  });

  it('recognises its own write after a lost response, and a real change as a conflict', () => {
    expect(sameContent(stored, write('ACD'))).toBe(true);
    expect(sameContent(stored, write('ACDE'))).toBe(false);
    expect(sameContent({ ...stored, workspace: { ...stored.workspace, profileWindow: 19 } }, write('ACD'))).toBe(false);
  });

  it('shows a waiting new project with the compact evidence it will save, never a full copy', () => {
    const [entry] = queued({ projectId: null, base: null, write: { ...write('ACDX'), workspace: { ...stored.workspace, alignment: { ...stored.workspace.alignment, first: 'ACD', second: 'ACE' } } } });
    if (!entry) throw new Error('missing');
    const summary = pendingSummary(entry);
    expect(summary).toMatchObject({ id: entry.key, name: 'Insulina', preview: { sequenceLength: 4, sequencePrefix: 'ACDX', excluded: 1, alignment: { firstLength: 3, secondLength: 3, result: null } } });
    expect(pendingSummary({ ...entry, write: null }).preview).toBeNull();
  });

  it('counts laboratory variants without failing on unreadable documents', () => {
    const laboratory = { schemaVersion: 1 as const, documentSha256: 'a'.repeat(64) };
    expect(laboratoryVariants({ workspace: { ...stored.workspace, laboratory: { ...laboratory, documentJson: JSON.stringify({ state: { drafts: { a: {}, b: {} } } }) } } })).toBe(2);
    expect(laboratoryVariants({ workspace: { ...stored.workspace, laboratory: { ...laboratory, documentJson: '{' } } })).toBe(0);
    expect(laboratoryVariants(stored)).toBe(0);
  });
});

describe('review fixes', () => {
  it('counts source, descriptors and the comparison result as content: a difference there is a real conflict', () => {
    const own = write('ACD');
    const descriptors = { sequence: 'ACD', excluded: 0, methodVersion: 'proteinforge-descriptors-v1' as const, result: { massDa: 307, isoelectricPoint: 5, instabilityIndex: 1, aliphaticIndex: 1, gravy: 0, length: 3 } };
    expect(sameContent({ ...stored, workspace: { ...stored.workspace, descriptors } }, own)).toBe(false);
    expect(sameContent({ ...stored, workspace: { ...stored.workspace, source: { origin: 'catalog', accession: 'P01308', sequence: 'ACD', entryVersion: null, sequenceVersion: 1, retrievedAt: null } } }, own)).toBe(false);
    // Absent and null are the same field; key order does not matter.
    expect(sameContent({ ...stored, workspace: { alignment: stored.workspace.alignment, descriptors: null, source: null, profileWindow: 9, schemaVersion: 1 } }, own)).toBe(true);
  });

  it('never merges into another account through a bound key', () => {
    const first = enqueue([], change({ projectId: null, base: null }), NOW, null, 'request-1');
    const other = enqueue(first?.entries ?? [], change({ projectId: null, base: null, owner: 'other' }), NOW, first?.key ?? null, 'request-2');
    expect(other?.entries.map(entry => entry.owner)).toEqual(['owner', 'other']);
  });

  it('keeps the base a later analysis brings to a waiting search', () => {
    const search = queued({ write: undefined, base: null, kind: 'search', run: run('a') });
    const merged = enqueue(search, change(), NOW, null, 'request-2');
    expect(merged?.entries[0]).toMatchObject({ base: stored, write: { activeSequence: 'ACDE' } });
  });
});
