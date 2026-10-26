import { useEffect, useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MappedStructure } from './MappedStructure';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { mappingAddress, mappingCoordinates, mappingEvidence, mappingReference } from '../../test/residueMappingFixture';
import type StructureViewer from './StructureViewer';
import type { ComponentProps } from 'react';
import { spanish } from '../../i18n/es';
import { ApiError } from '../api/apiClient';
import type { MappingLoader } from './mappingTypes';

type ViewerProps = ComponentProps<typeof StructureViewer>;
const viewer = vi.hoisted(() => ({ current: null as ViewerProps | null, mounts: 0 }));
vi.mock('./StructureViewer', () => ({ default: function MockViewer(props: ViewerProps) {
  viewer.current = props;
  const ready = props.residueSelection?.onReady; const pdbId = props.pdbId;
  useEffect(() => { viewer.mounts += 1; ready?.(pdbId, mappingCoordinates); }, [ready, pdbId]);
  return <output data-testid="coordinate-selection">{props.residueSelection?.selected?.labelAsymId ?? 'empty'}</output>;
} }));
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); viewer.mounts = 0; viewer.current = null; });
afterEach(() => { vi.unstubAllGlobals(); });

function Panel({ load }: { load: MappingLoader }) {
  const [position, setPosition] = useState<number | null>(2); const [chain, setChain] = useState<string | null>(null);
  return <MemoryRouter><AuthContext.Provider value={signedInFixture}><MappedStructure reference={mappingReference} structures={[{ id: '1TRZ', method: 'X-ray', resolution: null, chains: null }]} pdbId="1TRZ" position={position} chain={chain} onStructure={() => undefined}
    onSelect={(next, nextChain) => { setPosition(next); setChain(nextChain); }} mappingLoader={load} /></AuthContext.Provider></MemoryRouter>;
}

it('requires an explicit chain for ambiguous copies and reports actual structure picks', async () => {
  const user = userEvent.setup(); render(<Panel load={vi.fn().mockResolvedValue(mappingEvidence())} />);
  await waitFor(() => { expect(document.querySelector('[data-mapping-state=ambiguous]')).toBeInTheDocument(); });
  expect(screen.getByTestId('coordinate-selection')).toHaveTextContent('empty');
  await user.selectOptions(screen.getByLabelText(spanish['mapping.chain']), 'B');
  expect(screen.getByTestId('coordinate-selection')).toHaveTextContent('B');
  expect(document.querySelector('[data-mapping-state=mapped]')).toHaveTextContent('author-B:-2B');
  act(() => { viewer.current?.residueSelection?.onSelect('1TRZ', mappingAddress); });
  expect(screen.getByLabelText(spanish['mapping.chain'])).toHaveValue('A');
  expect(screen.getByTestId('coordinate-selection')).toHaveTextContent('A');
  expect(screen.getByLabelText(spanish['mapping.position'])).toHaveValue(2);
  expect(viewer.mounts).toBe(1);
});

it('clears the 3D highlight for uncovered positions and preserves unobserved correspondence explicitly', async () => {
  const user = userEvent.setup(); render(<Panel load={vi.fn().mockResolvedValue(mappingEvidence())} />);
  await waitFor(() => { expect(screen.getByLabelText(spanish['mapping.chain'])).toBeEnabled(); });
  await user.selectOptions(screen.getByLabelText(spanish['mapping.chain']), 'A');
  await user.clear(screen.getByLabelText(spanish['mapping.position']));
  await user.type(screen.getByLabelText(spanish['mapping.position']), '3');
  expect(document.querySelector('[data-mapping-state=unobserved]')).toBeInTheDocument();
  expect(screen.getByTestId('coordinate-selection')).toHaveTextContent('empty');
  await user.clear(screen.getByLabelText(spanish['mapping.position']));
  await user.type(screen.getByLabelText(spanish['mapping.position']), '6');
  expect(document.querySelector('[data-mapping-state=unmapped]')).toBeInTheDocument();
  expect(screen.getByTestId('coordinate-selection')).toHaveTextContent('empty');
});

it('retries a failed mapping without remounting the model or losing its camera', async () => {
  const user = userEvent.setup(); const load = vi.fn().mockRejectedValueOnce(new ApiError('timeout')).mockResolvedValueOnce(mappingEvidence());
  render(<Panel load={load} />);
  await waitFor(() => { expect(document.querySelector('[data-mapping-state=timeout]')).toBeInTheDocument(); });
  await screen.findByTestId('coordinate-selection');
  expect(screen.getByLabelText(spanish['mapping.chain'])).toBeDisabled();
  await user.click(screen.getByRole('button', { name: spanish['mapping.retry'] }));
  await waitFor(() => { expect(document.querySelector('[data-mapping-state=ambiguous]')).toBeInTheDocument(); });
  expect(viewer.mounts).toBe(1); expect(load).toHaveBeenCalledTimes(2);
});
