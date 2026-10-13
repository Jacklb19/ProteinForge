import type { TranslationKey } from '../../i18n';

/** How the backbone is colored; the order is the display order. */
export const COLOR_MODES = ['chemistry', 'hydropathy', 'chain'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];
export const DEFAULT_COLOR_MODE: ColorMode = 'chemistry';

export const COLOR_MODE_LABEL_KEYS = {
  chemistry: 'structure.modeChemistry',
  hydropathy: 'structure.modeHydropathy',
  chain: 'structure.modeChain',
} as const satisfies Record<ColorMode, TranslationKey>;

/** Starting orientation in radians, chosen so both chains and the three bridges are visible. */
export const INITIAL_YAW = 0.5;
export const INITIAL_PITCH = 0.2;

/** Radians turned per pixel dragged and per arrow key press; pitch stays within its limit. */
export const DRAG_RADIANS_PER_PIXEL = 0.01;
export const KEY_STEP_RADIANS = Math.PI / 18;
export const PITCH_LIMIT = Math.PI / 2;

/** Idle turn before the first interaction, in radians per second. Disabled with reduced motion. */
export const IDLE_RADIANS_PER_SECOND = 0.12;

/** Catmull–Rom subdivisions between consecutive Cα atoms. */
export const SPLINE_STEPS = 10;

/** Longest S–S distance, in ångström, drawn as a disulfide bridge. */
export const DISULFIDE_MAX_DISTANCE = 2.6;

/** Tube width as a fraction of the smaller canvas side, and its minimum in CSS pixels. */
export const TUBE_WIDTH_RATIO = 1 / 34;
export const TUBE_MIN_WIDTH = 5;
export const BRIDGE_WIDTH_FACTOR = 0.42;
export const SULFUR_WIDTH_FACTOR = 0.75;

/** Depth cues: far segments are thinner and fade towards the stage color. */
export const DEPTH_WIDTH_BASE = 0.72;
export const DEPTH_WIDTH_GAIN = 0.5;
export const DEPTH_FOG = 0.5;
export const OUTLINE_MIX = 0.55;
export const OUTLINE_EXTRA_WIDTH = 2.4;
export const SHEEN_MIX = 0.55;
export const SHEEN_WIDTH_FACTOR = 0.26;
export const SHEEN_OFFSET_X = 0.14;
export const SHEEN_OFFSET_Y = 0.22;

/** Free space kept around the molecule, in CSS pixels, and how far its bounding sphere may exceed it. */
export const STAGE_PADDING = 28;
export const STAGE_FIT = 1.3;

/** A pointer closer than this many tube widths to a Cα selects its residue. */
export const PICK_RADIUS_FACTOR = 1.6;
export const SELECTION_RADIUS_FACTOR = 1.15;
export const SELECTION_LINE_WIDTH = 2;
export const LABEL_FONT_SIZE = 12;
export const LABEL_PADDING = 4;
export const LABEL_OPACITY = 0.86;

/** Kyte–Doolittle extreme used to scale the hydropathy coloring. */
export const HYDROPATHY_EXTREME = 4.5;

/** Pointer travel, in CSS pixels, that turns a press into a drag instead of a selection. */
export const DRAG_THRESHOLD_PX = 4;
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
