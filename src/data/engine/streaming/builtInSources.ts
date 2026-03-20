// ═══════════════════════════════════════════════════════════════════
// charEdge — Built-In Source Adapters
// Registers all default data source adapters (Pyth, Finnhub,
// Binance, Kraken, Bybit, OKX, Coinbase, Forex) into a TickerPlant.
//
// Sprint 5 Task 5.1.3: Adapters are lazy-loaded on first use.
// ═══════════════════════════════════════════════════════════════════

import type { PriceCallback, SourceAdapter } from './TickerPlantTypes.js';

// Sprint 5 Task 5.1.3: Lazy-load adapters — only import when subscribe/fetchQuote is called.
// Each adapter is ~8KB; deferring 7 adapters saves ~56KB from initial load.
const _adapterCache = new Map<string, Promise<any>>();
function _lazy(path: string): Promise<any> {
  if (!_adapterCache.has(path)) _adapterCache.set(path, import(path));
  return _adapterCache.get(path)!;
}

// ── Symbol-class helpers for synchronous `supports` checks ──

const KNOWN_PYTH = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'ATOM', 'FTM', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'JUP',
  'AAPL', 'MSFT', 'GOOG', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX',
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'GOLD', 'SILVER']);

const CRYPTO_BASES = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'FTM', 'NEAR', 'APT',
  'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'LTC', 'FIL',
]);

const FOREX_PAIRS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF',
  'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY']);

function isCryptoSymbol(s: string): boolean {
  const upper = (s || '').toUpperCase();
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('USD')) return true;
  return CRYPTO_BASES.has(upper);
}

// Typed data helper to avoid `unknown` field access
function asAny(d: unknown): any { return d; }

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
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/PythAdapter.js').then(m => {
                if (disposed) return;
                unsub = m.pythAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.time, confidence: d.confidence || 0, volume: d.volume || 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { pythAdapter } = await _lazy('../../adapters/PythAdapter.js');
            const quote = await pythAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: quote.confidence || 0 };
        },

        supports: (symbol: string) => {
            const upper = (symbol || '').toUpperCase().replace(/USDT$|BUSD$/, '');
            return KNOWN_PYTH.has(upper) || isCryptoSymbol(symbol);
        },
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
                const base = typeof window === 'undefined' ? `http://localhost:${(globalThis as unknown as any).__TF_PORT || 3000}` : '';
                const res = await fetch(`${base}/api/binance/v3/ticker/price?symbol=${pair}`);
                if (!res.ok) return null;
                const data = await res.json();
                return { price: parseFloat(data.price), confidence: 0 };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
                return null;
            }
        },

        supports: (symbol: string) => isCryptoSymbol(symbol),
    });

    // ── Finnhub (real-time US stocks + forex)
    sources.set('finnhub', {
        id: 'finnhub',
        name: 'Finnhub',
        assetClasses: ['stock', 'etf', 'forex'],
        available: true, // availability checked lazily

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/FinnhubAdapter.js').then(m => {
                if (disposed || !m.finnhubAdapter.isConfigured) return;
                unsub = m.finnhubAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.timestamp || Date.now(), confidence: 0, volume: d.volume || 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { finnhubAdapter } = await _lazy('../../adapters/FinnhubAdapter.js');
            if (!finnhubAdapter.isConfigured) return null;
            const quote = await finnhubAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => {
            const upper = (symbol || '').toUpperCase();
            return !isCryptoSymbol(symbol) && !upper.includes('/');
        },
    });

    // ── Forex (combined Pyth + Finnhub)
    sources.set('forex', {
        id: 'forex',
        name: 'Forex Multi-Source',
        assetClasses: ['forex'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/ForexAdapter.js').then(m => {
                if (disposed || !m.forexAdapter.supports(symbol)) return;
                unsub = m.forexAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.timestamp || Date.now(), confidence: d.confidence || 0, volume: 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { forexAdapter } = await _lazy('../../adapters/ForexAdapter.js');
            const quote = await forexAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: quote.confidence || 0 };
        },

        supports: (symbol: string) => FOREX_PAIRS.has((symbol || '').toUpperCase()),
    });

    // ── Kraken WebSocket (real-time crypto streaming)
    sources.set('kraken', {
        id: 'kraken',
        name: 'Kraken WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/KrakenAdapter.js').then(m => {
                if (disposed || !m.krakenAdapter.supports(symbol)) return;
                unsub = m.krakenAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.time || d.timestamp || Date.now(), confidence: 0, volume: d.volume || 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { krakenAdapter } = await _lazy('../../adapters/KrakenAdapter.js');
            if (!krakenAdapter.supports(symbol)) return null;
            const quote = await krakenAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => isCryptoSymbol(symbol),
    });

    // ── Bybit WebSocket (real-time crypto spot streaming)
    sources.set('bybit', {
        id: 'bybit',
        name: 'Bybit WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/BybitAdapter.js').then(m => {
                if (disposed || !m.bybitAdapter.supports(symbol)) return;
                unsub = m.bybitAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.time || d.timestamp || Date.now(), confidence: 0, volume: d.volume || 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { bybitAdapter } = await _lazy('../../adapters/BybitAdapter.js');
            if (!bybitAdapter.supports(symbol)) return null;
            const quote = await bybitAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => isCryptoSymbol(symbol),
    });

    // ── OKX WebSocket (real-time crypto spot streaming)
    sources.set('okx', {
        id: 'okx',
        name: 'OKX WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/OKXAdapter.js').then(m => {
                if (disposed || !m.okxAdapter.supports(symbol)) return;
                unsub = m.okxAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.time || d.timestamp || Date.now(), confidence: 0, volume: d.volume || 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { okxAdapter } = await _lazy('../../adapters/OKXAdapter.js');
            if (!okxAdapter.supports(symbol)) return null;
            const quote = await okxAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => isCryptoSymbol(symbol),
    });

    // ── Coinbase WebSocket (real-time crypto ticker)
    sources.set('coinbase', {
        id: 'coinbase',
        name: 'Coinbase WS',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            _lazy('../../adapters/CoinbaseAdapter.js').then(m => {
                if (disposed || !m.coinbaseAdapter.supports(symbol)) return;
                unsub = m.coinbaseAdapter.subscribe(symbol, (data: unknown) => {
                    const d = asAny(data);
                    callback({ price: d.price, timestamp: d.time || d.timestamp || Date.now(), confidence: 0, volume: d.volume || 0 });
                });
            }).catch(() => {});
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { coinbaseAdapter } = await _lazy('../../adapters/CoinbaseAdapter.js');
            if (!coinbaseAdapter.supports(symbol)) return null;
            const quote = await coinbaseAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => isCryptoSymbol(symbol),
    });

    // ── CBOE Market Analytics (VIX, Put/Call Ratios)
    // CBOE provides market-wide analytics rather than per-symbol price
    // streams, so subscribe is null. VIX-class symbols are supported.
    sources.set('cboe', {
        id: 'cboe',
        name: 'CBOE Analytics',
        assetClasses: ['index'],
        available: true,

        subscribe: null,

        fetchQuote: async (symbol: string) => {
            const upper = symbol.toUpperCase();
            // Only VIX-family symbols
            if (!['VIX', 'VIX9D', 'VIX3M', 'VIX6M'].includes(upper)) return null;
            try {
                const { cboeAdapter } = await import('../../adapters/CBOEAdapter.js');
                const curve = await cboeAdapter.fetchVIXTermStructure();
                if (!curve?.length) return null;
                // Map symbol to the right term
                const termMap: Record<string, number> = { VIX9D: 0, VIX: 1, VIX3M: 2, VIX6M: 3 };
                const idx = termMap[upper] ?? 1;
                const point = curve[idx] || curve[0];
                if (!point) return null;
                return { price: point.price, confidence: 0 };
            } catch {
                return null;
            }
        },

        supports: (symbol: string) => {
            const upper = symbol.toUpperCase();
            return ['VIX', 'VIX9D', 'VIX3M', 'VIX6M'].includes(upper);
        },
    });

    // ── CoinCap (free crypto WebSocket — 1500+ assets)
    sources.set('coincap', {
        id: 'coincap',
        name: 'CoinCap',
        assetClasses: ['crypto'],
        available: true,

        subscribe: (symbol: string, callback: PriceCallback) => {
            let unsub: (() => void) | null = null;
            let disposed = false;
            import('../../adapters/CoinCapAdapter.js').then(({ coinCapAdapter }) => {
                if (disposed || !coinCapAdapter.supports(symbol)) return;
                unsub = coinCapAdapter.subscribe(symbol, (data: unknown) => {
                    callback({
                        price: (data as any).price,
                        timestamp: (data as any).time || Date.now(),
                        confidence: 0,
                        volume: (data as any).volume || 0,
                    });
                });
            }).catch(() => { /* CoinCapAdapter import failed — skip */ });
            return () => { disposed = true; if (typeof unsub === 'function') unsub(); };
        },

        fetchQuote: async (symbol: string) => {
            const { coinCapAdapter } = await import('../../adapters/CoinCapAdapter.js');
            if (!coinCapAdapter.supports(symbol)) return null;
            const quote = await coinCapAdapter.fetchQuote(symbol);
            if (!quote) return null;
            return { price: quote.price, confidence: 0 };
        },

        supports: (symbol: string) => {
            // CoinCap supports most crypto symbols
            const s = (symbol || '').toUpperCase();
            return s.endsWith('USDT') || s.endsWith('BUSD') || s.endsWith('USD');
        },
    });

    // ── DeFi Llama (TVL, yields — analytics source, no subscribe)
    sources.set('defillama', {
        id: 'defillama',
        name: 'DeFi Llama',
        assetClasses: ['defi'],
        available: true,

        subscribe: null,

        fetchQuote: async (_symbol: string) => {
            // DeFi Llama doesn't provide per-symbol quotes —
            // use fetchProtocols/fetchYields directly from the adapter
            return null;
        },

        supports: (_symbol: string) => false,
    });
}
