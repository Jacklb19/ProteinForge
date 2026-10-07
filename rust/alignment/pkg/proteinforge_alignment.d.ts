/* tslint:disable */
/* eslint-disable */

/**
 * Owned output: JavaScript copies the trace into a disjoint shared region.
 */
export class TileOutput {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    best(): Float32Array;
    boundaries(): Float32Array;
    trace(): Uint8Array;
}

export function alignment_contract_version(): number;

/**
 * Gotoh cells with interleaved M/X/Y boundaries and stable tie ordering.
 */
export function calculate_tile(first: Uint8Array, second: Uint8Array, scores: Float32Array, alphabet_size: number, top: Float32Array, left: Float32Array, local: boolean, last_row: boolean, last_column: boolean): TileOutput;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_tileoutput_free: (a: number, b: number) => void;
    readonly alignment_contract_version: () => number;
    readonly calculate_tile: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => [number, number, number];
    readonly tileoutput_best: (a: number) => [number, number];
    readonly tileoutput_boundaries: (a: number) => [number, number];
    readonly tileoutput_trace: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
