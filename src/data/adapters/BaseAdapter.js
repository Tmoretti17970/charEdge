// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Base Data Adapter (Arch Improvement #8)
//
// Interface for market data providers. All adapters extend this.
//
// Adapters:
//   YahooAdapter  — Equities, ETFs, Forex, Futures (via proxy)
//   BinanceAdapter — Crypto (via WebSocket + REST)
//   PolygonAdapter — Multi-asset paid tier (future)
// ═══════════════════════════════════════════════════════════════════

export class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Fetch OHLCV candle data for a symbol.
   * @param {string} symbol
   * @param {string} interval - '1m','5m','15m','1h','4h','1d','1w','1M'
   * @param {Object} [opts]
   * @param {string} [opts.from] - Start date ISO
   * @param {string} [opts.to] - End date ISO
   * @param {number} [opts.limit] - Max candles
   * @returns {Promise<{time:number,open:number,high:number,low:number,close:number,volume:number}[]>}
   */
  async fetchOHLCV(symbol, interval, _opts = {}) {
    throw new Error(`${this.name}: fetchOHLCV not implemented`);
  }

  /**
   * Fetch current quote/snapshot for a symbol.
   * @param {string} symbol
   * @returns {Promise<{price:number,change:number,changePct:number,volume:number,high:number,low:number,open:number}>}
   */
  async fetchQuote(_symbol) {
    throw new Error(`${this.name}: fetchQuote not implemented`);
  }

  /**
   * Subscribe to real-time price updates.
   * @param {string} symbol
   * @param {Function} callback - (data: {price,volume,time}) => void
   * @returns {Function} unsubscribe
   */
  subscribe(_symbol, _callback) {
    throw new Error(`${this.name}: subscribe not implemented`);
  }

  /**
   * Search for symbols matching a query.
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {Promise<{symbol:string,name:string,type:string,exchange:string}[]>}
   */
  async searchSymbols(query, _limit = 10) {
    throw new Error(`${this.name}: searchSymbols not implemented`);
  }

  /**
   * Check if adapter supports a given symbol.
   * @param {string} symbol
   * @returns {boolean}
   */
  supports(_symbol) {
    return false;
  }

  /**
   * Report adapter capabilities at runtime.
   * Auto-detects overridden methods by checking if prototype differs from BaseAdapter.
   * Subclasses can override for explicit control.
   * @returns {{ fetchOHLCV: boolean, fetchQuote: boolean, subscribe: boolean, searchSymbols: boolean }}
   */
  capabilities() {
    const base = BaseAdapter.prototype;
    const proto = Object.getPrototypeOf(this);
    return {
      fetchOHLCV: proto.fetchOHLCV !== base.fetchOHLCV,
      fetchQuote: proto.fetchQuote !== base.fetchQuote,
      subscribe: proto.subscribe !== base.subscribe,
      searchSymbols: proto.searchSymbols !== base.searchSymbols,
    };
  }
}

export default BaseAdapter;
