import type { TranslationKey } from '../../i18n/translate';
import type { AlignmentParameters } from './gotoh';

/** Substitution matrices offered for protein alignment; the order is the display order. */
export const MATRIX_NAMES = ['BLOSUM45', 'BLOSUM62', 'BLOSUM80'] as const;
export type MatrixName = (typeof MATRIX_NAMES)[number];

/** Alignment modes; global treats terminal gaps as free, local reports the best segment. */
export const ALIGNMENT_MODES = ['global', 'local'] as const;
export type AlignmentMode = (typeof ALIGNMENT_MODES)[number];

export const DEFAULT_MATRIX: MatrixName = 'BLOSUM62';
export const DEFAULT_MODE: AlignmentMode = 'global';

/** Affine gap costs: opening plus extension per additional residue. */
export const GAP_OPEN = 10;
export const GAP_EXTEND = 0.5;

/** Text format of aligned columns: gap character and conservation marks (EMBOSS convention). */
export const GAP_CHARACTER = '-';
export const ALIGNMENT_MARKS = { identical: '|', similar: ':', none: ' ' } as const;

/** Tile edge for the parallel wavefront and the public length limit per sequence. */
export const TILE_SIZE = 256;
export const MAX_ALIGNMENT_RESIDUES = 5000;

/** Columns per rendered alignment block and blocks rendered beyond the viewport. */
export const BLOCK_COLUMNS = 60;
export const BLOCK_OVERSCAN = 2;

/** Used only until the block height token and the viewport are measured. */
export const FALLBACK_BLOCK_HEIGHT_PX = 112;
export const FALLBACK_VIEWPORT_HEIGHT_PX = 360;

export const PERCENT_FORMAT = { style: 'percent', maximumFractionDigits: 1 } as const;
export const PROGRESS_FORMAT = { style: 'percent', maximumFractionDigits: 0 } as const;

/** Residues whose scoring is substituted, with the warning shown to the user. */
export const SCORING_SUBSTITUTIONS = [
  { residue: 'U', warningKey: 'alignment.warningU' },
  { residue: 'O', warningKey: 'alignment.warningO' },
] as const;

/** Translation keys for the mode names. */
export const MODE_LABEL_KEYS = {
  global: 'alignment.global',
  local: 'alignment.local',
} as const satisfies Record<AlignmentMode, TranslationKey>;

/** Translation keys describing how terminal gaps were scored. */
export const TERMINAL_GAP_LABEL_KEYS = {
  free: 'alignment.freeEnds',
  'not-applicable': 'alignment.localEnds',
} as const satisfies Record<AlignmentParameters['terminalGaps'], TranslationKey>;
