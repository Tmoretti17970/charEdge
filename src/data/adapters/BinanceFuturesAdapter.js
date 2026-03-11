// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Binance Futures Adapter
//
// FREE crypto derivatives data from Binance Futures public endpoints.
// No API key required. All endpoints are public market data.
//
// Provides:
//   • Open Interest (current + historical OHLC)
//   • Funding Rates (current + historical)
//   • Liquidations (real-time via WebSocket)
//   • Long/Short Ratio (top traders)
//   • Mark Price + Funding countdown
//   • Taker Buy/Sell Volume ratio
//
// Data is from fapi.binance.com (Binance USD-M Futures).
//
// Usage:
//   import { binanceFuturesAdapter } from './BinanceFuturesAdapter.js';
//   const oi = await binanceFuturesAdapter.fetchOpenInterest('BTCUSDT');
//   const funding = await binanceFuturesAdapter.fetchFundingRate('BTCUSDT');
//   const unsub = binanceFuturesAdapter.subscribeLiquidations(callback);
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';
const FAPI_BASE = '/api/binance-futures/fapi/v1';
const FUTURES_WS = 'wss://fstream.binance.com/ws';

const CACHE = new Map();
const CACHE_TTL = 15000;    // 15 sec for live data
const HIST_CACHE_TTL = 60000; // 1 min for historical

// ─── Helpers ───────────────────────────────────────────────────

function getCached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  return null;
}

function setCache(key, data, ttl = CACHE_TTL) {
  CACHE.set(key, { data, expiry: Date.now() + ttl });
}

function toFuturesSymbol(symbol) {
  const upper = (symbol || '').toUpperCase();
  if (upper.endsWith('USDT')) return upper;
  return upper + 'USDT';
}

// ─── Binance Futures Adapter ───────────────────────────────────

class _BinanceFuturesAdapter extends BaseAdapter {
  constructor() {
    super('binance-futures');
    this._liquidationWS = null;
    this._liquidationCallbacks = new Set();
    this._markPriceWS = null;
    this._markPriceCallbacks = new Map(); // symbol → Set<callback>
    this._geoBlocked = false;
  }

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    return upper.endsWith('USDT') || upper.endsWith('BUSD') ||
      ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC',
       'LINK', 'UNI', 'ATOM', 'FIL', 'NEAR', 'APT', 'ARB', 'SUI', 'LTC'].includes(upper);
  }

  latencyTier() { return 'realtime'; }

  // ─── Open Interest ─────────────────────────────────────────

  /**
   * Fetch current open interest for a symbol.
   * @param {string} symbol
   * @returns {Promise<{ symbol, openInterest, time } | null>}
   */
  async fetchOpenInterest(symbol) {
    if (this._geoBlocked) return null;
    const sym = toFuturesSymbol(symbol);
    const cacheKey = `oi-${sym}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(`${FAPI_BASE}/openInterest?symbol=${sym}`);
      if (resp.status === 451) this._geoBlocked = true;
      if (!resp.ok) return null;
      const data = await resp.json();

      const result = {
        symbol: data.symbol,
        openInterest: parseFloat(data.openInterest),
        time: data.time,
      };

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      logger.data.warn('[BinanceFutures] OI fetch failed:', err.message);
      return null;
    }
  }

  /**
   * Fetch historical open interest (OHLC format — great for chart overlay).
   * @param {string} symbol
   * @param {string} [period='5m'] - '5m','15m','30m','1h','2h','4h','6h','12h','1d'
   * @param {number} [limit=100]
   * @returns {Promise<Array<{ time, oi, oiValue }>>}
   */
  async fetchOpenInterestHistory(symbol, period = '5m', limit = 100) {
    if (this._geoBlocked) return [];
    const sym = toFuturesSymbol(symbol);
    const cacheKey = `oi-hist-${sym}-${period}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(`${FAPI_BASE}/openInterestHist?symbol=${sym}&period=${period}&limit=${limit}`);
      if (resp.status === 451) this._geoBlocked = true;
      if (!resp.ok) return [];
      const data = await resp.json();

      const result = data.map(d => ({
        time: d.timestamp,
        oi: parseFloat(d.sumOpenInterest),
        oiValue: parseFloat(d.sumOpenInterestValue), // USD value
      }));

      setCache(cacheKey, result, HIST_CACHE_TTL);
      return result;
    } catch (err) {
      logger.data.warn('[BinanceFutures] OI history failed:', err.message);
      return [];
    }
  }

  // ─── Funding Rate ──────────────────────────────────────────

  /**
   * Fetch current/recent funding rates.
   * @param {string} symbol
   * @param {number} [limit=20]
   * @returns {Promise<Array<{ symbol, fundingRate, fundingTime, markPrice }>>}
   */
  async fetchFundingRate(symbol, limit = 20) {
    if (this._geoBlocked) return [];
    const sym = toFuturesSymbol(symbol);
    const cacheKey = `funding-${sym}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(`${FAPI_BASE}/fundingRate?symbol=${sym}&limit=${limit}`);
      if (resp.status === 451) this._geoBlocked = true;
      if (!resp.ok) return [];
      const data = await resp.json();

      const result = data.map(d => ({
        symbol: d.symbol,
        fundingRate: parseFloat(d.fundingRate),
        fundingRatePct: parseFloat(d.fundingRate) * 100,
        fundingTime: d.fundingTime,
        markPrice: d.markPrice ? parseFloat(d.markPrice) : null,
      }));

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      logger.data.warn('[BinanceFutures] Funding rate failed:', err.message);
      return [];
    }
  }

  /**
   * Get the current funding rate as a single value.
   * @param {string} symbol
   * @returns {Promise<{ rate, ratePct, nextFundingTime } | null>}
   */
  async fetchCurrentFunding(symbol) {
    const rates = await this.fetchFundingRate(symbol, 1);
    if (!rates.length) return null;

    const latest = rates[rates.length - 1];
    return {
      rate: latest.fundingRate,
      ratePct: latest.fundingRatePct,
      nextFundingTime: latest.fundingTime,
      sentiment: latest.fundingRate > 0 ? 'longs pay shorts (bullish bias)' :
                 latest.fundingRate < 0 ? 'shorts pay longs (bearish bias)' : 'neutral',
    };
  }

  // ─── Long/Short Ratio ──────────────────────────────────────

  /**
   * Fetch top trader long/short ratio.
   * @param {string} symbol
   * @param {string} [period='5m'] - '5m','15m','30m','1h','2h','4h','6h','12h','1d'
   * @param {number} [limit=30]
   * @returns {Promise<Array<{ time, longShortRatio, longAccount, shortAccount }>>}
   */
  async fetchLongShortRatio(symbol, period = '5m', limit = 30) {
    if (this._geoBlocked) return [];
    const sym = toFuturesSymbol(symbol);
    const cacheKey = `lsr-${sym}-${period}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(`${FAPI_BASE}/topLongShortPositionRatio?symbol=${sym}&period=${period}&limit=${limit}`);
      if (resp.status === 451) this._geoBlocked = true;
      if (!resp.ok) return [];
      const data = await resp.json();

      const result = data.map(d => ({
        time: d.timestamp,
        longShortRatio: parseFloat(d.longShortRatio),
        longAccount: parseFloat(d.longAccount),
        shortAccount: parseFloat(d.shortAccount),
        longPct: Math.round(parseFloat(d.longAccount) * 1000) / 10,
        shortPct: Math.round(parseFloat(d.shortAccount) * 1000) / 10,
      }));

      setCache(cacheKey, result, HIST_CACHE_TTL);
      return result;
    } catch (err) {
      logger.data.warn('[BinanceFutures] L/S ratio failed:', err.message);
      return [];
    }
  }

  // ─── Taker Buy/Sell Volume ─────────────────────────────────

  /**
   * Fetch taker buy/sell volume ratio (shows actual aggression in the market).
   * @param {string} symbol
   * @param {string} [period='5m']
   * @param {number} [limit=30]
   * @returns {Promise<Array<{ time, buySellRatio, buyVol, sellVol }>>}
   */
  async fetchTakerVolume(symbol, period = '5m', limit = 30) {
    if (this._geoBlocked) return [];
    const sym = toFuturesSymbol(symbol);
    const cacheKey = `taker-${sym}-${period}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(`${FAPI_BASE}/takerlongshortRatio?symbol=${sym}&period=${period}&limit=${limit}`);
      if (resp.status === 451) this._geoBlocked = true;
      if (!resp.ok) return [];
      const data = await resp.json();

      const result = data.map(d => ({
        time: d.timestamp,
        buySellRatio: parseFloat(d.buySellRatio),
        buyVol: parseFloat(d.buyVol),
        sellVol: parseFloat(d.sellVol),
      }));

      setCache(cacheKey, result, HIST_CACHE_TTL);
      return result;
    } catch (err) {
      logger.data.warn('[BinanceFutures] Taker volume failed:', err.message);
      return [];
    }
  }

  // ─── Mark Price ────────────────────────────────────────────

  /**
   * Fetch current mark price, index price, and funding info.
   * @param {string} symbol
   * @returns {Promise<{ markPrice, indexPrice, estimatedSettlePrice, fundingRate, nextFundingTime } | null>}
   */
  async fetchMarkPrice(symbol) {
    if (this._geoBlocked) return null;
    const sym = toFuturesSymbol(symbol);

    try {
      const resp = await fetch(`${FAPI_BASE}/premiumIndex?symbol=${sym}`);
      if (resp.status === 451) this._geoBlocked = true;
      if (!resp.ok) return null;
      const data = await resp.json();

      return {
        symbol: data.symbol,
        markPrice: parseFloat(data.markPrice),
        indexPrice: parseFloat(data.indexPrice),
        estimatedSettlePrice: parseFloat(data.estimatedSettlePrice),
        fundingRate: parseFloat(data.lastFundingRate),
        fundingRatePct: parseFloat(data.lastFundingRate) * 100,
        nextFundingTime: data.nextFundingTime,
        interestRate: parseFloat(data.interestRate),
        time: data.time,
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return null;
    }
  }

  // ─── WebSocket: Liquidations ───────────────────────────────

  /**
   * Subscribe to real-time liquidation events (all symbols).
   * @param {Function} callback - ({ symbol, side, price, quantity, quantityUsd, time }) => void
   * @returns {Function} unsubscribe
   */
  subscribeLiquidations(callback) {
    this._liquidationCallbacks.add(callback);

    // Start WS if not already running
    if (!this._liquidationWS) {
      this._startLiquidationWS();
    }

    return () => {
      this._liquidationCallbacks.delete(callback);
      if (this._liquidationCallbacks.size === 0) {
        this._stopLiquidationWS();
      }
    };
  }

  /** @private */
  _startLiquidationWS() {
    try {
      // Subscribe to all liquidation orders
      this._liquidationWS = new WebSocket(`${FUTURES_WS}/!forceOrder@arr`);

      this._liquidationWS.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const order = msg.o || msg;

          const liq = {
            symbol: order.s,
            side: order.S?.toLowerCase() || 'unknown', // 'BUY' = short liquidated, 'SELL' = long liquidated
            type: order.S === 'BUY' ? 'short_liquidation' : 'long_liquidation',
            price: parseFloat(order.p),
            quantity: parseFloat(order.q),
            quantityUsd: parseFloat(order.p) * parseFloat(order.q),
            time: order.T,
            tradeTime: order.T,
          };

          for (const cb of this._liquidationCallbacks) {
            try { cb(liq); } catch (e) { logger.data.warn('Operation failed', e); }
          }
        } catch (e) { logger.data.warn('Operation failed', e); }
      };

      this._liquidationWS.onclose = () => {
        this._liquidationWS = null;
        // Auto-reconnect if we still have subscribers
        if (this._liquidationCallbacks.size > 0) {
          setTimeout(() => this._startLiquidationWS(), 3000);
        }
      };

      this._liquidationWS.onerror = () => { /* silent */ };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      this._liquidationWS = null;
    }
  }

  /** @private */
  _stopLiquidationWS() {
    if (this._liquidationWS) {
      this._liquidationWS.close();
      this._liquidationWS = null;
    }
  }

  // ─── WebSocket: Mark Price Streaming ───────────────────────

  /**
   * Subscribe to real-time mark price + funding rate updates.
   * @param {string} symbol
   * @param {Function} callback - ({ symbol, markPrice, indexPrice, fundingRate, nextFundingTime }) => void
   * @returns {Function} unsubscribe
   */
  subscribeMarkPrice(symbol, callback) {
    const sym = toFuturesSymbol(symbol).toLowerCase();

    if (!this._markPriceCallbacks.has(sym)) {
      this._markPriceCallbacks.set(sym, new Set());
    }
    this._markPriceCallbacks.get(sym).add(callback);

    // Start per-symbol WS
    if (!this._markPriceWS) {
      this._startMarkPriceWS(sym);
    }

    return () => {
      const subs = this._markPriceCallbacks.get(sym);
      if (subs) subs.delete(callback);
    };
  }

  /** @private */
  _startMarkPriceWS(symbol) {
    try {
      this._markPriceWS = new WebSocket(`${FUTURES_WS}/${symbol}@markPrice@1s`);

      this._markPriceWS.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          const update = {
            symbol: data.s,
            markPrice: parseFloat(data.p),
            indexPrice: parseFloat(data.i),
            fundingRate: parseFloat(data.r),
            fundingRatePct: parseFloat(data.r) * 100,
            nextFundingTime: data.T,
            time: data.E,
          };

          const subs = this._markPriceCallbacks.get(symbol);
          if (subs) {
            for (const cb of subs) {
              try { cb(update); } catch (e) { logger.data.warn('Operation failed', e); }
            }
          }
        } catch (e) { logger.data.warn('Operation failed', e); }
      };

      this._markPriceWS.onclose = () => {
        this._markPriceWS = null;
      };

      this._markPriceWS.onerror = () => { /* silent */ };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      this._markPriceWS = null;
    }
  }

  // ─── OI Divergence Detection ──────────────────────────────

  /**
   * Detect OI divergence: when price moves one way but OI moves the other.
   * A powerful contrarian signal.
   *
   * @param {string} symbol
   * @param {string} [period='1h']
   * @param {number} [lookback=12] - Number of periods to analyze
   * @returns {Promise<{ divergence, priceChange, oiChange, signal, strength } | null>}
   */
  async detectOIDivergence(symbol, period = '1h', lookback = 12) {
    try {
      const [oiHistory, markPrice] = await Promise.all([
        this.fetchOpenInterestHistory(symbol, period, lookback),
        this.fetchMarkPrice(symbol),
      ]);

      if (!oiHistory?.length || oiHistory.length < 3 || !markPrice) return null;

      const firstOI = oiHistory[0].oiValue;
      const lastOI = oiHistory[oiHistory.length - 1].oiValue;
      const oiChange = firstOI > 0 ? (lastOI - firstOI) / firstOI : 0;

      // We don't have historical price in OI data, so we compare OI trend with
      // the latest mark price trend indicators (funding rate as proxy)
      const fundingRate = markPrice.fundingRate || 0;

      let signal = 'neutral';
      let divergence = 'none';
      let strength = 0;

      // Bearish divergence: OI declining while funding positive (longs still paying)
      if (oiChange < -0.02 && fundingRate > 0.0005) {
        divergence = 'bearish';
        signal = 'Longs closing but funding still elevated — bearish';
        strength = Math.min(1, Math.abs(oiChange) * 10);
      }
      // Bullish divergence: OI declining while funding negative (shorts still paying)
      else if (oiChange < -0.02 && fundingRate < -0.0005) {
        divergence = 'bullish';
        signal = 'Shorts closing but funding still negative — bullish';
        strength = Math.min(1, Math.abs(oiChange) * 10);
      }
      // OI surge with extreme positive funding — crowded long
      else if (oiChange > 0.05 && fundingRate > 0.001) {
        divergence = 'crowded_long';
        signal = 'OI surging + extreme positive funding — crowded long, risk of long squeeze';
        strength = Math.min(1, oiChange * 5 + fundingRate * 500);
      }
      // OI surge with extreme negative funding — crowded short
      else if (oiChange > 0.05 && fundingRate < -0.001) {
        divergence = 'crowded_short';
        signal = 'OI surging + extreme negative funding — crowded short, risk of short squeeze';
        strength = Math.min(1, oiChange * 5 + Math.abs(fundingRate) * 500);
      }

      return {
        symbol: markPrice.symbol,
        divergence,
        signal,
        strength: Math.round(strength * 100) / 100,
        oiChange: Math.round(oiChange * 10000) / 100, // percentage
        fundingRate: Math.round(fundingRate * 10000) / 100, // bps as pct
        currentOI: lastOI,
        timestamp: Date.now(),
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return null;
    }
  }

  // ─── Funding Rate Alerts ──────────────────────────────────

  /**
   * Check if funding rate is at extreme levels (reversal signal).
   * When funding exceeds ±0.1%, it's a strong contrarian indicator.
   *
   * @param {string} symbol
   * @returns {Promise<{ isExtreme, fundingRate, alert, direction } | null>}
   */
  async checkFundingAlert(symbol) {
    const mark = await this.fetchMarkPrice(symbol);
    if (!mark) return null;

    const rate = mark.fundingRate || 0;
    const absRate = Math.abs(rate);
    const EXTREME_THRESHOLD = 0.001; // 0.1%
    const WARNING_THRESHOLD = 0.0005; // 0.05%

    let level = 'normal';
    let alert = null;

    if (absRate >= EXTREME_THRESHOLD) {
      level = 'extreme';
      alert = rate > 0
        ? '🔥 Extreme positive funding — longs paying heavily, reversal risk'
        : '🔥 Extreme negative funding — shorts paying heavily, reversal risk';
    } else if (absRate >= WARNING_THRESHOLD) {
      level = 'elevated';
      alert = rate > 0
        ? '⚠️ Elevated positive funding — bullish sentiment building'
        : '⚠️ Elevated negative funding — bearish sentiment building';
    }

    return {
      symbol: mark.symbol,
      fundingRate: rate,
      fundingRatePct: Math.round(rate * 10000) / 100,
      isExtreme: level === 'extreme',
      isElevated: level !== 'normal',
      level,
      direction: rate > 0 ? 'longs_paying' : rate < 0 ? 'shorts_paying' : 'neutral',
      alert,
      nextFundingTime: mark.nextFundingTime,
      timestamp: Date.now(),
    };
  }

  // ─── CoinGecko Fallback (geo-blocked regions) ──────────────

  /** @private */
  async _fetchCoinGeckoSnapshot(symbol) {
    const cacheKey = 'cg-deriv-snap';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch('/api/coingecko/derivatives');
      if (!resp.ok) return null;
      const tickers = await resp.json();

      const sym = toFuturesSymbol(symbol);
      const base = sym.replace('USDT', '');

      // Find matching Binance perpetual contract
      const ticker = tickers.find(t =>
        t.market?.toLowerCase().includes('binance') &&
        t.contract_type === 'perpetual' &&
        (t.symbol?.toUpperCase().includes(base + '/USDT') ||
         t.symbol?.toUpperCase().replace('_PERP', '').replace('/', '') === sym)
      );

      if (!ticker) return null;

      const price = parseFloat(ticker.price) || 0;
      const oiUsd = ticker.open_interest_usd || ticker.open_interest || 0;
      const fundingRate = (ticker.funding_rate || 0) / 100; // CG gives %, convert to decimal

      const result = {
        symbol: sym,
        openInterest: {
          symbol: sym,
          openInterest: price > 0 ? oiUsd / price : 0,
          time: Date.now(),
        },
        funding: {
          rate: fundingRate,
          ratePct: ticker.funding_rate || 0,
          nextFundingTime: null,
          sentiment: fundingRate > 0 ? 'longs pay shorts (bullish bias)' :
                     fundingRate < 0 ? 'shorts pay longs (bearish bias)' : 'neutral',
        },
        longShortRatio: null,
        markPrice: {
          symbol: sym,
          markPrice: price,
          indexPrice: ticker.index ? parseFloat(ticker.index) : price,
          estimatedSettlePrice: 0,
          fundingRate,
          fundingRatePct: ticker.funding_rate || 0,
          nextFundingTime: null,
          interestRate: 0,
          time: Date.now(),
        },
        takerVolume: null,
        timestamp: Date.now(),
        source: 'coingecko',
      };

      setCache(cacheKey, result, 30000);
      return result;
    } catch (err) {
      logger.data.warn('[BinanceFutures] CoinGecko fallback failed:', err?.message);
      return null;
    }
  }

  // ─── Comprehensive Derivatives Snapshot ────────────────────

  /**
   * Fetch a full derivatives snapshot for a symbol in one call.
   * Combines OI, funding, L/S ratio, and mark price.
   * Falls back to CoinGecko if Binance is geo-blocked (HTTP 451).
   * @param {string} symbol
   * @returns {Promise<Object>}
   */
  async fetchDerivativesSnapshot(symbol) {
    // If previously geo-blocked, skip Binance entirely
    if (this._geoBlocked) {
      return this._fetchCoinGeckoSnapshot(symbol);
    }

    const [oi, funding, lsr, markPrice, takerVol] = await Promise.all([
      this.fetchOpenInterest(symbol),
      this.fetchCurrentFunding(symbol),
      this.fetchLongShortRatio(symbol, '1h', 1),
      this.fetchMarkPrice(symbol),
      this.fetchTakerVolume(symbol, '1h', 1),
    ]);

    // If all returned null, likely geo-blocked — fallback to CoinGecko
    if (!oi && !funding && !markPrice) {
      this._geoBlocked = true;
      logger.data.warn('[BinanceFutures] API geo-blocked. Falling back to CoinGecko.');
      return this._fetchCoinGeckoSnapshot(symbol);
    }

    return {
      symbol: toFuturesSymbol(symbol),
      openInterest: oi,
      funding,
      longShortRatio: lsr?.[0] || null,
      markPrice,
      takerVolume: takerVol?.[0] || null,
      timestamp: Date.now(),
    };
  }

  // ─── Cleanup ───────────────────────────────────────────────

  dispose() {
    this._stopLiquidationWS();
    if (this._markPriceWS) {
      this._markPriceWS.close();
      this._markPriceWS = null;
    }
    this._liquidationCallbacks.clear();
    this._markPriceCallbacks.clear();
    CACHE.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const binanceFuturesAdapter = new _BinanceFuturesAdapter();
export default binanceFuturesAdapter;
