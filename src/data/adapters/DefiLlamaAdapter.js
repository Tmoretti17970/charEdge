// ═══════════════════════════════════════════════════════════════════
// charEdge — DeFi Llama Adapter (Phase 4c)
//
// Free, open-source DeFi data from DeFi Llama's public API.
// Provides:
//   - TVL (Total Value Locked) by protocol and chain
//   - Protocol yields/APY
//   - Stablecoin stats
//   - DEX volumes
//
// API Docs: https://defillama.com/docs/api
// No API key required.
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

const LLAMA_BASE = 'https://api.llama.fi';
const LLAMA_YIELDS = 'https://yields.llama.fi';

export class DefiLlamaAdapter extends BaseAdapter {
  constructor() {
    super('defillama');
    this._protocolCache = null;
    this._protocolCacheTime = 0;
    this._CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  supports(_symbol) {
    // DeFi Llama doesn't serve individual ticker data —
    // it's a supplementary source for protocol-level DeFi metrics
    return false;
  }

  latencyTier() {
    return 'delayed'; // Data updates every few minutes
  }

  // ─── TVL ──────────────────────────────────────────────────────

  /**
   * Get current TVL for all protocols.
   * @returns {Promise<Array<{name: string, tvl: number, chain: string, category: string, change_1d: number}>>}
   */
  async fetchProtocols() {
    const now = Date.now();
    if (this._protocolCache && (now - this._protocolCacheTime) < this._CACHE_TTL) {
      return this._protocolCache;
    }
    try {
      const res = await fetch(`${LLAMA_BASE}/protocols`);
      if (!res.ok) return [];
      const data = await res.json();
      this._protocolCache = (data || []).map(p => ({
        name: p.name,
        slug: p.slug,
        tvl: p.tvl || 0,
        chain: p.chain || p.chains?.[0] || 'Multi',
        category: p.category || 'Unknown',
        change_1d: p.change_1d || 0,
        change_7d: p.change_7d || 0,
        logo: p.logo || null,
        url: p.url || null,
      }));
      this._protocolCacheTime = now;
      return this._protocolCache;
    } catch (e) {
      logger.data.warn('[DefiLlama] fetchProtocols failed:', e);
      return [];
    }
  }

  /**
   * Get historical TVL for a specific protocol.
   * @param {string} slug - Protocol slug (e.g. 'aave', 'uniswap')
   * @returns {Promise<Array<{time: number, tvl: number}>>}
   */
  async fetchProtocolTVL(slug) {
    try {
      const res = await fetch(`${LLAMA_BASE}/protocol/${slug}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.tvl || []).map(p => ({
        time: p.date * 1000, // Convert seconds → ms
        tvl: p.totalLiquidityUSD || 0,
      }));
    } catch (e) {
      logger.data.warn('[DefiLlama] fetchProtocolTVL failed:', e);
      return [];
    }
  }

  /**
   * Get TVL for all chains.
   * @returns {Promise<Array<{name: string, tvl: number}>>}
   */
  async fetchChains() {
    try {
      const res = await fetch(`${LLAMA_BASE}/v2/chains`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(c => ({
        name: c.name,
        tvl: c.tvl || 0,
        tokenSymbol: c.tokenSymbol || null,
      }));
    } catch (e) {
      logger.data.warn('[DefiLlama] fetchChains failed:', e);
      return [];
    }
  }

  // ─── Yields ───────────────────────────────────────────────────

  /**
   * Fetch top yield pools across DeFi.
   * @param {number} [limit=50] - Max pools to return
   * @returns {Promise<Array<{pool: string, project: string, chain: string, tvlUsd: number, apy: number, symbol: string}>>}
   */
  async fetchYields(limit = 50) {
    try {
      const res = await fetch(`${LLAMA_YIELDS}/pools`);
      if (!res.ok) return [];
      const { data } = await res.json();
      return (data || [])
        .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
        .slice(0, limit)
        .map(p => ({
          pool: p.pool,
          project: p.project,
          chain: p.chain,
          tvlUsd: p.tvlUsd || 0,
          apy: p.apy || 0,
          apyBase: p.apyBase || 0,
          apyReward: p.apyReward || 0,
          symbol: p.symbol || '',
          stablecoin: p.stablecoin || false,
        }));
    } catch (e) {
      logger.data.warn('[DefiLlama] fetchYields failed:', e);
      return [];
    }
  }

  // ─── Stablecoins ──────────────────────────────────────────────

  /**
   * Fetch stablecoin market data.
   * @returns {Promise<Array<{name: string, symbol: string, circulating: number, price: number}>>}
   */
  async fetchStablecoins() {
    try {
      const res = await fetch(`${LLAMA_BASE}/stablecoins`);
      if (!res.ok) return [];
      const { peggedAssets } = await res.json();
      return (peggedAssets || []).map(s => ({
        name: s.name,
        symbol: s.symbol,
        circulating: s.circulating?.peggedUSD || 0,
        price: s.price || 1,
        chains: s.chains || [],
      }));
    } catch (e) {
      logger.data.warn('[DefiLlama] fetchStablecoins failed:', e);
      return [];
    }
  }

  // ─── DEX Volumes ──────────────────────────────────────────────

  /**
   * Fetch aggregate DEX volume data.
   * @returns {Promise<Array<{name: string, totalVolume24h: number, change_1d: number}>>}
   */
  async fetchDexVolumes() {
    try {
      const res = await fetch(`${LLAMA_BASE}/overview/dexs`);
      if (!res.ok) return [];
      const { protocols } = await res.json();
      return (protocols || []).map(d => ({
        name: d.name,
        totalVolume24h: d.total24h || 0,
        change_1d: d.change_1d || 0,
        chains: d.chains || [],
      }));
    } catch (e) {
      logger.data.warn('[DefiLlama] fetchDexVolumes failed:', e);
      return [];
    }
  }
}

export const defiLlamaAdapter = new DefiLlamaAdapter();
export default DefiLlamaAdapter;
