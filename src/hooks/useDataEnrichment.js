// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — useDataEnrichment Hook
//
// Composable React hook that provides the "Bloomberg layer" —
// all streaming derived metrics for any symbol. Automatically
// subscribes to StreamingMetrics and provides real-time updates.
//
// Usage:
//   const metrics = useDataEnrichment('BTCUSDT');
//   // metrics.orderImbalance, metrics.twap, metrics.volatilityRegime, etc.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { streamingMetrics } from '../data/engine/streaming/StreamingMetrics.js';
import { tickPersistence } from '../data/engine/streaming/TickPersistence.js';

/**
 * Hook that provides real-time streaming metrics for a symbol.
 *
 * @param {string} symbol - e.g., 'BTCUSDT'
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - Whether to subscribe
 * @returns {Object} All streaming metric values
 */
export function useDataEnrichment(symbol, options = {}) {
  const { enabled = true } = options;
  const [snapshot, setSnapshot] = useState(null);
  const symbolRef = useRef(null);

  useEffect(() => {
    if (!enabled || !symbol) {
      setSnapshot(null);
      return;
    }

    const upper = symbol.toUpperCase();
    symbolRef.current = upper;

    // Get initial snapshot
    const initial = streamingMetrics.getSnapshot(upper);
    if (initial) setSnapshot(initial);

    // Subscribe to updates
    const unsub = streamingMetrics.subscribe(upper, (metrics) => {
      if (symbolRef.current === upper) {
        setSnapshot(metrics);
      }
    });

    return () => {
      unsub();
    };
  }, [symbol, enabled]);

  return snapshot || {
    symbol: symbol?.toUpperCase() || '',
    tickCount: 0,
    orderImbalance: 0,
    tradeArrivalRate: 0,
    twap: 0,
    volatilityRegime: 'normal',
    volatilityPct: 0,
    deltaDivergence: 0,
    absorption: null,
    priceImpact: { alpha: 0, beta: 0, interpretation: 'neutral' },
    volumeClockBars: 0,
    currentBarProgress: 0,
  };
}

/**
 * Hook that provides tick data persistence stats and export capabilities.
 *
 * @param {string} symbol
 * @returns {{ stats, inventory, exportCSV, exportJSON, downloadExport }}
 */
export function useTickPersistence(symbol) {
  const [inventory, setInventory] = useState({});
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadInventory = async () => {
      const inv = await tickPersistence.getDataInventory();
      if (mounted) setInventory(inv);
    };

    loadInventory();
    const timer = setInterval(loadInventory, 30000); // Refresh every 30 sec

    setStats(tickPersistence.getStats());

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [symbol]);

  const exportCSV = useCallback(async () => {
    if (symbol) await tickPersistence.downloadExport(symbol, 'csv');
  }, [symbol]);

  const exportJSON = useCallback(async () => {
    if (symbol) await tickPersistence.downloadExport(symbol, 'json');
  }, [symbol]);

  return {
    stats,
    inventory,
    symbolData: inventory[(symbol || '').toUpperCase()] || null,
    exportCSV,
    exportJSON,
  };
}

/**
 * Hook that provides volume clock bars for a symbol.
 *
 * @param {string} symbol
 * @param {number} [limit=100]
 * @returns {Array} Volume clock bars
 */
export function useVolumeClockBars(symbol, limit = 100) {
  const [bars, setBars] = useState([]);

  useEffect(() => {
    if (!symbol) return;

    const upper = symbol.toUpperCase();
    let lastCount = 0;

    const unsub = streamingMetrics.subscribe(upper, (snapshot) => {
      if (snapshot.volumeClockBars !== lastCount) {
        lastCount = snapshot.volumeClockBars;
        setBars(streamingMetrics.getVolumeClockBars(upper, limit));
      }
    });

    return unsub;
  }, [symbol, limit]);

  return bars;
}

export default useDataEnrichment;
