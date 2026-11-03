import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORT_FILENAMES } from '../config';
import { REPORT_CONTENT_TYPES, REPORT_FORMAT_KINDS, REPORT_KIND_FORMATS, REPORT_LIST_PAGE_SIZE, REPORT_STORAGE_LIMITS, STORED_REPORT_KINDS } from './config';
import { readReportStorageEnabled } from './reportStorageFeature';

// The backend is a sibling checkout locally; continuous integration of this repository has only the
// generated contract, which states the per-file bound in its comments.
const backendConfig = resolve('../backend/app/report_config.py');
const generated = resolve('src/gen/proteinforge/report/v1/report_service_pb.ts');
const pythonNumber = (source: string, name: string): number => {
  const match = new RegExp(`^${name} = ([\\d_]+)$`, 'm').exec(source);
  if (!match?.[1]) throw new Error(`Missing ${name}`);
  return Number(match[1].replaceAll('_', ''));
};

describe('report storage configuration', () => {
  it.skipIf(!existsSync(backendConfig))('matches the limits, kinds, content types and file names of the backend', () => {
    const source = readFileSync(backendConfig, 'utf8');
    expect(REPORT_STORAGE_LIMITS).toEqual({
      maxReportBytes: pythonNumber(source, 'MAX_REPORT_BYTES'),
      maxReports: pythonNumber(source, 'MAX_REPORTS_PER_OWNER'),
      maxOwnerBytes: pythonNumber(source, 'MAX_OWNER_REPORT_BYTES'),
    });
    expect(REPORT_LIST_PAGE_SIZE).toBeLessThanOrEqual(pythonNumber(source, 'MAX_REPORT_PAGE_SIZE'));
    for (const kind of STORED_REPORT_KINDS) {
      expect(source).toContain(`"${kind}": ("${REPORT_CONTENT_TYPES[kind]}", "${REPORT_FILENAMES[REPORT_KIND_FORMATS[kind]].split('.').at(-1) ?? ''}", "${REPORT_FILENAMES[REPORT_KIND_FORMATS[kind]]}")`);
    }
  });

  it('keeps the per-file bound of the generated contract and one page for every report', () => {
    expect(readFileSync(generated, 'utf8')).toContain(`1–${REPORT_STORAGE_LIMITS.maxReportBytes.toLocaleString('en-US')} bytes`);
    expect(REPORT_LIST_PAGE_SIZE).toBeGreaterThanOrEqual(REPORT_STORAGE_LIMITS.maxReports);
  });

  it('maps every stored kind to one export format and back; the properties CSV is not stored', () => {
    for (const kind of STORED_REPORT_KINDS) expect(REPORT_FORMAT_KINDS[REPORT_KIND_FORMATS[kind]]).toBe(kind);
    expect(Object.keys(REPORT_FORMAT_KINDS)).toHaveLength(STORED_REPORT_KINDS.length);
  });

  it('stays off unless the build asks for it explicitly', () => {
    expect(readReportStorageEnabled({} as ImportMetaEnv)).toBe(false);
    expect(readReportStorageEnabled({ VITE_REPORT_STORAGE: '' } as ImportMetaEnv)).toBe(false);
    expect(readReportStorageEnabled({ VITE_REPORT_STORAGE: 'true' } as ImportMetaEnv)).toBe(false);
    expect(readReportStorageEnabled({ VITE_REPORT_STORAGE: ' enabled ' } as ImportMetaEnv)).toBe(true);
  });
});
