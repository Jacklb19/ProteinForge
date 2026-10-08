import type { TranslationKey } from '../../i18n';
import type { IconName } from '../../shared/Icon';
import { ROUTES } from '../../shared/navigation';
import { EXAMPLE_SEQUENCES } from '../editor/config';
import { DEFAULT_HYDROPATHY_WINDOW } from '../descriptors/config';

/** Delivery state shown on each tool card; only `available` tools link anywhere. */
export type ToolStatus = 'available' | 'preparing' | 'planned';

export const TOOL_STATUS_LABEL_KEYS = {
  available: 'landing.statusAvailable',
  preparing: 'landing.statusPreparing',
  planned: 'landing.statusPlanned',
} as const satisfies Record<ToolStatus, TranslationKey>;

/** Tool cards in display order; statuses follow the current definition of the project. */
export const LANDING_TOOLS: readonly {
  id: string;
  icon: IconName;
  titleKey: TranslationKey;
  textKey: TranslationKey;
  status: ToolStatus;
  path?: string;
}[] = [
  { id: 'analyze', icon: 'sequence', titleKey: 'landing.toolAnalyzeTitle', textKey: 'landing.toolAnalyzeText', status: 'available', path: ROUTES.analyze },
  { id: 'align', icon: 'alignment', titleKey: 'landing.toolAlignTitle', textKey: 'landing.toolAlignText', status: 'available', path: ROUTES.alignment },
  { id: 'projects', icon: 'grid', titleKey: 'landing.toolProjectsTitle', textKey: 'landing.toolProjectsText', status: 'preparing' },
  { id: 'generate', icon: 'spark', titleKey: 'landing.toolGenerateTitle', textKey: 'landing.toolGenerateText', status: 'planned' },
  { id: 'structure', icon: 'cube', titleKey: 'landing.toolStructureTitle', textKey: 'landing.toolStructureText', status: 'planned' },
  { id: 'report', icon: 'book', titleKey: 'landing.toolReportTitle', textKey: 'landing.toolReportText', status: 'planned' },
];

/** The recorrido really happens in this order, so the steps are numbered. */
export const LANDING_STEPS: readonly { titleKey: TranslationKey; textKey: TranslationKey; icon: IconName }[] = [
  { titleKey: 'landing.flowStep1Title', textKey: 'landing.flowStep1Text', icon: 'upload' },
  { titleKey: 'landing.flowStep2Title', textKey: 'landing.flowStep2Text', icon: 'flask' },
  { titleKey: 'landing.flowStep3Title', textKey: 'landing.flowStep3Text', icon: 'alignment' },
];

export const LANDING_HONESTY_KEYS: readonly TranslationKey[] = ['landing.honestyText1', 'landing.honestyText2', 'landing.honestyText3'];

/** The hero draws the first bundled example with the default window; nothing is invented. */
export const HERO_EXAMPLE = EXAMPLE_SEQUENCES[0];
export const HERO_WINDOW = DEFAULT_HYDROPATHY_WINDOW;

/** Drawing box of the hero profile in SVG units; the element scales to its container. */
export const HERO_BOX = { width: 640, height: 320, paddingX: 28, paddingY: 36 } as const;
export const HERO_BEAD_RADIUS = 4.5;

/** Ideal α-helix (Pauling and Corey, 1951): 3.6 residues per turn, 1.5 Å rise, 2.3 Å Cα radius, i → i + 4 hydrogen bonds. */
export const HELIX_GEOMETRY = {
  residues: 28,
  radiusAngstrom: 2.3,
  risePerResidueAngstrom: 1.5,
  degreesPerResidue: 100,
  hydrogenBondOffset: 4,
} as const;

/** Rendering of the helix scene in CSS pixels and turns per second; motion stops with reduced motion. */
export const HELIX_SCENE = {
  rotationPerSecond: 0.08,
  restRotation: 0.6,
  tilt: 0.7,
  perspective: 90,
  viewAngstrom: 42,
  atomRadius: 6.5,
  atomStroke: 1.5,
  backboneWidth: 4,
  bondWidth: 1,
  bondDash: [3, 4],
  bondOpacity: 0.7,
} as const;
