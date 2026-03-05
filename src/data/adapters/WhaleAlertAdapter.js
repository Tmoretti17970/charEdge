import { logger } from '../../utils/logger.ts';
// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Whale Alert Adapter
//
// Tracks large cryptocurrency transactions (>$1M) for trading signals.
// Uses the free Whale Alert API or falls back to polling Etherscan.
//
// Whale Alert free tier:
//   - 10 requests/min
//   - Historical data: last 1 hour
//   - Requires free API key from https://whale-alert.io
//
// Etherscan free tier (ETH gas fallback):
//   - 5 requests/sec
//   - Free key from https://etherscan.io/apis
//
// Usage:
//   import { whaleAlertAdapter } from './WhaleAlertAdapter.js';
//   whaleAlertAdapter.setApiKey('YOUR_KEY');
//   const tx = await whaleAlertAdapter.fetchRecentWhaleTransactions();
// ═══════════════════════════════════════════════════════════════════

const WHALE_ALERT_BASE = 'https://api.whale-alert.io/v1';
const ETHERSCAN_BASE = 'https://api.etherscan.io/api';

const CACHE = new Map();
const CACHE_TTL = 120000; // 2 min

class _WhaleAlertAdapter {
  constructor() {
    this._whaleApiKey = '';
    this._etherscanApiKey = '';
  }

  setApiKey(key) { this._whaleApiKey = key; }
  setEtherscanApiKey(key) { this._etherscanApiKey = key; }
  get isConfigured() { return !!this._whaleApiKey; }

  // ─── Whale Alert API ─────────────────────────────────────────

  /**
   * Fetch recent large transactions.
   * @param {Object} [opts]
   * @param {number} [opts.minValue=1000000] - Minimum USD value
   * @param {string} [opts.currency] - Filter by currency (e.g., 'bitcoin')
   * @returns {Promise<Array<{ hash, timestamp, amount, amountUsd, from, to, currency, type }>>}
   */
  async fetchRecentWhaleTransactions(opts = {}) {
    if (!this._whaleApiKey) return [];

    const cached = CACHE.get('recent-whales');
    if (cached && Date.now() < cached.expiry) return cached.data;

    const minValue = opts.minValue || 1000000;
    const since = Math.floor((Date.now() - 3600000) / 1000); // 1 hour ago

    const params = new URLSearchParams({
      api_key: this._whaleApiKey,
      min_value: String(minValue),
      start: String(since),
    });
    if (opts.currency) params.set('currency', opts.currency);

    try {
      const resp = await fetch(`${WHALE_ALERT_BASE}/transactions?${params}`);
      if (!resp.ok) return [];

      const json = await resp.json();
      if (json.result !== 'success' || !json.transactions) return [];

      const result = json.transactions.map(tx => ({
        hash: tx.hash,
        timestamp: tx.timestamp * 1000,
        amount: tx.amount,
        amountUsd: tx.amount_usd,
        from: this._formatOwner(tx.from),
        to: this._formatOwner(tx.to),
        currency: tx.symbol?.toUpperCase() || '',
        blockchain: tx.blockchain,
        type: this._classifyTransaction(tx),
      })).sort((a, b) => b.amountUsd - a.amountUsd);

      CACHE.set('recent-whales', { data: result, expiry: Date.now() + CACHE_TTL });
      return result;
    } catch (err) {
      logger.data.warn('[WhaleAlert] Fetch failed:', err.message);
      return [];
    }
  }

  /**
   * Get a summary of whale activity for a specific crypto.
   * @param {string} currency - e.g., 'bitcoin', 'ethereum'
   * @returns {Promise<{ totalVolume, transactionCount, largestTx, netFlow }>}
   */
  async fetchWhaleActivitySummary(currency) {
    const all = await this.fetchRecentWhaleTransactions({ currency });
    if (!all.length) return null;

    let totalVolume = 0;
    let exchangeInflow = 0;
    let exchangeOutflow = 0;
    let largestTx = all[0];

    for (const tx of all) {
      totalVolume += tx.amountUsd;
      if (tx.amountUsd > largestTx.amountUsd) largestTx = tx;
      if (tx.type === 'exchange_deposit') exchangeInflow += tx.amountUsd;
      if (tx.type === 'exchange_withdrawal') exchangeOutflow += tx.amountUsd;
    }

    return {
      currency: currency.toUpperCase(),
      transactionCount: all.length,
      totalVolumeUsd: Math.round(totalVolume),
      largestTx: {
        amountUsd: largestTx.amountUsd,
        amount: largestTx.amount,
        type: largestTx.type,
      },
      exchangeInflow: Math.round(exchangeInflow),
      exchangeOutflow: Math.round(exchangeOutflow),
      netFlow: Math.round(exchangeInflow - exchangeOutflow),
      sentiment: exchangeInflow > exchangeOutflow ? 'bearish' : 'bullish',
    };
  }

  // ─── Etherscan: ETH Gas Prices ───────────────────────────────

  /**
   * Fetch current ETH gas prices.
   * @returns {Promise<{ low, average, high, baseFee }|null>}
   */
  async fetchGasPrices() {
    if (!this._etherscanApiKey) return null;

    const cached = CACHE.get('gas-prices');
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const resp = await fetch(`${ETHERSCAN_BASE}?module=gastracker&action=gasoracle&apikey=${this._etherscanApiKey}`);
      if (!resp.ok) return null;

      const json = await resp.json();
      if (json.status !== '1' || !json.result) return null;

      const result = {
        low: parseInt(json.result.SafeGasPrice, 10),
        average: parseInt(json.result.ProposeGasPrice, 10),
        high: parseInt(json.result.FastGasPrice, 10),
        baseFee: parseFloat(json.result.suggestBaseFee),
        timestamp: Date.now(),
      };

      CACHE.set('gas-prices', { data: result, expiry: Date.now() + 30000 });
      return result;
    } catch (_) {
      return null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  _formatOwner(owner) {
    if (!owner) return { type: 'unknown', name: '' };
    return {
      type: owner.owner_type || 'unknown',
      name: owner.owner || '',
      address: owner.address || '',
    };
  }

  _classifyTransaction(tx) {
    const fromType = tx.from?.owner_type || '';
    const toType = tx.to?.owner_type || '';

    if (fromType === 'exchange' && toType === 'exchange') return 'exchange_to_exchange';
    if (toType === 'exchange') return 'exchange_deposit';
    if (fromType === 'exchange') return 'exchange_withdrawal';
    if (fromType === 'unknown' && toType === 'unknown') return 'wallet_transfer';
    return 'other';
  }

  /**
   * Format a USD value for display (e.g., "$2.5M", "$150K").
   */
  formatUsd(value) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const whaleAlertAdapter = new _WhaleAlertAdapter();
export default whaleAlertAdapter;
