// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Heatmap Engine (Phase 10)
//
// Aggregates anonymized entry/exit prices from P2P peers.
// Builds a price-level histogram showing retail activity zones.
//
// Privacy controls:
//   - All prices rounded to nearest 0.1% to prevent deanonymization
//   - No user/peer IDs stored with trade events
//   - Sliding window (last 100 events per symbol)
//   - Opt-in only
// ═══════════════════════════════════════════════════════════════════

// Message type constant (previously from PeerProtocol.js)
const MSG = Object.freeze({ TRADE_HEATMAP: 'trade_heatmap' });

// ─── Constants ──────────────────────────────────────────────────

const MAX_EVENTS_PER_SYMBOL = 100;
const NUM_BINS              = 40;
const ANONYMIZE_PRECISION   = 0.001; // Round to nearest 0.1%

// ─── Event Types ────────────────────────────────────────────────

export const HEATMAP_EVENT = Object.freeze({
  ENTRY: 'entry',
  EXIT:  'exit',
});

// ═══════════════════════════════════════════════════════════════════
// TradeHeatmapEngine Class
// ═══════════════════════════════════════════════════════════════════

export class TradeHeatmapEngine extends EventTarget {
  constructor() {
    super();
    /**
     * events[symbol] = [{ type, price, ts }]
     * @type {Map<string, Array<{ type: string, price: number, ts: number }>>}
     */
    this._events = new Map();

    /** Privacy opt-in flag */
    this._optedIn = false;
  }

  // ─── Privacy ────────────────────────────────────────────────

  get isOptedIn() { return this._optedIn; }

  setOptIn(value) {
    this._optedIn = !!value;
    if (!this._optedIn) {
      this._events.clear();
    }
  }

  // ─── Anonymization ─────────────────────────────────────────

  /**
   * Round a price to the nearest 0.1% to prevent deanonymization.
   * E.g., 45,231.47 → 45,230 (rounded to ~0.1% bucket).
   * @param {number} price
   * @returns {number}
   */
  anonymizePrice(price) {
    if (price <= 0) return 0;
    const bucket = price * ANONYMIZE_PRECISION;
    return Math.round(price / bucket) * bucket;
  }

  // ─── Local Trade Registration ──────────────────────────────

  /**
   * Register a local trade for broadcasting.
   * Returns the anonymized payload to send to peers.
   * @param {string} symbol
   * @param {string} type - 'entry' or 'exit'
   * @param {number} price
   * @returns {{ ok: boolean, payload?: Object }}
   */
  registerTrade(symbol, type, price) {
    if (!this._optedIn) return { ok: false };
    if (!Object.values(HEATMAP_EVENT).includes(type)) return { ok: false };

    const anonPrice = this.anonymizePrice(price);
    const event = { type, price: anonPrice, ts: Date.now() };

    this._addEvent(symbol, event);

    return {
      ok: true,
      payload: { symbol, type, price: anonPrice, ts: event.ts },
    };
  }

  // ─── Incoming Peer Events ──────────────────────────────────

  /**
   * Process an incoming TRADE_HEATMAP message from a peer.
   * @param {Object} msg - Parsed protocol message
   */
  handlePeerMessage(msg) {
    if (msg.type !== MSG.TRADE_HEATMAP || !this._optedIn) return;

    const { symbol, type, price, ts } = msg.payload || {};
    if (!symbol || !type || !price) return;

    // Re-anonymize (don't trust peer's rounding)
    const anonPrice = this.anonymizePrice(price);
    this._addEvent(symbol, { type, price: anonPrice, ts: ts || Date.now() });
  }

  // ─── Profile Computation ───────────────────────────────────

  /**
   * Build a heatmap profile for a symbol.
   * Returns price bins with entry/exit density.
   *
   * @param {string} symbol
   * @param {number} [priceMin] - Optional price range override
   * @param {number} [priceMax] - Optional price range override
   * @returns {{ bins: Array<{ priceMin: number, priceMax: number, priceMid: number, entries: number, exits: number, total: number, normalized: number }>, hotZone: { price: number, density: number } } | null}
   */
  getProfile(symbol, priceMin, priceMax) {
    const events = this._events.get(symbol);
    if (!events?.length) return null;

    // Determine price range
    let lo = priceMin ?? Infinity;
    let hi = priceMax ?? -Infinity;
    if (priceMin == null || priceMax == null) {
      for (const e of events) {
        if (e.price < lo) lo = e.price;
        if (e.price > hi) hi = e.price;
      }
    }

    const range = hi - lo;
    if (range <= 0) return null;

    const binSize = range / NUM_BINS;

    // Initialize bins
    const bins = [];
    for (let i = 0; i < NUM_BINS; i++) {
      bins.push({
        priceMin: lo + i * binSize,
        priceMax: lo + (i + 1) * binSize,
        priceMid: lo + (i + 0.5) * binSize,
        entries: 0,
        exits: 0,
        total: 0,
        normalized: 0,
      });
    }

    // Distribute events into bins
    let maxTotal = 0;
    for (const e of events) {
      const idx = Math.min(NUM_BINS - 1, Math.max(0, Math.floor((e.price - lo) / binSize)));
      if (e.type === HEATMAP_EVENT.ENTRY) {
        bins[idx].entries++;
      } else {
        bins[idx].exits++;
      }
      bins[idx].total++;
      if (bins[idx].total > maxTotal) maxTotal = bins[idx].total;
    }

    // Normalize
    if (maxTotal > 0) {
      for (const bin of bins) {
        bin.normalized = bin.total / maxTotal;
      }
    }

    // Find hot zone (highest density)
    let hotIdx = 0;
    for (let i = 1; i < NUM_BINS; i++) {
      if (bins[i].total > bins[hotIdx].total) hotIdx = i;
    }

    return {
      bins,
      hotZone: { price: bins[hotIdx].priceMid, density: bins[hotIdx].normalized },
      totalEvents: events.length,
    };
  }

  // ─── Internal ───────────────────────────────────────────────

  _addEvent(symbol, event) {
    if (!this._events.has(symbol)) {
      this._events.set(symbol, []);
    }

    const arr = this._events.get(symbol);
    arr.push(event);

    // Enforce sliding window
    while (arr.length > MAX_EVENTS_PER_SYMBOL) arr.shift();

    this._emit('heatmap-update', { symbol });
  }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /**
   * Clear all stored data (e.g., on opt-out).
   */
  clear() {
    this._events.clear();
  }

  destroy() {
    this._events.clear();
  }
}

// ─── Singleton ────────────────────────────────────────────────

let _instance = null;

export function getTradeHeatmapEngine() {
  if (!_instance) _instance = new TradeHeatmapEngine();
  return _instance;
}

export default TradeHeatmapEngine;
