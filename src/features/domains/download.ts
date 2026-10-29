import { DOMAINS_CONFIG } from './config';

/** Saves exactly this FASTA text; nothing is reformatted. */
export function downloadAssembly(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url; link.download = DOMAINS_CONFIG.filename; link.click();
  setTimeout(() => { URL.revokeObjectURL(url); }, DOMAINS_CONFIG.downloadRevokeMs);
}
