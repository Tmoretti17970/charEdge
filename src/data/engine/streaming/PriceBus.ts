// ═══════════════════════════════════════════════════════════════════
// charEdge — PriceBus (Sprint 1, Task 1.1)
//
// Single source of truth for live prices across the entire app.
// Accepts prices from WebSocketService, PriceAggregator, TickerPlant,
// and any future source — distributes to all consumers via subscribe().
//
// This is a DISTRIBUTION layer, not an AGGREGATION layer.
// PriceAggregator handles multi-source aggregation (median, outlier
// rejection, confidence scoring). PriceBus just makes sure every
// consumer sees the same latest price.
//
// Usage:
//   import { priceBus } from './PriceBus.ts';
//   priceBus.publish('BTCUSDT', 97050.25, 'binance-ws', Date.now());
//   const unsub = priceBus.subscribe('BTCUSDT', (data) => { ... });
//   priceBus.getLatest('BTCUSDT'); // → { price, source, timestamp }
// ═══════════════════════════════════════════════════════════════════

export interface PriceData {
  price: number;
  source: string;
  timestamp: number;
}

type PriceCallback = (data: PriceData) => void;

class _PriceBus {
  /** Latest price per symbol */
  private _latest: Map<string, PriceData> = new Map();

  /** Per-symbol subscriber sets */
  private _subscribers: Map<string, Set<PriceCallback>> = new Map();

  /** Global subscribers (receive ALL symbol updates) */
  private _globalSubscribers: Set<PriceCallback> = new Set();

  /**
   * Publish a price update.
   *
   * @param symbol - Normalized symbol (e.g. 'BTCUSDT', 'AAPL')
   * @param price - The price value (must be > 0)
   * @param source - Source identifier (e.g. 'binance-ws', 'aggregator', 'pyth')
   * @param timestamp - Unix timestamp in ms
   */
  publish(symbol: string, price: number, source: string, timestamp: number): void {
    if (!symbol || !price || price <= 0) return;

    const upper = symbol.toUpperCase();
    const data: PriceData = { price, source, timestamp };

    // Only accept if newer than existing (or first update)
    const existing = this._latest.get(upper);
    if (existing && existing.timestamp > timestamp) return;

    this._latest.set(upper, data);

    // Notify per-symbol subscribers
    const subs = this._subscribers.get(upper);
    if (subs) {
      for (const cb of subs) {
        try { cb(data); } catch { /* subscriber error — don't crash bus */ }
      }
    }

    // Notify global subscribers
    for (const cb of this._globalSubscribers) {
      try { cb({ ...data, symbol: upper } as PriceData & { symbol: string }); } catch { /* */ }
    }
  }

  /**
   * Subscribe to price updates for a specific symbol.
   *
   * @param symbol - Symbol to subscribe to
   * @param callback - Receives { price, source, timestamp }
   * @returns Unsubscribe function
   */
  subscribe(symbol: string, callback: PriceCallback): () => void {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return () => {};

    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper)!.add(callback);

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this._subscribers.delete(upper);
      }
    };
  }

  /**
   * Subscribe to ALL symbol price updates.
   * Useful for components that display multiple symbols (watchlists, dashboards).
   *
   * @param callback - Receives { price, source, timestamp, symbol }
   * @returns Unsubscribe function
   */
  subscribeAll(callback: PriceCallback): () => void {
    this._globalSubscribers.add(callback);
    return () => { this._globalSubscribers.delete(callback); };
  }

  /**
   * Get the latest price for a symbol without subscribing.
   *
   * @param symbol - Symbol to query
   * @returns Latest price data, or null if no price received yet
   */
  getLatest(symbol: string): PriceData | null {
    return this._latest.get((symbol || '').toUpperCase()) || null;
  }

  /**
   * Get latest prices for multiple symbols.
   *
   * @param symbols - Array of symbols
   * @returns Map of symbol → PriceData
   */
  getMultiple(symbols: string[]): Map<string, PriceData> {
    const result = new Map<string, PriceData>();
    for (const sym of symbols) {
      const data = this._latest.get(sym.toUpperCase());
      if (data) result.set(sym.toUpperCase(), data);
    }
    return result;
  }

  /**
   * Get all currently tracked symbols and their latest prices.
   */
  getAll(): Record<string, PriceData> {
    const result: Record<string, PriceData> = {};
    for (const [sym, data] of this._latest) {
      result[sym] = data;
    }
    return result;
  }

  /** Number of symbols with active prices. */
  get symbolCount(): number {
    return this._latest.size;
  }

  /** Number of active subscriptions across all symbols. */
  get subscriberCount(): number {
    let count = 0;
    for (const subs of this._subscribers.values()) {
      count += subs.size;
    }
    return count + this._globalSubscribers.size;
  }

  /** Clear all data and subscriptions. Mainly for testing. */
  dispose(): void {
    this._latest.clear();
    this._subscribers.clear();
    this._globalSubscribers.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const priceBus = new _PriceBus();

// Expose on window for dev-mode console access
if (typeof window !== 'undefined') {
  (window as any).__priceBus = priceBus;
}

export default priceBus;
