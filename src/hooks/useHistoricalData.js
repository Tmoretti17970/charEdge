// ═══════════════════════════════════════════════════════════════════
// charEdge — useHistoricalData Hook (Sprint 10)
//
// Fetches OHLCV kline data for a symbol and timeframe.
// Crypto → Binance REST klines via fetchBinanceBatch.
// Equities → FetchService (routes to Polygon/Yahoo/etc).
// Caches results to avoid redundant fetches when switching time
// ranges or re-selecting the same symbol.
//
// Returns: { candles, loading, error, timeRange, setTimeRange }
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { isCrypto } from '../constants.js';
import { fetchBinanceBatch, toBinancePair } from '../data/BinanceClient.js';

// ─── Time range presets ────────────────────────────────────────

export const TIME_RANGES = [
  { id: '1D', label: '1D', interval: '5m', limit: 288 }, // 5min × 288 = 24h
  { id: '1W', label: '1W', interval: '30m', limit: 336 }, // 30min × 336 = 7d
  { id: '1M', label: '1M', interval: '4h', limit: 180 }, // 4h × 180 = 30d
  { id: '3M', label: '3M', interval: '1d', limit: 90 }, // 1d × 90
  { id: '1Y', label: '1Y', interval: '1d', limit: 365 }, // 1d × 365
  { id: 'ALL', label: 'ALL', interval: '1w', limit: 500 }, // 1w × 500 ~10yr
];

/** Map hook time-range intervals to FetchService TF IDs */
const INTERVAL_TO_TF = {
  '5m': '5m',
  '30m': '30m',
  '4h': '4h',
  '1d': '1D',
  '1w': '1w',
};

const DEFAULT_RANGE = '1M';

// ─── In-memory cache ───────────────────────────────────────────

const _cache = new Map();
function cacheKey(symbol, rangeId) {
  return `${symbol}:${rangeId}`;
}

// ═══════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════

export default function useHistoricalData(symbol) {
  const [timeRange, setTimeRange] = useState(DEFAULT_RANGE);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!symbol) {
      setCandles([]);
      return;
    }

    const range = TIME_RANGES.find((r) => r.id === timeRange) || TIME_RANGES[2];
    const key = cacheKey(symbol, timeRange);

    // Check cache first
    if (_cache.has(key)) {
      setCandles(_cache.get(key));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let data = null;

        if (isCrypto(symbol)) {
          // Crypto → Binance REST klines
          const pair = toBinancePair(symbol);
          data = await fetchBinanceBatch(pair, range.interval, range.limit);
        } else {
          // Equities/Futures/Forex → route through FetchService
          const { fetchOHLC } = await import('../data/FetchService');
          const tfId = INTERVAL_TO_TF[range.interval] || '1D';
          const result = await fetchOHLC(symbol, tfId);
          data = result?.data || null;
        }

        if (cancelled || !mountedRef.current) return;

        if (!data || data.length === 0) {
          setCandles([]);
          setError('No data available');
        } else {
          _cache.set(key, data);
          setCandles(data);
        }
      } catch (e) {
        if (!cancelled && mountedRef.current) {
          setError(e.message || 'Failed to fetch data');
          setCandles([]);
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, timeRange]);

  return { candles, loading, error, timeRange, setTimeRange, timeRanges: TIME_RANGES };
}
