// ═══════════════════════════════════════════════════════════════════
// charEdge — MiniTicker Service (Phase 4.3)
//
// Subscribes to Binance `!miniTicker@arr` stream — a single WebSocket
// subscription that provides price updates for ALL trading pairs (~500+).
//
// This replaces per-symbol watchlist subscriptions:
//   Before: 50 symbols × 1 stream each = 50 streams
//   After:  1 stream = ALL symbols, ~100 bytes/symbol/update
//
// Memory: ~500KB for 500 symbols (1KB each), updates every ~1s.
// Bandwidth: ~50KB/s (one batch per second with all symbols).
//
// Usage:
//   import { miniTickerService } from './MiniTickerService';
//   miniTickerService.start();
//   miniTickerService.getPrice('BTCUSDT'); // → { price, volume, high, low, ... }
//   miniTickerService.subscribe('BTCUSDT', (ticker) => { ... });
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

const BINANCE_WS = 'wss://data-stream.binance.vision/ws/!miniTicker@arr';

export interface MiniTicker {
  symbol: string;
  price: number; // Close price
  open: number; // Open price (24h)
  high: number; // High (24h)
  low: number; // Low (24h)
  volume: number; // Base asset volume (24h)
  quoteVolume: number; // Quote asset volume (24h)
  changePct: number; // Price change percent (24h)
  time: number; // Event time
}

type TickerCallback = (ticker: MiniTicker) => void;

// eslint-disable-next-line @typescript-eslint/naming-convention
class _MiniTickerService {
  private _ws: WebSocket | null = null;
  private _connected = false;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempts = 0;

  /** All-symbol price cache: BTCUSDT → MiniTicker */
  private _prices = new Map<string, MiniTicker>();

  /** Per-symbol callbacks for targeted updates */
  private _subscribers = new Map<string, Set<TickerCallback>>();

  /** Global callbacks that receive all ticker updates */
  private _globalCallbacks = new Set<(tickers: MiniTicker[]) => void>();

  private _started = false;

  /**
   * Start the mini ticker stream.
   * Idempotent — safe to call multiple times.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._connect();
  }

  /**
   * Stop the mini ticker stream and clean up.
   */
  stop() {
    this._started = false;
    this._closeWs();
    this._prices.clear();
  }

  /**
   * Get the latest price for a symbol (instant, from cache).
   * Returns null if no data received yet.
   */
  getPrice(symbol: string): MiniTicker | null {
    return this._prices.get(symbol.toUpperCase()) ?? null;
  }

  /**
   * Get all cached prices.
   */
  getAllPrices(): Map<string, MiniTicker> {
    return this._prices;
  }

  /**
   * Subscribe to updates for a specific symbol.
   * @returns unsubscribe function
   */
  subscribe(symbol: string, callback: TickerCallback): () => void {
    const upper = symbol.toUpperCase();
    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper)!.add(callback);

    // Auto-start if not running
    this.start();

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this._subscribers.delete(upper);
      }
    };
  }

  /**
   * Subscribe to ALL ticker updates (batch).
   * @returns unsubscribe function
   */
  subscribeAll(callback: (tickers: MiniTicker[]) => void): () => void {
    this._globalCallbacks.add(callback);
    this.start();
    return () => {
      this._globalCallbacks.delete(callback);
    };
  }

  /** Number of symbols with price data */
  get symbolCount(): number {
    return this._prices.size;
  }

  get connected(): boolean {
    return this._connected;
  }

  // ── Private ──────────────────────────────────────────────────

  private _connect() {
    if (this._ws) return;

    try {
      this._ws = new WebSocket(BINANCE_WS);

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectAttempts = 0;
        logger.data.info(`[MiniTickerService] Connected — receiving all-market price updates`);
      };

      this._ws.onmessage = (evt) => {
        try {
          const tickers = JSON.parse(evt.data);
          if (!Array.isArray(tickers)) return;

          const parsed: MiniTicker[] = [];

          for (const t of tickers) {
            const ticker: MiniTicker = {
              symbol: t.s,
              price: +t.c, // Close price
              open: +t.o, // Open price
              high: +t.h, // High
              low: +t.l, // Low
              volume: +t.v, // Base volume
              quoteVolume: +t.q, // Quote volume
              changePct: ((+t.c - +t.o) / +t.o) * 100,
              time: t.E,
            };

            // Update cache
            this._prices.set(ticker.symbol, ticker);
            parsed.push(ticker);

            // Dispatch to per-symbol subscribers
            const subs = this._subscribers.get(ticker.symbol);
            if (subs) {
              for (const cb of subs) {
                try {
                  cb(ticker);
                } catch {
                  /* ignore */
                }
              }
            }
          }

          // Dispatch to global subscribers
          if (parsed.length > 0 && this._globalCallbacks.size > 0) {
            for (const cb of this._globalCallbacks) {
              try {
                cb(parsed);
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* ignore parse errors */
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._ws = null;
        if (this._started) this._scheduleReconnect();
      };

      this._ws.onerror = () => {
        /* onclose will fire */
      };
    } catch {
      this._ws = null;
      if (this._started) this._scheduleReconnect();
    }
  }

  private _closeWs() {
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
        /* ignore */
      }
      this._ws = null;
    }
    this._connected = false;
  }

  private _scheduleReconnect() {
    if (this._reconnectAttempts >= 10) {
      logger.data.warn('[MiniTickerService] Max reconnect attempts reached');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30_000);
    const jitter = delay * (0.5 + Math.random());
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, jitter);
  }
}

export const miniTickerService = new _MiniTickerService();
export default miniTickerService;
