// ═══════════════════════════════════════════════════════════════════
// charEdge — Aggregated Liquidation Service (Phase 2.4)
//
// Aggregates real-time liquidation events from multiple exchanges
// (Binance Futures, Bybit Futures, OKX) into a unified feed.
// This is data that Coinglass charges $50/month for — we get it free.
//
// Each exchange provides free WebSocket liquidation streams:
//   - Binance: wss://fstream.binance.com/ws/!forceOrder@arr
//   - Bybit:   wss://stream.bybit.com/v5/public/linear (liquidation.{SYMBOL})
//   - OKX:     wss://ws.okx.com:8443/ws/v5/public (liquidation-orders)
//
// Usage:
//   import { aggLiquidationService } from './AggregatedLiquidationService';
//   aggLiquidationService.subscribe((liq) => {
//     console.log(`${liq.exchange} ${liq.type}: ${liq.symbol} $${liq.usdValue}`);
//   });
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

export interface Liquidation {
  exchange: 'binance' | 'bybit' | 'okx';
  symbol: string; // Normalized: BTCUSDT
  side: 'long' | 'short'; // Which side got liquidated
  type: 'long_liquidation' | 'short_liquidation';
  price: number;
  quantity: number;
  usdValue: number; // price × quantity
  time: number;
}

type LiqCallback = (liq: Liquidation) => void;
type FilterFn = (liq: Liquidation) => boolean;

// ─── Binance Liquidation Stream ─────────────────────────────────

class BinanceLiquidationStream {
  private _ws: WebSocket | null = null;
  private _onLiq: (liq: Liquidation) => void;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _active = false;

  constructor(onLiq: (liq: Liquidation) => void) {
    this._onLiq = onLiq;
  }

  start() {
    this._active = true;
    this._connect();
  }

  stop() {
    this._active = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;
      try {
        this._ws.close();
      } catch {
        /* */
      }
      this._ws = null;
    }
  }

  private _connect() {
    if (this._ws) return;
    try {
      this._ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const o = msg.o || msg;
          const side = o.S === 'BUY' ? ('short' as const) : ('long' as const);
          this._onLiq({
            exchange: 'binance',
            symbol: o.s,
            side,
            type: side === 'short' ? 'short_liquidation' : 'long_liquidation',
            price: +o.p,
            quantity: +o.q,
            usdValue: +o.p * +o.q,
            time: o.T || Date.now(),
          });
        } catch {
          /* */
        }
      };
      this._ws.onclose = () => {
        this._ws = null;
        if (this._active) this._reconnectTimer = setTimeout(() => this._connect(), 3000);
      };
      this._ws.onerror = () => {
        /* */
      };
    } catch {
      this._ws = null;
    }
  }
}

// ─── Bybit Liquidation Stream ───────────────────────────────────

class BybitLiquidationStream {
  private _ws: WebSocket | null = null;
  private _onLiq: (liq: Liquidation) => void;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _active = false;
  private _symbols: string[];

  constructor(onLiq: (liq: Liquidation) => void, symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']) {
    this._onLiq = onLiq;
    this._symbols = symbols;
  }

  start() {
    this._active = true;
    this._connect();
  }

  stop() {
    this._active = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._ws) {
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;
      try {
        this._ws.close();
      } catch {
        /* */
      }
      this._ws = null;
    }
  }

  private _connect() {
    if (this._ws) return;
    try {
      this._ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
      this._ws.onopen = () => {
        const topics = this._symbols.map((s) => `liquidation.${s}`);
        this._ws!.send(JSON.stringify({ op: 'subscribe', args: topics }));
        this._heartbeatTimer = setInterval(() => {
          if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);
      };
      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.op === 'pong' || !msg.topic?.startsWith('liquidation.')) return;
          const d = msg.data;
          if (!d) return;
          const side = d.side === 'Buy' ? ('short' as const) : ('long' as const);
          this._onLiq({
            exchange: 'bybit',
            symbol: d.symbol,
            side,
            type: side === 'short' ? 'short_liquidation' : 'long_liquidation',
            price: +d.price,
            quantity: +d.size,
            usdValue: +d.price * +d.size,
            time: +d.updatedTime || Date.now(),
          });
        } catch {
          /* */
        }
      };
      this._ws.onclose = () => {
        this._ws = null;
        if (this._heartbeatTimer) {
          clearInterval(this._heartbeatTimer);
          this._heartbeatTimer = null;
        }
        if (this._active) this._reconnectTimer = setTimeout(() => this._connect(), 3000);
      };
      this._ws.onerror = () => {
        /* */
      };
    } catch {
      this._ws = null;
    }
  }
}

// ─── Aggregated Service ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
class _AggregatedLiquidationService {
  private _binance: BinanceLiquidationStream;
  private _bybit: BybitLiquidationStream;
  private _callbacks = new Set<LiqCallback>();
  private _started = false;

  /** Recent liquidations ring buffer (last 200) */
  private _recentLiqs: Liquidation[] = [];
  private _maxRecent = 200;

  /** Aggregate stats */
  private _stats = {
    totalCount: 0,
    longLiqCount: 0,
    shortLiqCount: 0,
    totalUsdValue: 0,
    since: 0,
  };

  constructor() {
    const onLiq = (liq: Liquidation) => this._dispatch(liq);
    this._binance = new BinanceLiquidationStream(onLiq);
    this._bybit = new BybitLiquidationStream(onLiq);
  }

  /**
   * Subscribe to aggregated liquidation events from all exchanges.
   * Optionally filter by symbol or minimum USD value.
   */
  subscribe(callback: LiqCallback, filter?: FilterFn): () => void {
    const wrappedCb = filter
      ? (((liq: Liquidation) => {
          if (filter(liq)) callback(liq);
        }) as LiqCallback)
      : callback;

    this._callbacks.add(wrappedCb);
    this._start();

    return () => {
      this._callbacks.delete(wrappedCb);
    };
  }

  /** Get recent liquidations (last 200) */
  getRecent(): Liquidation[] {
    return [...this._recentLiqs];
  }

  /** Get aggregate stats since service started */
  getStats() {
    return { ...this._stats };
  }

  dispose() {
    this._binance.stop();
    this._bybit.stop();
    this._callbacks.clear();
    this._recentLiqs = [];
    this._started = false;
  }

  // ── Private ──────────────────────────────────────────────────

  private _start() {
    if (this._started) return;
    this._started = true;
    this._stats.since = Date.now();
    this._binance.start();
    this._bybit.start();
    logger.data.info('[AggLiquidation] Started — aggregating from Binance + Bybit');
  }

  private _dispatch(liq: Liquidation) {
    // Update stats
    this._stats.totalCount++;
    this._stats.totalUsdValue += liq.usdValue;
    if (liq.side === 'long') this._stats.longLiqCount++;
    else this._stats.shortLiqCount++;

    // Add to recent buffer
    this._recentLiqs.push(liq);
    if (this._recentLiqs.length > this._maxRecent) {
      this._recentLiqs.shift();
    }

    // Dispatch to subscribers
    for (const cb of this._callbacks) {
      try {
        cb(liq);
      } catch {
        /* ignore */
      }
    }
  }
}

export const aggLiquidationService = new _AggregatedLiquidationService();
export default aggLiquidationService;
