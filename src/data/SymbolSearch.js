import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Search
//
// Searches for trading symbols across multiple sources:
//   1. Local SymbolRegistry (instant, no network)
//   2. Binance exchangeInfo (crypto pairs)
//
// Extracted from FetchService.js for separation of concerns.
// ═══════════════════════════════════════════════════════════════════

// ─── P4-9: Fuzzy Scoring ─────────────────────────────────────────

/**
 * Generate trigrams (3-char substrings) from a string.
 * @param {string} str
 * @returns {Set<string>}
 */
function trigrams(str) {
  const t = new Set();
  const s = str.toUpperCase();
  for (let i = 0; i <= s.length - 3; i++) t.add(s.slice(i, i + 3));
  return t;
}

/**
 * Score a candidate against a query using fuzzy matching.
 * Returns 0..1 where 1 = perfect match.
 *
 * Scoring weights:
 *   - Exact match: 1.0
 *   - Prefix match: 0.8
 *   - Substring: 0.5
 *   - Trigram overlap: 0..0.4 (Jaccard coefficient)
 *
 * @param {string} query - User's search input (already uppercased)
 * @param {string} candidate - Symbol name to score against
 * @returns {number} 0..1 score
 */
function fuzzyScore(query, candidate) {
  const q = query.toUpperCase();
  const c = candidate.toUpperCase();

  if (q === c) return 1.0;
  if (c.startsWith(q)) return 0.8;
  if (c.includes(q)) return 0.5;

  // Trigram overlap (Jaccard coefficient) — handles typos
  if (q.length >= 3 && c.length >= 3) {
    const qTri = trigrams(q);
    const cTri = trigrams(c);
    let intersection = 0;
    for (const t of qTri) { if (cTri.has(t)) intersection++; }
    const union = qTri.size + cTri.size - intersection;
    if (union === 0) return 0;
    const jaccard = intersection / union;
    return jaccard * 0.4;
  }

  // Short queries: character overlap
  if (q.length < 3) {
    let matches = 0;
    for (const ch of q) { if (c.includes(ch)) matches++; }
    return (matches / q.length) * 0.3;
  }

  return 0;
}

let _exchangeInfoCache = null;

/**
 * C2.3: Binance REST Symbol Search
 * Fetches exchange info to provide symbol autocomplete.
 * Searches local SymbolRegistry first, then Binance exchange info.
 *
 * @param {string} query — Search query (e.g. 'BTC', 'ETH', 'AAPL')
 * @returns {Promise<Array<{name: string, pair: string, description: string, exchange?: string, assetClass?: string, provider?: string}>>}
 */
export async function fetchSymbolSearch(query) {
  if (!query || query.trim() === '') return [];
  const q = query.toUpperCase().trim();

  // ─── 1. Search the local SymbolRegistry first (instant, no network) ───
  // This includes Pyth-powered equities, FX, commodities, and all crypto
  let registryResults = [];
  try {
    // Dynamic import to avoid circular dependency
    const { SymbolRegistry } = await import('./SymbolRegistry.js');
    registryResults = SymbolRegistry.search(q, 10).map((info) => ({
      name: info.symbol,
      pair: info.symbol,
      description: info.displayName || info.symbol,
      exchange: info.exchange || info.provider || '',
      assetClass: info.assetClass || 'stock',
      provider: info.provider || 'yahoo',
    }));
  } catch (_) {
    /* SymbolRegistry not available */
  }

  // ─── 2. Search Binance exchange info (for crypto not in registry) ───
  let binanceResults = [];
  try {
    if (!_exchangeInfoCache) {
      const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
      const url = `${base}/api/binance/v3/exchangeInfo`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data && data.symbols) {
          _exchangeInfoCache = data.symbols
            .filter((s) => s.status === 'TRADING')
            .filter(
              (s) =>
                s.quoteAsset === 'USDT' || s.quoteAsset === 'BUSD' || s.quoteAsset === 'USDC' || s.quoteAsset === 'BTC',
            )
            .map((s) => ({
              name: s.baseAsset,
              pair: s.symbol,
              description: `${s.baseAsset} / ${s.quoteAsset}`,
              exchange: 'Binance',
            }));

          const unique = [];
          const seen = new Set();
          for (const s of _exchangeInfoCache) {
            if (!seen.has(s.name)) {
              seen.add(s.name);
              unique.push(s);
            }
          }
          _exchangeInfoCache = unique;
        }
      }
    }

    if (_exchangeInfoCache) {
      // ─── P4-9: Fuzzy/Trigram Search ──────────────────────────────
      const scored = _exchangeInfoCache
        .map((s) => ({ ...s, score: fuzzyScore(q, s.name) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      binanceResults = scored;
    }
  } catch (err) {
    logger.data.warn('Binance symbol search failed:', err.message);
  }

  // ─── 3. Merge: registry first, then Binance (deduplicated) ───
  const seen = new Set(registryResults.map((r) => r.name));
  const merged = [...registryResults];
  for (const r of binanceResults) {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      merged.push(r);
    }
  }

  return merged.slice(0, 15);
}

/**
 * Clear the cached exchange info (for testing).
 */
export function clearSymbolSearchCache() {
  _exchangeInfoCache = null;
}
