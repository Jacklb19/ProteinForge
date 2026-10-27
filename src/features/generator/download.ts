import { GENERATOR_CONFIG } from './config';

/** Saves exactly this text as the generator's JSON file; nothing is reformatted. */
export function downloadSearch(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = GENERATOR_CONFIG.filename; link.click();
  setTimeout(() => { URL.revokeObjectURL(url); }, GENERATOR_CONFIG.downloadRevokeMs);
}
