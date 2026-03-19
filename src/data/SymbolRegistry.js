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
  { symbol: 'UNIUSDT', displayName: 'Uniswap', exchange: 'Binance', wsSymbol: 'uniusdt' },
  { symbol: 'NEARUSDT', displayName: 'NEAR Protocol', exchange: 'Binance', wsSymbol: 'nearusdt' },
  { symbol: 'APTUSDT', displayName: 'Aptos', exchange: 'Binance', wsSymbol: 'aptusdt' },
  { symbol: 'ARBUSDT', displayName: 'Arbitrum', exchange: 'Binance', wsSymbol: 'arbusdt' },
  { symbol: 'OPUSDT', displayName: 'Optimism', exchange: 'Binance', wsSymbol: 'opusdt' },
  { symbol: 'SUIUSDT', displayName: 'Sui', exchange: 'Binance', wsSymbol: 'suiusdt' },
  { symbol: 'SHIBUSDT', displayName: 'Shiba Inu', exchange: 'Binance', wsSymbol: 'shibusdt' },
  { symbol: 'PEPEUSDT', displayName: 'Pepe', exchange: 'Binance', wsSymbol: 'pepeusdt' },
  { symbol: 'TRXUSDT', displayName: 'Tron', exchange: 'Binance', wsSymbol: 'trxusdt' },
  { symbol: 'INJUSDT', displayName: 'Injective', exchange: 'Binance', wsSymbol: 'injusdt' },
  { symbol: 'AAVEUSDT', displayName: 'Aave', exchange: 'Binance', wsSymbol: 'aaveusdt' },
  { symbol: 'ATOMUSDT', displayName: 'Cosmos', exchange: 'Binance', wsSymbol: 'atomusdt' },
].map((c) => ({ ...c, assetClass: 'crypto', provider: 'binance', currency: 'USDT', realtime: true }));

// Pyth feed IDs for stocks (expanded — matches PythAdapter PYTH_FEEDS)
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
  COIN:  '0xfee33f2a978bf32dd6b662b65ba8083c6773b494f8401194ec1870c640860245',
  PLTR:  '0x3a4c922ec7e8cd86a6fa4005827e723a134a16f4ffe836eac91e7820c61f75a1',
  SMCI:  '0x8f34132a42f8bb7a47568d77a910f97174a30719e16904e9f2915d5b2c6c2d52',
  BA:    '0xd29a7daa6b0ab145996eef98e32db98fd2fa6b6811c2faf2ab5ab3c16a8134cd',
  CSCO:  '0x3f4b77dd904e849f70e1e812b7811de57202b49bc47c56391275c0f45f2ec481',
  HD:    '0xb3a83dbe70b62241b0f916212e097465a1b31085fa30da3342dd35468ca17ca5',
  PANW:  '0x3b00df0661ccb3109d11ff301c1aa4e88b8d647cb477b089ba225149e6e1b7bb',
  LMT:   '0x880d96a272d5ccbb3cd6f6aacb881a996cb4976b3f252b58c595cd2a418b6ea9',
  LRCX:  '0x01a67883f58bd0f0e9cf8f52f21d7cf78c144d7e7ae32ce9256420834b33fb75',
  TSM:   '0xe722560a66e4ab00522ef20a38fa2ba5d1b41f1c5404723ed895d202a7af7cc4',
  GS:    '0x9c68c0c6999765cf6e27adf75ed551b34403126d3b0d5b686a2addb147ed4554',
  NKE:   '0x67649450b4ca4bfff97cbaf96d2fd9e40f6db148cb65999140154415e4378e14',
  LOW:   '0xab31ec9dbcacacfb26e5ea6c249d69f5ae8b9c691aac6ccc5919b6107efa1c3a',
  PEP:   '0xbe230eddb16aad5ad273a85e581e74eb615ebf67d378f885768d9b047df0c843',
  TTD:   '0x0ad2003fcf837c63f83ce1238efaadce0976ef93d4b3b0befbbf5e196945c385',
  RDDT:  '0xc0ece6b9254797f4384bda1ba3f2c33259f552c7849a86b3029e811be5ea9227',
  HOOD:  '0x52ecf79ab14d988ca24fbd282a7cb91d41d36cb76aa3c9075a3eabce9ff63e2f',
};

const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'BRK-B', 'JPM', 'V', 'UNH', 'MA', 'HD', 'PG', 'JNJ',
  'BAC', 'XOM', 'ABBV', 'COST', 'KO', 'MRK', 'PEP', 'AVGO',
  'LLY', 'TMO', 'ORCL', 'ADBE', 'CRM', 'CSCO', 'ACN', 'NFLX',
  'AMD', 'INTC', 'QCOM', 'TXN',
  // Expanded coverage (Phase 1c)
  'PLTR', 'SMCI', 'ARM', 'COIN', 'SQ', 'SHOP', 'RIVN', 'LCID',
  'BA', 'DIS', 'WMT', 'PYPL', 'UBER', 'ABNB', 'SNAP', 'ROKU',
  'SOFI', 'MARA', 'RIOT', 'HOOD', 'GME', 'AMC', 'NIO', 'LI',
  'XPEV', 'BABA', 'JD', 'PDD', 'MU', 'MRVL', 'PANW', 'CRWD',
  'NET', 'SNOW', 'DDOG', 'ZS', 'TTD', 'RBLX', 'U',
  // S&P 500 additions
  'GS', 'MS', 'BLK', 'SCHW', 'C', 'WFC', 'AXP', 'LOW', 'TGT',
  'CVX', 'COP', 'SLB', 'EOG', 'PSX', 'VLO', 'MPC', 'PFE', 'ABT',
  'BMY', 'GILD', 'ISRG', 'MDT', 'SYK', 'VRTX', 'REGN', 'AMGN',
  'DHR', 'ZTS', 'ELV', 'CI', 'HCA', 'T', 'VZ', 'CMCSA', 'CHTR',
  'TMUS', 'LMT', 'RTX', 'NOC', 'GD', 'GE', 'HON', 'CAT', 'DE',
  'MMM', 'UPS', 'FDX', 'ADP', 'ITW', 'EMR', 'ETN', 'PH',
  'ANET', 'NOW', 'INTU', 'SNPS', 'CDNS', 'KLAC', 'LRCX', 'AMAT',
  'TSM', 'ASML', 'SAP', 'IBM', 'HPQ', 'DELL', 'WDAY', 'TEAM',
  'DXCM', 'OKTA', 'TWLO', 'DOCU', 'MDB', 'SPLK', 'ZM', 'FTNT',
  'NKE', 'LULU', 'SBUX', 'MCD', 'CMG', 'YUM', 'DPZ', 'DASH',
  'MCO', 'SPGI', 'ICE', 'CME', 'KKR', 'APO', 'BX', 'COIN',
  'RDDT', 'AFRM', 'OXY', 'USB', 'ROST', 'MSI', 'DHI',
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
  // Expanded coverage
  { symbol: 'IBIT', displayName: 'iShares Bitcoin ETF' },
  { symbol: 'SLV', displayName: 'Silver ETF' },
  { symbol: 'HYG', displayName: 'High Yield Corp Bond' },
  { symbol: 'VOO', displayName: 'Vanguard S&P 500' },
  { symbol: 'SOXL', displayName: 'Semis Bull 3×' },
  { symbol: 'TQQQ', displayName: 'Nasdaq Bull 3×' },
  { symbol: 'SQQQ', displayName: 'Nasdaq Bear 3×' },
  { symbol: 'XLV', displayName: 'Health Care Sector' },
  { symbol: 'XLI', displayName: 'Industrial Sector' },
  { symbol: 'XLP', displayName: 'Consumer Staples' },
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
  { symbol: 'NZDUSD=X', displayName: 'NZD/USD', wsSymbol: 'nzdusd', pythFeedId: '0x92eea8ba1b00078cdc2ef6f64f091f262e8c7d0576ee4677572f314ebfafa4c7' },
  { symbol: 'EURGBP=X', displayName: 'EUR/GBP', wsSymbol: 'eurgbp', pythFeedId: null },
  { symbol: 'EURJPY=X', displayName: 'EUR/JPY', wsSymbol: 'eurjpy', pythFeedId: null },
  { symbol: 'GBPJPY=X', displayName: 'GBP/JPY', wsSymbol: 'gbpjpy', pythFeedId: null },
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
  // Expanded — micros
  { symbol: 'MES=F', displayName: 'Micro E-mini S&P' },
  { symbol: 'MNQ=F', displayName: 'Micro E-mini Nasdaq' },
].map((f) => ({
  ...f,
  assetClass: 'futures',
  provider: 'pyth',
  exchange: 'CME',
  currency: 'USD',
  realtime: true,
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
    // Stock display name → ticker aliases (fixes Yahoo proxy 404s)
    this._aliases.set('TESLA', 'TSLA');
    this._aliases.set('APPLE', 'AAPL');
    this._aliases.set('MICROSOFT', 'MSFT');
    this._aliases.set('GOOGLE', 'GOOGL');
    this._aliases.set('AMAZON', 'AMZN');
    this._aliases.set('NVIDIA', 'NVDA');
    this._aliases.set('NETFLIX', 'NFLX');
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
