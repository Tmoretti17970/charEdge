// ═══════════════════════════════════════════════════════════════════
// charEdge — Price Tracker Store (Coinbase-Style Alert Engine)
//
// Maintains rolling price statistics per symbol for market-condition
// alert evaluation:
//   - 52-week (365-day) high / low tracking
//   - Percentage change windows (1h, 4h, 24h, 7d)
//   - Reference price snapshots for %-change computation
//
// Fed by SmartAlertBridge on every closed bar.
// Persisted to localStorage so 52-week data survives page reloads.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export type PercentTimeWindow = '1h' | '4h' | '24h' | '7d';

export interface SymbolPriceStats {
    symbol: string;
    // 52-week tracking
    high52w: number;
    low52w: number;
    high52wDate: string;    // ISO — when the 52w high was set
    low52wDate: string;     // ISO — when the 52w low was set
    // Reference prices for %-change computation
    // Snapped at the start of each window
    refPrice1h: number | null;
    refPrice4h: number | null;
    refPrice24h: number | null;
    refPrice7d: number | null;
    refTime1h: number;   // timestamp (ms) of last 1h reference snap
    refTime4h: number;
    refTime24h: number;
    refTime7d: number;
    // Current price (latest close)
    lastPrice: number;
    lastUpdated: number;  // timestamp (ms)
}

interface PriceTrackerState {
    stats: Record<string, SymbolPriceStats>;
}

interface PriceTrackerActions {
    /**
     * Push a closed bar price for a symbol.
     * Updates 52w high/low, rotates reference prices, and stores latest.
     */
    pushPrice: (symbol: string, price: number, barTimeMs?: number) => void;

    /**
     * Get stats for a symbol (or null if not tracked).
     */
    getStats: (symbol: string) => SymbolPriceStats | null;

    /**
     * Compute the %-change for a symbol over a given time window.
     * Returns null if not enough data.
     */
    getPercentChange: (symbol: string, window: PercentTimeWindow) => number | null;

    /**
     * Check if a symbol's current price is at/near its 52-week high.
     * Returns proximity as a percentage (0 = at high, negative = below).
     */
    get52wHighProximity: (symbol: string) => number | null;

    /**
     * Check if a symbol's current price is at/near its 52-week low.
     * Returns proximity as a percentage (0 = at low, positive = above).
     */
    get52wLowProximity: (symbol: string) => number | null;

    /**
     * Seed 52-week data from historical klines (optional backfill).
     */
    seed52w: (symbol: string, high: number, highDate: string, low: number, lowDate: string) => void;

    /**
     * Clear all tracking data.
     */
    clear: () => void;
}

// ─── Window durations in ms ─────────────────────────────────────

const WINDOW_MS: Record<PercentTimeWindow, number> = {
    '1h': 3_600_000,
    '4h': 14_400_000,
    '24h': 86_400_000,
    '7d': 604_800_000,
};

// 52 weeks in ms
const WEEK_52_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Store ──────────────────────────────────────────────────────

const usePriceTracker = create<PriceTrackerState & PriceTrackerActions>()(
    persist(
        (set, get) => ({
            stats: {},

            pushPrice: (symbol: string, price: number, barTimeMs?: number) => {
                const now = barTimeMs || Date.now();
                const sym = symbol.toUpperCase();

                set((s) => {
                    const existing = s.stats[sym];
                    const stats = { ...s.stats };

                    if (!existing) {
                        // First price for this symbol — initialize everything
                        const isoNow = new Date(now).toISOString();
                        stats[sym] = {
                            symbol: sym,
                            high52w: price,
                            low52w: price,
                            high52wDate: isoNow,
                            low52wDate: isoNow,
                            refPrice1h: price,
                            refPrice4h: price,
                            refPrice24h: price,
                            refPrice7d: price,
                            refTime1h: now,
                            refTime4h: now,
                            refTime24h: now,
                            refTime7d: now,
                            lastPrice: price,
                            lastUpdated: now,
                        };
                    } else {
                        const updated = { ...existing, lastPrice: price, lastUpdated: now };

                        // Update 52-week high/low
                        if (price > updated.high52w) {
                            updated.high52w = price;
                            updated.high52wDate = new Date(now).toISOString();
                        }
                        if (price < updated.low52w) {
                            updated.low52w = price;
                            updated.low52wDate = new Date(now).toISOString();
                        }

                        // Expire 52w records older than 365 days
                        // If the high/low date is older than 52 weeks, reset to current
                        const high52wAge = now - new Date(updated.high52wDate).getTime();
                        if (high52wAge > WEEK_52_MS) {
                            updated.high52w = price;
                            updated.high52wDate = new Date(now).toISOString();
                        }
                        const low52wAge = now - new Date(updated.low52wDate).getTime();
                        if (low52wAge > WEEK_52_MS) {
                            updated.low52w = price;
                            updated.low52wDate = new Date(now).toISOString();
                        }

                        // Rotate reference prices when their windows expire
                        if (now - updated.refTime1h >= WINDOW_MS['1h']) {
                            updated.refPrice1h = price;
                            updated.refTime1h = now;
                        }
                        if (now - updated.refTime4h >= WINDOW_MS['4h']) {
                            updated.refPrice4h = price;
                            updated.refTime4h = now;
                        }
                        if (now - updated.refTime24h >= WINDOW_MS['24h']) {
                            updated.refPrice24h = price;
                            updated.refTime24h = now;
                        }
                        if (now - updated.refTime7d >= WINDOW_MS['7d']) {
                            updated.refPrice7d = price;
                            updated.refTime7d = now;
                        }

                        stats[sym] = updated;
                    }

                    return { stats };
                });
            },

            getStats: (symbol: string) => {
                return get().stats[symbol.toUpperCase()] || null;
            },

            getPercentChange: (symbol: string, window: PercentTimeWindow) => {
                const stat = get().stats[symbol.toUpperCase()];
                if (!stat) return null;

                const refKey = `refPrice${window.replace('h', 'h').replace('d', 'd')}` as keyof SymbolPriceStats;
                // Map window to ref field
                let refPrice: number | null = null;
                switch (window) {
                    case '1h': refPrice = stat.refPrice1h; break;
                    case '4h': refPrice = stat.refPrice4h; break;
                    case '24h': refPrice = stat.refPrice24h; break;
                    case '7d': refPrice = stat.refPrice7d; break;
                }

                if (refPrice == null || refPrice === 0) return null;
                return ((stat.lastPrice - refPrice) / refPrice) * 100;
            },

            get52wHighProximity: (symbol: string) => {
                const stat = get().stats[symbol.toUpperCase()];
                if (!stat || stat.high52w === 0) return null;
                return ((stat.lastPrice - stat.high52w) / stat.high52w) * 100;
            },

            get52wLowProximity: (symbol: string) => {
                const stat = get().stats[symbol.toUpperCase()];
                if (!stat || stat.low52w === 0) return null;
                return ((stat.lastPrice - stat.low52w) / stat.low52w) * 100;
            },

            seed52w: (symbol: string, high: number, highDate: string, low: number, lowDate: string) => {
                const sym = symbol.toUpperCase();
                set((s) => {
                    const existing = s.stats[sym];
                    const stats = { ...s.stats };

                    if (existing) {
                        stats[sym] = {
                            ...existing,
                            high52w: Math.max(existing.high52w, high),
                            low52w: Math.min(existing.low52w, low),
                            high52wDate: high > existing.high52w ? highDate : existing.high52wDate,
                            low52wDate: low < existing.low52w ? lowDate : existing.low52wDate,
                        };
                    } else {
                        const now = Date.now();
                        stats[sym] = {
                            symbol: sym,
                            high52w: high,
                            low52w: low,
                            high52wDate: highDate,
                            low52wDate: lowDate,
                            refPrice1h: null,
                            refPrice4h: null,
                            refPrice24h: null,
                            refPrice7d: null,
                            refTime1h: now,
                            refTime4h: now,
                            refTime24h: now,
                            refTime7d: now,
                            lastPrice: 0,
                            lastUpdated: now,
                        };
                    }

                    return { stats };
                });
            },

            clear: () => set({ stats: {} }),
        }),
        { name: 'charEdge-price-tracker' },
    ),
);

// ─── Market Alert Evaluation ────────────────────────────────────

/**
 * Evaluate market-condition alerts (52w high/low, %-change).
 * Called from SmartAlertBridge after pushPrice().
 *
 * @param alerts - Active alerts from useAlertStore (should already be filtered to active)
 * @param triggerFn - Function to trigger an alert by ID (useAlertStore.triggerAlert)
 */
export function checkMarketAlerts(
    alerts: Array<{
        id: string;
        symbol: string;
        condition: string;
        price: number;
        active: boolean;
        percentThreshold?: number | null;
        timeWindow?: string | null;
    }>,
    triggerFn: (id: string) => void,
): void {
    const tracker = usePriceTracker.getState();

    for (const alert of alerts) {
        if (!alert.active) continue;

        const stat = tracker.getStats(alert.symbol);
        if (!stat) continue;

        let triggered = false;

        switch (alert.condition) {
            case '52w_high':
                // Trigger when current price >= 52-week high
                triggered = stat.lastPrice >= stat.high52w && stat.lastPrice > 0;
                break;

            case '52w_low':
                // Trigger when current price <= 52-week low
                triggered = stat.lastPrice <= stat.low52w && stat.lastPrice > 0;
                break;

            case 'percent_above': {
                // Trigger when %-change over time window exceeds threshold
                const window = (alert.timeWindow || '24h') as PercentTimeWindow;
                const pctChange = tracker.getPercentChange(alert.symbol, window);
                if (pctChange != null && alert.percentThreshold != null) {
                    triggered = pctChange >= alert.percentThreshold;
                }
                break;
            }

            case 'percent_below': {
                // Trigger when %-change over time window drops below negative threshold
                const window = (alert.timeWindow || '24h') as PercentTimeWindow;
                const pctChange = tracker.getPercentChange(alert.symbol, window);
                if (pctChange != null && alert.percentThreshold != null) {
                    triggered = pctChange <= -Math.abs(alert.percentThreshold);
                }
                break;
            }

            default:
                // Not a market-condition alert — skip
                continue;
        }

        if (triggered) {
            triggerFn(alert.id);
        }
    }
}

export { usePriceTracker };
export default usePriceTracker;
