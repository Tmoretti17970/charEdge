// ═══════════════════════════════════════════════════════════════════
// charEdge — Built-In Source Adapters
// Registers all default data source adapters (Pyth, Finnhub,
// Binance, Kraken, Bybit, OKX, Coinbase, Forex) into a TickerPlant.
// ═══════════════════════════════════════════════════════════════════

import type { PriceCallback, SourceAdapter } from './TickerPlantTypes.js';
import { pythAdapter } from '../../adapters/PythAdapter.js';
import { finnhubAdapter } from '../../adapters/FinnhubAdapter.js';
import { forexAdapter } from '../../adapters/ForexAdapter.js';
import { krakenAdapter } from '../../adapters/KrakenAdapter.js';
import { bybitAdapter } from '../../adapters/BybitAdapter.js';
import { okxAdapter } from '../../adapters/OKXAdapter.js';
import { coinbaseAdapter } from '../../adapters/CoinbaseAdapter.js';

/**
 * Register all built-in data source adapters into the given source map.
 * @param sources - The TickerPlant's source registry map
 */
export function registerBuiltInSources(sources: Map<string, SourceAdapter>): void {
    // ── Pyth Network (SSE streaming)
    sources.set('pyth', {
        id: 'pyth',
        name: 'Pyth Network',
        assetClasses: ['crypto', 'stock', 'forex', 'commodity'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            return pythAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.time,
                    confidence: data.confidence || 0,
                    volume: data.volume || 0,
                });
            });
        },

        fetchQuote: async (symbol: string) => {
            const quote = await pythAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return {
                price: quote.price,
                confidence: quote.confidence || 0,
            };
        },

        supports: (symbol: string) => pythAdapter.supports(symbol),
    });

    // ── Binance REST (client-side crypto)
    sources.set('binance-rest', {
        id: 'binance-rest',
        name: 'Binance REST',
        assetClasses: ['crypto'],
        available: true,

        subscribe: null,
        fetchQuote: async (symbol: string) => {
            try {
                const upper = (symbol || '').toUpperCase();
                const { isCrypto } = await import('../../../constants.js');
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const base_sym = upper.replace(/(?:USDT|BUSD|USDC)$/, '');
                if (!isCrypto(base_sym) && !upper.endsWith('USDT') && !upper.endsWith('BUSD')) return null;
                const pair = upper.endsWith('USDT') ? upper : upper + 'USDT';
                const base = typeof window === 'undefined' ? `http://localhost:${(globalThis as unknown).__TF_PORT || 3000}` : '';
                const res = await fetch(`${base}/api/binance/v3/ticker/price?symbol=${pair}`);
                if (!res.ok) return null;
                const data = await res.json();
                return { price: parseFloat(data.price), confidence: 0 };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
                return null;
            }
        },

        supports: (symbol: string) => {
            const upper = (symbol || '').toUpperCase();
            if (upper.endsWith('USDT') || upper.endsWith('BUSD')) return true;
            const CRYPTO_BASES = new Set([
                'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
                'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'FTM', 'NEAR', 'APT',
                'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'LTC', 'FIL',
            ]);
            return CRYPTO_BASES.has(upper);
        },
    });

    // ── Finnhub (real-time US stocks + forex)
    sources.set('finnhub', {
        id: 'finnhub',
        name: 'Finnhub',
        assetClasses: ['stock', 'etf', 'forex'],
        available: finnhubAdapter.isConfigured,

        subscribe: finnhubAdapter.isConfigured ? (symbol: string, callback: PriceCallback) => {
            return finnhubAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.timestamp || Date.now(),
                    confidence: 0,
                    volume: data.volume || 0,
                });
            });
        } : null,

        fetchQuote: finnhubAdapter.isConfigured ? async (symbol: string) => {
            const quote = await finnhubAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        } : null,

        supports: (symbol: string) => finnhubAdapter.supports(symbol),
    });

    // ── Forex (combined Pyth + Finnhub)
    sources.set('forex', {
        id: 'forex',
        name: 'Forex Multi-Source',
        assetClasses: ['forex'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            if (!forexAdapter.supports(symbol)) return null;
            return forexAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.timestamp || Date.now(),
                    confidence: data.confidence || 0,
                    volume: 0,
                });
            });
        },

        fetchQuote: async (symbol: string) => {
            const quote = await forexAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: quote.confidence || 0 };
        },

        supports: (symbol: string) => forexAdapter.supports(symbol),
    });

    // ── Kraken WebSocket (real-time crypto streaming)
    sources.set('kraken', {
        id: 'kraken',
        name: 'Kraken WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            if (!krakenAdapter.supports(symbol)) return null;
            return krakenAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.time || data.timestamp || Date.now(),
                    confidence: 0,
                    volume: data.volume || 0,
                });
            });
        },

        fetchQuote: async (symbol: string) => {
            if (!krakenAdapter.supports(symbol)) return null;
            const quote = await krakenAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => krakenAdapter.supports(symbol),
    });

    // ── Bybit WebSocket (real-time crypto spot streaming)
    sources.set('bybit', {
        id: 'bybit',
        name: 'Bybit WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            if (!bybitAdapter.supports(symbol)) return null;
            return bybitAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.time || data.timestamp || Date.now(),
                    confidence: 0,
                    volume: data.volume || 0,
                });
            });
        },

        fetchQuote: async (symbol: string) => {
            if (!bybitAdapter.supports(symbol)) return null;
            const quote = await bybitAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => bybitAdapter.supports(symbol),
    });

    // ── OKX WebSocket (real-time crypto spot streaming)
    sources.set('okx', {
        id: 'okx',
        name: 'OKX WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            if (!okxAdapter.supports(symbol)) return null;
            return okxAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.time || data.timestamp || Date.now(),
                    confidence: 0,
                    volume: data.volume || 0,
                });
            });
        },

        fetchQuote: async (symbol: string) => {
            if (!okxAdapter.supports(symbol)) return null;
            const quote = await okxAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => okxAdapter.supports(symbol),
    });

    // ── Coinbase WebSocket (real-time crypto ticker)
    sources.set('coinbase', {
        id: 'coinbase',
        name: 'Coinbase WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            if (!coinbaseAdapter.supports(symbol)) return null;
            return coinbaseAdapter.subscribe(symbol, (data: unknown) => {
                callback({
                    price: data.price,
                    timestamp: data.time || data.timestamp || Date.now(),
                    confidence: 0,
                    volume: data.volume || 0,
                });
            });
        },

        fetchQuote: async (symbol: string) => {
            if (!coinbaseAdapter.supports(symbol)) return null;
            const quote = await coinbaseAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => coinbaseAdapter.supports(symbol),
    });
}
