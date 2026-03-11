// ═══════════════════════════════════════════════════════════════════
// charEdge — MarkSpec Type Definitions (Sprint 13–14, Task #103)
//
// Declarative encoding interface for chart grammar.
// Defines how data fields map to visual properties (position, color,
// size, opacity) on chart marks (rect, line, area, point, text).
//
// This is the type foundation for future grammar-driven rendering.
// ═══════════════════════════════════════════════════════════════════

// ─── Scale Specification ─────────────────────────────────────────

export type ScaleType = 'linear' | 'log' | 'time' | 'band' | 'ordinal';

export interface ScaleSpec {
    type: ScaleType;
    /** Explicit domain bounds. Inferred from data if omitted. */
    domain?: [number, number] | string[];
    /** Explicit range bounds. Defaults to [0, chartWidth] or [chartHeight, 0]. */
    range?: [number, number];
    /** Clamp values outside domain. Default: false. */
    clamp?: boolean;
    /** Nice rounding on domain ends. Default: true for linear/log. */
    nice?: boolean;
}

// ─── Encoding Channels ──────────────────────────────────────────

/** Map a data field to a visual property via a scale. */
export interface FieldEncoding {
    field: string;
    scale?: ScaleSpec;
    /** Aggregate function applied before encoding. */
    aggregate?: 'sum' | 'mean' | 'min' | 'max' | 'count' | 'median';
}

/** Use a constant value for a visual property. */
export interface ValueEncoding {
    value: number | string;
}

/** Conditional encoding: pick value based on a predicate. */
export interface ConditionalEncoding {
    condition: {
        field: string;
        test: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
        value: number | string;
    };
    /** Encoding when condition is true. */
    then: FieldEncoding | ValueEncoding;
    /** Encoding when condition is false. */
    else: FieldEncoding | ValueEncoding;
}

export type Encoding = FieldEncoding | ValueEncoding | ConditionalEncoding;

// ─── Mark Types ─────────────────────────────────────────────────

export type MarkType = 'rect' | 'line' | 'area' | 'point' | 'text' | 'rule' | 'bar';

export interface MarkEncodings {
    x: Encoding;
    y: Encoding;
    x2?: Encoding;
    y2?: Encoding;
    color?: Encoding;
    fill?: Encoding;
    stroke?: Encoding;
    size?: Encoding;
    opacity?: Encoding;
    text?: Encoding;
    shape?: Encoding;
    strokeWidth?: Encoding;
    strokeDash?: ValueEncoding;
}

// ─── MarkSpec ───────────────────────────────────────────────────

/**
 * A MarkSpec defines a single visual mark layer on the chart.
 *
 * @example
 * ```ts
 * const candleBody: MarkSpec = {
 *   type: 'rect',
 *   data: 'candles',
 *   encodings: {
 *     x:     { field: 'time', scale: { type: 'time' } },
 *     y:     { field: 'open', scale: { type: 'linear' } },
 *     y2:    { field: 'close' },
 *     color: {
 *       condition: { field: 'close', test: 'gte', value: 0 },
 *       then: { value: '#26a69a' },
 *       else: { value: '#ef5350' },
 *     },
 *   },
 * };
 * ```
 */
export interface MarkSpec {
    /** Visual mark type. */
    type: MarkType;
    /** Reference to a named data source. */
    data?: string;
    /** Visual encoding channels. */
    encodings: MarkEncodings;
    /** Optional name for referencing this mark layer. */
    name?: string;
    /** Z-order for layering. Higher = on top. */
    zIndex?: number;
    /** Whether this mark is interactive (responds to hover/click). */
    interactive?: boolean;
}

// ─── Layer Composition ──────────────────────────────────────────

/**
 * A LayerSpec composes multiple marks into a single chart view.
 * Marks render in array order (later = on top), unless zIndex overrides.
 */
export interface LayerSpec {
    marks: MarkSpec[];
    /** Shared scales across all marks in this layer. */
    scales?: Record<string, ScaleSpec>;
    /** Data sources referenced by marks. */
    data?: Record<string, unknown[]>;
    /** Chart dimensions. */
    width?: number;
    height?: number;
}
