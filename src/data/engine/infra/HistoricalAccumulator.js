// ═══════════════════════════════════════════════════════════════════
// charEdge — Historical Accumulator
//
// Background gap-filler that runs on app start (or on demand).
// Checks OPFS for each recently-viewed symbol, finds the oldest
// cached candle, and fetches missing earlier history.
//
// Runs at low priority (setTimeout stagger) to avoid impacting UX.
// Rate-limited: max 2 requests per 10 seconds.
//
// Usage:
//   import { startAccumulator, stopAccumulator } from './HistoricalAccumulator.js';
//   startAccumulator();
// ═══════════════════════════════════════════════════════════════════

import { opfsBarStore } from './OPFSBarStore.js';
import { prefetchPredictor } from './PrefetchPredictor.js';

const STORAGE_KEY = 'charEdge-symbol-frequency';
const MAX_CONCURRENT = 2;
const STAGGER_MS = 10_000; // 10s between batches

let _running = false;
let _stopRequested = false;

/**
 * Get the most-viewed symbols, sorted by frequency (descending).
 * @param {number} limit
 * @returns {Array<{ symbol: string, count: number }>}
 */
export function getFrequentSymbols(limit = 10) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const freq = JSON.parse(raw);
    return Object.entries(freq)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Record that a symbol was viewed (increment frequency counter).
 * @param {string} symbol
 */
export function recordSymbolView(symbol) {
  if (!symbol) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const freq = raw ? JSON.parse(raw) : {};
    freq[symbol] = (freq[symbol] || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freq));
  } catch {
    // localStorage not available
  }
}

/**
 * Find gaps in cached data for a symbol/interval and attempt to fill them.
 * @param {string} symbol
 * @param {string} interval - e.g. '1d'
 * @param {Function} fetchFn - async (symbol, interval, opts) => bars[]
 * @returns {Promise<{ filled: number, errors: number }>}
 */
async function _fillGaps(symbol, interval, fetchFn) {
  let filled = 0, errors = 0;

  try {
    const existing = await opfsBarStore.getCandles(symbol, interval);
    if (!existing || existing.length === 0) {
      // No data at all — do a fresh fetch, the normal pipeline handles this
      return { filled: 0, errors: 0 };
    }

    // Find the oldest candle timestamp
    const oldestTime = existing[0].time;
    const oldestMs = typeof oldestTime === 'string' ? new Date(oldestTime).getTime() : oldestTime;

    // Try to fetch older data (pass endTime = oldestMs - 1 to get data before it)
    const olderBars = await fetchFn(symbol, interval, { endTime: oldestMs - 1 });

    if (olderBars && olderBars.length > 0) {
      // Merge: prepend older bars + existing
      const merged = [...olderBars, ...existing];
      await opfsBarStore.putCandles(symbol, interval, merged);
      filled = olderBars.length;
    }
  } catch {
    errors++;
  }

  return { filled, errors };
}

/**
 * Start the background accumulator.
 * Processes the top N most-viewed symbols, filling gaps in their '1d' cache.
 *
 * @param {object} [opts]
 * @param {Function} [opts.fetchFn] - Custom fetch function for testing. Default uses FetchService.
 * @param {number} [opts.maxSymbols=6] - Max symbols to process
 * @returns {Promise<{ processed: number, filled: number, errors: number }>}
 */
export async function startAccumulator(opts = {}) {
  if (_running) return { processed: 0, filled: 0, errors: 0 };
  _running = true;
  _stopRequested = false;

  const maxSymbols = opts.maxSymbols || 6;
  const frequentSymbols = getFrequentSymbols(maxSymbols);

  // Merge ML predictions with frequency-based list (#12 ML Prefetching)
  const currentSymbol = frequentSymbols[0]?.symbol || null;
  const predictions = currentSymbol ? prefetchPredictor.predict(currentSymbol, 3) : [];
  const seenSymbols = new Set(frequentSymbols.map(s => s.symbol));
  for (const pred of predictions) {
    if (!seenSymbols.has(pred.symbol) && frequentSymbols.length < maxSymbols) {
      frequentSymbols.push({ symbol: pred.symbol, count: 0 });
      seenSymbols.add(pred.symbol);
    }
  }
  const symbols = frequentSymbols;

  let totalProcessed = 0, totalFilled = 0, totalErrors = 0;

  // Default fetch function uses FetchService's Binance pagination
  const fetchFn = opts.fetchFn || (async (sym, interval, fetchOpts) => {
    try {
      const { fetchOHLC } = await import('../../FetchService.js');
      // Pass fetchOpts so endTime is respected for gap-filling
      const result = await fetchOHLC(sym, interval, fetchOpts);
      return result?.data || null;
    } catch {
      return null;
    }
  });

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
    if (_stopRequested) break;

    const batch = symbols.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map((s) => _fillGaps(s.symbol, '1d', fetchFn));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalProcessed++;
        totalFilled += result.value.filled;
        totalErrors += result.value.errors;
      } else {
        totalErrors++;
      }
    }

    // Stagger between batches
    if (i + MAX_CONCURRENT < symbols.length && !_stopRequested) {
      await new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
    }
  }

  _running = false;
  return { processed: totalProcessed, filled: totalFilled, errors: totalErrors };
}

/**
 * Stop the accumulator if it's running.
 */
export function stopAccumulator() {
  _stopRequested = true;
}

/**
 * Check if the accumulator is currently running.
 * @returns {boolean}
 */
export function isRunning() {
  return _running;
}

export default { startAccumulator, stopAccumulator, isRunning, getFrequentSymbols, recordSymbolView };
