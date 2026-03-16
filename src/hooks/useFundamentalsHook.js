// ═══════════════════════════════════════════════════════════════════
// charEdge — useFundamentalsHook (Sprint 32)
//
// React hook that batches fetchFundamentals() calls for visible
// symbols, dedupes concurrent requests, and returns cached data.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchFundamentals } from '../data/FundamentalService.js';

const globalCache = {};  // symbol → { data, ts }
const CACHE_TTL = 3600_000; // 1 hour
const pendingRequests = {}; // symbol → Promise

async function fetchWithDedup(symbol) {
  const sym = symbol.toUpperCase();

  // Check memory cache
  const cached = globalCache[sym];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Dedupe in-flight requests
  if (pendingRequests[sym]) {
    return pendingRequests[sym];
  }

  pendingRequests[sym] = fetchFundamentals(sym)
    .then(data => {
      if (data) {
        globalCache[sym] = { data, ts: Date.now() };
      }
      delete pendingRequests[sym];
      return data;
    })
    .catch(err => {
      delete pendingRequests[sym];
      return cached?.data || null;
    });

  return pendingRequests[sym];
}

/**
 * React hook to fetch fundamentals for a list of symbols.
 * Returns { data: Record<string, FundamentalData>, loading: boolean }
 *
 * @param {string[]} symbols - Array of symbols to fetch
 * @returns {{ data: Object, loading: boolean }}
 */
export function useFundamentals(symbols) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const prevSymbols = useRef('');

  const fetchAll = useCallback(async (syms) => {
    if (!syms || syms.length === 0) return;

    setLoading(true);
    const results = {};

    // Fetch in batches of 3 with 1s gaps (rate limit friendly)
    for (let i = 0; i < syms.length; i += 3) {
      const batch = syms.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(sym => fetchWithDedup(sym).catch(() => null))
      );
      batch.forEach((sym, idx) => {
        if (batchResults[idx]) {
          results[sym.toUpperCase()] = batchResults[idx];
        }
      });

      // Rate limit gap between batches
      if (i + 3 < syms.length) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    setData(prev => ({ ...prev, ...results }));
    setLoading(false);
  }, []);

  useEffect(() => {
    const key = [...(symbols || [])].sort().join(',');
    if (key === prevSymbols.current) return;
    prevSymbols.current = key;

    // Only fetch symbols not already cached
    const toFetch = (symbols || []).filter(s => {
      const cached = globalCache[s.toUpperCase()];
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        // Pre-populate from cache
        setData(prev => ({ ...prev, [s.toUpperCase()]: cached.data }));
        return false;
      }
      return true;
    });

    if (toFetch.length > 0) {
      fetchAll(toFetch);
    }
  }, [symbols, fetchAll]);

  return { data, loading };
}

/**
 * Clear the in-memory fundamentals cache.
 */
export function clearFundamentalsCache() {
  Object.keys(globalCache).forEach(k => delete globalCache[k]);
}
