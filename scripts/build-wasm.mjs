// Builds rust/alignment/pkg. Panic locations embed source paths in the binary, so the Cargo home
// is remapped to a fixed prefix: the package then no longer depends on the user or the runner.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CARGO_PREFIX = '/cargo';
const cargoHome = process.env.CARGO_HOME ?? join(homedir(), '.cargo');
const rustflags = [process.env.RUSTFLAGS, `--remap-path-prefix=${cargoHome}=${CARGO_PREFIX}`].filter(Boolean).join(' ');

const result = spawnSync('wasm-pack', ['build', 'rust/alignment', '--target', 'web', '--out-dir', 'pkg'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, RUSTFLAGS: rustflags },
});
process.exitCode = result.status ?? 1;
