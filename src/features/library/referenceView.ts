import type { SequenceSource } from '../editor/source';
import type { PdbReference, UniProtEntry } from './libraryApi';

/** Public reference and transient selection only; never stored in a workspace or localStorage. */
export interface ReferenceView {
  source: SequenceSource;
  entry: UniProtEntry | null;
  structures: readonly PdbReference[];
  pdbId: string;
  position: number | null;
  chain: string | null;
}

export function isCurrentReference(view: ReferenceView | null, text: string, source: SequenceSource | null): view is ReferenceView {
  return view !== null && source !== null && text === source.sequence && view.source.sequence === text
    && view.source.accession === source.accession && view.source.sequenceVersion === source.sequenceVersion;
}
