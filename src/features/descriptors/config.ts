import type { TranslationKey } from '../../i18n';
import type { Descriptors } from './descriptors';

/** Kyte–Doolittle windows offered to the user; the order is the display order. */
export const HYDROPATHY_WINDOWS = [9, 19] as const;
export type HydropathyWindow = (typeof HYDROPATHY_WINDOWS)[number];
export const DEFAULT_HYDROPATHY_WINDOW: HydropathyWindow = 9;

/** What each window size is commonly used to reveal, per Kyte and Doolittle (1982). */
export const WINDOW_PURPOSE_KEYS: Record<HydropathyWindow, TranslationKey> = {
  9: 'profile.window9Purpose',
  19: 'profile.window19Purpose',
};

/** Reference lines drawn on the profile: the zero line and the 19-window transmembrane threshold. */
export const PROFILE_REFERENCE_LINES: Record<HydropathyWindow, readonly number[]> = {
  9: [0],
  19: [0, 1.6],
};

/** Minimum vertical half-range of the profile, so flat profiles keep a readable scale. */
export const PROFILE_MINIMUM_HALF_RANGE = 0.5;

/** Axis labels show the plotted extremes with one decimal. */
export const PROFILE_AXIS_FORMAT = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;

export const PROFILE_ROWS_PER_PAGE = 50;
export const PROFILE_VALUE_FORMAT = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;

/** Published Chou–Fasman parameter tables used for the propensities (ExPASy ProtScale). */
export const METHOD_REFERENCES: readonly { labelKey: TranslationKey; url: string }[] = [
  { labelKey: 'profile.helixLink', url: 'https://web.expasy.org/protscale/pscale/alpha-helixFasman.html' },
  { labelKey: 'profile.sheetLink', url: 'https://web.expasy.org/protscale/pscale/beta-sheetFasman.html' },
  { labelKey: 'profile.turnLink', url: 'https://web.expasy.org/protscale/pscale/beta-turnFasman.html' },
];

/** Residues per numbered block in the residue reader, as in UniProt and ProtParam. */
export const RESIDUES_PER_BLOCK = 10;
/** Lines rendered beyond the reader viewport. */
export const READER_OVERSCAN_LINES = 3;

const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;
const THREE_DECIMALS = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;

/** Descriptor rows in display order, with their method reference and number format. */
export const DESCRIPTOR_FIELDS: readonly {
  key: keyof Descriptors;
  labelKey: TranslationKey;
  methodKey: TranslationKey;
  helpKey: TranslationKey;
  unitKey?: TranslationKey;
  format: Intl.NumberFormatOptions;
}[] = [
  { key: 'massDa', labelKey: 'descriptors.mass', methodKey: 'descriptors.massMethod', helpKey: 'guide.mass', unitKey: 'units.dalton', format: TWO_DECIMALS },
  { key: 'isoelectricPoint', labelKey: 'descriptors.isoelectricPoint', methodKey: 'descriptors.isoelectricPointMethod', helpKey: 'guide.pi', format: TWO_DECIMALS },
  { key: 'instabilityIndex', labelKey: 'descriptors.instabilityIndex', methodKey: 'descriptors.instabilityIndexMethod', helpKey: 'guide.instability', format: TWO_DECIMALS },
  { key: 'aliphaticIndex', labelKey: 'descriptors.aliphaticIndex', methodKey: 'descriptors.aliphaticIndexMethod', helpKey: 'guide.aliphatic', format: TWO_DECIMALS },
  { key: 'gravy', labelKey: 'descriptors.gravy', methodKey: 'descriptors.gravyMethod', helpKey: 'guide.gravy', format: THREE_DECIMALS },
];

/** Static profile sketch: viewBox height, inner inset and spacing of the position labels. */
export const SKETCH_HEIGHT_UNITS = 100;
export const SKETCH_INSET_UNITS = 5;
export const SKETCH_POSITION_STEP = 10;

/** Chou–Fasman propensity range mapped onto the opacity of the tendency strips. */
export const PROPENSITY_STRIP_FLOOR = 0.55;
export const PROPENSITY_STRIP_SPAN = 1;
export const STRIP_MINIMUM_OPACITY = 0.08;
