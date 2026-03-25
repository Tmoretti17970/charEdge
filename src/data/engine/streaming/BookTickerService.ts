// ═══════════════════════════════════════════════════════════════════
// charEdge — BookTicker Service (Phase 2.2)
//
// Subscribes to Binance `@bookTicker` stream for best bid/ask data.
// Provides real-time spread information — a feature TradingView reserves
// for paid users, available to us for free via Binance public WS.
//
// Usage:
//   import { bookTickerService } from './BookTickerService';
//   bookTickerService.subscribe('BTCUSDT', ({ bid, ask, spread }) => {
//     console.log(`Spread: ${spread.toFixed(2)} (${spreadPct.toFixed(4)}%)`);
//   });
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

const BINANCE_WS_BASE = 'wss://data-stream.binance.vision/ws';

export interface BookTicker {
  symbol: string;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  spread: number; // ask - bid
  spreadPct: number; // (ask - bid) / ask * 100
  midPrice: number; // (bid + ask) / 2
  time: number;
}

type BookTickerCallback = (data: BookTicker) => void;

// eslint-disable-next-line @typescript-eslint/naming-convention
class _BookTickerService {
  private _ws: WebSocket | null = null;
  private _connected = false;
  private _activeSymbol: string | null = null;
  private _callbacks = new Set<BookTickerCallback>();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _latest: BookTicker | null = null;

  /**
   * Subscribe to best bid/ask updates for a symbol.
   * Only one symbol active at a time (the chart symbol).
   * @returns unsubscribe function
   */
  subscribe(symbol: string, callback: BookTickerCallback): () => void {
    const upper = symbol.toUpperCase();
    // Ensure it ends with USDT
    const sym = upper.endsWith('USDT') ? upper : upper + 'USDT';

    this._callbacks.add(callback);

    // Switch symbol if needed
    if (this._activeSymbol !== sym) {
      this._closeWs();
      this._activeSymbol = sym;
      this._connect();
    }

    return () => {
      this._callbacks.delete(callback);
      if (this._callbacks.size === 0) {
        this._closeWs();
        this._activeSymbol = null;
      }
    };
  }

  /**
   * Get the latest bid/ask data (instant, from cache).
   */
  getLatest(): BookTicker | null {
    return this._latest;
  }

  get connected(): boolean {
    return this._connected;
  }

  // ── Private ──────────────────────────────────────────────────

  private _connect() {
    if (!this._activeSymbol || this._ws) return;

    const stream = `${this._activeSymbol.toLowerCase()}@bookTicker`;
    const url = `${BINANCE_WS_BASE}/${stream}`;

    try {
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        this._connected = true;
        logger.data.info(`[BookTickerService] Streaming bid/ask for ${this._activeSymbol}`);
      };

      this._ws.onmessage = (evt) => {
        try {
          const d = JSON.parse(evt.data);
          const bid = +d.b;
          const ask = +d.a;

          const ticker: BookTicker = {
            symbol: d.s,
            bidPrice: bid,
            bidQty: +d.B,
            askPrice: ask,
            askQty: +d.A,
            spread: ask - bid,
            spreadPct: ask > 0 ? ((ask - bid) / ask) * 100 : 0,
            midPrice: (bid + ask) / 2,
            time: d.u || Date.now(),
          };

          this._latest = ticker;

          for (const cb of this._callbacks) {
            try {
              cb(ticker);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore parse errors */
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._ws = null;
        if (this._activeSymbol && this._callbacks.size > 0) {
          this._reconnectTimer = setTimeout(() => this._connect(), 3000);
        }
      };

      this._ws.onerror = () => {
        /* onclose will fire */
      };
    } catch {
      this._ws = null;
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
    this._latest = null;
  }
}

export const bookTickerService = new _BookTickerService();
export default bookTickerService;
