// ═══════════════════════════════════════════════════════════════════
// charEdge — Branded Types
//
// Nominal/branded types prevent accidental confusion between string
// subtypes. Example: you can't pass a Timeframe where a Symbol
// is expected, even though both are strings at runtime.
//
// Usage:
//   import type { Symbol, Timeframe, Timestamp } from '../types/branded';
//   function getCandles(symbol: Symbol, tf: Timeframe): Bar[] { ... }
//
// Creating branded values:
//   import { asSymbol, asTimeframe, asTimestamp } from '../types/branded';
//   const sym = asSymbol('BTCUSDT');
// ═══════════════════════════════════════════════════════════════════

// ─── Branded Type Definitions ────────────────────────────────────

/** A trading symbol (e.g. 'BTCUSDT', 'AAPL', 'ES') */
export type Symbol = string & { readonly __brand: 'Symbol' };

/** A timeframe string (e.g. '1m', '5m', '1h', '1D', '1W') */
export type Timeframe = string & { readonly __brand: 'Timeframe' };

/** A Unix timestamp in milliseconds */
export type Timestamp = number & { readonly __brand: 'Timestamp' };

/** A price value */
export type Price = number & { readonly __brand: 'Price' };

/** A volume value */
export type Volume = number & { readonly __brand: 'Volume' };

/** A percentage (0-100) */
export type Percentage = number & { readonly __brand: 'Percentage' };

/** An API key string */
export type ApiKey = string & { readonly __brand: 'ApiKey' };

/** A user ID */
export type UserId = string & { readonly __brand: 'UserId' };

// ─── Factory Functions ───────────────────────────────────────────
// These perform runtime assertions and cast to the branded type.

export function asSymbol(s: string): Symbol {
    if (!s || typeof s !== 'string') throw new Error(`Invalid symbol: ${s}`);
    return s as Symbol;
}

export function asTimeframe(tf: string): Timeframe {
    if (!tf || typeof tf !== 'string') throw new Error(`Invalid timeframe: ${tf}`);
    return tf as Timeframe;
}

export function asTimestamp(t: number): Timestamp {
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) {
        throw new Error(`Invalid timestamp: ${t}`);
    }
    return t as Timestamp;
}

export function asPrice(p: number): Price {
    if (typeof p !== 'number' || !Number.isFinite(p)) {
        throw new Error(`Invalid price: ${p}`);
    }
    return p as Price;
}

export function asVolume(v: number): Volume {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw new Error(`Invalid volume: ${v}`);
    }
    return v as Volume;
}
