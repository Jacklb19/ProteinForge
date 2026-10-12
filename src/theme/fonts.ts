import provenance from '../../public/fonts/provenance.json';

/** Self-hosted font file described in `public/fonts/provenance.json`, the single source for font files. */
export interface FontFile {
  file: string;
  family: string;
  weight: number;
  role: 'interface' | 'sequence' | 'display';
  preload: boolean;
  bytes: number;
  sha256: string;
}

export const FONT_BASE_PATH = '/fonts/';
export const FONT_FILES = provenance.files as FontFile[];

export function fontUrl(font: Pick<FontFile, 'file'>): string {
  return `${FONT_BASE_PATH}${font.file}`;
}

/** Regular interface face; the chart worker registers it because workers do not see document fonts. */
export const CHART_FONT = FONT_FILES.find((font) => font.role === 'interface' && font.weight === 400);
