import { readFile } from 'node:fs/promises';
import init, { alignment_contract_version } from '../rust/alignment/pkg/proteinforge_alignment.js';

await init({ module_or_path: await readFile(new URL('../rust/alignment/pkg/proteinforge_alignment_bg.wasm', import.meta.url)) });
if (alignment_contract_version() !== 1) throw new Error('Unexpected WebAssembly contract version.');
process.stdout.write('WebAssembly module initialized successfully.\n');
