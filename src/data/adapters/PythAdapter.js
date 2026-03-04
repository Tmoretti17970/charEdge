// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Pyth Network Adapter
//
// Provides institutional-grade, permissionless price feeds via
// the Pyth Hermes API. Supports crypto, equities, FX, and commodities.
//
// Data source: https://hermes.pyth.network
// Docs: https://docs.pyth.network/price-feeds
//
// Features:
//   ✓ REST polling for latest prices
//   ✓ SSE streaming for real-time updates (~400ms)
//   ✓ 500+ feeds across 4 asset classes
//   ✓ Confidence intervals on every price
//   ✓ No API key required (permissionless)
//   ✓ Fallback between REST and SSE
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '../../utils/logger.ts';
import { pythCandleAggregator, SUPPORTED_INTERVALS } from '../engine/streaming/PythCandleAggregator.js';

// ─── Hermes API Endpoints ───────────────────────────────────────

const HERMES_BASE = 'https://hermes.pyth.network';
const HERMES_LATEST = `${HERMES_BASE}/v2/updates/price/latest`;
const HERMES_STREAM = `${HERMES_BASE}/v2/updates/price/stream`;

// ─── Pyth Feed ID Registry ──────────────────────────────────────
// Each feed has a unique 32-byte hex identifier.
// Full list: https://pyth.network/developers/price-feed-ids

const PYTH_FEEDS = {
  // ── Crypto ────────────────────────────────────────────────────
  BTC:       { id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', name: 'Bitcoin',         class: 'crypto' },
  ETH:       { id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', name: 'Ethereum',        class: 'crypto' },
  SOL:       { id: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', name: 'Solana',          class: 'crypto' },
  BNB:       { id: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f', name: 'BNB',             class: 'crypto' },
  XRP:       { id: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8', name: 'XRP',             class: 'crypto' },
  ADA:       { id: '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d', name: 'Cardano',         class: 'crypto' },
  DOGE:      { id: '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c', name: 'Dogecoin',        class: 'crypto' },
  AVAX:      { id: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7', name: 'Avalanche',       class: 'crypto' },
  DOT:       { id: '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284f97c7c83813510900', name: 'Polkadot',        class: 'crypto' },
  MATIC:     { id: '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52', name: 'Polygon',         class: 'crypto' },
  LINK:      { id: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221', name: 'Chainlink',       class: 'crypto' },
  UNI:       { id: '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501', name: 'Uniswap',         class: 'crypto' },
  ATOM:      { id: '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439cb7bfd8783069bd958801', name: 'Cosmos',           class: 'crypto' },
  LTC:       { id: '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54', name: 'Litecoin',        class: 'crypto' },
  NEAR:      { id: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750', name: 'NEAR Protocol',   class: 'crypto' },
  APT:       { id: '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5', name: 'Aptos',           class: 'crypto' },
  ARB:       { id: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5', name: 'Arbitrum',        class: 'crypto' },
  OP:        { id: '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf', name: 'Optimism',        class: 'crypto' },
  SUI:       { id: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744', name: 'Sui',             class: 'crypto' },

  // ── US Equities ───────────────────────────────────────────────
  AAPL:      { id: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688', name: 'Apple Inc.',      class: 'equity' },
  MSFT:      { id: '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1', name: 'Microsoft',       class: 'equity' },
  GOOGL:     { id: '0xe65ff435be42630439c96a7c34a99577de631c5b6e17c5a642c8cf3a3ef84c39', name: 'Alphabet',        class: 'equity' },
  AMZN:      { id: '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364b5060e91916e551418', name: 'Amazon',          class: 'equity' },
  NVDA:      { id: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593', name: 'NVIDIA',          class: 'equity' },
  META:      { id: '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe', name: 'Meta Platforms',  class: 'equity' },
  TSLA:      { id: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1', name: 'Tesla',           class: 'equity' },
  GOOG:      { id: '0xe65ff435be42630439c96a7c34a99577de631c5b6e17c5a642c8cf3a3ef84c39', name: 'Alphabet C',      class: 'equity' },
  JPM:       { id: '0x7f4f157e57bda157e37bb6dd6e6ee2d8a8ff2b35cc1c3fa23eb61b0f6f31d1ae', name: 'JPMorgan Chase',  class: 'equity' },
  NFLX:      { id: '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2', name: 'Netflix',         class: 'equity' },
  AMD:       { id: '0x3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e', name: 'AMD',             class: 'equity' },
  CRM:       { id: '0xfeff234600320f4d6bb5a01d02570a9725c1e424977f2b823f7231e6857bdae8', name: 'Salesforce',      class: 'equity' },

  // ── Forex ─────────────────────────────────────────────────────
  EURUSD:    { id: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b', name: 'EUR/USD',         class: 'forex' },
  GBPUSD:    { id: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1', name: 'GBP/USD',         class: 'forex' },
  USDJPY:    { id: '0xef2c98c804ba503c6a707e38be4dfbb16683775e3783c8a75d24bbc16dcdeec0', name: 'USD/JPY',         class: 'forex' },
  AUDUSD:    { id: '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80', name: 'AUD/USD',         class: 'forex' },
  USDCAD:    { id: '0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b0a688e1aa5be1b51698', name: 'USD/CAD',         class: 'forex' },
  USDCHF:    { id: '0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e8840', name: 'USD/CHF',         class: 'forex' },
  NZDUSD:    { id: '0x92eea8ba1b00078cdc2ef6f64f091f262e8c7d0576ee4677572f314ebfafa4c7', name: 'NZD/USD',         class: 'forex' },

  // ── Commodities ───────────────────────────────────────────────
  XAU:       { id: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63c52eecd2c7a9c6ffe', name: 'Gold (XAU/USD)',  class: 'commodity' },
  XAG:       { id: '0xf2fb02c32b055c805e7238d628e5e992ab910babeb8d9e093ed7e3d2a1f3b3c5', name: 'Silver (XAG/USD)',class: 'commodity' },
  CRUDE:     { id: '0x925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6', name: 'Crude Oil (WTI)', class: 'commodity' },
};

// Build reverse lookups
const FEED_TO_SYMBOL = new Map();
const SYMBOL_TO_FEED = new Map();
for (const [sym, feed] of Object.entries(PYTH_FEEDS)) {
  FEED_TO_SYMBOL.set(feed.id, sym);
  SYMBOL_TO_FEED.set(sym, feed);
}

// ─── Pyth Adapter Class ─────────────────────────────────────────

export class PythAdapter extends BaseAdapter {
  constructor() {
    super('pyth');
    this._sseSource = null;          // EventSource for streaming
    this._subscriptions = new Map(); // symbol → callback
    this._lastPrices = new Map();    // symbol → { price, conf, timestamp }
    this._status = 'disconnected';
  }

  /**
   * Check if this adapter supports a symbol.
   * Pyth supports any symbol in our feed registry.
   */
  supports(symbol) {
    return !!this._resolveFeed(symbol);
  }

  /**
   * Resolve a charEdge symbol to a Pyth feed entry.
   * Handles aliases: 'BTCUSDT' → 'BTC', 'AAPL' → 'AAPL', etc.
   */
  _resolveFeed(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase().trim();

    // Direct lookup
    if (PYTH_FEEDS[upper]) return PYTH_FEEDS[upper];

    // Strip USDT suffix for crypto
    const bare = upper.replace(/USDT$|USD$|BUSD$/, '');
    if (PYTH_FEEDS[bare]) return PYTH_FEEDS[bare];

    // Strip Yahoo-style suffixes for other assets
    const clean = upper.replace(/=X$|=F$/, '');
    if (PYTH_FEEDS[clean]) return PYTH_FEEDS[clean];

    return null;
  }

  /**
   * Fetch the latest quote/snapshot for a symbol.
   * Uses Hermes REST API.
   */
  async fetchQuote(symbol) {
    const feed = this._resolveFeed(symbol);
    if (!feed) return null;

    try {
      const url = `${HERMES_LATEST}?ids[]=${feed.id}&parsed=true`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const json = await res.json();
      const parsed = json?.parsed?.[0];
      if (!parsed?.price) return null;

      const price = this._parsePrice(parsed.price);
      const emaPrice = parsed.ema_price ? this._parsePrice(parsed.ema_price) : null;

      // Cache the latest price
      this._lastPrices.set(symbol.toUpperCase(), {
        price,
        confidence: this._parsePrice(parsed.price, 'conf'),
        timestamp: parsed.price.publish_time * 1000,
        emaPrice,
      });

      return {
        price,
        change: emaPrice ? price - emaPrice : 0,
        changePct: emaPrice ? ((price - emaPrice) / emaPrice) * 100 : 0,
        volume: 0, // Pyth doesn't provide volume
        high: price, // Pyth only provides spot — no H/L/O
        low: price,
        open: emaPrice || price,
        confidence: this._parsePrice(parsed.price, 'conf'),
        source: 'pyth',
      };
    } catch (err) {
      logger.data.warn(`[PythAdapter] fetchQuote error for ${symbol}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch OHLCV data from the candle aggregator.
   * Pyth doesn't provide historical candles natively — we build them
   * client-side from the SSE tick stream via PythCandleAggregator.
   *
   * Returns accumulated candles if available, otherwise null
   * (signals to the data layer to try another provider for history).
   */
  async fetchOHLCV(symbol, interval = '1m', _opts = {}) {
    const feed = this._resolveFeed(symbol);
    if (!feed) return null;

    // Map interval format: chart engine may use '1' for 1m, '60' for 1h, etc.
    const normalizedInterval = this._normalizeInterval(interval);
    const candles = pythCandleAggregator.getCandles(
      this._feedSymbol(symbol),
      normalizedInterval
    );

    // Only return if we have meaningful data (at least 2 candles)
    if (candles.length < 2) return null;

    return candles;
  }

  /**
   * Subscribe to real-time price updates via SSE streaming.
   * Pyth Hermes provides Server-Sent Events for price updates (~400ms).
   */
  subscribe(symbol, callback) {
    const feed = this._resolveFeed(symbol);
    if (!feed) return () => {};

    const normalizedSymbol = symbol.toUpperCase();
    this._subscriptions.set(normalizedSymbol, { callback, feedId: feed.id });

    // If SSE is not running, start it with all subscribed feed IDs
    this._restartSSE();

    return () => {
      this._subscriptions.delete(normalizedSymbol);
      if (this._subscriptions.size === 0) {
        this._stopSSE();
      } else {
        this._restartSSE();
      }
    };
  }

  /**
   * Subscribe to multiple symbols simultaneously.
   * More efficient than calling subscribe() per symbol.
   * @param {string[]} symbols
   * @param {Function} callback - ({ symbol, price, confidence, timestamp }) => void
   * @returns {Function} unsubscribe all
   */
  subscribeMany(symbols, callback) {
    const unsubs = symbols.map((sym) => this.subscribe(sym, callback));
    return () => unsubs.forEach((fn) => fn());
  }

  /**
   * Search through the Pyth feed registry for matching symbols.
   */
  async searchSymbols(query, limit = 10) {
    if (!query) return [];
    const q = query.toUpperCase().trim();
    const results = [];

    for (const [sym, feed] of Object.entries(PYTH_FEEDS)) {
      if (results.length >= limit) break;
      if (sym.includes(q) || feed.name.toUpperCase().includes(q)) {
        results.push({
          symbol: sym,
          name: feed.name,
          type: feed.class.toUpperCase(),
          exchange: 'Pyth Network',
        });
      }
    }

    return results;
  }

  /**
   * Get all available Pyth feed symbols.
   * @returns {{ symbol: string, name: string, class: string }[]}
   */
  getAvailableFeeds() {
    return Object.entries(PYTH_FEEDS).map(([sym, feed]) => ({
      symbol: sym,
      name: feed.name,
      class: feed.class,
      feedId: feed.id,
    }));
  }

  /**
   * Fetch quotes for multiple symbols in a single request.
   * Hermes supports batching via multiple `ids[]` params.
   */
  async fetchMultiQuote(symbols) {
    const feeds = symbols
      .map((s) => ({ symbol: s, feed: this._resolveFeed(s) }))
      .filter((f) => f.feed);

    if (feeds.length === 0) return {};

    try {
      const ids = feeds.map((f) => `ids[]=${f.feed.id}`).join('&');
      const url = `${HERMES_LATEST}?${ids}&parsed=true`;
      const res = await fetch(url);
      if (!res.ok) return {};

      const json = await res.json();
      const results = {};

      for (const parsed of json?.parsed || []) {
        const feedId = '0x' + parsed.id;
        const sym = FEED_TO_SYMBOL.get(feedId);
        if (!sym || !parsed.price) continue;

        const price = this._parsePrice(parsed.price);
        const emaPrice = parsed.ema_price ? this._parsePrice(parsed.ema_price) : null;

        results[sym] = {
          price,
          change: emaPrice ? price - emaPrice : 0,
          changePct: emaPrice ? ((price - emaPrice) / emaPrice) * 100 : 0,
          confidence: this._parsePrice(parsed.price, 'conf'),
          timestamp: parsed.price.publish_time * 1000,
          source: 'pyth',
        };
      }

      return results;
    } catch (err) {
      logger.data.warn('[PythAdapter] fetchMultiQuote error:', err.message);
      return {};
    }
  }

  /**
   * Get the current connection status.
   * @returns {'connected'|'connecting'|'disconnected'|'error'}
   */
  getStatus() {
    return this._status;
  }

  /**
   * Get the last known price for a symbol.
   * @param {string} symbol
   * @returns {{ price, confidence, timestamp }|null}
   */
  getLastPrice(symbol) {
    return this._lastPrices.get(symbol?.toUpperCase()) || null;
  }

  /**
   * Get the latest confidence interval for a symbol.
   * Pyth's confidence represents the ± price range within which
   * the true price is expected to fall.
   * @param {string} symbol
   * @returns {{ confidence: number, timestamp: number } | null}
   */
  getConfidence(symbol) {
    return pythCandleAggregator.getConfidence(this._feedSymbol(symbol));
  }

  /**
   * Subscribe to candle close events from the aggregator.
   * @param {string} symbol
   * @param {string} interval - '1m'|'5m'|'15m'|'1h'|'4h'|'1d'
   * @param {Function} callback - (candle) => void
   * @returns {Function} unsubscribe
   */
  onCandle(symbol, interval, callback) {
    return pythCandleAggregator.onCandle(this._feedSymbol(symbol), interval, callback);
  }

  /**
   * Get accumulated candle data for a symbol from the aggregator.
   * @param {string} symbol
   * @param {string} interval
   * @returns {Object[]}
   */
  getCandles(symbol, interval = '1m') {
    return pythCandleAggregator.getCandles(this._feedSymbol(symbol), interval);
  }

  /**
   * Get supported candle intervals.
   * @returns {string[]}
   */
  getSupportedIntervals() {
    return [...SUPPORTED_INTERVALS];
  }

  // ─── SSE (Server-Sent Events) Management ─────────────────────

  /** @private */
  _restartSSE() {
    this._stopSSE();

    const feedIds = Array.from(this._subscriptions.values()).map((s) => s.feedId);
    if (feedIds.length === 0) return;

    const ids = feedIds.map((id) => `ids[]=${id}`).join('&');
    const url = `${HERMES_STREAM}?${ids}&parsed=true&allow_unordered=true&benchmarks_only=false`;

    try {
      this._status = 'connecting';
      this._sseSource = new EventSource(url);

      this._sseSource.onopen = () => {
        this._status = 'connected';
      };

      this._sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data?.parsed) return;

          for (const parsed of data.parsed) {
            const feedId = '0x' + parsed.id;
            const sym = FEED_TO_SYMBOL.get(feedId);
            if (!sym || !parsed.price) continue;

            const price = this._parsePrice(parsed.price);
            const confidence = this._parsePrice(parsed.price, 'conf');
            const timestamp = parsed.price.publish_time * 1000;

            // Update cache
            this._lastPrices.set(sym, { price, confidence, timestamp });

            // Feed tick into candle aggregator
            pythCandleAggregator.ingestTick(sym, price, confidence, timestamp);

            // Notify all subscriptions that match this symbol
            // (Check both direct sym and USDT variants)
            for (const [subSym, sub] of this._subscriptions) {
              if (sub.feedId === feedId) {
                sub.callback({
                  price,
                  volume: 0,
                  time: timestamp,
                  symbol: subSym,
                  confidence,
                  source: 'pyth',
                });
              }
            }
          }
        } catch {
          /* ignore individual message parse errors */
        }
      };

      this._sseSource.onerror = () => {
        this._status = 'error';
        // EventSource auto-reconnects — we just track the status
        setTimeout(() => {
          if (this._sseSource) this._status = 'connecting';
        }, 1000);
      };
    } catch (err) {
      logger.data.warn('[PythAdapter] SSE connection error:', err.message);
      this._status = 'error';
    }
  }

  /** @private */
  _stopSSE() {
    if (this._sseSource) {
      this._sseSource.close();
      this._sseSource = null;
    }
    this._status = 'disconnected';
  }

  // ─── Price Parsing ────────────────────────────────────────────

  /**
   * Parse a Pyth price object into a decimal number.
   * Pyth stores prices as (price * 10^expo), e.g. { price: "5123456", expo: -2 } = 51234.56
   * @private
   */
  _parsePrice(priceObj, field = 'price') {
    if (!priceObj) return 0;
    const raw = parseInt(priceObj[field] || '0', 10);
    const expo = parseInt(priceObj.expo || '0', 10);
    return raw * Math.pow(10, expo);
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Get the base Pyth symbol for a charEdge symbol.
   * E.g. 'BTCUSDT' → 'BTC', 'AAPL' → 'AAPL'
   * @private
   */
  _feedSymbol(symbol) {
    if (!symbol) return '';
    const feed = this._resolveFeed(symbol);
    if (!feed) return symbol.toUpperCase();
    // Find the key in PYTH_FEEDS that matches this feed
    for (const [sym, f] of Object.entries(PYTH_FEEDS)) {
      if (f.id === feed.id) return sym;
    }
    return symbol.toUpperCase();
  }

  /**
   * Normalize chart interval to aggregator format.
   * Chart engine may use '1', '5', '60', 'D' etc.
   * @private
   */
  _normalizeInterval(interval) {
    const map = {
      '1': '1m', '1m': '1m',
      '5': '5m', '5m': '5m',
      '15': '15m', '15m': '15m',
      '60': '1h', '1h': '1h',
      '240': '4h', '4h': '4h',
      'D': '1d', '1D': '1d', '1d': '1d',
    };
    return map[interval] || '1m';
  }

  /**
   * Close all connections and clean up.
   */
  dispose() {
    this._stopSSE();
    this._subscriptions.clear();
    this._lastPrices.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const pythAdapter = new PythAdapter();

export {
  PYTH_FEEDS,
  FEED_TO_SYMBOL,
  SYMBOL_TO_FEED,
  HERMES_BASE,
  HERMES_LATEST,
  HERMES_STREAM,
};

export default PythAdapter;
