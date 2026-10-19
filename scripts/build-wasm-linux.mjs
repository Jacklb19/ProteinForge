// Builds the committed WebAssembly package inside Linux, as CI does. A Windows build writes
// source paths with backslashes into the binary, so its bytes never match the CI rebuild.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const IMAGE = 'node:24';
const RUST_TOOLCHAIN = '1.91.1';
const WASM_PACK = '0.15.0';
const steps = [
  'curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none',
  '. "$HOME/.cargo/env"',
  `rustup toolchain install ${RUST_TOOLCHAIN} --profile minimal --component rustfmt --target wasm32-unknown-unknown`,
  `cargo install wasm-pack --locked --version ${WASM_PACK}`,
  'node scripts/build-wasm.mjs',
  'node scripts/verify-wasm.mjs',
].join(' && ');

const result = spawnSync('docker', [
  'run', '--rm', '-v', `${process.cwd()}:/work`, '-w', '/work', '-e', 'CARGO_TARGET_DIR=/tmp/target', IMAGE, 'bash', '-c', steps,
], { stdio: 'inherit' });
// wasm-pack writes a .gitignore that would hide the package from Git.
rmSync('rust/alignment/pkg/.gitignore', { force: true });
process.exitCode = result.status ?? 1;
