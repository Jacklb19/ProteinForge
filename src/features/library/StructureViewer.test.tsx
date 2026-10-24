import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StructureViewer from './StructureViewer';
import type { CoordinateResidue } from './residueMapping';
import { spanish } from '../../i18n/es';

const mocks = vi.hoisted(() => {
  const address = { entityId: '1', labelAsymId: 'A', authAsymId: 'A', labelSeqId: 1, authSeqId: '1', insertionCode: '', modelNum: 1 };
  const clicks = new Set<(event: { current: { loci: unknown } }) => void>();
  const highlightOnly = vi.fn();
  const dispose = vi.fn();
  const index = { pdbId: '1TRZ', coordinates: [address], lociFor: vi.fn((residue: unknown) => ({ residue })) };
  return { address, clicks, highlightOnly, dispose, index, ready: vi.fn(), pick: vi.fn(), indexStructureResidues: vi.fn(() => index), residueFromLoci: vi.fn(() => address as CoordinateResidue | null) };
});

vi.mock('./structureResidues', () => ({ indexStructureResidues: mocks.indexStructureResidues, residueFromLoci: mocks.residueFromLoci }));
vi.mock('./molstarRuntime', () => ({
  Color: { fromHexStyle: () => 0 }, DefaultPluginSpec: () => ({}),
  indexStructureResidues: mocks.indexStructureResidues, residueFromLoci: mocks.residueFromLoci,
  PluginContext: class {
    init = () => Promise.resolve();
    initViewerAsync = () => Promise.resolve(true);
    dispose = mocks.dispose;
    managers = { interactivity: { lociHighlights: { highlightOnly: mocks.highlightOnly } } };
    canvas3d = { setProps: vi.fn(), requestCameraReset: vi.fn(), requestResize: vi.fn(), pause: vi.fn(), resume: vi.fn() };
    behaviors = { interaction: { click: { subscribe: (callback: (event: { current: { loci: unknown } }) => void) => {
      mocks.clicks.add(callback); return { unsubscribe: () => { mocks.clicks.delete(callback); } };
    } } } };
    builders = {
      data: { rawData: () => Promise.resolve({}) },
      structure: {
        parseTrajectory: () => Promise.resolve({}), createModel: () => Promise.resolve({}),
        createStructure: () => Promise.resolve({ obj: { data: {} } }),
        tryCreateComponentStatic: () => Promise.resolve({}), representation: { addRepresentation: () => Promise.resolve({}) },
      },
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks(); mocks.clicks.clear();
  mocks.index.pdbId = '1TRZ';
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) })));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });
const bridge = (selected: CoordinateResidue | null = mocks.address) => ({ pdbId: '1TRZ', selected, onReady: mocks.ready, onSelect: mocks.pick });

it('leaves the existing viewer unchanged when no selection bridge is supplied', async () => {
  const view = render(<StructureViewer pdbId="1TRZ" />);
  await waitFor(() => { expect(view.container.querySelector('[role=status]')).toHaveTextContent(spanish['library.viewerReady']); });
  expect(mocks.indexStructureResidues).not.toHaveBeenCalled();
  expect(mocks.clicks.size).toBe(0);
  view.unmount(); expect(mocks.dispose).toHaveBeenCalledOnce();
});

it('publishes actual addresses, highlights incoming selection and reports picks without reloading coordinates', async () => {
  const view = render(<StructureViewer pdbId="1TRZ" residueSelection={bridge()} />);
  await waitFor(() => { expect(mocks.ready).toHaveBeenCalledWith('1TRZ', [mocks.address]); });
  await waitFor(() => { expect(mocks.highlightOnly).toHaveBeenLastCalledWith({ loci: { residue: mocks.address } }, false); });
  act(() => { for (const callback of mocks.clicks) callback({ current: { loci: { picked: true } } }); });
  expect(mocks.pick).toHaveBeenCalledWith('1TRZ', mocks.address);
  view.rerender(<StructureViewer pdbId="1TRZ" residueSelection={bridge(null)} />);
  await waitFor(() => { expect(mocks.highlightOnly).toHaveBeenLastCalledWith({ loci: { residue: null } }, false); });
  expect(fetch).toHaveBeenCalledOnce();
  view.unmount(); expect(mocks.clicks.size).toBe(0); expect(mocks.dispose).toHaveBeenCalledOnce();
});

it('uses the latest callback and does not retain a subscription across structures or after unmount', async () => {
  const view = render(<StructureViewer pdbId="1TRZ" residueSelection={bridge()} />);
  await waitFor(() => { expect(mocks.clicks.size).toBe(1); });
  const onSelect = vi.fn();
  view.rerender(<StructureViewer pdbId="1TRZ" residueSelection={{ ...bridge(), onSelect }} />);
  act(() => { for (const callback of mocks.clicks) callback({ current: { loci: {} } }); });
  expect(onSelect).toHaveBeenCalledWith('1TRZ', mocks.address); expect(mocks.pick).not.toHaveBeenCalled();
  mocks.index.pdbId = '2XYZ';
  view.rerender(<StructureViewer pdbId="2XYZ" residueSelection={bridge(null)} />);
  await waitFor(() => { expect(mocks.ready).toHaveBeenCalledWith('2XYZ', [mocks.address]); });
  await waitFor(() => { expect(mocks.index.lociFor).toHaveBeenLastCalledWith(null); });
  expect(mocks.clicks.size).toBe(1);
  view.unmount(); expect(mocks.clicks.size).toBe(0);
});

it('rejects coordinates for another PDB entry before publishing a selectable address', async () => {
  mocks.index.pdbId = '2XYZ';
  const view = render(<StructureViewer pdbId="1TRZ" residueSelection={bridge()} />);
  await waitFor(() => { expect(view.container.querySelector('[role=status]')).toHaveTextContent(spanish['library.viewerError']); });
  expect(mocks.ready).not.toHaveBeenCalled(); expect(mocks.clicks.size).toBe(0);
});
