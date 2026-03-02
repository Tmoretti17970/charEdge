// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Symbol Registry (Arch Improvement #7)
//
// Central registry for all supported instruments.
// Replaces scattered symbol definitions across constants.js,
// WebSocketService, FetchService, and FundamentalService.
//
// Usage:
//   import { SymbolRegistry } from './SymbolRegistry.js';
//   const info = SymbolRegistry.lookup('AAPL');
//   const cryptos = SymbolRegistry.byClass('crypto');
//   const provider = SymbolRegistry.getProvider('BTCUSDT');
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SymbolInfo
 * @property {string} symbol - Canonical symbol (e.g. 'AAPL', 'BTCUSDT')
 * @property {string} displayName - Human-readable name
 * @property {string} assetClass - 'stock'|'etf'|'crypto'|'futures'|'forex'|'options'|'index'
 * @property {string} provider - 'yahoo'|'binance'|'polygon'|'pyth'|'manual'
 * @property {string} [exchange] - Exchange name
 * @property {string} [currency] - Quote currency
 * @property {boolean} [realtime] - Supports WebSocket/SSE streaming
 * @property {string} [wsSymbol] - Symbol format for WebSocket subscriptions
 * @property {string} [pythFeedId] - Pyth Network feed ID for SSE streaming
 */

// ─── Built-in Symbol Catalog ────────────────────────────────────

const CRYPTO_PAIRS = [
  { symbol: 'BTCUSDT', displayName: 'Bitcoin', exchange: 'Binance', wsSymbol: 'btcusdt' },
  { symbol: 'ETHUSDT', displayName: 'Ethereum', exchange: 'Binance', wsSymbol: 'ethusdt' },
  { symbol: 'SOLUSDT', displayName: 'Solana', exchange: 'Binance', wsSymbol: 'solusdt' },
  { symbol: 'BNBUSDT', displayName: 'BNB', exchange: 'Binance', wsSymbol: 'bnbusdt' },
  { symbol: 'XRPUSDT', displayName: 'XRP', exchange: 'Binance', wsSymbol: 'xrpusdt' },
  { symbol: 'ADAUSDT', displayName: 'Cardano', exchange: 'Binance', wsSymbol: 'adausdt' },
  { symbol: 'DOGEUSDT', displayName: 'Dogecoin', exchange: 'Binance', wsSymbol: 'dogeusdt' },
  { symbol: 'AVAXUSDT', displayName: 'Avalanche', exchange: 'Binance', wsSymbol: 'avaxusdt' },
  { symbol: 'DOTUSDT', displayName: 'Polkadot', exchange: 'Binance', wsSymbol: 'dotusdt' },
  { symbol: 'MATICUSDT', displayName: 'Polygon', exchange: 'Binance', wsSymbol: 'maticusdt' },
  { symbol: 'LINKUSDT', displayName: 'Chainlink', exchange: 'Binance', wsSymbol: 'linkusdt' },
  { symbol: 'LTCUSDT', displayName: 'Litecoin', exchange: 'Binance', wsSymbol: 'ltcusdt' },
].map((c) => ({ ...c, assetClass: 'crypto', provider: 'binance', currency: 'USDT', realtime: true }));

// Pyth feed IDs for stocks (subset that Pyth supports)
const _PYTH_STOCK_IDS = {
  AAPL:  '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  MSFT:  '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  GOOGL: '0xe65ff435be42630439c96a7c34a99577de631c5b6e17c5a642c8cf3a3ef84c39',
  AMZN:  '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364b5060e91916e551418',
  NVDA:  '0x2bef40c78bc4bccf2956e7d70c8db7fcf6c8e0c1acf1973cae7f7e59a0eac3a3',
  META:  '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  TSLA:  '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  JPM:   '0x7f4f157e57bda157e37bb6dd6e6ee2d8a8ff2b35cc1c3fa23eb61b0f6f31d1ae',
  NFLX:  '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2',
  AMD:   '0xa9dcd4ba8a5db3a0de2bfd16d882fe1f2fedc65bbc56e3e49f9e3eac0b07c52a',
  CRM:   '0xfeff234600320f4d6bb5a01d02570a9725c1e424977f2b823f7231e6857bdae8',
};

const POPULAR_STOCKS = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'META',
  'TSLA',
  'BRK-B',
  'JPM',
  'V',
  'UNH',
  'MA',
  'HD',
  'PG',
  'JNJ',
  'BAC',
  'XOM',
  'ABBV',
  'COST',
  'KO',
  'MRK',
  'PEP',
  'AVGO',
  'LLY',
  'TMO',
  'ORCL',
  'ADBE',
  'CRM',
  'CSCO',
  'ACN',
  'NFLX',
  'AMD',
  'INTC',
  'QCOM',
  'TXN',
].map((s) => ({
  symbol: s,
  displayName: s,
  assetClass: 'stock',
  provider: 'pyth',
  exchange: 'NASDAQ/NYSE',
  currency: 'USD',
  realtime: true,
  pythFeedId: _PYTH_STOCK_IDS[s] || null,
}));

const POPULAR_ETFS = [
  { symbol: 'SPY', displayName: 'S&P 500 ETF' },
  { symbol: 'QQQ', displayName: 'Nasdaq 100 ETF' },
  { symbol: 'IWM', displayName: 'Russell 2000 ETF' },
  { symbol: 'DIA', displayName: 'Dow Jones ETF' },
  { symbol: 'VTI', displayName: 'Total Stock Market' },
  { symbol: 'GLD', displayName: 'Gold ETF' },
  { symbol: 'TLT', displayName: '20+ Year Treasury' },
  { symbol: 'XLF', displayName: 'Financial Sector' },
  { symbol: 'XLK', displayName: 'Tech Sector' },
  { symbol: 'XLE', displayName: 'Energy Sector' },
  { symbol: 'ARKK', displayName: 'ARK Innovation' },
  { symbol: 'VIX', displayName: 'Volatility Index' },
].map((e) => ({
  ...e,
  assetClass: 'etf',
  provider: 'yahoo',
  exchange: 'NYSE',
  currency: 'USD',
  realtime: false,
}));

const FOREX_PAIRS = [
  { symbol: 'EURUSD=X', displayName: 'EUR/USD', wsSymbol: 'eurusd', pythFeedId: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b' },
  { symbol: 'GBPUSD=X', displayName: 'GBP/USD', wsSymbol: 'gbpusd', pythFeedId: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1' },
  { symbol: 'USDJPY=X', displayName: 'USD/JPY', wsSymbol: 'usdjpy', pythFeedId: '0xef2c98c804ba503c6a707e38be4dfbb16683775e3783c8a75d24bbc16dcdeec0' },
  { symbol: 'AUDUSD=X', displayName: 'AUD/USD', wsSymbol: 'audusd', pythFeedId: '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80' },
  { symbol: 'USDCAD=X', displayName: 'USD/CAD', wsSymbol: 'usdcad', pythFeedId: '0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b0a688e1aa5be1b51698' },
  { symbol: 'USDCHF=X', displayName: 'USD/CHF', wsSymbol: 'usdchf', pythFeedId: '0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e8840' },
].map((f) => ({
  ...f,
  assetClass: 'forex',
  provider: 'pyth',
  exchange: 'FX',
  currency: 'USD',
  realtime: true,
}));

const COMMODITIES = [
  { symbol: 'XAU', displayName: 'Gold (XAU/USD)', pythFeedId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63c52eecd2c7a9c6ffe' },
  { symbol: 'XAG', displayName: 'Silver (XAG/USD)', pythFeedId: '0xf2fb02c32b055c805e7238d628e5e992ab910babeb8d9e093ed7e3d2a1f3b3c5' },
].map((c) => ({
  ...c,
  assetClass: 'commodity',
  provider: 'pyth',
  exchange: 'Pyth Network',
  currency: 'USD',
  realtime: true,
}));

const FUTURES = [
  { symbol: 'ES=F', displayName: 'E-mini S&P 500' },
  { symbol: 'NQ=F', displayName: 'E-mini Nasdaq' },
  { symbol: 'YM=F', displayName: 'E-mini Dow' },
  { symbol: 'RTY=F', displayName: 'E-mini Russell' },
  { symbol: 'CL=F', displayName: 'Crude Oil' },
  { symbol: 'GC=F', displayName: 'Gold Futures' },
  { symbol: 'SI=F', displayName: 'Silver Futures' },
  { symbol: 'ZB=F', displayName: 'US Treasury Bond' },
  { symbol: 'ZN=F', displayName: '10-Year T-Note' },
  { symbol: 'NG=F', displayName: 'Natural Gas' },
].map((f) => ({
  ...f,
  assetClass: 'futures',
  provider: 'yahoo',
  exchange: 'CME',
  currency: 'USD',
  realtime: false,
}));

// ─── Registry Class ─────────────────────────────────────────────

class _SymbolRegistry {
  constructor() {
    /** @type {Map<string, SymbolInfo>} */
    this._map = new Map();
    this._aliases = new Map(); // e.g. 'BTC' → 'BTCUSDT'

    // Load built-in catalog
    const all = [...CRYPTO_PAIRS, ...POPULAR_STOCKS, ...POPULAR_ETFS, ...FOREX_PAIRS, ...FUTURES, ...COMMODITIES];
    for (const info of all) {
      this._map.set(info.symbol.toUpperCase(), info);
    }

    // Set up aliases
    this._aliases.set('BTC', 'BTCUSDT');
    this._aliases.set('ETH', 'ETHUSDT');
    this._aliases.set('SOL', 'SOLUSDT');
    this._aliases.set('BITCOIN', 'BTCUSDT');
    this._aliases.set('ETHEREUM', 'ETHUSDT');
    // Commodity / forex aliases for Pyth resolution
    this._aliases.set('GOLD', 'XAU');
    this._aliases.set('SILVER', 'XAG');
    this._aliases.set('EURUSD', 'EURUSD=X');
    this._aliases.set('GBPUSD', 'GBPUSD=X');
    this._aliases.set('USDJPY', 'USDJPY=X');
  }

  /**
   * Look up symbol info. Returns null if unknown.
   * @param {string} symbol
   * @returns {SymbolInfo|null}
   */
  lookup(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase().trim();
    const resolved = this._aliases.get(upper) || upper;
    return this._map.get(resolved) || null;
  }

  /**
   * Get all symbols for an asset class.
   * @param {'stock'|'etf'|'crypto'|'futures'|'forex'} assetClass
   * @returns {SymbolInfo[]}
   */
  byClass(assetClass) {
    return Array.from(this._map.values()).filter((s) => s.assetClass === assetClass);
  }

  /**
   * Get the data provider for a symbol.
   * @param {string} symbol
   * @returns {'yahoo'|'binance'|'polygon'|'manual'|null}
   */
  getProvider(symbol) {
    const info = this.lookup(symbol);
    return info?.provider || null;
  }

  /**
   * Check if a symbol supports real-time streaming.
   * @param {string} symbol
   * @returns {boolean}
   */
  isRealtime(symbol) {
    const info = this.lookup(symbol);
    return info?.realtime || false;
  }

  /**
   * Register a custom symbol (e.g. from broker import).
   * @param {SymbolInfo} info
   */
  register(info) {
    if (!info.symbol) return;
    this._map.set(info.symbol.toUpperCase(), {
      ...info,
      provider: info.provider || 'yahoo',
      assetClass: info.assetClass || 'stock',
      realtime: info.realtime || false,
    });
  }

  /**
   * Search symbols by query string (for autocomplete).
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {SymbolInfo[]}
   */
  search(query, limit = 10) {
    if (!query || query.length < 1) return [];
    const q = query.toUpperCase().trim();
    const results = [];

    for (const [sym, info] of this._map) {
      if (results.length >= limit) break;
      if (sym.includes(q) || info.displayName?.toUpperCase().includes(q)) {
        results.push(info);
      }
    }

    // Sort: exact prefix matches first
    results.sort((a, b) => {
      const aPrefix = a.symbol.toUpperCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.symbol.toUpperCase().startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix;
    });

    return results;
  }

  /**
   * Get total registered symbol count.
   * @returns {number}
   */
  get size() {
    return this._map.size;
  }

  /**
   * Get all registered symbols.
   * @returns {SymbolInfo[]}
   */
  all() {
    return Array.from(this._map.values());
  }
}

// Singleton
const SymbolRegistry = new _SymbolRegistry();

export { SymbolRegistry, CRYPTO_PAIRS, POPULAR_STOCKS, POPULAR_ETFS, FOREX_PAIRS, FUTURES, COMMODITIES };
export default SymbolRegistry;
