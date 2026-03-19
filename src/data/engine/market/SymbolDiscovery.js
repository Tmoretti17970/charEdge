// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Discovery Service (6.5.4)
//
// Queries all configured data adapters for available symbols,
// deduplicates results, and returns a unified list.
//
// Usage:
//   import { symbolDiscovery } from './SymbolDiscovery.js';
//   const results = await symbolDiscovery.search('AAPL');
//   // → [{ symbol: 'AAPL', name: 'Apple Inc.', type: 'EQUITY', exchange: 'NASDAQ', adapter: 'polygon' }, ...]
// ═══════════════════════════════════════════════════════════════════

import { SymbolRegistry } from '../../SymbolRegistry.js';

// ─── Adapter Registry ──────────────────────────────────────────

// Lazy-loaded adapters — import on first use to avoid circular deps
const ADAPTER_LOADERS = [
    { name: 'binance', load: () => import('../adapters/BinanceAdapter.js').then(m => new m.BinanceAdapter()) },
    { name: 'polygon', load: () => import('../adapters/PolygonAdapter.js').then(m => m.polygonAdapter) },
    { name: 'alpaca', load: () => import('../adapters/AlpacaAdapter.js').then(m => m.alpacaAdapter) },
    { name: 'yahoo', load: () => import('../adapters/YahooAdapter.js').then(m => m.default || new m.YahooAdapter()) },
];

// ─── Discovery Service ─────────────────────────────────────────

class SymbolDiscovery {
    constructor() {
        /** @type {Map<string, import('../adapters/BaseAdapter.js').default>} */
        this._adapters = new Map();
        this._initialized = false;
        this._initPromise = null;
    }

    /**
     * Initialize adapters (lazy, once).
     * @private
     */
    async _ensureInit() {
        if (this._initialized) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            for (const { name, load } of ADAPTER_LOADERS) {
                try {
                    const adapter = await load();
                    if (adapter) {
                        this._adapters.set(name, adapter);
                    }
                // eslint-disable-next-line unused-imports/no-unused-vars
                } catch (_) {
                    // Adapter not available — skip
                }
            }
            this._initialized = true;
        })();

        return this._initPromise;
    }

    /**
     * Search for symbols across all configured adapters.
     * Deduplicates by symbol, preferring adapters with live data capabilities.
     *
     * @param {string} query - Search term (e.g., 'AAPL', 'bitcoin')
     * @param {Object} [opts]
     * @param {number} [opts.limit=20] - Max results
     * @param {number} [opts.timeout=5000] - Per-adapter timeout in ms
     * @returns {Promise<Array<{symbol: string, name: string, type: string, exchange: string, adapter: string}>>}
     */
    async search(query, { limit = 20, timeout = 5000 } = {}) {
        await this._ensureInit();

        if (!query?.trim()) return [];

        // Query all adapters in parallel with timeout
        const promises = [];
        for (const [name, adapter] of this._adapters) {
            // Skip adapters that require config but aren't configured
            if (adapter.isConfigured === false) continue;

            const adapterPromise = Promise.race([
                adapter.searchSymbols(query, limit).then(results =>
                    results.map(r => ({ ...r, adapter: name })),
                ),
                new Promise(resolve => setTimeout(() => resolve([]), timeout)),
            ]).catch(() => []);

            promises.push(adapterPromise);
        }

        const allResults = (await Promise.all(promises)).flat();

        // Deduplicate by symbol — prefer adapters with subscribe capability
        const seen = new Map(); // symbol → result
        const ADAPTER_PRIORITY = { polygon: 3, alpaca: 2, binance: 1, yahoo: 0 };

        for (const result of allResults) {
            const sym = result.symbol.toUpperCase();
            const existing = seen.get(sym);

            if (!existing) {
                seen.set(sym, result);
            } else {
                // Keep higher-priority adapter
                const existingPri = ADAPTER_PRIORITY[existing.adapter] ?? 0;
                const newPri = ADAPTER_PRIORITY[result.adapter] ?? 0;
                if (newPri > existingPri) {
                    seen.set(sym, result);
                }
            }
        }

        const results = Array.from(seen.values()).slice(0, limit);
        // Auto-register newly discovered symbols into SymbolRegistry (Phase 1b)
        this._autoRegister(results);
        return results;
    }

    /**
     * Auto-register search results into SymbolRegistry so subsequent lookups,
     * watchlists, and routing find newly discovered symbols.
     * @param {Array<{symbol: string, name: string, type: string, exchange: string, adapter: string}>} results
     */
    _autoRegister(results) {
        for (const r of results) {
            if (!r.symbol || SymbolRegistry.lookup(r.symbol)) continue;
            SymbolRegistry.register({
                symbol: r.symbol,
                displayName: r.name || r.symbol,
                assetClass: (r.type || 'stock').toLowerCase(),
                provider: r.adapter || 'yahoo',
                exchange: r.exchange || '',
                currency: 'USD',
                realtime: false,
            });
        }
    }

    /**
     * Check which adapters support a specific symbol.
     * @param {string} symbol
     * @returns {Promise<string[]>} Adapter names that support this symbol
     */
    async getSupportingAdapters(symbol) {
        await this._ensureInit();

        const supporting = [];
        for (const [name, adapter] of this._adapters) {
            try {
                if (adapter.supports(symbol)) {
                    supporting.push(name);
                }
            // eslint-disable-next-line unused-imports/no-unused-vars
            } catch (_) {
                // skip
            }
        }
        return supporting;
    }

    /**
     * Get the best adapter for a symbol (highest priority configured adapter).
     * @param {string} symbol
     * @returns {Promise<{name: string, adapter: import('../adapters/BaseAdapter.js').default} | null>}
     */
    async getBestAdapter(symbol) {
        await this._ensureInit();

        const PRIORITY = ['polygon', 'alpaca', 'binance', 'yahoo'];

        for (const name of PRIORITY) {
            const adapter = this._adapters.get(name);
            if (adapter && adapter.supports(symbol)) {
                if (adapter.isConfigured === false) continue;
                return { name, adapter };
            }
        }

        return null;
    }

    /**
     * Get all registered adapter names and their status.
     */
    async getAdapterStatus() {
        await this._ensureInit();

        const status = {};
        for (const [name, adapter] of this._adapters) {
            status[name] = {
                configured: adapter.isConfigured !== false,
                capabilities: adapter.capabilities?.() || {},
            };
        }
        return status;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const symbolDiscovery = new SymbolDiscovery();
export { SymbolDiscovery };
export default symbolDiscovery;
