/** A portable, locale-independent CSV of the current descriptor calculation. */
export const DESCRIPTOR_REPORT_FILENAME = 'proteinforge-properties.csv';
export const CSV_SEPARATOR = ',';
export const CSV_LINE_ENDING = '\r\n';
export const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
export const REPORT_SCHEMA_VERSION = 1;
export const REPORT_TIMEOUT_MS = 20_000;
export const REPORT_FILENAMES = { pdf: 'proteinforge-report.pdf', json: 'proteinforge-report.json', profile: 'proteinforge-profile.csv', alignment: 'proteinforge-alignment.csv' } as const;
export const REPORT_METHOD_LINKS = [
  'https://web.expasy.org/protparam/',
  'https://web.expasy.org/protscale/pscale/Hphob.Doolittle.html',
  'https://web.expasy.org/protscale/pscale/alpha-helixFasman.html',
  'https://web.expasy.org/protscale/pscale/beta-sheetFasman.html',
  'https://web.expasy.org/protscale/pscale/beta-turnFasman.html',
  'https://www.bioinformatics.nl/cgi-bin/emboss/help/needle',
] as const;
/** A4 in millimetres. Basic PDF text uses standard embedded metrics; UI fonts remain local. */
export const PDF_LAYOUT = { width: 210, height: 297, margin: 18, bottom: 278, line: 5, gap: 7, title: 24, section: 14, body: 10, mono: 8, small: 8, graphHeight: 42, graphMaxPoints: 600, sequenceColumns: 70, alignmentColumns: 60, accent: '#12615f', ink: '#121826', muted: '#525e62', border: '#dce4df' } as const;
