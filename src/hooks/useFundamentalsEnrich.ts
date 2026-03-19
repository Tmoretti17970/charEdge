// ═══════════════════════════════════════════════════════════════════
// charEdge — Fundamentals Enrichment Hook (Sprint 32)
//
// Batch-fetches fundamental data (market cap, supply, ATH) for
// watchlist items and merges into a lookup map. Respects CoinGecko
// rate limits with sequential fetching and 1hr cache.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { fetchFundamentals } from '../data/FundamentalService.js';

const BATCH_SIZE = 3;       // max concurrent fetches
const BATCH_DELAY = 2000;   // ms between batches (CoinGecko is 10/min)

/**
 * Hook that enriches watchlist items with fundamental data.
 *
 * @param {string[]} symbols - list of symbols to enrich
 * @returns {{ fundamentals: Record<string, object>, loading: boolean }}
 */
export function useFundamentalsEnrich(symbols) {
  const [fundamentals, setFundamentals] = useState({});
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    // Only fetch symbols we haven't fetched yet
    const toFetch = symbols.filter((s) => !fetchedRef.current.has(s));
    if (toFetch.length === 0) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const results = {};

      // Process in batches to respect rate limits
      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        if (cancelled) break;

        const batch = toFetch.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (sym) => {
          try {
            const data = await fetchFundamentals(sym);
            if (data && !cancelled) {
              results[sym] = data;
              fetchedRef.current.add(sym);
            }
          } catch {
            // Skip failed symbols — they'll show '—'
          }
        });

        await Promise.all(promises);

        // Wait between batches (except for last batch)
        if (i + BATCH_SIZE < toFetch.length && !cancelled) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY));
        }
      }

      if (!cancelled) {
        setFundamentals((prev) => ({ ...prev, ...results }));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [symbols.join(',')]); // re-run when symbol list changes

  return { fundamentals, loading };
}

export default useFundamentalsEnrich;
