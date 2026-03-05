// ═══════════════════════════════════════════════════════════════════
// charEdge — SparklineService
//
// Lightweight ticker and sparkline data fetching.
// Extracted from FetchService.js.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';
import { YahooAdapter } from './adapters/YahooAdapter.js';
import { toBinancePair } from './BinanceClient.js';
import { logger } from '../utils/logger';

/**
 * Fetch 24hr ticker price change statistics for one or multiple symbols.
 * Crypto: uses Binance 24hr ticker API.
 * Equities: uses Yahoo Finance for change% data.
 */
export async function fetch24hTicker(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const symArray = Array.isArray(symbols) ? symbols : [symbols];

  const cryptoSyms = symArray.filter((sym) => isCrypto(sym));
  const equitySyms = symArray.filter((sym) => !isCrypto(sym));
  const results = [];

  // ── Crypto: Binance 24hr ticker ──
  if (cryptoSyms.length > 0) {
    const pairs = cryptoSyms.map((sym) => toBinancePair(sym));
    try {
      const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
      const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
      const url = `${base}/api/binance/v3/ticker/24hr?symbols=${symbolsParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        results.push(...(Array.isArray(data) ? data : [data]));
      }
    } catch (e) { logger.data.warn('Operation failed', e); }
  }

  // ── Equities: Yahoo Finance quote for change% ──
  if (equitySyms.length > 0) {
    try {
      const yahoo = new YahooAdapter();
      for (const sym of equitySyms) {
        try {
          const candles = await yahoo.fetchOHLCV(sym, '5m', { range: '1d' });
          if (candles && candles.length >= 2) {
            const first = candles[0];
            const last = candles[candles.length - 1];
            const priceChange = last.close - first.open;
            const priceChangePct = ((priceChange / first.open) * 100).toFixed(2);
            results.push({
              symbol: sym,
              lastPrice: String(last.close),
              priceChange: String(priceChange.toFixed(4)),
              priceChangePercent: priceChangePct,
              highPrice: String(Math.max(...candles.map(c => c.high))),
              lowPrice: String(Math.min(...candles.map(c => c.low))),
              volume: String(candles.reduce((s, c) => s + (c.volume || 0), 0)),
            });
          }
        } catch (e) { logger.data.warn('Operation failed', e); }
      }
    } catch (e) { logger.data.warn('Operation failed', e); }
  }

  return results;
}

/**
 * Fetch lightweight sparkline data (recent closes).
 * Crypto: Binance 24 × 1h klines.
 * Equities: Yahoo Finance 1d chart with 15m candles.
 */
export async function fetchSparkline(symbol, isCryptoAsset = true) {
  const s = (symbol || '').toUpperCase();

  // ── Equities: Yahoo Finance sparkline ──
  if (!isCryptoAsset || !isCrypto(s)) {
    try {
      const yahoo = new YahooAdapter();
      const candles = await yahoo.fetchOHLCV(s, '15m', { range: '1d' });
      if (candles && candles.length > 0) return candles.map(c => c.close);
    } catch (e) { logger.data.warn('Operation failed', e); }
    return [];
  }

  // ── Crypto: Binance klines ──
  let pair = toBinancePair(s);
  try {
    const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
    const url = `${base}/api/binance/v3/klines?symbol=${pair}&interval=1h&limit=24`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((k) => parseFloat(k[4]));
  } catch (_) {
    return [];
  }
}
