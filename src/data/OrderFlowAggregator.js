// ═══════════════════════════════════════════════════════════════════
// charEdge — Order Flow Aggregator (v2 — Engine Bridge)
//
// Processes tick-level (@aggTrade) and DOM (@depth) streams to
// construct data structures for Footprint and Heatmap renderers.
//
// v2: When the OrderFlowEngine is active for a symbol, delegates
// to it for richer footprint, delta, CVD, VP, and large trade data.
// Falls back to local computation when engine isn't connected.
// ═══════════════════════════════════════════════════════════════════

import { orderFlowEngine } from './engine/orderflow/OrderFlowEngine.js';

/**
 * Footprint Profile Structure:
 * {
 *   [price_bucket]: { bidVol: number, askVol: number, totalVol: number, delta: number }
 * }
 */

export class OrderFlowAggregator {
  constructor(tickSize = 1) {
    this.tickSize = tickSize;
    this.currentBarTime = null;
    this.footprint = {}; // The active footprint for the current candle
    this.domHistory = []; // Array of DOM snapshots for the heatmap
    this.currentDOM = { bids: new Map(), asks: new Map() };

    // v2: Bridge state
    this._symbol = null;      // Symbol this aggregator is bound to
    this._engineActive = false; // Whether OrderFlowEngine has data for this symbol
  }

  /**
   * Bind this aggregator to a specific symbol for engine bridging.
   * @param {string} symbol
   */
  bindSymbol(symbol) {
    this._symbol = (symbol || '').toUpperCase();
    this._checkEngine();
  }

  /** Check if OrderFlowEngine has active data for our symbol. */
  _checkEngine() {
    if (!this._symbol) return;
    const stats = orderFlowEngine.getStats(this._symbol);
    this._engineActive = stats?.active && stats.totalTicks > 0;
  }

  // Adjust precision to group trades into readable footprint rows
  _bucketPrice(priceStr) {
    const p = parseFloat(priceStr);
    return (Math.floor(p / this.tickSize) * this.tickSize).toFixed(8).replace(/\.?0+$/, ''); // clean trailing zeros
  }

  /**
   * Process an incoming @aggTrade WebSocket message
   * @param {Object} msg - Parsed JSON from Binance @aggTrade
   * @param {Object} currentBar - The current OHLCV bar being updated
   */
  processTrade(msg, currentBar) {
    if (!currentBar) return;

    // Reset footprint if we've moved to a new candle
    if (this.currentBarTime !== currentBar.time) {
      this.currentBarTime = currentBar.time;
      this.footprint = {};
    }

    const price = msg.p;
    const qty = parseFloat(msg.q);
    const isMakerBuyer = msg.m;

    // Binance: if maker is buyer (m: true), taker is seller -> Sell order (Bid hit)
    // If maker is seller (m: false), taker is buyer -> Buy order (Ask hit)
    const isBuy = !isMakerBuyer;

    const bucket = this._bucketPrice(price);

    if (!this.footprint[bucket]) {
      this.footprint[bucket] = { bidVol: 0, askVol: 0, totalVol: 0, delta: 0 };
    }

    const row = this.footprint[bucket];

    if (isBuy) {
      row.askVol += qty; // Market buy executed against resting ask
      row.delta += qty;
    } else {
      row.bidVol += qty; // Market sell executed against resting bid
      row.delta -= qty;
    }

    row.totalVol += qty;

    // Attach the footprint data directly to the current bar object
    // so the ChartEngine can pass it to the FootprintRenderer
    currentBar.footprint = this.footprint;
    currentBar.poc = this.calculatePOC();

    // v2: Periodically re-check engine state
    if (this._symbol && !this._engineActive && (currentBar._bridgeCheck || 0) < Date.now() - 5000) {
      currentBar._bridgeCheck = Date.now();
      this._checkEngine();
    }
  }

  /**
   * v2: Enrich a bar with OrderFlowEngine data if available.
   * After calling, bar will have .footprint, .poc, .delta, .buyVol, .sellVol
   *
   * @param {Object} bar - OHLCV bar object
   * @param {string} tf  - Timeframe string ('1m', '5m', etc.)
   * @returns {Object} Same bar (mutated in-place)
   */
  enrichBar(bar, tf = '5m') {
    if (!bar || !this._symbol) return bar;
    this._checkEngine();

    if (this._engineActive) {
      // Delegate to the richer OrderFlowEngine
      const { footprint, poc } = orderFlowEngine.getFootprint(this._symbol, bar.time, tf);
      if (footprint && Object.keys(footprint).length > 0) {
        bar.footprint = footprint;
        bar.poc = poc;
      }

      const delta = orderFlowEngine.getCandleDelta(this._symbol, tf, bar.time);
      if (delta) {
        bar.delta = delta.delta;
        bar.buyVol = delta.buyVol;
        bar.sellVol = delta.sellVol;
      }
    }

    return bar;
  }

  /**
   * v2: Enrich an entire bar array with engine data.
   * @param {Array} bars
   * @param {string} tf
   * @returns {Array} Same array (mutated in-place)
   */
  enrichBars(bars, tf = '5m') {
    if (!bars?.length || !this._symbol) return bars;
    this._checkEngine();  // single check for the batch

    if (this._engineActive) {
      orderFlowEngine.attachFootprints(this._symbol, bars, tf);
    }

    return bars;
  }

  /**
   * Process an incoming @depth or @depth20 WebSocket message for Heatmaps
   * @param {Object} msg - Parsed JSON from Binance depth stream
   */
  processDOMSnapshot(msg) {
    const snapshot = {
      time: Date.now(),
      bids: msg.bids || [],
      asks: msg.asks || []
    };

    this.domHistory.push(snapshot);
    if (this.domHistory.length > 1000) {
      this.domHistory.shift();
    }
  }

  /**
   * Calculate Point of Control (price level with highest volume)
   */
  calculatePOC() {
    let maxVol = -1;
    let pocPrice = null;

    for (const [price, data] of Object.entries(this.footprint)) {
      if (data.totalVol > maxVol) {
        maxVol = data.totalVol;
        pocPrice = parseFloat(price);
      }
    }

    return pocPrice;
  }

  // ─── v2: Engine Bridge Proxies ─────────────────────────────────

  /**
   * Get CVD history from the engine (if active).
   * @returns {{ current: number, history: Array<{ time, cvd }> } | null}
   */
  getCVD() {
    if (!this._symbol) return null;
    this._checkEngine();
    return this._engineActive ? orderFlowEngine.getCVD(this._symbol) : null;
  }

  /**
   * Get delta array for a timeframe from the engine.
   * @param {string} tf
   * @returns {Array<{ time, buyVol, sellVol, delta, count }>}
   */
  getDelta(tf = '5m') {
    if (!this._symbol) return [];
    this._checkEngine();
    return this._engineActive ? orderFlowEngine.getDelta(this._symbol, tf) : [];
  }

  /**
   * Get aggressor ratio (buy % vs sell %).
   * @returns {{ buyPct: number, sellPct: number } | null}
   */
  getAggressorRatio() {
    if (!this._symbol) return null;
    this._checkEngine();
    return this._engineActive ? orderFlowEngine.getAggressorRatio(this._symbol) : null;
  }

  /**
   * Get volume profile from the engine.
   * @returns {{ levels, poc, vah, val, tickSize } | null}
   */
  getVolumeProfile() {
    if (!this._symbol) return null;
    this._checkEngine();
    return this._engineActive ? orderFlowEngine.getVolumeProfile(this._symbol) : null;
  }

  /**
   * Get large trades from the engine.
   * @param {number} limit
   * @returns {Array}
   */
  getLargeTrades(limit = 20) {
    if (!this._symbol) return [];
    this._checkEngine();
    return this._engineActive ? orderFlowEngine.getLargeTrades(this._symbol, limit) : [];
  }

  /** Whether the engine bridge is active. */
  get isEngineBridged() {
    this._checkEngine();
    return this._engineActive;
  }
}

// Map of aggregators per symbol_tf
const aggregators = new Map();

export function getAggregator(key, tickSize = 1) {
  if (!aggregators.has(key)) {
    aggregators.set(key, new OrderFlowAggregator(tickSize));
  }
  return aggregators.get(key);
}

export function removeAggregator(key) {
  aggregators.delete(key);
}
