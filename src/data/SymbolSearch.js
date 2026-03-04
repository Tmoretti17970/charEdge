// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Search
//
// Searches for trading symbols across multiple sources:
//   1. Local SymbolRegistry (instant, no network)
//   2. Binance exchangeInfo (crypto pairs)
//
// Extracted from FetchService.js for separation of concerns.
// ═══════════════════════════════════════════════════════════════════

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
  } catch {
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
      const exact = [];
      const startsWith = [];
      const contains = [];

      for (const s of _exchangeInfoCache) {
        if (s.name === q) exact.push(s);
        else if (s.name.startsWith(q)) startsWith.push(s);
        else if (s.name.includes(q)) contains.push(s);
        if (exact.length + startsWith.length + contains.length >= 10) break;
      }
      binanceResults = [...exact, ...startsWith, ...contains];
    }
  } catch (err) {
    console.warn('Binance symbol search failed:', err.message);
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
