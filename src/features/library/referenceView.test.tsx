import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SequenceDraftProvider } from '../editor/SequenceDraftProvider';
import { useSequenceDraft } from '../editor/sequenceDraft';
import { isCurrentReference } from './referenceView';
import type { ReferenceView } from './referenceView';
import { mappingReference } from '../../test/residueMappingFixture';

const view: ReferenceView = { source: mappingReference, entry: null, structures: [], pdbId: '1TRZ', position: 2, chain: 'A' };
it('keeps a reference view only for an exact source and clears it on all draft/source replacements', () => {
  const { result } = renderHook(useSequenceDraft, { wrapper: ({ children }) => <SequenceDraftProvider initial={{ text: mappingReference.sequence, source: mappingReference }}>{children}</SequenceDraftProvider> });
  act(() => { result.current.setReferenceView(view); });
  expect(isCurrentReference(result.current.referenceView, result.current.text, result.current.source)).toBe(true);
  expect(isCurrentReference(view, mappingReference.sequence, { ...mappingReference, sequenceVersion: 2 })).toBe(false);
  expect(isCurrentReference(view, mappingReference.sequence + 'A', mappingReference)).toBe(false);
  act(() => { result.current.setText(mappingReference.sequence + 'A'); });
  expect(result.current.referenceView).toBeNull(); expect(result.current.source).toBeNull();
  act(() => { result.current.setText(mappingReference.sequence); result.current.setSource(mappingReference); result.current.setReferenceView(view); });
  act(() => { result.current.setSource(mappingReference); });
  expect(result.current.referenceView).toBeNull();
});
