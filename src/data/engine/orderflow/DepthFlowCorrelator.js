// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Depth × OrderFlow Correlation Engine
//
// Cross-references DepthEngine (order book) and OrderFlowEngine
// (trade flow) to detect institutional trading patterns:
//
//   • Absorption: Large resting order gets eaten but price doesn't move
//   • Iceberg: Repeated fills at same price level (bid wall refills)
//   • Sweep: Rapid removal of multiple depth levels (market sweep)
//   • Divergence: Book building on one side while trades hit the other
//
// Usage:
//   import { depthFlowCorrelator } from './DepthFlowCorrelator.js';
//   depthFlowCorrelator.start('BTCUSDT');
//   depthFlowCorrelator.onEvent((event) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { depthEngine } from './DepthEngine.js';
import { orderFlowEngine } from './OrderFlowEngine.js';
import { pipelineLogger } from '../infra/DataPipelineLogger.js';

// ─── Constants ─────────────────────────────────────────────────

const ABSORPTION_VOLUME_THRESHOLD = 0.6;  // 60% of wall filled but price holds
const ICEBERG_REFILL_COUNT = 3;           // 3+ refills at same level = iceberg
const ICEBERG_WINDOW_MS = 30_000;         // 30-second window for iceberg detection
const SWEEP_LEVELS_MIN = 3;              // 3+ levels removed in one update = sweep
const SWEEP_TIME_WINDOW_MS = 2000;       // Within 2 seconds
const DIVERGENCE_LOOKBACK_MS = 30_000;   // 30-second lookback for divergence
const MAX_EVENTS = 200;                  // Keep last 200 events
const POLL_INTERVAL_MS = 1000;           // Check correlations every 1s

// ─── Event Types ───────────────────────────────────────────────

const EVENT_TYPE = {
  ABSORPTION: 'absorption',
  ICEBERG: 'iceberg',
  SWEEP: 'sweep',
  DIVERGENCE: 'divergence',
};

// ─── Per-Symbol Tracking State ─────────────────────────────────

class CorrelationState {
  constructor(symbol) {
    this.symbol = symbol;

    // Depth tracking
    this.prevBidWall = null;      // { price, qty }
    this.prevAskWall = null;
    this.prevBidLevels = 0;
    this.prevAskLevels = 0;

    // Iceberg tracking: Map<price, { refillCount, lastSeen, initialQty }>
    this.icebergCandidates = new Map();

    // Trade flow tracking
    this.recentBuyVol = 0;
    this.recentSellVol = 0;
    this.recentTradeCount = 0;

    // Sweep tracking
    this.prevDepthSnapshot = null;
  }
}

// ─── Depth × OrderFlow Correlator ──────────────────────────────

class _DepthFlowCorrelator {
  constructor() {
    this._symbols = new Map();       // symbol → CorrelationState
    this._events = [];               // Global event log
    this._eventCallbacks = new Set();
    this._depthUnsubs = new Map();   // symbol → unsubscribe
    this._flowUnsubs = new Map();    // symbol → unsubscribe
    this._pollTimers = new Map();    // symbol → intervalId
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Start correlating depth × order flow for a symbol.
   * @param {string} symbol - e.g., 'BTCUSDT'
   */
  start(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (this._symbols.has(upper)) return;

    const state = new CorrelationState(upper);
    this._symbols.set(upper, state);

    // Subscribe to depth updates
    const depthUnsub = depthEngine.subscribe(upper, (snapshot) => {
      this._onDepthUpdate(upper, state, snapshot);
    }, { levels: 20, updateMs: 500 });
    this._depthUnsubs.set(upper, depthUnsub);

    // Subscribe to order flow ticks
    const flowUnsub = orderFlowEngine.subscribe(upper, (tick) => {
      this._onTick(upper, state, tick);
    });
    this._flowUnsubs.set(upper, flowUnsub);

    // Periodic divergence check
    this._pollTimers.set(upper, setInterval(() => {
      this._checkDivergence(upper, state);
    }, POLL_INTERVAL_MS));

    pipelineLogger.info('DepthFlowCorrelator', `Started correlation for ${upper}`);
  }

  /**
   * Stop correlating for a symbol.
   * @param {string} symbol
   */
  stop(symbol) {
    const upper = (symbol || '').toUpperCase();

    const depthUnsub = this._depthUnsubs.get(upper);
    if (depthUnsub) { depthUnsub(); this._depthUnsubs.delete(upper); }

    const flowUnsub = this._flowUnsubs.get(upper);
    if (flowUnsub) { flowUnsub(); this._flowUnsubs.delete(upper); }

    const timer = this._pollTimers.get(upper);
    if (timer) { clearInterval(timer); this._pollTimers.delete(upper); }

    this._symbols.delete(upper);
  }

  /**
   * Subscribe to correlation events.
   * @param {Function} callback - (event) => void
   * @returns {Function} unsubscribe
   */
  onEvent(callback) {
    this._eventCallbacks.add(callback);
    return () => this._eventCallbacks.delete(callback);
  }

  /**
   * Get recent events for a symbol.
   * @param {string} [symbol] - Optional filter by symbol
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getEvents(symbol, limit = 20) {
    const events = symbol
      ? this._events.filter(e => e.symbol === symbol.toUpperCase())
      : this._events;
    return events.slice(-limit);
  }

  /**
   * Get all actively tracked symbols.
   * @returns {string[]}
   */
  getActiveSymbols() {
    return [...this._symbols.keys()];
  }

  /**
   * Dispose: stop all correlations.
   */
  dispose() {
    for (const sym of [...this._symbols.keys()]) {
      this.stop(sym);
    }
    this._events = [];
    this._eventCallbacks.clear();
  }

  // ─── Private: Depth Update Handler ───────────────────────────

  _onDepthUpdate(symbol, state, snapshot) {
    // ── Sweep Detection ──
    // Check if multiple levels were removed in one update
    if (state.prevDepthSnapshot) {
      const prevBids = state.prevDepthSnapshot.bids || [];
      const prevAsks = state.prevDepthSnapshot.asks || [];
      const currBids = snapshot.bids || [];
      const currAsks = snapshot.asks || [];

      // Count removed bid levels
      const currBidPrices = new Set(currBids.map(b => b.price));
      const removedBids = prevBids.filter(b => !currBidPrices.has(b.price) && b.qty > 0);

      if (removedBids.length >= SWEEP_LEVELS_MIN) {
        const totalSweptQty = removedBids.reduce((s, b) => s + b.qty, 0);
        this._emitEvent({
          type: EVENT_TYPE.SWEEP,
          symbol,
          side: 'bid',
          levelsRemoved: removedBids.length,
          totalQuantity: totalSweptQty,
          priceRange: [
            Math.min(...removedBids.map(b => b.price)),
            Math.max(...removedBids.map(b => b.price)),
          ],
          time: Date.now(),
          severity: removedBids.length >= 5 ? 'high' : 'medium',
        });
      }

      // Count removed ask levels
      const currAskPrices = new Set(currAsks.map(a => a.price));
      const removedAsks = prevAsks.filter(a => !currAskPrices.has(a.price) && a.qty > 0);

      if (removedAsks.length >= SWEEP_LEVELS_MIN) {
        const totalSweptQty = removedAsks.reduce((s, a) => s + a.qty, 0);
        this._emitEvent({
          type: EVENT_TYPE.SWEEP,
          symbol,
          side: 'ask',
          levelsRemoved: removedAsks.length,
          totalQuantity: totalSweptQty,
          priceRange: [
            Math.min(...removedAsks.map(a => a.price)),
            Math.max(...removedAsks.map(a => a.price)),
          ],
          time: Date.now(),
          severity: removedAsks.length >= 5 ? 'high' : 'medium',
        });
      }
    }

    // ── Absorption Detection ──
    // Bid wall: large resting bid that absorbs sell volume but price holds
    if (snapshot.bidWallPrice && snapshot.totalBidDepth > 0) {
      const wallQty = snapshot.bids.find(b => b.price === snapshot.bidWallPrice)?.qty || 0;

      if (state.prevBidWall && state.prevBidWall.price === snapshot.bidWallPrice) {
        const consumed = state.prevBidWall.qty - wallQty;
        if (consumed > 0 && consumed / state.prevBidWall.qty > ABSORPTION_VOLUME_THRESHOLD) {
          // Wall absorbed significant volume but price still here → absorption
          this._emitEvent({
            type: EVENT_TYPE.ABSORPTION,
            symbol,
            side: 'bid',
            price: snapshot.bidWallPrice,
            absorbed: consumed,
            remaining: wallQty,
            pctConsumed: Math.round((consumed / state.prevBidWall.qty) * 100),
            time: Date.now(),
            severity: consumed / state.prevBidWall.qty > 0.8 ? 'high' : 'medium',
          });
        }
      }
      state.prevBidWall = { price: snapshot.bidWallPrice, qty: wallQty };
    }

    // Ask wall absorption
    if (snapshot.askWallPrice && snapshot.totalAskDepth > 0) {
      const wallQty = snapshot.asks.find(a => a.price === snapshot.askWallPrice)?.qty || 0;

      if (state.prevAskWall && state.prevAskWall.price === snapshot.askWallPrice) {
        const consumed = state.prevAskWall.qty - wallQty;
        if (consumed > 0 && consumed / state.prevAskWall.qty > ABSORPTION_VOLUME_THRESHOLD) {
          this._emitEvent({
            type: EVENT_TYPE.ABSORPTION,
            symbol,
            side: 'ask',
            price: snapshot.askWallPrice,
            absorbed: consumed,
            remaining: wallQty,
            pctConsumed: Math.round((consumed / state.prevAskWall.qty) * 100),
            time: Date.now(),
            severity: consumed / state.prevAskWall.qty > 0.8 ? 'high' : 'medium',
          });
        }
      }
      state.prevAskWall = { price: snapshot.askWallPrice, qty: wallQty };
    }

    // ── Iceberg Detection ──
    // Track price levels that keep refilling after being consumed
    for (const bid of (snapshot.bids || []).slice(0, 5)) {
      const key = `bid-${bid.price}`;
      const prev = state.icebergCandidates.get(key);
      if (prev) {
        // Level exists again — check if it was consumed and refilled
        if (prev.wasConsumed && Date.now() - prev.lastSeen < ICEBERG_WINDOW_MS) {
          prev.refillCount++;
          prev.wasConsumed = false;
          prev.lastSeen = Date.now();

          if (prev.refillCount >= ICEBERG_REFILL_COUNT) {
            this._emitEvent({
              type: EVENT_TYPE.ICEBERG,
              symbol,
              side: 'bid',
              price: bid.price,
              refillCount: prev.refillCount,
              currentQty: bid.qty,
              time: Date.now(),
              severity: prev.refillCount >= 5 ? 'high' : 'medium',
            });
            state.icebergCandidates.delete(key); // Reset tracking
          }
        }
      } else {
        state.icebergCandidates.set(key, {
          initialQty: bid.qty,
          refillCount: 0,
          wasConsumed: false,
          lastSeen: Date.now(),
        });
      }
    }

    // Mark consumed levels
    if (state.prevDepthSnapshot) {
      for (const [key, data] of state.icebergCandidates) {
        const price = parseFloat(key.split('-')[1]);
        const side = key.startsWith('bid') ? 'bids' : 'asks';
        const exists = (snapshot[side] || []).some(l => l.price === price);
        if (!exists) {
          data.wasConsumed = true;
        }
      }
    }

    // Clean stale iceberg candidates
    const now = Date.now();
    for (const [key, data] of state.icebergCandidates) {
      if (now - data.lastSeen > ICEBERG_WINDOW_MS * 2) {
        state.icebergCandidates.delete(key);
      }
    }

    state.prevDepthSnapshot = snapshot;
  }

  // ─── Private: Tick Handler ───────────────────────────────────

  _onTick(symbol, state, tick) {
    if (tick.side === 'buy') {
      state.recentBuyVol += tick.volume;
    } else {
      state.recentSellVol += tick.volume;
    }
    state.recentTradeCount++;
  }

  // ─── Private: Divergence Check ───────────────────────────────

  _checkDivergence(symbol, state) {
    const depth = depthEngine.getDepth(symbol);
    if (!depth || state.recentTradeCount < 10) return;

    // Reset volumes for next window
    const buyVol = state.recentBuyVol;
    const sellVol = state.recentSellVol;
    state.recentBuyVol = 0;
    state.recentSellVol = 0;
    state.recentTradeCount = 0;

    const totalVol = buyVol + sellVol;
    if (totalVol === 0) return;

    const tradeBias = buyVol / totalVol; // >0.5 = more buying
    const depthBias = depth.imbalanceRatio;   // >0.5 = more bid depth

    // Divergence: heavy buying but depth building on ask side (or vice versa)
    // Strong buy flow + ask-heavy book = potential trap / distribution
    if (tradeBias > 0.65 && depthBias < 0.4) {
      this._emitEvent({
        type: EVENT_TYPE.DIVERGENCE,
        symbol,
        description: 'Heavy buying flow but ask-side depth building (distribution?)',
        tradeBuyPct: Math.round(tradeBias * 100),
        depthBidPct: Math.round(depthBias * 100),
        recentBuyVol: buyVol,
        recentSellVol: sellVol,
        time: Date.now(),
        severity: 'medium',
      });
    }

    // Strong sell flow + bid-heavy book = potential accumulation
    if (tradeBias < 0.35 && depthBias > 0.6) {
      this._emitEvent({
        type: EVENT_TYPE.DIVERGENCE,
        symbol,
        description: 'Heavy selling flow but bid-side depth building (accumulation?)',
        tradeBuyPct: Math.round(tradeBias * 100),
        depthBidPct: Math.round(depthBias * 100),
        recentBuyVol: buyVol,
        recentSellVol: sellVol,
        time: Date.now(),
        severity: 'medium',
      });
    }
  }

  // ─── Private: Event Emission ─────────────────────────────────

  _emitEvent(event) {
    this._events.push(event);
    if (this._events.length > MAX_EVENTS) {
      this._events = this._events.slice(-MAX_EVENTS);
    }

    for (const cb of this._eventCallbacks) {
      try { cb(event); }
      catch (err) {
        pipelineLogger.warn('DepthFlowCorrelator', 'Event callback error', err);
      }
    }

    pipelineLogger.info('DepthFlowCorrelator',
      `[${event.type.toUpperCase()}] ${event.symbol} — ${event.description || event.side || ''}`);
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const depthFlowCorrelator = new _DepthFlowCorrelator();
export default depthFlowCorrelator;
