import type { ProfilePoint, HydropathyWindow } from './profile';
import type { ResiduePropensity } from './chouFasman';

/** Visual values read from design tokens on the main thread. */
export interface ChartStyle {
  locale: 'es' | 'en';
  surface: string;
  text: string;
  curve: string;
  reference: string;
  font: string;
  margin: number;
  lineWidth: number;
  referenceWidth: number;
}

/** Configuration and calculation sent to the profile worker. */
export type ProfileRequest =
  | { type: 'initialize'; canvas: OffscreenCanvas; style: ChartStyle }
  | {
    type: 'calculate';
    id: number;
    sequence: string;
    windowSize: HydropathyWindow;
    width: number;
    height: number;
    scale: number;
    style: ChartStyle;
  };

/** Returns the full profile to the main thread for the accessible table. */
export type ProfileResponse =
  | { id: number; points: ProfilePoint[]; propensities: ResiduePropensity[]; error?: never }
  | { id: number; error: string; points?: never; propensities?: never };
