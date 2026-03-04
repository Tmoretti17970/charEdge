// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — useDerivativesData Hook
//
// Auto-fetches derivatives data (OI history, liquidations) for a
// crypto symbol and provides it to ChartEngine for overlay rendering.
//
// Usage:
//   const { oiData, liquidations, snapshot } = useDerivativesData(binanceSymbol);
//   // Pass oiData and liquidations to ChartEngine props
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger.ts';
import { binanceFuturesAdapter } from '../../data/adapters/BinanceFuturesAdapter.js';

/**
 * Hook that auto-fetches OI history and subscribes to liquidation events
 * for a given crypto futures symbol.
 *
 * @param {string} symbol - Binance-resolved symbol, e.g. 'BTCUSDT'
 * @param {Object} opts
 * @param {boolean} opts.enabled - Whether to fetch data (default: true)
 * @param {string}  opts.oiPeriod - OI history period (default: '5m')
 * @param {number}  opts.refreshMs - OI refresh interval ms (default: 30000)
 * @returns {{ oiData, liquidations, snapshot, loading, error }}
 */
export function useDerivativesData(symbol, opts = {}) {
  const {
    enabled = true,
    oiPeriod = '5m',
    refreshMs = 30_000,
  } = opts;

  const [oiData, setOiData] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const liqUnsubRef = useRef(null);
  const intervalRef = useRef(null);

  const isCrypto = isFuturesSymbol(symbol);

  // Fetch OI history
  const fetchOI = useCallback(async (sym) => {
    try {
      const history = await binanceFuturesAdapter.fetchOpenInterestHistory(sym, oiPeriod, 100);
      if (history?.length) setOiData(history);
    } catch (err) {
      logger.data.warn('[useDerivativesData] OI fetch failed:', err.message);
    }
  }, [oiPeriod]);

  // Fetch full snapshot
  const fetchSnapshot = useCallback(async (sym) => {
    try {
      const snap = await binanceFuturesAdapter.fetchDerivativesSnapshot(sym);
      if (snap) setSnapshot(snap);
    } catch (err) {
      logger.data.warn('[useDerivativesData] Snapshot fetch failed:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !isCrypto || !symbol) {
      setOiData([]);
      setLiquidations([]);
      setSnapshot(null);
      return;
    }

    const upper = symbol.toUpperCase();
    setLoading(true);
    setError(null);

    // Initial fetch
    Promise.all([fetchOI(upper), fetchSnapshot(upper)])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Periodic refresh for OI + snapshot
    intervalRef.current = setInterval(() => {
      fetchOI(upper);
      fetchSnapshot(upper);
    }, refreshMs);

    // Subscribe to live liquidation events
    try {
      liqUnsubRef.current = binanceFuturesAdapter.subscribeLiquidations((liq) => {
        // Only keep liquidations for our symbol
        if (liq.symbol === upper) {
          setLiquidations((prev) => {
            const next = [...prev, liq];
            return next.length > 100 ? next.slice(-100) : next; // Ring buffer
          });
        }
      });
    } catch (err) {
      logger.data.warn('[useDerivativesData] Liquidation WS failed:', err.message);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (liqUnsubRef.current) {
        liqUnsubRef.current();
        liqUnsubRef.current = null;
      }
      setLiquidations([]);
    };
  }, [symbol, enabled, isCrypto, refreshMs, fetchOI, fetchSnapshot]);

  return { oiData, liquidations, snapshot, loading, error };
}

/**
 * Check if a symbol supports Binance futures.
 */
function isFuturesSymbol(symbol) {
  const upper = (symbol || '').toUpperCase();
  return upper.endsWith('USDT') || upper.endsWith('BUSD');
}

export default useDerivativesData;
