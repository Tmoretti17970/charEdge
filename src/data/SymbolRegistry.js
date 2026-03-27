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
  AAPL: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  MSFT: '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  GOOGL: '0xe65ff435be42630439c96a7c34a99577de631c5b6e17c5a642c8cf3a3ef84c39',
  AMZN: '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364b5060e91916e551418',
  NVDA: '0x2bef40c78bc4bccf2956e7d70c8db7fcf6c8e0c1acf1973cae7f7e59a0eac3a3',
  META: '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  TSLA: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  JPM: '0x7f4f157e57bda157e37bb6dd6e6ee2d8a8ff2b35cc1c3fa23eb61b0f6f31d1ae',
  NFLX: '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2',
  AMD: '0xa9dcd4ba8a5db3a0de2bfd16d882fe1f2fedc65bbc56e3e49f9e3eac0b07c52a',
  CRM: '0xfeff234600320f4d6bb5a01d02570a9725c1e424977f2b823f7231e6857bdae8',
  COIN: '0xfee33f2a978bf32dd6b662b65ba8083c6773b494f8401194ec1870c640860245',
  PLTR: '0x3a4c922ec7e8cd86a6fa4005827e723a134a16f4ffe836eac91e7820c61f75a1',
  SMCI: '0x8f34132a42f8bb7a47568d77a910f97174a30719e16904e9f2915d5b2c6c2d52',
  BA: '0xd29a7daa6b0ab145996eef98e32db98fd2fa6b6811c2faf2ab5ab3c16a8134cd',
  CSCO: '0x3f4b77dd904e849f70e1e812b7811de57202b49bc47c56391275c0f45f2ec481',
  HD: '0xb3a83dbe70b62241b0f916212e097465a1b31085fa30da3342dd35468ca17ca5',
  PANW: '0x3b00df0661ccb3109d11ff301c1aa4e88b8d647cb477b089ba225149e6e1b7bb',
  LMT: '0x880d96a272d5ccbb3cd6f6aacb881a996cb4976b3f252b58c595cd2a418b6ea9',
  LRCX: '0x01a67883f58bd0f0e9cf8f52f21d7cf78c144d7e7ae32ce9256420834b33fb75',
  TSM: '0xe722560a66e4ab00522ef20a38fa2ba5d1b41f1c5404723ed895d202a7af7cc4',
  GS: '0x9c68c0c6999765cf6e27adf75ed551b34403126d3b0d5b686a2addb147ed4554',
  NKE: '0x67649450b4ca4bfff97cbaf96d2fd9e40f6db148cb65999140154415e4378e14',
  LOW: '0xab31ec9dbcacacfb26e5ea6c249d69f5ae8b9c691aac6ccc5919b6107efa1c3a',
  PEP: '0xbe230eddb16aad5ad273a85e581e74eb615ebf67d378f885768d9b047df0c843',
  TTD: '0x0ad2003fcf837c63f83ce1238efaadce0976ef93d4b3b0befbbf5e196945c385',
  RDDT: '0xc0ece6b9254797f4384bda1ba3f2c33259f552c7849a86b3029e811be5ea9227',
  HOOD: '0x52ecf79ab14d988ca24fbd282a7cb91d41d36cb76aa3c9075a3eabce9ff63e2f',
};

const POPULAR_STOCKS = [
  // ── Mega-Cap Technology ──────────────────────────────────────
  { symbol: 'AAPL', displayName: 'Apple' },
  { symbol: 'MSFT', displayName: 'Microsoft' },
  { symbol: 'GOOGL', displayName: 'Alphabet' },
  { symbol: 'AMZN', displayName: 'Amazon' },
  { symbol: 'NVDA', displayName: 'NVIDIA' },
  { symbol: 'META', displayName: 'Meta Platforms' },
  { symbol: 'TSLA', displayName: 'Tesla' },
  { symbol: 'AVGO', displayName: 'Broadcom' },
  { symbol: 'ORCL', displayName: 'Oracle' },
  { symbol: 'ADBE', displayName: 'Adobe' },
  { symbol: 'CRM', displayName: 'Salesforce' },
  { symbol: 'CSCO', displayName: 'Cisco' },
  { symbol: 'ACN', displayName: 'Accenture' },
  { symbol: 'NFLX', displayName: 'Netflix' },
  { symbol: 'AMD', displayName: 'AMD' },
  { symbol: 'INTC', displayName: 'Intel' },
  { symbol: 'QCOM', displayName: 'Qualcomm' },
  { symbol: 'TXN', displayName: 'Texas Instruments' },
  { symbol: 'IBM', displayName: 'IBM' },
  { symbol: 'NOW', displayName: 'ServiceNow' },
  { symbol: 'INTU', displayName: 'Intuit' },
  { symbol: 'ANET', displayName: 'Arista Networks' },
  { symbol: 'PLTR', displayName: 'Palantir' },
  { symbol: 'SMCI', displayName: 'Super Micro Computer' },
  { symbol: 'ARM', displayName: 'Arm Holdings' },
  { symbol: 'COIN', displayName: 'Coinbase' },
  { symbol: 'SQ', displayName: 'Block' },
  { symbol: 'SHOP', displayName: 'Shopify' },
  { symbol: 'SNOW', displayName: 'Snowflake' },
  { symbol: 'DDOG', displayName: 'Datadog' },
  { symbol: 'CRWD', displayName: 'CrowdStrike' },
  { symbol: 'PANW', displayName: 'Palo Alto Networks' },
  { symbol: 'NET', displayName: 'Cloudflare' },
  { symbol: 'ZS', displayName: 'Zscaler' },
  { symbol: 'FTNT', displayName: 'Fortinet' },
  { symbol: 'TTD', displayName: 'The Trade Desk' },
  { symbol: 'MU', displayName: 'Micron' },
  { symbol: 'MRVL', displayName: 'Marvell Technology' },
  { symbol: 'SNPS', displayName: 'Synopsys' },
  { symbol: 'CDNS', displayName: 'Cadence Design' },
  { symbol: 'KLAC', displayName: 'KLA Corp' },
  { symbol: 'LRCX', displayName: 'Lam Research' },
  { symbol: 'AMAT', displayName: 'Applied Materials' },
  { symbol: 'TSM', displayName: 'TSMC' },
  { symbol: 'ASML', displayName: 'ASML' },
  { symbol: 'SAP', displayName: 'SAP' },
  { symbol: 'HPQ', displayName: 'HP Inc' },
  { symbol: 'DELL', displayName: 'Dell Technologies' },
  { symbol: 'WDAY', displayName: 'Workday' },
  { symbol: 'TEAM', displayName: 'Atlassian' },
  { symbol: 'DXCM', displayName: 'DexCom' },
  { symbol: 'OKTA', displayName: 'Okta' },
  { symbol: 'TWLO', displayName: 'Twilio' },
  { symbol: 'DOCU', displayName: 'DocuSign' },
  { symbol: 'MDB', displayName: 'MongoDB' },
  { symbol: 'SPLK', displayName: 'Splunk' },
  { symbol: 'ZM', displayName: 'Zoom Video' },
  { symbol: 'RBLX', displayName: 'Roblox' },
  { symbol: 'U', displayName: 'Unity Software' },
  { symbol: 'RDDT', displayName: 'Reddit' },
  { symbol: 'HOOD', displayName: 'Robinhood' },
  { symbol: 'AFRM', displayName: 'Affirm' },
  { symbol: 'MSI', displayName: 'Motorola Solutions' },
  { symbol: 'NXPI', displayName: 'NXP Semiconductors' },
  { symbol: 'ON', displayName: 'ON Semiconductor' },
  { symbol: 'SWKS', displayName: 'Skyworks Solutions' },
  { symbol: 'STX', displayName: 'Seagate Technology' },
  { symbol: 'WDC', displayName: 'Western Digital' },
  { symbol: 'KEYS', displayName: 'Keysight Technologies' },
  { symbol: 'ZBRA', displayName: 'Zebra Technologies' },
  { symbol: 'MPWR', displayName: 'Monolithic Power' },
  { symbol: 'GDDY', displayName: 'GoDaddy' },
  { symbol: 'GEN', displayName: 'Gen Digital' },
  { symbol: 'IT', displayName: 'Gartner' },
  { symbol: 'ANSS', displayName: 'Ansys' },
  { symbol: 'FICO', displayName: 'Fair Isaac' },
  { symbol: 'CPAY', displayName: 'Corpay' },
  // ── Financials ───────────────────────────────────────────────
  { symbol: 'BRK-B', displayName: 'Berkshire Hathaway' },
  { symbol: 'JPM', displayName: 'JPMorgan Chase' },
  { symbol: 'V', displayName: 'Visa' },
  { symbol: 'MA', displayName: 'Mastercard' },
  { symbol: 'BAC', displayName: 'Bank of America' },
  { symbol: 'GS', displayName: 'Goldman Sachs' },
  { symbol: 'MS', displayName: 'Morgan Stanley' },
  { symbol: 'BLK', displayName: 'BlackRock' },
  { symbol: 'SCHW', displayName: 'Charles Schwab' },
  { symbol: 'C', displayName: 'Citigroup' },
  { symbol: 'WFC', displayName: 'Wells Fargo' },
  { symbol: 'AXP', displayName: 'American Express' },
  { symbol: 'USB', displayName: 'U.S. Bancorp' },
  { symbol: 'MCO', displayName: 'Moody\'s' },
  { symbol: 'SPGI', displayName: 'S&P Global' },
  { symbol: 'ICE', displayName: 'Intercontinental Exchange' },
  { symbol: 'CME', displayName: 'CME Group' },
  { symbol: 'KKR', displayName: 'KKR & Co' },
  { symbol: 'APO', displayName: 'Apollo Global' },
  { symbol: 'BX', displayName: 'Blackstone' },
  { symbol: 'PNC', displayName: 'PNC Financial' },
  { symbol: 'TFC', displayName: 'Truist Financial' },
  { symbol: 'MTB', displayName: 'M&T Bank' },
  { symbol: 'FITB', displayName: 'Fifth Third Bancorp' },
  { symbol: 'COF', displayName: 'Capital One' },
  { symbol: 'DFS', displayName: 'Discover Financial' },
  { symbol: 'MET', displayName: 'MetLife' },
  { symbol: 'PRU', displayName: 'Prudential Financial' },
  { symbol: 'AFL', displayName: 'Aflac' },
  { symbol: 'TRV', displayName: 'Travelers' },
  { symbol: 'CB', displayName: 'Chubb' },
  { symbol: 'MMC', displayName: 'Marsh McLennan' },
  { symbol: 'AON', displayName: 'Aon' },
  { symbol: 'AIG', displayName: 'AIG' },
  { symbol: 'ALL', displayName: 'Allstate' },
  { symbol: 'CINF', displayName: 'Cincinnati Financial' },
  { symbol: 'PYPL', displayName: 'PayPal' },
  { symbol: 'SOFI', displayName: 'SoFi Technologies' },
  // ── Healthcare ───────────────────────────────────────────────
  { symbol: 'UNH', displayName: 'UnitedHealth' },
  { symbol: 'LLY', displayName: 'Eli Lilly' },
  { symbol: 'JNJ', displayName: 'Johnson & Johnson' },
  { symbol: 'ABBV', displayName: 'AbbVie' },
  { symbol: 'TMO', displayName: 'Thermo Fisher' },
  { symbol: 'PFE', displayName: 'Pfizer' },
  { symbol: 'ABT', displayName: 'Abbott Labs' },
  { symbol: 'BMY', displayName: 'Bristol-Myers Squibb' },
  { symbol: 'GILD', displayName: 'Gilead Sciences' },
  { symbol: 'ISRG', displayName: 'Intuitive Surgical' },
  { symbol: 'MDT', displayName: 'Medtronic' },
  { symbol: 'SYK', displayName: 'Stryker' },
  { symbol: 'VRTX', displayName: 'Vertex Pharma' },
  { symbol: 'REGN', displayName: 'Regeneron' },
  { symbol: 'AMGN', displayName: 'Amgen' },
  { symbol: 'DHR', displayName: 'Danaher' },
  { symbol: 'ZTS', displayName: 'Zoetis' },
  { symbol: 'ELV', displayName: 'Elevance Health' },
  { symbol: 'CI', displayName: 'Cigna' },
  { symbol: 'HCA', displayName: 'HCA Healthcare' },
  { symbol: 'BSX', displayName: 'Boston Scientific' },
  { symbol: 'EW', displayName: 'Edwards Lifesciences' },
  { symbol: 'BDX', displayName: 'Becton Dickinson' },
  { symbol: 'HOLX', displayName: 'Hologic' },
  { symbol: 'IDXX', displayName: 'IDEXX Labs' },
  { symbol: 'A', displayName: 'Agilent Technologies' },
  { symbol: 'IQV', displayName: 'IQVIA' },
  { symbol: 'GEHC', displayName: 'GE HealthCare' },
  { symbol: 'ALGN', displayName: 'Align Technology' },
  { symbol: 'ZBH', displayName: 'Zimmer Biomet' },
  { symbol: 'MTD', displayName: 'Mettler-Toledo' },
  // ── Consumer Discretionary ───────────────────────────────────
  { symbol: 'HD', displayName: 'Home Depot' },
  { symbol: 'LOW', displayName: 'Lowe\'s' },
  { symbol: 'TGT', displayName: 'Target' },
  { symbol: 'WMT', displayName: 'Walmart' },
  { symbol: 'COST', displayName: 'Costco' },
  { symbol: 'NKE', displayName: 'Nike' },
  { symbol: 'LULU', displayName: 'Lululemon' },
  { symbol: 'SBUX', displayName: 'Starbucks' },
  { symbol: 'MCD', displayName: 'McDonald\'s' },
  { symbol: 'CMG', displayName: 'Chipotle' },
  { symbol: 'YUM', displayName: 'Yum! Brands' },
  { symbol: 'DPZ', displayName: 'Domino\'s Pizza' },
  { symbol: 'DASH', displayName: 'DoorDash' },
  { symbol: 'ROST', displayName: 'Ross Stores' },
  { symbol: 'DHI', displayName: 'D.R. Horton' },
  { symbol: 'DIS', displayName: 'Walt Disney' },
  { symbol: 'UBER', displayName: 'Uber' },
  { symbol: 'ABNB', displayName: 'Airbnb' },
  { symbol: 'SNAP', displayName: 'Snap' },
  { symbol: 'ROKU', displayName: 'Roku' },
  { symbol: 'BKNG', displayName: 'Booking Holdings' },
  { symbol: 'MAR', displayName: 'Marriott' },
  { symbol: 'HLT', displayName: 'Hilton' },
  { symbol: 'ORLY', displayName: 'O\'Reilly Automotive' },
  { symbol: 'AZO', displayName: 'AutoZone' },
  { symbol: 'LEN', displayName: 'Lennar' },
  { symbol: 'PHM', displayName: 'PulteGroup' },
  { symbol: 'EBAY', displayName: 'eBay' },
  { symbol: 'RCL', displayName: 'Royal Caribbean' },
  { symbol: 'WYNN', displayName: 'Wynn Resorts' },
  { symbol: 'GPC', displayName: 'Genuine Parts' },
  { symbol: 'GRMN', displayName: 'Garmin' },
  { symbol: 'POOL', displayName: 'Pool Corp' },
  { symbol: 'RIVN', displayName: 'Rivian' },
  { symbol: 'LCID', displayName: 'Lucid Group' },
  { symbol: 'GME', displayName: 'GameStop' },
  { symbol: 'AMC', displayName: 'AMC Entertainment' },
  { symbol: 'NIO', displayName: 'NIO' },
  { symbol: 'LI', displayName: 'Li Auto' },
  { symbol: 'XPEV', displayName: 'XPeng' },
  { symbol: 'BABA', displayName: 'Alibaba' },
  { symbol: 'JD', displayName: 'JD.com' },
  { symbol: 'PDD', displayName: 'PDD Holdings' },
  // ── Consumer Staples ─────────────────────────────────────────
  { symbol: 'PG', displayName: 'Procter & Gamble' },
  { symbol: 'KO', displayName: 'Coca-Cola' },
  { symbol: 'PEP', displayName: 'PepsiCo' },
  { symbol: 'CL', displayName: 'Colgate-Palmolive' },
  { symbol: 'MDLZ', displayName: 'Mondelez' },
  { symbol: 'MNST', displayName: 'Monster Beverage' },
  { symbol: 'PM', displayName: 'Philip Morris' },
  { symbol: 'MO', displayName: 'Altria' },
  { symbol: 'KDP', displayName: 'Keurig Dr Pepper' },
  { symbol: 'SYY', displayName: 'Sysco' },
  { symbol: 'KR', displayName: 'Kroger' },
  { symbol: 'ADM', displayName: 'Archer-Daniels-Midland' },
  { symbol: 'STZ', displayName: 'Constellation Brands' },
  { symbol: 'GIS', displayName: 'General Mills' },
  { symbol: 'HSY', displayName: 'Hershey' },
  { symbol: 'KMB', displayName: 'Kimberly-Clark' },
  { symbol: 'MKC', displayName: 'McCormick' },
  // ── Energy ───────────────────────────────────────────────────
  { symbol: 'XOM', displayName: 'Exxon Mobil' },
  { symbol: 'CVX', displayName: 'Chevron' },
  { symbol: 'COP', displayName: 'ConocoPhillips' },
  { symbol: 'SLB', displayName: 'Schlumberger' },
  { symbol: 'EOG', displayName: 'EOG Resources' },
  { symbol: 'PSX', displayName: 'Phillips 66' },
  { symbol: 'VLO', displayName: 'Valero Energy' },
  { symbol: 'MPC', displayName: 'Marathon Petroleum' },
  { symbol: 'OXY', displayName: 'Occidental Petroleum' },
  { symbol: 'DVN', displayName: 'Devon Energy' },
  { symbol: 'FANG', displayName: 'Diamondback Energy' },
  { symbol: 'HAL', displayName: 'Halliburton' },
  { symbol: 'BKR', displayName: 'Baker Hughes' },
  { symbol: 'WMB', displayName: 'Williams Companies' },
  { symbol: 'KMI', displayName: 'Kinder Morgan' },
  { symbol: 'OKE', displayName: 'ONEOK' },
  { symbol: 'TRGP', displayName: 'Targa Resources' },
  // ── Industrials ──────────────────────────────────────────────
  { symbol: 'BA', displayName: 'Boeing' },
  { symbol: 'GE', displayName: 'GE Aerospace' },
  { symbol: 'HON', displayName: 'Honeywell' },
  { symbol: 'CAT', displayName: 'Caterpillar' },
  { symbol: 'DE', displayName: 'Deere & Co' },
  { symbol: 'MMM', displayName: '3M' },
  { symbol: 'UPS', displayName: 'UPS' },
  { symbol: 'FDX', displayName: 'FedEx' },
  { symbol: 'ADP', displayName: 'ADP' },
  { symbol: 'ITW', displayName: 'Illinois Tool Works' },
  { symbol: 'EMR', displayName: 'Emerson Electric' },
  { symbol: 'ETN', displayName: 'Eaton' },
  { symbol: 'PH', displayName: 'Parker-Hannifin' },
  { symbol: 'LMT', displayName: 'Lockheed Martin' },
  { symbol: 'RTX', displayName: 'RTX Corp' },
  { symbol: 'NOC', displayName: 'Northrop Grumman' },
  { symbol: 'GD', displayName: 'General Dynamics' },
  { symbol: 'WM', displayName: 'Waste Management' },
  { symbol: 'RSG', displayName: 'Republic Services' },
  { symbol: 'CTAS', displayName: 'Cintas' },
  { symbol: 'PAYX', displayName: 'Paychex' },
  { symbol: 'FAST', displayName: 'Fastenal' },
  { symbol: 'ODFL', displayName: 'Old Dominion Freight' },
  { symbol: 'CSX', displayName: 'CSX Corp' },
  { symbol: 'NSC', displayName: 'Norfolk Southern' },
  { symbol: 'UNP', displayName: 'Union Pacific' },
  { symbol: 'TDG', displayName: 'TransDigm' },
  { symbol: 'AXON', displayName: 'Axon Enterprise' },
  { symbol: 'IR', displayName: 'Ingersoll Rand' },
  { symbol: 'CPRT', displayName: 'Copart' },
  { symbol: 'VRSK', displayName: 'Verisk Analytics' },
  { symbol: 'SHW', displayName: 'Sherwin-Williams' },
  { symbol: 'MARA', displayName: 'MARA Holdings' },
  { symbol: 'RIOT', displayName: 'Riot Platforms' },
  // ── Telecom / Communication ──────────────────────────────────
  { symbol: 'T', displayName: 'AT&T' },
  { symbol: 'VZ', displayName: 'Verizon' },
  { symbol: 'CMCSA', displayName: 'Comcast' },
  { symbol: 'CHTR', displayName: 'Charter Communications' },
  { symbol: 'TMUS', displayName: 'T-Mobile' },
  { symbol: 'EA', displayName: 'Electronic Arts' },
  { symbol: 'TTWO', displayName: 'Take-Two Interactive' },
  { symbol: 'MTCH', displayName: 'Match Group' },
  { symbol: 'PARA', displayName: 'Paramount Global' },
  { symbol: 'WBD', displayName: 'Warner Bros Discovery' },
  { symbol: 'NWSA', displayName: 'News Corp' },
  // ── Utilities ────────────────────────────────────────────────
  { symbol: 'NEE', displayName: 'NextEra Energy' },
  { symbol: 'DUK', displayName: 'Duke Energy' },
  { symbol: 'SO', displayName: 'Southern Company' },
  { symbol: 'D', displayName: 'Dominion Energy' },
  { symbol: 'AEP', displayName: 'American Electric Power' },
  { symbol: 'SRE', displayName: 'Sempra' },
  { symbol: 'XEL', displayName: 'Xcel Energy' },
  { symbol: 'WEC', displayName: 'WEC Energy' },
  { symbol: 'ED', displayName: 'Consolidated Edison' },
  { symbol: 'AWK', displayName: 'American Water Works' },
  // ── Real Estate ──────────────────────────────────────────────
  { symbol: 'PLD', displayName: 'Prologis' },
  { symbol: 'AMT', displayName: 'American Tower' },
  { symbol: 'CCI', displayName: 'Crown Castle' },
  { symbol: 'EQIX', displayName: 'Equinix' },
  { symbol: 'PSA', displayName: 'Public Storage' },
  { symbol: 'SPG', displayName: 'Simon Property' },
  { symbol: 'O', displayName: 'Realty Income' },
  { symbol: 'WELL', displayName: 'Welltower' },
  { symbol: 'DLR', displayName: 'Digital Realty' },
  { symbol: 'VICI', displayName: 'VICI Properties' },
  // ── Materials ────────────────────────────────────────────────
  { symbol: 'LIN', displayName: 'Linde' },
  { symbol: 'APD', displayName: 'Air Products' },
  { symbol: 'ECL', displayName: 'Ecolab' },
  { symbol: 'DD', displayName: 'DuPont' },
  { symbol: 'FCX', displayName: 'Freeport-McMoRan' },
  { symbol: 'NEM', displayName: 'Newmont' },
  { symbol: 'NUE', displayName: 'Nucor' },
  { symbol: 'VMC', displayName: 'Vulcan Materials' },
  { symbol: 'MLM', displayName: 'Martin Marietta' },
  { symbol: 'PPG', displayName: 'PPG Industries' },
].map((s) => ({
  ...s,
  assetClass: 'stock',
  provider: 'pyth',
  exchange: 'NASDAQ/NYSE',
  currency: 'USD',
  realtime: true,
  pythFeedId: _PYTH_STOCK_IDS[s.symbol] || null,
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
  {
    symbol: 'EURUSD=X',
    displayName: 'EUR/USD',
    wsSymbol: 'eurusd',
    pythFeedId: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  },
  {
    symbol: 'GBPUSD=X',
    displayName: 'GBP/USD',
    wsSymbol: 'gbpusd',
    pythFeedId: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
  },
  {
    symbol: 'USDJPY=X',
    displayName: 'USD/JPY',
    wsSymbol: 'usdjpy',
    pythFeedId: '0xef2c98c804ba503c6a707e38be4dfbb16683775e3783c8a75d24bbc16dcdeec0',
  },
  {
    symbol: 'AUDUSD=X',
    displayName: 'AUD/USD',
    wsSymbol: 'audusd',
    pythFeedId: '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80',
  },
  {
    symbol: 'USDCAD=X',
    displayName: 'USD/CAD',
    wsSymbol: 'usdcad',
    pythFeedId: '0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b0a688e1aa5be1b51698',
  },
  {
    symbol: 'USDCHF=X',
    displayName: 'USD/CHF',
    wsSymbol: 'usdchf',
    pythFeedId: '0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e8840',
  },
  {
    symbol: 'NZDUSD=X',
    displayName: 'NZD/USD',
    wsSymbol: 'nzdusd',
    pythFeedId: '0x92eea8ba1b00078cdc2ef6f64f091f262e8c7d0576ee4677572f314ebfafa4c7',
  },
  {
    symbol: 'EURGBP=X',
    displayName: 'EUR/GBP',
    wsSymbol: 'eurgbp',
    pythFeedId: '0xc349ff6087acab1c0c5442a9de0ea804239cc9fd09be8b1a93ffa0ed7f366d9c',
  },
  {
    symbol: 'EURJPY=X',
    displayName: 'EUR/JPY',
    wsSymbol: 'eurjpy',
    pythFeedId: '0xd8c874fa511b9838d094109f996890642421e462c3b29501a2560cecf82c2eb4',
  },
  {
    symbol: 'GBPJPY=X',
    displayName: 'GBP/JPY',
    wsSymbol: 'gbpjpy',
    pythFeedId: '0xcfa65905787703c692c3cac2b8a009a1db51ce68b54f5b206ce6a55bfa2c3cd1',
  },
].map((f) => ({
  ...f,
  assetClass: 'forex',
  provider: 'pyth',
  exchange: 'FX',
  currency: 'USD',
  realtime: true,
}));

const COMMODITIES = [
  {
    symbol: 'XAU',
    displayName: 'Gold (XAU/USD)',
    pythFeedId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63c52eecd2c7a9c6ffe',
  },
  {
    symbol: 'XAG',
    displayName: 'Silver (XAG/USD)',
    pythFeedId: '0xf2fb02c32b055c805e7238d628e5e992ab910babeb8d9e093ed7e3d2a1f3b3c5',
  },
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
  // Expanded — commodities & currencies
  { symbol: 'HG=F', displayName: 'Copper' },
  { symbol: 'PL=F', displayName: 'Platinum' },
  { symbol: 'ZC=F', displayName: 'Corn' },
  { symbol: 'ZS=F', displayName: 'Soybeans' },
  { symbol: 'ZW=F', displayName: 'Wheat' },
  { symbol: 'KC=F', displayName: 'Coffee' },
  { symbol: 'CT=F', displayName: 'Cotton' },
  { symbol: 'BTC=F', displayName: 'Bitcoin Futures (CME)' },
  { symbol: '6E=F', displayName: 'Euro FX Futures' },
  { symbol: '6J=F', displayName: 'Yen Futures' },
  { symbol: 'VX=F', displayName: 'VIX Futures' },
].map((f) => ({
  ...f,
  assetClass: 'futures',
  provider: 'pyth',
  exchange: 'CME',
  currency: 'USD',
  realtime: true,
}));

// ─── Global Indices (display-only, Yahoo Finance) ────────────────

const INDICES = [
  { symbol: '^GSPC', displayName: 'S&P 500' },
  { symbol: '^IXIC', displayName: 'NASDAQ Composite' },
  { symbol: '^DJI', displayName: 'Dow Jones' },
  { symbol: '^RUT', displayName: 'Russell 2000' },
  { symbol: '^VIX', displayName: 'Volatility Index' },
  { symbol: '^TNX', displayName: '10-Year Treasury Yield' },
  { symbol: '^FTSE', displayName: 'FTSE 100' },
  { symbol: '^N225', displayName: 'Nikkei 225' },
  { symbol: '^HSI', displayName: 'Hang Seng' },
  { symbol: '^GDAXI', displayName: 'DAX' },
  { symbol: '^STOXX50E', displayName: 'EURO STOXX 50' },
  { symbol: '^AXJO', displayName: 'ASX 200' },
].map((i) => ({
  ...i,
  assetClass: 'index',
  provider: 'yahoo',
  exchange: 'Index',
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
    const all = [...CRYPTO_PAIRS, ...POPULAR_STOCKS, ...POPULAR_ETFS, ...FOREX_PAIRS, ...FUTURES, ...COMMODITIES, ...INDICES];
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
    this._aliases.set('BERKSHIRE', 'BRK-B');
    this._aliases.set('JPMORGAN', 'JPM');
    this._aliases.set('JOHNSON', 'JNJ');
    this._aliases.set('WALMART', 'WMT');
    this._aliases.set('DISNEY', 'DIS');
    this._aliases.set('BOEING', 'BA');
    this._aliases.set('GOLDMAN', 'GS');
    this._aliases.set('PAYPAL', 'PYPL');
    this._aliases.set('COSTCO', 'COST');
    this._aliases.set('STARBUCKS', 'SBUX');
    this._aliases.set('MCDONALDS', 'MCD');
    this._aliases.set('COCA-COLA', 'KO');
    this._aliases.set('COCACOLA', 'KO');
    this._aliases.set('PEPSI', 'PEP');
    this._aliases.set('PROCTER', 'PG');
    this._aliases.set('CATERPILLAR', 'CAT');
    this._aliases.set('HONEYWELL', 'HON');
    this._aliases.set('LOCKHEED', 'LMT');
    this._aliases.set('BROADCOM', 'AVGO');
    this._aliases.set('PALANTIR', 'PLTR');
    this._aliases.set('CROWDSTRIKE', 'CRWD');
    this._aliases.set('COINBASE', 'COIN');
    this._aliases.set('AIRBNB', 'ABNB');
    this._aliases.set('ALIBABA', 'BABA');
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
   * Resolve a symbol, auto-discovering unknown symbols from Binance or CoinGecko.
   * If found, registers it for future lookups. Returns SymbolInfo or null.
   * @param {string} symbol
   * @returns {Promise<SymbolInfo|null>}
   */
  async resolve(symbol) {
    const existing = this.lookup(symbol);
    if (existing) return existing;

    const upper = (symbol || '').toUpperCase().trim();
    if (!upper) return null;

    // Try Binance exchangeInfo to check if it's a valid trading pair
    try {
      const pair = upper.endsWith('USDT') ? upper : `${upper}USDT`;
      const res = await fetch(`/api/binance/v3/ticker/price?symbol=${pair}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.price) {
          const info = {
            symbol: pair,
            displayName: upper.replace(/USDT$/, ''),
            assetClass: 'crypto',
            provider: 'binance',
            exchange: 'Binance',
            currency: 'USDT',
            realtime: true,
            wsSymbol: pair.toLowerCase(),
          };
          this.register(info);
          // Also set up the shorthand alias
          const base = upper.replace(/USDT$/, '');
          if (base !== pair) this._aliases.set(base, pair);
          return info;
        }
      }
    } catch {
      /* fall through */
    }

    // Not found on Binance — register as equity with Yahoo/Pyth fallback
    const info = {
      symbol: upper,
      displayName: upper,
      assetClass: 'stock',
      provider: 'pyth',
      exchange: 'NASDAQ/NYSE',
      currency: 'USD',
      realtime: true,
    };
    this.register(info);
    return info;
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

export { SymbolRegistry, CRYPTO_PAIRS, POPULAR_STOCKS, POPULAR_ETFS, FOREX_PAIRS, FUTURES, COMMODITIES, INDICES };
export default SymbolRegistry;
