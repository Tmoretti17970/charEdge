// ═══════════════════════════════════════════════════════════════════
// charEdge — CoinCap WebSocket Adapter (Phase 4b)
//
// Real-time crypto prices via CoinCap's free WebSocket API.
// Covers 1500+ crypto assets without API key.
//
// API Docs: https://docs.coincap.io/
// WebSocket: wss://ws.coincap.io/prices?assets=bitcoin,ethereum,...
// REST: https://api.coincap.io/v2/assets
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

const COINCAP_REST = 'https://api.coincap.io/v2';
const COINCAP_WS = 'wss://ws.coincap.io/prices';

// Map common trading pair symbols → CoinCap asset IDs
const SYMBOL_TO_ID = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binance-coin', SOL: 'solana',
  XRP: 'xrp', ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', MATIC: 'polygon', LINK: 'chainlink',
  UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin', FIL: 'filecoin',
  NEAR: 'near-protocol', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism',
  SUI: 'sui', SEI: 'sei-network', TIA: 'celestia', PEPE: 'pepe',
  SHIB: 'shiba-inu', WIF: 'dogwifcoin', BONK: 'bonk',
};

function toAssetId(symbol) {
  const base = (symbol || '').toUpperCase().replace(/USDT$|BUSD$|USD$/, '');
  return SYMBOL_TO_ID[base] || base.toLowerCase();
}

function isCryptoSymbol(symbol) {
  const s = (symbol || '').toUpperCase();
  return s.endsWith('USDT') || s.endsWith('BUSD') || s.endsWith('USD')
    || Object.keys(SYMBOL_TO_ID).includes(s);
}

export class CoinCapAdapter extends BaseAdapter {
  constructor() {
    super('coincap');
    this._ws = null;
    this._subs = new Map(); // assetId → Set<callback>
    this._reconnectTimer = null;
  }

  supports(symbol) {
    return isCryptoSymbol(symbol);
  }

  latencyTier() {
    return 'realtime';
  }

  // ─── REST: Fetch quote ────────────────────────────────────────

  async fetchQuote(symbol) {
    const assetId = toAssetId(symbol);
    try {
      const res = await fetch(`${COINCAP_REST}/assets/${assetId}`);
      if (!res.ok) return null;
      const { data } = await res.json();
      if (!data) return null;

      return {
        price: +data.priceUsd || 0,
        change: +data.changePercent24Hr ? (+data.priceUsd * +data.changePercent24Hr / 100) : 0,
        changePct: +data.changePercent24Hr || 0,
        volume: +data.volumeUsd24Hr || 0,
        high: 0, // CoinCap doesn't provide intraday H/L
        low: 0,
        open: 0,
      };
    } catch (e) {
      logger.data.warn('[CoinCap] fetchQuote failed:', e);
      return null;
    }
  }

  // ─── REST: Search symbols ─────────────────────────────────────

  async searchSymbols(query, limit = 10) {
    try {
      const res = await fetch(`${COINCAP_REST}/assets?search=${encodeURIComponent(query)}&limit=${limit}`);
      if (!res.ok) return [];
      const { data } = await res.json();
      return (data || []).map(a => ({
        symbol: (a.symbol || '').toUpperCase() + 'USDT',
        name: a.name || '',
        type: 'crypto',
        exchange: 'CoinCap',
      }));
    } catch {
      return [];
    }
  }

  // ─── REST: Fetch historical candles ───────────────────────────

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    const assetId = toAssetId(symbol);
    // CoinCap intervals: m1, m5, m15, m30, h1, h2, h6, h12, d1
    const INTERVAL_MAP = {
      '1m': 'm1', '5m': 'm5', '15m': 'm15', '30m': 'm30',
      '1h': 'h1', '2h': 'h2', '4h': 'h6', '6h': 'h6',
      '1d': 'd1', '1w': 'd1',
    };
    const ccInterval = INTERVAL_MAP[interval] || 'd1';

    const params = new URLSearchParams({ interval: ccInterval });
    if (opts.from) params.set('start', String(typeof opts.from === 'number' ? opts.from : new Date(opts.from).getTime()));
    if (opts.to) params.set('end', String(typeof opts.to === 'number' ? opts.to : new Date(opts.to).getTime()));

    try {
      const res = await fetch(`${COINCAP_REST}/assets/${assetId}/history?${params}`);
      if (!res.ok) return [];
      const { data } = await res.json();
      return (data || []).map(d => ({
        time: d.time,
        open: +d.priceUsd,
        high: +d.priceUsd,
        low: +d.priceUsd,
        close: +d.priceUsd,
        volume: 0, // CoinCap history doesn't include volume per candle
      }));
    } catch (e) {
      logger.data.warn('[CoinCap] fetchOHLCV failed:', e);
      return [];
    }
  }

  // ─── WebSocket: Real-time prices ──────────────────────────────

  subscribe(symbol, callback) {
    const assetId = toAssetId(symbol);

    if (!this._subs.has(assetId)) {
      this._subs.set(assetId, new Set());
    }
    this._subs.get(assetId).add(callback);

    // Connect or reconnect WS with current asset list
    this._connectWS();

    return () => {
      const set = this._subs.get(assetId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this._subs.delete(assetId);
      }
      // Reconnect with updated asset list (or close if no more subs)
      if (this._subs.size === 0) {
        this._closeWS();
      } else {
        this._connectWS();
      }
    };
  }

  _connectWS() {
    // Close existing connection to reconnect with updated asset list
    this._closeWS();

    const assetIds = [...this._subs.keys()];
    if (assetIds.length === 0) return;

    const url = `${COINCAP_WS}?assets=${assetIds.join(',')}`;
    try {
      this._ws = new WebSocket(url);

      this._ws.onmessage = (event) => {
        try {
          const prices = JSON.parse(event.data);
          for (const [assetId, priceStr] of Object.entries(prices)) {
            const callbacks = this._subs.get(assetId);
            if (callbacks) {
              const tick = {
                price: +priceStr,
                volume: 0,
                time: Date.now(),
              };
              callbacks.forEach(cb => cb(tick));
            }
          }
        } catch { /* ignore malformed messages */ }
      };

      this._ws.onclose = () => {
        // Auto-reconnect after 5s if still have subscribers
        if (this._subs.size > 0) {
          this._reconnectTimer = setTimeout(() => this._connectWS(), 5000);
        }
      };

      this._ws.onerror = (e) => {
        logger.data.warn('[CoinCap] WebSocket error:', e);
      };
    } catch (e) {
      logger.data.warn('[CoinCap] WebSocket connect failed:', e);
    }
  }

  _closeWS() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.onclose = null; // prevent auto-reconnect
      this._ws.close();
      this._ws = null;
    }
  }
}

export const coinCapAdapter = new CoinCapAdapter();
export default CoinCapAdapter;
