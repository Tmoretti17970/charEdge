// ═══════════════════════════════════════════════════════════════════
// charEdge — DexScreener Adapter
//
// Free DEX token price data via DexScreener's public API.
// No API key required. Covers memecoins, new launches, and
// tokens not listed on centralized exchanges.
//
// API Docs: https://docs.dexscreener.com/api/reference
// Endpoint: https://api.dexscreener.com/latest/dex
//
// Features:
//   ✓ Token search by symbol or address
//   ✓ Price, volume, liquidity, change%
//   ✓ Multi-chain coverage (Ethereum, Solana, Base, etc.)
//   ✓ No API key required
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

const DEX_BASE = 'https://api.dexscreener.com';

export class DexScreenerAdapter extends BaseAdapter {
  constructor() {
    super('dexscreener');
  }

  supports(_symbol) {
    // DexScreener can look up any token — we don't pre-filter
    return true;
  }

  latencyTier() {
    return 'fast';
  }

  /**
   * Fetch quote for a token via DexScreener search.
   * Picks the highest-liquidity pair.
   */
  async fetchQuote(symbol) {
    const clean = (symbol || '').toUpperCase().replace(/USDT$|BUSD$|USD$/, '');
    if (!clean) return null;

    try {
      const res = await fetch(`${DEX_BASE}/latest/dex/search?q=${encodeURIComponent(clean)}`);
      if (!res.ok) return null;
      const json = await res.json();

      const pairs = json.pairs || [];
      if (pairs.length === 0) return null;

      // Sort by liquidity (USD) descending, pick best pair
      const sorted = pairs
        .filter((p) => p.baseToken?.symbol?.toUpperCase() === clean)
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

      const best = sorted[0] || pairs[0];
      if (!best) return null;

      const price = parseFloat(best.priceUsd) || 0;
      const change24h = best.priceChange?.h24 || 0;

      return {
        price,
        change: price * (change24h / 100),
        changePct: change24h,
        volume: best.volume?.h24 || 0,
        high: 0, // DexScreener doesn't provide H/L
        low: 0,
        open: 0,
        // Extra DEX-specific metadata
        _dex: {
          chain: best.chainId,
          dexId: best.dexId,
          pairAddress: best.pairAddress,
          liquidity: best.liquidity?.usd || 0,
          fdv: best.fdv || 0,
          baseToken: best.baseToken,
          quoteToken: best.quoteToken,
          url: best.url,
        },
      };
    } catch (e) {
      logger.data.warn('[DexScreener] fetchQuote failed:', e.message);
      return null;
    }
  }

  /**
   * Search for tokens by name or symbol.
   */
  async searchSymbols(query, limit = 10) {
    try {
      const res = await fetch(`${DEX_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const json = await res.json();
      const pairs = json.pairs || [];

      // Deduplicate by base token symbol
      const seen = new Set();
      const results = [];
      for (const p of pairs) {
        const sym = p.baseToken?.symbol?.toUpperCase();
        if (!sym || seen.has(sym)) continue;
        seen.add(sym);
        results.push({
          symbol: sym,
          name: p.baseToken?.name || sym,
          type: 'crypto',
          exchange: `DEX (${p.chainId}/${p.dexId})`,
        });
        if (results.length >= limit) break;
      }
      return results;
    } catch {
      return [];
    }
  }
}

export const dexScreenerAdapter = new DexScreenerAdapter();
