// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeSnapshot Types (Task 5.6.1)
//
// Market state captured automatically at trade execution time.
// Attached to trades as `context.snapshot` for post-trade analysis,
// replay, and behavioral intelligence.
// ═══════════════════════════════════════════════════════════════════

// ─── Snapshot Schema ─────────────────────────────────────────────

/** Market state captured at the moment of trade execution. */
export interface TradeSnapshot {
  /** Millisecond epoch when snapshot was captured */
  capturedAt: number;

  // ─── Price Context ──────────────────────────────────────────
  /** Market price at execution */
  price: number;
  /** Best bid (if available) */
  bid?: number;
  /** Best ask (if available) */
  ask?: number;
  /** Bid-ask spread (if available) */
  spread?: number;

  // ─── Volume ─────────────────────────────────────────────────
  /** 24h volume (if available) */
  volume24h?: number;
  /** Volume of the current bar */
  volumeBar?: number;

  // ─── Indicators ─────────────────────────────────────────────
  /**
   * Active indicator values at snapshot time.
   * Keys follow the format `${indicatorId}_${period}`, e.g. "sma_20", "rsi_14".
   * Values are the latest computed value, or null if not yet computed.
   */
  indicators: Record<string, number | null>;

  // ─── Order Book Depth ───────────────────────────────────────
  /** Aggregated order book depth (if available) */
  orderBookDepth?: {
    /** Total bid volume in top N levels */
    bids: number;
    /** Total ask volume in top N levels */
    asks: number;
    /** Bid/ask imbalance ratio: bids / (bids + asks) */
    imbalance?: number;
  };

  // ─── Candle Context ─────────────────────────────────────────
  /** The current (forming or latest) bar at snapshot time */
  currentBar?: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    t: number;
  };

  /** Timeframe of the active chart, e.g. '1m', '5m', '1h' */
  timeframe: string;
  /** Symbol of the active chart */
  symbol: string;
}

// ─── Trade Context Wrapper ───────────────────────────────────────

/** Context attached to a trade object for post-trade analysis. */
export interface TradeContext {
  /** Market state snapshot at trade execution */
  snapshot: TradeSnapshot;
  /** Original stop-loss at entry time (for HOPE_TRADING detection) */
  originalStopLoss?: number | null;
  /** Original take-profit at entry time (for EARLY_EXIT detection) */
  originalTakeProfit?: number | null;
}

// ─── Factory ─────────────────────────────────────────────────────

/**
 * Create a TradeSnapshot from chart state values.
 * Pure function — no store access, all values passed in.
 */
export function createSnapshot(params: {
  symbol: string;
  timeframe: string;
  price: number;
  indicators: Record<string, number | null>;
  currentBar?: TradeSnapshot['currentBar'];
  bid?: number;
  ask?: number;
  volumeBar?: number;
  volume24h?: number;
  orderBookDepth?: TradeSnapshot['orderBookDepth'];
}): TradeSnapshot {
  const snapshot: TradeSnapshot = {
    capturedAt: Date.now(),
    symbol: params.symbol,
    timeframe: params.timeframe,
    price: params.price,
    indicators: { ...params.indicators },
  };

  if (params.currentBar) snapshot.currentBar = params.currentBar;
  if (params.bid != null) snapshot.bid = params.bid;
  if (params.ask != null) snapshot.ask = params.ask;
  if (params.bid != null && params.ask != null) {
    snapshot.spread = Math.abs(params.ask - params.bid);
  }
  if (params.volumeBar != null) snapshot.volumeBar = params.volumeBar;
  if (params.volume24h != null) snapshot.volume24h = params.volume24h;
  if (params.orderBookDepth) snapshot.orderBookDepth = params.orderBookDepth;

  return snapshot;
}

/**
 * Extract indicator key name from an indicator config object.
 * Produces keys like "sma_20", "ema_50", "rsi_14".
 */
export function indicatorKey(indicator: {
  indicatorId?: string;
  type?: string;
  params?: Record<string, unknown>;
}): string {
  const id = indicator.indicatorId || indicator.type || 'unknown';
  const period = indicator.params?.period ?? indicator.params?.length ?? '';
  return period ? `${id}_${period}` : id;
}
