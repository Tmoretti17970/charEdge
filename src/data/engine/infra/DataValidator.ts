// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Validator
//
// Phase 2 Task 2.2.1: Post-transform data validation.
// Validates OHLC bars for sanity constraints before rendering.
//
// Rules:
//   1. High ≥ Low (always)
//   2. Open/Close within [Low, High] range
//   3. Timestamps must be monotonically increasing
//   4. Volume ≥ 0
//   5. No NaN/Infinity in any field
//   6. No duplicate timestamps
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from '../../../types/data.js';

// ─── Types ───────────────────────────────────────────────────────

export interface ValidationIssue {
    /** Index of the problematic bar */
    barIndex: number;
    /** Which field is invalid */
    field: 'time' | 'open' | 'high' | 'low' | 'close' | 'volume' | 'ohlc' | 'timestamp';
    /** Machine-readable code */
    code: string;
    /** Human-readable description */
    message: string;
    /** Severity: error = must fix, warning = suspicious but usable */
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    /** Number of bars that passed validation */
    validCount: number;
    /** Total bars checked */
    totalCount: number;
}

// ─── Validation ──────────────────────────────────────────────────

/**
 * Validate an array of OHLCV bars for data integrity.
 * Returns structured results with all issues found.
 */
export function validateBars(bars: Bar[]): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    let lastTime = -Infinity;

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];

        // === NaN / Infinity checks ===
        for (const field of ['time', 'open', 'high', 'low', 'close', 'volume'] as const) {
            const val = bar[field];
            if (typeof val !== 'number' || !isFinite(val)) {
                errors.push({
                    barIndex: i,
                    field,
                    code: 'INVALID_NUMBER',
                    message: `Bar[${i}].${field} is ${val} (expected finite number)`,
                    severity: 'error',
                });
            }
        }

        // === OHLC sanity ===
        if (isFinite(bar.high) && isFinite(bar.low)) {
            if (bar.high < bar.low) {
                errors.push({
                    barIndex: i,
                    field: 'ohlc',
                    code: 'HIGH_LESS_THAN_LOW',
                    message: `Bar[${i}] high (${bar.high}) < low (${bar.low})`,
                    severity: 'error',
                });
            }

            // Open/Close should be within [Low, High]
            if (isFinite(bar.open) && (bar.open > bar.high || bar.open < bar.low)) {
                warnings.push({
                    barIndex: i,
                    field: 'open',
                    code: 'OPEN_OUT_OF_RANGE',
                    message: `Bar[${i}] open (${bar.open}) outside [${bar.low}, ${bar.high}]`,
                    severity: 'warning',
                });
            }
            if (isFinite(bar.close) && (bar.close > bar.high || bar.close < bar.low)) {
                warnings.push({
                    barIndex: i,
                    field: 'close',
                    code: 'CLOSE_OUT_OF_RANGE',
                    message: `Bar[${i}] close (${bar.close}) outside [${bar.low}, ${bar.high}]`,
                    severity: 'warning',
                });
            }
        }

        // === Volume ===
        if (isFinite(bar.volume) && bar.volume < 0) {
            errors.push({
                barIndex: i,
                field: 'volume',
                code: 'NEGATIVE_VOLUME',
                message: `Bar[${i}] has negative volume: ${bar.volume}`,
                severity: 'error',
            });
        }

        // === Monotonic timestamps ===
        if (isFinite(bar.time)) {
            if (bar.time <= lastTime) {
                if (bar.time === lastTime) {
                    warnings.push({
                        barIndex: i,
                        field: 'timestamp',
                        code: 'DUPLICATE_TIMESTAMP',
                        message: `Bar[${i}] has duplicate timestamp: ${bar.time}`,
                        severity: 'warning',
                    });
                } else {
                    errors.push({
                        barIndex: i,
                        field: 'timestamp',
                        code: 'NONMONOTONIC_TIMESTAMP',
                        message: `Bar[${i}] time (${bar.time}) ≤ previous (${lastTime})`,
                        severity: 'error',
                    });
                }
            }
            lastTime = bar.time;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        validCount: bars.length - errors.length,
        totalCount: bars.length,
    };
}

/**
 * Quick check: returns true if all bars pass basic sanity.
 * Faster than full validateBars for hot paths.
 */
export function isBarArrayValid(bars: Bar[]): boolean {
    let lastTime = -Infinity;
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        if (
            !isFinite(b.time) || !isFinite(b.open) || !isFinite(b.high) ||
            !isFinite(b.low) || !isFinite(b.close) || !isFinite(b.volume) ||
            b.high < b.low || b.volume < 0 || b.time <= lastTime
        ) {
            return false;
        }
        lastTime = b.time;
    }
    return true;
}

// ─── Legacy Sanitization API ─────────────────────────────────────
// Merged from DataValidator.js — validates, cleans, deduplicates.

const ONE_DAY_MS = 86_400_000;

interface CandleValidation {
    valid: boolean;
    candle: Record<string, unknown>;
    issues: string[];
}

interface GapInfo {
    afterIndex: number;
    afterTime: unknown;
    beforeTime: unknown;
    gapMs: number;
}

/**
 * Validate a single OHLCV candle.
 */
export function validateCandle(candle: Record<string, unknown>): CandleValidation {
    if (!candle || typeof candle !== 'object') {
        return { valid: false, candle, issues: ['not an object'] };
    }

    const issues: string[] = [];
    const fixed = { ...candle } as Record<string, unknown>;

    // Time validation
    const t = typeof candle.time === 'string' ? new Date(candle.time as string).getTime() : candle.time as number;
    if (!t || isNaN(t as number)) {
        return { valid: false, candle, issues: ['invalid timestamp'] };
    }
    if ((t as number) > Date.now() + ONE_DAY_MS) {
        return { valid: false, candle, issues: ['timestamp in the future'] };
    }

    // Price validation — all must be numbers and non-negative
    for (const field of ['open', 'high', 'low', 'close']) {
        if (typeof candle[field] !== 'number' || isNaN(candle[field] as number)) {
            return { valid: false, candle, issues: [`${field} is not a number`] };
        }
        if ((candle[field] as number) < 0) {
            return { valid: false, candle, issues: [`negative ${field}`] };
        }
    }

    // high < low → swap (fixable)
    if ((fixed.high as number) < (fixed.low as number)) {
        const tmp = fixed.high;
        fixed.high = fixed.low;
        fixed.low = tmp;
        issues.push('high < low (swapped)');
    }

    // Volume validation — negative → zero (fixable)
    if (typeof fixed.volume === 'number' && fixed.volume < 0) {
        fixed.volume = 0;
        issues.push('negative volume (zeroed)');
    }

    // Zero-close candles are likely filler data
    if (fixed.close === 0 && fixed.open === 0 && fixed.high === 0 && fixed.low === 0) {
        return { valid: false, candle, issues: ['all-zero candle'] };
    }

    return { valid: true, candle: fixed, issues };
}

/**
 * Validate and clean an array of OHLCV candles.
 * Removes invalid candles and fixes fixable issues.
 */
export function validateCandleArray(bars: unknown[]): Record<string, unknown>[] {
    if (!Array.isArray(bars)) return [];

    const result: Record<string, unknown>[] = [];
    for (const bar of bars) {
        const { valid, candle } = validateCandle(bar as Record<string, unknown>);
        if (valid) result.push(candle);
    }
    return result;
}

/**
 * Detect gaps in a candle array.
 *
 * Delegates to canonical GapDetector — this wrapper adapts the return shape
 * for backward compatibility with mixed string/epoch timestamps.
 */
export function detectGaps(bars: Record<string, unknown>[], expectedIntervalMs: number): GapInfo[] {
    if (!Array.isArray(bars) || bars.length < 2 || !expectedIntervalMs) return [];

    const gaps: GapInfo[] = [];
    const threshold = expectedIntervalMs * 2;

    for (let i = 1; i < bars.length; i++) {
        const prevTime = typeof bars[i - 1].time === 'string'
            ? new Date(bars[i - 1].time as string).getTime()
            : bars[i - 1].time as number;
        const currTime = typeof bars[i].time === 'string'
            ? new Date(bars[i].time as string).getTime()
            : bars[i].time as number;
        const diff = currTime - prevTime;

        if (diff > threshold) {
            gaps.push({
                afterIndex: i - 1,
                afterTime: bars[i - 1].time,
                beforeTime: bars[i].time,
                gapMs: diff,
            });
        }
    }
    return gaps;
}

/**
 * Deduplicate candles by timestamp. Keeps the last occurrence.
 */
export function deduplicateCandles(bars: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!Array.isArray(bars) || bars.length === 0) return [];

    const map = new Map<string, Record<string, unknown>>();
    for (const bar of bars) {
        const key = typeof bar.time === 'string'
            ? bar.time as string
            : new Date(bar.time as number).toISOString();
        map.set(key, bar);
    }

    return [...map.values()].sort((a, b) => {
        const ta = typeof a.time === 'string' ? new Date(a.time as string).getTime() : a.time as number;
        const tb = typeof b.time === 'string' ? new Date(b.time as string).getTime() : b.time as number;
        return ta - tb;
    });
}
