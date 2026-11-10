import type { TranslationKey } from '../i18n';
import { NAVIGATION_ITEMS, ROUTES } from '../shared/navigation';

/** With Ctrl (or ⌘ on a Mac) this key opens the palette from any tool. */
export const PALETTE_KEY = 'k';
export const PALETTE_ID = 'command-palette';
/** Projects offered at once; typing narrows them. */
export const PALETTE_MAX_PROJECTS = 8;
/** Every destination of the laboratory, in sidebar order, then the two that sit at its foot. */
export const PALETTE_DESTINATIONS: readonly { path: string; labelKey: TranslationKey }[] = [
  ...NAVIGATION_ITEMS.map(({ path, labelKey }) => ({ path, labelKey })),
  { path: ROUTES.guide, labelKey: 'nav.guide' },
  { path: ROUTES.profile, labelKey: 'nav.profile' },
];

export interface PaletteEntry { id: string; kind: 'destination' | 'project'; label: string; path: string }

/** Case and accents do not matter when matching: «analisis» finds «Análisis». */
const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Destinations first, then projects, each kept when its name contains what was typed. */
export function paletteEntries(query: string, destinations: readonly { path: string; label: string }[], projects: readonly { id: string; name: string }[]): PaletteEntry[] {
  const wanted = fold(query);
  const matches = (label: string): boolean => !wanted || fold(label).includes(wanted);
  return [
    ...destinations.filter(item => matches(item.label)).map((item): PaletteEntry => ({ id: `destination-${item.path}`, kind: 'destination', label: item.label, path: item.path })),
    ...projects.filter(item => matches(item.name)).slice(0, PALETTE_MAX_PROJECTS).map((item): PaletteEntry => ({ id: `project-${item.id}`, kind: 'project', label: item.name, path: ROUTES.projects })),
  ];
}
