import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useResidueMapping } from './useResidueMapping';
import { mappingAddress, mappingCoordinates, mappingEvidence, mappingReference } from '../../test/residueMappingFixture';
import { ApiError } from '../api/apiClient';
import { ResidueMappingError } from './mappingTypes';

beforeEach(() => { vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const input = { reference: mappingReference, pdbId: '1TRZ', token: 'test-token' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it('sends only public identifiers and gates both directions on full hash plus actual coordinates', async () => {
  const load = vi.fn().mockResolvedValue(mappingEvidence());
  const { result } = renderHook(() => useResidueMapping({ ...input, load }));
  await waitFor(() => { expect(load).toHaveBeenCalledOnce(); });
  expect(load.mock.calls[0]?.slice(0, 2)).toEqual([{ pdbId: '1TRZ', accession: 'P01308', sequenceVersion: 1 }, 'test-token']);
  expect(result.current.ready).toBe(false); expect(result.current.binding.fromSequence(2).status).toBe('unverified');
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await waitFor(() => { expect(result.current.ready).toBe(true); });
  expect(result.current.binding.fromSequence(2).status).toBe('ambiguous');
  expect(result.current.binding.fromSequence(2, 'A').status).toBe('mapped');
  expect(result.current.binding.fromStructure(mappingAddress).status).toBe('mapped');
});

it('does not spend two reference lookups during StrictMode effect rehearsal', async () => {
  const load = vi.fn().mockResolvedValue(mappingEvidence());
  const { result } = renderHook(() => useResidueMapping({ ...input, load }), { wrapper: StrictMode });
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await waitFor(() => { expect(result.current.ready).toBe(true); });
  expect(load).toHaveBeenCalledOnce();
});

it('closes an old binding on reference replacement before accepting any delayed response', async () => {
  const late = deferred<unknown>();
  const load = vi.fn().mockResolvedValueOnce(mappingEvidence()).mockReturnValueOnce(late.promise);
  const { result, rerender } = renderHook(props => useResidueMapping(props), { initialProps: { ...input, load } });
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await waitFor(() => { expect(result.current.ready).toBe(true); });
  const old = result.current.binding;
  rerender({ ...input, reference: { ...mappingReference, sequence: 'ACDEFA' }, load });
  expect(result.current.ready).toBe(false); expect(old.fromStructure(mappingAddress).status).toBe('unverified');
  await act(async () => { late.resolve(mappingEvidence()); await late.promise; });
  await waitFor(() => { expect(result.current.reason).toBe('stale'); });
  expect(result.current.binding.fromSequence(2, 'A').status).toBe('unverified');
});

it('aborts superseded requests and ignores their late answers after token/PDB replacement', async () => {
  const late = deferred<unknown>(); const load = vi.fn().mockReturnValueOnce(late.promise).mockResolvedValue(mappingEvidence());
  const { result, rerender, unmount } = renderHook(props => useResidueMapping(props), { initialProps: { ...input, load } });
  await waitFor(() => { expect(load).toHaveBeenCalledOnce(); });
  const signal = load.mock.calls[0]?.[2] as AbortSignal;
  rerender({ ...input, token: 'new-token', pdbId: '2XYZ', load });
  expect(signal.aborted).toBe(true);
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await act(async () => { late.resolve(mappingEvidence()); await late.promise; });
  expect(result.current.ready).toBe(false); expect(result.current.reason).toBe('loading');
  unmount(); expect((load.mock.calls[1]?.[2] as AbortSignal).aborted).toBe(true);
});

it('clears ready selections immediately on coordinate loss and can verify a recovered model', async () => {
  const load = vi.fn().mockResolvedValue(mappingEvidence());
  const { result } = renderHook(() => useResidueMapping({ ...input, load }));
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await waitFor(() => { expect(result.current.ready).toBe(true); });
  const old = result.current.binding;
  act(() => { result.current.onUnavailable('1TRZ', 'index'); });
  expect(result.current.reason).toBe('index'); expect(result.current.ready).toBe(false);
  expect(old.fromStructure(mappingAddress).status).toBe('unverified');
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await waitFor(() => { expect(result.current.ready).toBe(true); });
  expect(load).toHaveBeenCalledOnce();
});

it('does not acquire a mapping without identity or a known reference version', () => {
  const load = vi.fn();
  const { result, rerender } = renderHook(props => useResidueMapping(props), { initialProps: { ...input, token: '', load } });
  expect(result.current.reason).toBe('session');
  rerender({ ...input, reference: { ...mappingReference, sequenceVersion: null }, load });
  expect(result.current.reason).toBe('version'); expect(load).not.toHaveBeenCalled();
});

it.each([
  [new ApiError('not-found'), 'missing'], [new ApiError('timeout'), 'timeout'],
  [new ApiError('unavailable'), 'unavailable'], [new ApiError('rate-limit'), 'limit'],
  [new ResidueMappingError('size'), 'size'], [new ResidueMappingError('version'), 'stale'],
])('distinguishes acquisition failures and retries without reacquiring coordinates: %s', async (error, reason) => {
  const load = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(mappingEvidence());
  const { result } = renderHook(() => useResidueMapping({ ...input, load }));
  act(() => { result.current.onReady('1TRZ', mappingCoordinates); });
  await waitFor(() => { expect(result.current.reason).toBe(reason); });
  expect(result.current.ready).toBe(false);
  act(() => { result.current.retry(); });
  await waitFor(() => { expect(result.current.ready).toBe(true); });
  expect(load).toHaveBeenCalledTimes(2);
});
