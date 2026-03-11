// ═══════════════════════════════════════════════════════════════════
// charEdge — Columnar Bar Storage
//
// Sprint 18 #112: Column-oriented typed-array bar storage for
// cache-friendly indicator computation and zero-copy WASM handoff.
//
// Row-oriented Bar[] → Column-oriented BarColumns conversion,
// plus efficient append/slice operations.
// ═══════════════════════════════════════════════════════════════════

import type { Bar, BarColumns } from './types';

// ─── Conversion Functions ───────────────────────────────────────

/**
 * Convert row-oriented bars to columnar typed arrays.
 * @param bars - Array of Bar objects
 * @returns BarColumns with typed arrays
 */
export function barsToColumns(bars: Bar[]): BarColumns {
    const n = bars.length;
    const t = new Float64Array(n);
    const o = new Float32Array(n);
    const h = new Float32Array(n);
    const l = new Float32Array(n);
    const c = new Float64Array(n);
    const v = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        const bar = bars[i]!;
        t[i] = bar.t;
        o[i] = bar.o;
        h[i] = bar.h;
        l[i] = bar.l;
        c[i] = bar.c;
        v[i] = bar.v;
    }

    return { t, o, h, l, c, v, length: n };
}

/**
 * Convert columnar typed arrays back to row-oriented bars.
 * @param cols - BarColumns with typed arrays
 * @returns Array of Bar objects
 */
export function columnsToBars(cols: BarColumns): Bar[] {
    const bars: Bar[] = new Array(cols.length);
    for (let i = 0; i < cols.length; i++) {
        bars[i] = {
            t: cols.t[i]!,
            o: cols.o[i]!,
            h: cols.h[i]!,
            l: cols.l[i]!,
            c: cols.c[i]!,
            v: cols.v[i]!,
        };
    }
    return bars;
}

// ─── Operational Functions ──────────────────────────────────────

/**
 * Append a single bar to an existing BarColumns.
 * Creates new typed arrays with one extra element.
 * @param cols - Existing columnar data
 * @param bar - Bar to append
 * @returns New BarColumns (immutable pattern)
 */
export function appendToColumns(cols: BarColumns, bar: Bar): BarColumns {
    const n = cols.length + 1;

    const t = new Float64Array(n);
    t.set(cols.t);
    t[cols.length] = bar.t;

    const o = new Float32Array(n);
    o.set(cols.o);
    o[cols.length] = bar.o;

    const h = new Float32Array(n);
    h.set(cols.h);
    h[cols.length] = bar.h;

    const l = new Float32Array(n);
    l.set(cols.l);
    l[cols.length] = bar.l;

    const c = new Float64Array(n);
    c.set(cols.c);
    c[cols.length] = bar.c;

    const v = new Float32Array(n);
    v.set(cols.v);
    v[cols.length] = bar.v;

    return { t, o, h, l, c, v, length: n };
}

/**
 * Slice a subset of a BarColumns.
 * Uses TypedArray.subarray() for zero-copy views where possible.
 * @param cols - Source columnar data
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @returns New BarColumns (zero-copy subarray views)
 */
export function sliceColumns(cols: BarColumns, start: number, end: number): BarColumns {
    const s = Math.max(0, start);
    const e = Math.min(cols.length, end);
    return {
        t: cols.t.subarray(s, e) as Float64Array,
        o: cols.o.subarray(s, e) as Float32Array,
        h: cols.h.subarray(s, e) as Float32Array,
        l: cols.l.subarray(s, e) as Float32Array,
        c: cols.c.subarray(s, e) as Float64Array,
        v: cols.v.subarray(s, e) as Float32Array,
        length: e - s,
    };
}

/**
 * Create an empty BarColumns with the given capacity.
 * @param capacity - Pre-allocated array size
 * @returns Empty BarColumns
 */
export function createEmptyColumns(capacity: number = 0): BarColumns {
    return {
        t: new Float64Array(capacity),
        o: new Float32Array(capacity),
        h: new Float32Array(capacity),
        l: new Float32Array(capacity),
        c: new Float64Array(capacity),
        v: new Float32Array(capacity),
        length: 0,
    };
}

/**
 * Calculate byte size of a BarColumns struct.
 * Float64Array = 8 bytes/element, Float32Array = 4 bytes/element.
 * Per bar: t(8) + o(4) + h(4) + l(4) + c(8) + v(4) = 32 bytes
 * (vs 48 bytes per bar in row-oriented Float64 storage — 33% savings)
 */
export function columnarByteSize(cols: BarColumns): number {
    return cols.t.byteLength + cols.o.byteLength + cols.h.byteLength
         + cols.l.byteLength + cols.c.byteLength + cols.v.byteLength;
}
