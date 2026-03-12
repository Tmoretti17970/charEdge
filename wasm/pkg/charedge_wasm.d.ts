/* tslint:disable */
/* eslint-disable */

/**
 * Compute Average True Range (Wilder's smoothing).
 * Requires parallel high/low/close Float64Arrays.
 * Returns Float64Array with NaN for warm-up indices.
 */
export function wasm_atr(high: Float64Array, low: Float64Array, close: Float64Array, period: number): Float64Array;

/**
 * Compute Bollinger Bands.
 * Returns a flat Float64Array of length 3*n: [upper..., middle..., lower...].
 * Caller must split by n to get each band.
 */
export function wasm_bollinger(close: Float64Array, period: number, multiplier: number): Float64Array;

/**
 * Compute Exponential Moving Average.
 * Returns Float64Array with NaN for warm-up indices.
 */
export function wasm_ema(close: Float64Array, period: number): Float64Array;

/**
 * Compute MACD.
 * Returns a flat Float64Array of length 3*n: [macd..., signal..., histogram...].
 * Caller must split by n to get each line.
 */
export function wasm_macd(close: Float64Array, fast: number, slow: number, signal: number): Float64Array;

/**
 * Compute Relative Strength Index (Wilder's smoothing).
 * Returns Float64Array with values in [0, 100], NaN for warm-up.
 */
export function wasm_rsi(close: Float64Array, period: number): Float64Array;

/**
 * Compute Simple Moving Average.
 * Returns Float64Array with NaN for warm-up indices.
 */
export function wasm_sma(close: Float64Array, period: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly wasm_atr: (a: any, b: any, c: any, d: number) => any;
    readonly wasm_bollinger: (a: any, b: number, c: number) => any;
    readonly wasm_ema: (a: any, b: number) => any;
    readonly wasm_macd: (a: any, b: number, c: number, d: number) => any;
    readonly wasm_rsi: (a: any, b: number) => any;
    readonly wasm_sma: (a: any, b: number) => any;
    readonly __wbindgen_externrefs: WebAssembly.Table;
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
