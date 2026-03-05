// ═══════════════════════════════════════════════════════════════════
// charEdge — Canonical Data Schemas (P4-1)
//
// Defines strict TypeScript types for all data flowing through the
// system. Adapters must normalize to these shapes at the boundary.
// ═══════════════════════════════════════════════════════════════════

/**
 * Canonical OHLCV bar — the single source of truth for price data.
 * All adapters MUST produce this shape via `toCanonicalBar()`.
 */
export interface CanonicalBar {
    /** Unix timestamp in milliseconds */
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    /** Adapter that produced this bar (e.g. 'binance', 'coingecko') */
    source?: string;
    /** Data confidence 0..1 (1 = exchange-verified, <1 = interpolated/estimated) */
    quality?: number;
}

/**
 * Canonical tick / trade — individual market event.
 */
export interface CanonicalTick {
    /** Unix timestamp in milliseconds */
    time: number;
    price: number;
    volume: number;
    side: 'buy' | 'sell' | 'unknown';
    /** Exchange trade ID (for dedup) */
    tradeId?: string;
}

/**
 * Canonical order book level.
 */
export interface CanonicalBookLevel {
    price: number;
    size: number;
}

/**
 * Canonical order book snapshot.
 */
export interface CanonicalOrderBook {
    time: number;
    bids: CanonicalBookLevel[];
    asks: CanonicalBookLevel[];
    source?: string;
}

/**
 * Adapter metadata — describes a data adapter's capabilities.
 */
export interface AdapterMeta {
    id: string;
    name: string;
    supportedTimeframes: string[];
    supportedSymbols?: string[];
    maxBarsPerRequest: number;
    rateLimit: { maxRequests: number; windowMs: number };
}

// ─── Normalizers ─────────────────────────────────────────────────

/**
 * Normalize a raw bar object from any adapter into a CanonicalBar.
 * Ensures all fields exist and are numeric.
 */
export function toCanonicalBar(
    raw: Record<string, unknown>,
    source?: string,
): CanonicalBar {
    return {
        time: Number(raw.time ?? raw.t ?? raw.timestamp ?? 0),
        open: Number(raw.open ?? raw.o ?? 0),
        high: Number(raw.high ?? raw.h ?? 0),
        low: Number(raw.low ?? raw.l ?? 0),
        close: Number(raw.close ?? raw.c ?? 0),
        volume: Number(raw.volume ?? raw.v ?? raw.vol ?? 0),
        source,
        quality: typeof raw.quality === 'number' ? raw.quality : 1.0,
    };
}

/**
 * Normalize a batch of raw bars.
 */
export function toCanonicalBars(
    rawBars: Record<string, unknown>[],
    source?: string,
): CanonicalBar[] {
    return rawBars.map(r => toCanonicalBar(r, source));
}

/**
 * Validate a CanonicalBar for data quality.
 * Returns an array of issue strings (empty = valid).
 */
export function validateCanonicalBar(bar: CanonicalBar): string[] {
    const issues: string[] = [];
    if (!bar.time || bar.time <= 0) issues.push('invalid time');
    if (bar.high < bar.low) issues.push('high < low');
    if (bar.high < bar.open || bar.high < bar.close) issues.push('high < open/close');
    if (bar.low > bar.open || bar.low > bar.close) issues.push('low > open/close');
    if (bar.volume < 0) issues.push('negative volume');
    if (!isFinite(bar.close)) issues.push('non-finite close');
    return issues;
}
