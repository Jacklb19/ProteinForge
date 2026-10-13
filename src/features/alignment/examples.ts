import { useCallback, useEffect, useRef, useState } from 'react';
import { REFERENCE_CATALOG } from '../library/catalog';
import { useAlignmentDraft } from './alignmentDraft';
import type { AlignmentDraftState, AlignmentInput } from './alignmentDraft';
import { DEFAULT_MATRIX, DEFAULT_MODE, EXAMPLE_ALIGNMENT_ACCESSIONS } from './config';
import type { AlignmentResult } from './gotoh';
import { useAlignmentWorker } from './useAlignmentWorker';

function referenceSequence(accession: string): string {
  const reference = REFERENCE_CATALOG.find((entry) => entry.accession === accession);
  if (!reference) throw new Error(`Missing bundled reference ${accession}`);
  return reference.sequence;
}

/** The comparison every visitor starts with: two real, closely related references. */
export const EXAMPLE_ALIGNMENT_INPUT: AlignmentInput = {
  first: referenceSequence(EXAMPLE_ALIGNMENT_ACCESSIONS.first),
  second: referenceSequence(EXAMPLE_ALIGNMENT_ACCESSIONS.second),
  matrix: DEFAULT_MATRIX,
  mode: DEFAULT_MODE,
};

export const EXAMPLE_ALIGNMENT_DRAFT: AlignmentDraftState = { ...EXAMPLE_ALIGNMENT_INPUT, result: null, resultInput: null, warnings: [] };

/** True while the draft still holds the untouched example inputs. */
export function isExampleInput(input: AlignmentInput): boolean {
  return input.first === EXAMPLE_ALIGNMENT_INPUT.first && input.second === EXAMPLE_ALIGNMENT_INPUT.second
    && input.matrix === EXAMPLE_ALIGNMENT_INPUT.matrix && input.mode === EXAMPLE_ALIGNMENT_INPUT.mode;
}

/** Bundled reference whose sequence is exactly this one, if any. */
export function referenceFor(sequence: string): (typeof REFERENCE_CATALOG)[number] | undefined {
  return sequence ? REFERENCE_CATALOG.find((entry) => entry.sequence === sequence) : undefined;
}

/**
 * Result of the example comparison, computed by the real alignment worker.
 * When the visitor has not changed the comparison draft, the result is shared with it so Alinear opens ready.
 */
export function useExampleAlignment(): AlignmentResult | null {
  const draft = useAlignmentDraft();
  const pristine = isExampleInput(draft);
  const shared = pristine && draft.resultInput && isExampleInput(draft.resultInput) ? draft.result : null;
  const [own, setOwn] = useState<AlignmentResult | null>(null);
  const share = useRef({ pristine, update: draft.update });
  useEffect(() => { share.current = { pristine, update: draft.update }; }, [pristine, draft.update]);
  const receive = useCallback((result: AlignmentResult, input: AlignmentInput) => {
    setOwn(result);
    if (share.current.pristine) share.current.update({ result, resultInput: input });
  }, []);
  const { start } = useAlignmentWorker(receive);
  const needed = shared === null && own === null;
  useEffect(() => { if (needed) start(EXAMPLE_ALIGNMENT_INPUT); }, [needed, start]);
  return shared ?? own;
}
