import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5174/alignment');
  const report = await page.evaluate(async () => {
    const source = `
      const { calculateTile, initialBoundary } = await import('/src/features/alignment/tile.ts');
      const { calculateWasmTile, initializeAlignmentWasm } = await import('/src/features/alignment/wasm.ts');
      const { buildResult } = await import('/src/features/alignment/gotoh.ts');
      const started = performance.now();
      await initializeAlignmentWasm();
      const initializationMs = performance.now() - started;
      function run(size, calculate) {
        const first = 'ACDEFGHIKLMNPQRSTVWY'.repeat(Math.ceil(size / 20)).slice(0, size);
        const second = first.slice(0, size / 2) + 'X' + first.slice(size / 2 + 1);
        const trace = new ArrayBuffer((size + 1) ** 2);
        const tiles = Math.ceil(size / 256);
        const results = Array.from({ length: tiles }, () => []);
        let best = { score: 0, i: 0, j: size, state: 0 };
        const start = performance.now();
        for (let diagonal = 0; diagonal < tiles * 2 - 1; diagonal++) {
          for (let r = Math.max(0, diagonal - tiles + 1); r <= Math.min(tiles - 1, diagonal); r++) {
            const c = diagonal - r;
            const row = r * 256, column = c * 256;
            const height = Math.min(256, size - row), width = Math.min(256, size - column);
            const tile = calculate({ row, column, height, width, first, second, matrix: 'BLOSUM62', mode: 'global',
              top: r === 0 ? initialBoundary(width) : results[r - 1][c].bottom,
              left: c === 0 ? initialBoundary(height) : results[r][c - 1].right, trace });
            results[r][c] = tile;
            if (tile.best.score > best.score) best = tile.best;
          }
        }
        const result = buildResult(first, second, 'BLOSUM62', 'global', new Uint8Array(trace), best);
        return { ms: performance.now() - start, result };
      }
      run(256, calculateTile); run(256, calculateWasmTile);
      const measurements = [];
      for (const size of [2000, 5000, 10000]) {
        const typescriptMs = [], wasmMs = [];
        for (let repetition = 0; repetition < 3; repetition++) {
          const ts = run(size, calculateTile), wasm = run(size, calculateWasmTile);
          if (JSON.stringify(ts.result) !== JSON.stringify(wasm.result)) throw new Error('Kernel results differ');
          typescriptMs.push(ts.ms); wasmMs.push(wasm.ms);
        }
        measurements.push({ size, typescriptMs, wasmMs, traceBytes: (size + 1) ** 2 });
      }
      postMessage({ initializationMs, measurements, hardwareConcurrency: navigator.hardwareConcurrency, userAgent: navigator.userAgent });
    `;
    const url = URL.createObjectURL(new Blob([source.replaceAll("from '/", "from 'http://127.0.0.1:5174/")
      .replaceAll("import('/", "import('http://127.0.0.1:5174/")], { type: 'text/javascript' }));
    const worker = new Worker(url, { type: 'module' });
    try {
      return await new Promise((resolve, reject) => {
        worker.onmessage = (event) => resolve(event.data);
        worker.onerror = (event) => reject(new Error(event.message));
      });
    } finally { worker.terminate(); URL.revokeObjectURL(url); }
  });
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/alignment-benchmark.json', JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally { await browser.close(); await server.close(); }
