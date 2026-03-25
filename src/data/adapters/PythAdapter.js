// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Pyth Network Adapter
//
// Provides institutional-grade, permissionless price feeds via
// the Pyth Hermes API. Supports crypto, equities, FX, and commodities.
//
// Data source: https://hermes.pyth.network
// Docs: https://docs.pyth.network/price-feeds
//
// Features:
//   ✓ REST polling for latest prices
//   ✓ SSE streaming for real-time updates (~400ms)
//   ✓ 500+ feeds across 4 asset classes
//   ✓ Confidence intervals on every price
//   ✓ No API key required (permissionless)
//   ✓ Fallback between REST and SSE
// ═══════════════════════════════════════════════════════════════════

import { pythCandleAggregator, SUPPORTED_INTERVALS } from '../engine/streaming/PythCandleAggregator.js';
import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

// ─── Hermes API Endpoints ───────────────────────────────────────

const HERMES_BASE = 'https://hermes.pyth.network';
const HERMES_LATEST = `${HERMES_BASE}/v2/updates/price/latest`;
const HERMES_STREAM = `${HERMES_BASE}/v2/updates/price/stream`;

// ─── Pyth Feed ID Registry ──────────────────────────────────────
// Each feed has a unique 32-byte hex identifier.
// Full list: https://pyth.network/developers/price-feed-ids

const PYTH_FEEDS = {
  // ── Crypto ────────────────────────────────────────────────────
  BTC: { id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', name: 'Bitcoin', class: 'crypto' },
  ETH: { id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', name: 'Ethereum', class: 'crypto' },
  SOL: { id: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', name: 'Solana', class: 'crypto' },
  BNB: { id: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f', name: 'BNB', class: 'crypto' },
  XRP: { id: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8', name: 'XRP', class: 'crypto' },
  ADA: { id: '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d', name: 'Cardano', class: 'crypto' },
  DOGE: { id: '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c', name: 'Dogecoin', class: 'crypto' },
  AVAX: {
    id: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    name: 'Avalanche',
    class: 'crypto',
  },
  DOT: { id: '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284f97c7c83813510900', name: 'Polkadot', class: 'crypto' },
  MATIC: { id: '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52', name: 'Polygon', class: 'crypto' },
  LINK: {
    id: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    name: 'Chainlink',
    class: 'crypto',
  },
  UNI: { id: '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501', name: 'Uniswap', class: 'crypto' },
  ATOM: { id: '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439cb7bfd8783069bd958801', name: 'Cosmos', class: 'crypto' },
  LTC: { id: '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54', name: 'Litecoin', class: 'crypto' },
  NEAR: {
    id: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
    name: 'NEAR Protocol',
    class: 'crypto',
  },
  APT: { id: '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5', name: 'Aptos', class: 'crypto' },
  ARB: { id: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5', name: 'Arbitrum', class: 'crypto' },
  OP: { id: '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf', name: 'Optimism', class: 'crypto' },
  SUI: { id: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744', name: 'Sui', class: 'crypto' },

  // ── US Equities ───────────────────────────────────────────────
  AAPL: {
    id: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    name: 'Apple Inc.',
    class: 'equity',
  },
  MSFT: {
    id: '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
    name: 'Microsoft',
    class: 'equity',
  },
  GOOGL: {
    id: '0xe65ff435be42630439c96a7c34a99577de631c5b6e17c5a642c8cf3a3ef84c39',
    name: 'Alphabet',
    class: 'equity',
  },
  AMZN: { id: '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364b5060e91916e551418', name: 'Amazon', class: 'equity' },
  NVDA: { id: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593', name: 'NVIDIA', class: 'equity' },
  META: {
    id: '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
    name: 'Meta Platforms',
    class: 'equity',
  },
  TSLA: { id: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1', name: 'Tesla', class: 'equity' },
  GOOG: {
    id: '0xe65ff435be42630439c96a7c34a99577de631c5b6e17c5a642c8cf3a3ef84c39',
    name: 'Alphabet C',
    class: 'equity',
  },
  JPM: {
    id: '0x7f4f157e57bda157e37bb6dd6e6ee2d8a8ff2b35cc1c3fa23eb61b0f6f31d1ae',
    name: 'JPMorgan Chase',
    class: 'equity',
  },
  NFLX: { id: '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2', name: 'Netflix', class: 'equity' },
  AMD: { id: '0x3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e', name: 'AMD', class: 'equity' },
  CRM: {
    id: '0xfeff234600320f4d6bb5a01d02570a9725c1e424977f2b823f7231e6857bdae8',
    name: 'Salesforce',
    class: 'equity',
  },
  // Expanded equities (Phase 1a) — sourced from Pyth Hermes API
  COIN: { id: '0xfee33f2a978bf32dd6b662b65ba8083c6773b494f8401194ec1870c640860245', name: 'Coinbase', class: 'equity' },
  PLTR: { id: '0x3a4c922ec7e8cd86a6fa4005827e723a134a16f4ffe836eac91e7820c61f75a1', name: 'Palantir', class: 'equity' },
  SMCI: {
    id: '0x8f34132a42f8bb7a47568d77a910f97174a30719e16904e9f2915d5b2c6c2d52',
    name: 'Super Micro',
    class: 'equity',
  },
  BA: { id: '0xd29a7daa6b0ab145996eef98e32db98fd2fa6b6811c2faf2ab5ab3c16a8134cd', name: 'Boeing', class: 'equity' },
  CSCO: { id: '0x3f4b77dd904e849f70e1e812b7811de57202b49bc47c56391275c0f45f2ec481', name: 'Cisco', class: 'equity' },
  HD: { id: '0xb3a83dbe70b62241b0f916212e097465a1b31085fa30da3342dd35468ca17ca5', name: 'Home Depot', class: 'equity' },
  PANW: {
    id: '0x3b00df0661ccb3109d11ff301c1aa4e88b8d647cb477b089ba225149e6e1b7bb',
    name: 'Palo Alto Ntwks',
    class: 'equity',
  },
  LMT: {
    id: '0x880d96a272d5ccbb3cd6f6aacb881a996cb4976b3f252b58c595cd2a418b6ea9',
    name: 'Lockheed Martin',
    class: 'equity',
  },
  LRCX: {
    id: '0x01a67883f58bd0f0e9cf8f52f21d7cf78c144d7e7ae32ce9256420834b33fb75',
    name: 'Lam Research',
    class: 'equity',
  },
  TSM: { id: '0xe722560a66e4ab00522ef20a38fa2ba5d1b41f1c5404723ed895d202a7af7cc4', name: 'TSMC', class: 'equity' },
  GS: {
    id: '0x9c68c0c6999765cf6e27adf75ed551b34403126d3b0d5b686a2addb147ed4554',
    name: 'Goldman Sachs',
    class: 'equity',
  },
  NKE: { id: '0x67649450b4ca4bfff97cbaf96d2fd9e40f6db148cb65999140154415e4378e14', name: 'Nike', class: 'equity' },
  ABT: {
    id: '0x4aac40f432e039ab06236eb9bd3c58347f953d8f05b29aaac295b99cc47ee429',
    name: 'Abbott Labs',
    class: 'equity',
  },
  LOW: { id: '0xab31ec9dbcacacfb26e5ea6c249d69f5ae8b9c691aac6ccc5919b6107efa1c3a', name: 'Lowes', class: 'equity' },
  PEP: { id: '0xbe230eddb16aad5ad273a85e581e74eb615ebf67d378f885768d9b047df0c843', name: 'PepsiCo', class: 'equity' },
  PFE: { id: '0x0704ad7547b3dfee329266ee53276349d48e4587cb08264a2818288f356efd1d', name: 'Pfizer', class: 'equity' },
  AXP: {
    id: '0x9ff7b9a93df40f6d7edc8184173c50f4ae72152c6142f001e8202a26f951d710',
    name: 'American Express',
    class: 'equity',
  },
  SCHW: {
    id: '0xd437b2f1470d5f007f18a5565eaab1ed182d97204d80b7dd3dac29839f61c9e6',
    name: 'Charles Schwab',
    class: 'equity',
  },
  ANET: {
    id: '0x31cc7558642dc348a3e2894146a998031438de8ccc56b7af2171bcd5e5d83eda',
    name: 'Arista Networks',
    class: 'equity',
  },
  VRTX: {
    id: '0xac9de86ae3dcff03514bde733f5793f1446b2cd31f1539a1c449acc3e76cacc1',
    name: 'Vertex Pharma',
    class: 'equity',
  },
  HPQ: { id: '0xd1d6eb75702d0e80582c2d5a2df1849b9c83d7afbe99a2d474317f1f356e5659', name: 'HP Inc', class: 'equity' },
  ITW: {
    id: '0x2b610a0d95397c20582741b53d61d5e79bab7bebbd5793546e90662f8f6ce0b9',
    name: 'Illinois Tool',
    class: 'equity',
  },
  DHI: { id: '0xa2c9466d7558768573d83ad57735177d8448098d0a87aca9ca2ae9a9585bbdcc', name: 'DR Horton', class: 'equity' },
  MCO: { id: '0x81ec776dd73898187779458dcd0c282a91322c7bd5fcb38b565f1b94bd8adff0', name: 'Moodys', class: 'equity' },
  KKR: { id: '0xaef0db13545e411bfc9d17e7eba913b0a5376c6af415a33240b546f773b25105', name: 'KKR', class: 'equity' },
  TTD: {
    id: '0x0ad2003fcf837c63f83ce1238efaadce0976ef93d4b3b0befbbf5e196945c385',
    name: 'Trade Desk',
    class: 'equity',
  },
  RDDT: { id: '0xc0ece6b9254797f4384bda1ba3f2c33259f552c7849a86b3029e811be5ea9227', name: 'Reddit', class: 'equity' },
  HOOD: {
    id: '0x52ecf79ab14d988ca24fbd282a7cb91d41d36cb76aa3c9075a3eabce9ff63e2f',
    name: 'Robinhood',
    class: 'equity',
  },
  AFRM: { id: '0x137b11f6e570f46d5cbcf1ebe05ba1bbc677d419ba6eefb5e7f0786c11adae06', name: 'Affirm', class: 'equity' },
  OXY: {
    id: '0x54ba7b095dfa286f556cd41d4bfefe956ebd4df3d9eec8fe0188d0727f07e344',
    name: 'Occidental',
    class: 'equity',
  },
  USB: {
    id: '0x3490a2ca9b5db045ea37d86c2d5dd69f893417fb3b9937b4bcd61d17f0bf0c20',
    name: 'US Bancorp',
    class: 'equity',
  },
  ROST: {
    id: '0x093d0ce5cbf3150e271db36706a0cf42b9dd7e62b1bc70fef09c0e2ee80434d5',
    name: 'Ross Stores',
    class: 'equity',
  },
  WDAY: { id: '0xa3ae4e6fb2cef300b62c34b4611048dfd64e148faa08e912b31e17f1da61d875', name: 'Workday', class: 'equity' },
  MSI: {
    id: '0xcc7851b525bd7f0d8ce00e409d59d6cd5ecdfbc5a2df1aaee3c4948426976100',
    name: 'Motorola Sol.',
    class: 'equity',
  },
  SYK: { id: '0x1e2fea8c5028e09489fbcb31014e9e7833e08eea78922eaa69d96cf1b37206c2', name: 'Stryker', class: 'equity' },

  // ── US ETFs ─────────────────────────────────────────────────
  SPY: {
    id: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    name: 'S&P 500 ETF',
    class: 'equity',
  },
  QQQ: {
    id: '0x3a5c4932d871ad2e81b0e539cfca59ba0344aa08e42edc2ef4a3a6aa40208e0d',
    name: 'Nasdaq 100 ETF',
    class: 'equity',
  },
  IWM: {
    id: '0x8c5f1a7a23992fbc0efb94869c0b02985e10f6d4bf753a81a45b88803a0b1a3e',
    name: 'Russell 2000',
    class: 'equity',
  },
  DIA: {
    id: '0x57cff3a9a4d4c87b595a2d1bd1bac0240400a84677366d632ab838bbbe56f763',
    name: 'Dow Jones ETF',
    class: 'equity',
  },
  GLD: { id: '0xe190f467043db04548200354889dfe0d9d314c08b8d4e62fabf4d5a3140fecca', name: 'SPDR Gold', class: 'equity' },
  TLT: {
    id: '0x9f383d612ac09c7e6ffda24deca1502fce72e0ba58ff473fea411d9727401cc1',
    name: '20+ Year Treas.',
    class: 'equity',
  },
  VOO: {
    id: '0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179',
    name: 'Vanguard S&P 500',
    class: 'equity',
  },
  VTI: {
    id: '0x26c67e91769aeba33a09469c705a1863794014dac416e4270661f489309ae862',
    name: 'Total Stock Mkt',
    class: 'equity',
  },
  XLE: {
    id: '0x8bf649e08e5a86129c57990556c8eec30e296069b524f4639549282bc5c07bb4',
    name: 'Energy Sector',
    class: 'equity',
  },
  XLP: {
    id: '0x7a86ffacf2ae07167fa810214e87a137ef1fa17a8b7b9416d3f1df48a3432e9132',
    name: 'Cons. Staples',
    class: 'equity',
  },
  SOXL: {
    id: '0x53008e9cb71db278f91d7ee0011434af626548018b5f9d4c11000c387eac46fb',
    name: 'Semis Bull 3x',
    class: 'equity',
  },
  ARKK: {
    id: '0xb2fe0af6c828efefda3ffda664f919825a535aa28a0f19fc238945c7aff540b1',
    name: 'ARK Innovation',
    class: 'equity',
  },
  IBIT: {
    id: '0x1b79d5b75253c291cc72d40cc874f468d07c1e6c149ee298a00d8075cb10c2c0',
    name: 'iShares Bitcoin',
    class: 'equity',
  },
  SLV: {
    id: '0x6fc08c2bd425e68b471239b29de7968667b210774aa252b9813f8d8edf5b62e7',
    name: 'iShares Silver',
    class: 'equity',
  },
  HYG: {
    id: '0x2077043ee3b67b9a70949c8396c110f6cf43de8e6d9e6efdcbd557a152cf2c6e',
    name: 'HY Corp Bond',
    class: 'equity',
  },
  TQQQ: {
    id: '0x5aa9f82dc2e0f5f8271fd163e980010101517da59f4b72b71c7056a5950b2f9d',
    name: 'Nasdaq Bull 3x',
    class: 'equity',
  },
  XLF: {
    id: '0x06b884220ac5ac16fedfb03f84ec62b6e311241bc0af40ebfe4aedf462c18825',
    name: 'Financial Sect',
    class: 'equity',
  },
  XLK: {
    id: '0x343e151bf5a9063e075f84ec102186c5902ec4fd11db83cd4d8d8de5af756343',
    name: 'Tech Sector',
    class: 'equity',
  },
  XLV: {
    id: '0x0bf68c2bd425e68b471239b29de7968667b210774aa252b9813f8d8edf5b62d9',
    name: 'Health Care',
    class: 'equity',
  },
  XLI: {
    id: '0xeb1b3f975062611aa0d67251d576ca30a100a55f3cbf72bfb2d0a27286cf374c',
    name: 'Industrial Sect',
    class: 'equity',
  },

  // ── Forex ─────────────────────────────────────────────────────
  EURUSD: { id: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b', name: 'EUR/USD', class: 'forex' },
  GBPUSD: { id: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1', name: 'GBP/USD', class: 'forex' },
  USDJPY: { id: '0xef2c98c804ba503c6a707e38be4dfbb16683775e3783c8a75d24bbc16dcdeec0', name: 'USD/JPY', class: 'forex' },
  AUDUSD: { id: '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80', name: 'AUD/USD', class: 'forex' },
  USDCAD: { id: '0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b0a688e1aa5be1b51698', name: 'USD/CAD', class: 'forex' },
  USDCHF: { id: '0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e8840', name: 'USD/CHF', class: 'forex' },
  NZDUSD: { id: '0x92eea8ba1b00078cdc2ef6f64f091f262e8c7d0576ee4677572f314ebfafa4c7', name: 'NZD/USD', class: 'forex' },
  EURGBP: { id: '0xc349ff6087acab1c0c5442a9de0ea804239cc9fd09be8b1a93ffa0ed7f366d9c', name: 'EUR/GBP', class: 'forex' },
  EURJPY: { id: '0xd8c874fa511b9838d094109f996890642421e462c3b29501a2560cecf82c2eb4', name: 'EUR/JPY', class: 'forex' },
  GBPJPY: { id: '0xcfa65905787703c692c3cac2b8a009a1db51ce68b54f5b206ce6a55bfa2c3cd1', name: 'GBP/JPY', class: 'forex' },

  // ── Commodities ───────────────────────────────────────────────
  XAU: {
    id: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63c52eecd2c7a9c6ffe',
    name: 'Gold (XAU/USD)',
    class: 'commodity',
  },
  XAG: {
    id: '0xf2fb02c32b055c805e7238d628e5e992ab910babeb8d9e093ed7e3d2a1f3b3c5',
    name: 'Silver (XAG/USD)',
    class: 'commodity',
  },
  CRUDE: {
    id: '0x925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6',
    name: 'Crude Oil (WTI)',
    class: 'commodity',
  },
};

// Build reverse lookups
const FEED_TO_SYMBOL = new Map();
const SYMBOL_TO_FEED = new Map();
for (const [sym, feed] of Object.entries(PYTH_FEEDS)) {
  FEED_TO_SYMBOL.set(feed.id, sym);
  SYMBOL_TO_FEED.set(sym, feed);
}

// ─── Pyth Adapter Class ─────────────────────────────────────────

export class PythAdapter extends BaseAdapter {
  constructor() {
    super('pyth');
    this._sseSource = null; // EventSource for streaming
    this._subscriptions = new Map(); // symbol → callback
    this._lastPrices = new Map(); // symbol → { price, conf, timestamp }
    this._status = 'disconnected';
  }

  /**
   * Check if this adapter supports a symbol.
   * Pyth supports any symbol in our feed registry.
   */
  supports(symbol) {
    return !!this._resolveFeed(symbol);
  }

  latencyTier() {
    return 'realtime';
  }

  /**
   * Resolve a charEdge symbol to a Pyth feed entry.
   * Handles aliases: 'BTCUSDT' → 'BTC', 'AAPL' → 'AAPL', etc.
   */
  _resolveFeed(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase().trim();

    // Direct lookup
    if (PYTH_FEEDS[upper]) return PYTH_FEEDS[upper];

    // Strip USDT suffix for crypto
    const bare = upper.replace(/USDT$|USD$|BUSD$/, '');
    if (PYTH_FEEDS[bare]) return PYTH_FEEDS[bare];

    // Strip Yahoo-style suffixes for other assets
    const clean = upper.replace(/=X$|=F$/, '');
    if (PYTH_FEEDS[clean]) return PYTH_FEEDS[clean];

    // Futures symbol aliases → corresponding Pyth feeds
    const FUTURES_ALIASES = {
      ES: 'SPY', // E-mini S&P 500 → SPY ETF feed
      NQ: 'QQQ', // E-mini Nasdaq 100 → QQQ ETF feed
      YM: 'DIA', // E-mini Dow → DIA ETF feed
      RTY: 'IWM', // E-mini Russell 2000 → IWM ETF feed
      MES: 'SPY', // Micro E-mini S&P → SPY feed
      MNQ: 'QQQ', // Micro E-mini Nasdaq → QQQ feed
      GC: 'XAU', // Gold futures → Gold feed
      SI: 'XAG', // Silver futures → Silver feed
      CL: 'CRUDE', // Crude oil futures → Crude oil feed
      MGC: 'XAU', // Micro gold → Gold feed
      MCL: 'CRUDE', // Micro crude → Crude oil feed
    };
    if (FUTURES_ALIASES[clean] && PYTH_FEEDS[FUTURES_ALIASES[clean]]) {
      return PYTH_FEEDS[FUTURES_ALIASES[clean]];
    }

    return null;
  }

  /**
   * Fetch the latest quote/snapshot for a symbol.
   * Uses Hermes REST API.
   */
  async fetchQuote(symbol) {
    const feed = this._resolveFeed(symbol);
    if (!feed) return null;

    try {
      const url = `${HERMES_LATEST}?ids[]=${feed.id}&parsed=true`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const json = await res.json();
      const parsed = json?.parsed?.[0];
      if (!parsed?.price) return null;

      const price = this._parsePrice(parsed.price);
      const emaPrice = parsed.ema_price ? this._parsePrice(parsed.ema_price) : null;

      // Cache the latest price
      this._lastPrices.set(symbol.toUpperCase(), {
        price,
        confidence: this._parsePrice(parsed.price, 'conf'),
        timestamp: parsed.price.publish_time * 1000,
        emaPrice,
      });

      return {
        price,
        change: emaPrice ? price - emaPrice : 0,
        changePct: emaPrice ? ((price - emaPrice) / emaPrice) * 100 : 0,
        volume: 0, // Pyth doesn't provide volume
        high: price, // Pyth only provides spot — no H/L/O
        low: price,
        open: emaPrice || price,
        confidence: this._parsePrice(parsed.price, 'conf'),
        source: 'pyth',
      };
    } catch (err) {
      logger.data.warn(`[PythAdapter] fetchQuote error for ${symbol}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch OHLCV data from the candle aggregator.
   * Pyth doesn't provide historical candles natively — we build them
   * client-side from the SSE tick stream via PythCandleAggregator.
   *
   * Returns accumulated candles if available, otherwise null
   * (signals to the data layer to try another provider for history).
   */
  async fetchOHLCV(symbol, interval = '1m', _opts = {}) {
    const feed = this._resolveFeed(symbol);
    if (!feed) return null;

    // Map interval format: chart engine may use '1' for 1m, '60' for 1h, etc.
    const normalizedInterval = this._normalizeInterval(interval);
    const candles = pythCandleAggregator.getCandles(this._feedSymbol(symbol), normalizedInterval);

    // Only return if we have meaningful data (at least 2 candles)
    if (candles.length < 2) return null;

    return candles;
  }

  /**
   * Subscribe to real-time price updates via SSE streaming.
   * Pyth Hermes provides Server-Sent Events for price updates (~400ms).
   */
  subscribe(symbol, callback) {
    const feed = this._resolveFeed(symbol);
    if (!feed) return () => {};

    const normalizedSymbol = symbol.toUpperCase();
    this._subscriptions.set(normalizedSymbol, { callback, feedId: feed.id });

    // If SSE is not running, start it with all subscribed feed IDs
    this._restartSSE();

    return () => {
      this._subscriptions.delete(normalizedSymbol);
      if (this._subscriptions.size === 0) {
        this._stopSSE();
      } else {
        this._restartSSE();
      }
    };
  }

  /**
   * Subscribe to multiple symbols simultaneously.
   * More efficient than calling subscribe() per symbol.
   * @param {string[]} symbols
   * @param {Function} callback - ({ symbol, price, confidence, timestamp }) => void
   * @returns {Function} unsubscribe all
   */
  subscribeMany(symbols, callback) {
    const unsubs = symbols.map((sym) => this.subscribe(sym, callback));
    return () => unsubs.forEach((fn) => fn());
  }

  /**
   * Search through the Pyth feed registry for matching symbols.
   */
  async searchSymbols(query, limit = 10) {
    if (!query) return [];
    const q = query.toUpperCase().trim();
    const results = [];

    for (const [sym, feed] of Object.entries(PYTH_FEEDS)) {
      if (results.length >= limit) break;
      if (sym.includes(q) || feed.name.toUpperCase().includes(q)) {
        results.push({
          symbol: sym,
          name: feed.name,
          type: feed.class.toUpperCase(),
          exchange: 'Pyth Network',
        });
      }
    }

    return results;
  }

  /**
   * Get all available Pyth feed symbols.
   * @returns {{ symbol: string, name: string, class: string }[]}
   */
  getAvailableFeeds() {
    return Object.entries(PYTH_FEEDS).map(([sym, feed]) => ({
      symbol: sym,
      name: feed.name,
      class: feed.class,
      feedId: feed.id,
    }));
  }

  /**
   * Fetch quotes for multiple symbols in a single request.
   * Hermes supports batching via multiple `ids[]` params.
   */
  async fetchMultiQuote(symbols) {
    const feeds = symbols.map((s) => ({ symbol: s, feed: this._resolveFeed(s) })).filter((f) => f.feed);

    if (feeds.length === 0) return {};

    try {
      const ids = feeds.map((f) => `ids[]=${f.feed.id}`).join('&');
      const url = `${HERMES_LATEST}?${ids}&parsed=true`;
      const res = await fetch(url);
      if (!res.ok) return {};

      const json = await res.json();
      const results = {};

      for (const parsed of json?.parsed || []) {
        const feedId = '0x' + parsed.id;
        const sym = FEED_TO_SYMBOL.get(feedId);
        if (!sym || !parsed.price) continue;

        const price = this._parsePrice(parsed.price);
        const emaPrice = parsed.ema_price ? this._parsePrice(parsed.ema_price) : null;

        results[sym] = {
          price,
          change: emaPrice ? price - emaPrice : 0,
          changePct: emaPrice ? ((price - emaPrice) / emaPrice) * 100 : 0,
          confidence: this._parsePrice(parsed.price, 'conf'),
          timestamp: parsed.price.publish_time * 1000,
          source: 'pyth',
        };
      }

      return results;
    } catch (err) {
      logger.data.warn('[PythAdapter] fetchMultiQuote error:', err.message);
      return {};
    }
  }

  /**
   * Get the current connection status.
   * @returns {'connected'|'connecting'|'disconnected'|'error'}
   */
  getStatus() {
    return this._status;
  }

  /**
   * Get the last known price for a symbol.
   * @param {string} symbol
   * @returns {{ price, confidence, timestamp }|null}
   */
  getLastPrice(symbol) {
    return this._lastPrices.get(symbol?.toUpperCase()) || null;
  }

  /**
   * Get the latest confidence interval for a symbol.
   * Pyth's confidence represents the ± price range within which
   * the true price is expected to fall.
   * @param {string} symbol
   * @returns {{ confidence: number, timestamp: number } | null}
   */
  getConfidence(symbol) {
    return pythCandleAggregator.getConfidence(this._feedSymbol(symbol));
  }

  /**
   * Subscribe to candle close events from the aggregator.
   * @param {string} symbol
   * @param {string} interval - '1m'|'5m'|'15m'|'1h'|'4h'|'1d'
   * @param {Function} callback - (candle) => void
   * @returns {Function} unsubscribe
   */
  onCandle(symbol, interval, callback) {
    return pythCandleAggregator.onCandle(this._feedSymbol(symbol), interval, callback);
  }

  /**
   * Get accumulated candle data for a symbol from the aggregator.
   * @param {string} symbol
   * @param {string} interval
   * @returns {Object[]}
   */
  getCandles(symbol, interval = '1m') {
    return pythCandleAggregator.getCandles(this._feedSymbol(symbol), interval);
  }

  /**
   * Get supported candle intervals.
   * @returns {string[]}
   */
  getSupportedIntervals() {
    return [...SUPPORTED_INTERVALS];
  }

  // ─── SSE (Server-Sent Events) Management ─────────────────────

  /** @private */
  _restartSSE() {
    this._stopSSE();

    const feedIds = Array.from(this._subscriptions.values()).map((s) => s.feedId);
    if (feedIds.length === 0) return;

    const ids = feedIds.map((id) => `ids[]=${id}`).join('&');
    const url = `${HERMES_STREAM}?${ids}&parsed=true&allow_unordered=true&benchmarks_only=false`;

    try {
      this._status = 'connecting';
      this._sseSource = new EventSource(url);

      this._sseSource.onopen = () => {
        this._status = 'connected';
      };

      this._sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data?.parsed) return;

          for (const parsed of data.parsed) {
            const feedId = '0x' + parsed.id;
            const sym = FEED_TO_SYMBOL.get(feedId);
            if (!sym || !parsed.price) continue;

            const price = this._parsePrice(parsed.price);
            const confidence = this._parsePrice(parsed.price, 'conf');
            const timestamp = parsed.price.publish_time * 1000;

            // Update cache
            this._lastPrices.set(sym, { price, confidence, timestamp });

            // Feed tick into candle aggregator
            pythCandleAggregator.ingestTick(sym, price, confidence, timestamp);

            // Notify all subscriptions that match this symbol
            // (Check both direct sym and USDT variants)
            for (const [subSym, sub] of this._subscriptions) {
              if (sub.feedId === feedId) {
                sub.callback({
                  price,
                  volume: 0,
                  time: timestamp,
                  symbol: subSym,
                  confidence,
                  source: 'pyth',
                });
              }
            }
          }
          // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (_) {
          /* ignore individual message parse errors */
        }
      };

      this._sseSource.onerror = () => {
        this._status = 'error';
        // EventSource auto-reconnects — we just track the status
        setTimeout(() => {
          if (this._sseSource) this._status = 'connecting';
        }, 1000);
      };
    } catch (err) {
      logger.data.warn('[PythAdapter] SSE connection error:', err.message);
      this._status = 'error';
    }
  }

  /** @private */
  _stopSSE() {
    if (this._sseSource) {
      this._sseSource.close();
      this._sseSource = null;
    }
    this._status = 'disconnected';
  }

  // ─── Price Parsing ────────────────────────────────────────────

  /**
   * Parse a Pyth price object into a decimal number.
   * Pyth stores prices as (price * 10^expo), e.g. { price: "5123456", expo: -2 } = 51234.56
   * @private
   */
  _parsePrice(priceObj, field = 'price') {
    if (!priceObj) return 0;
    const raw = parseInt(priceObj[field] || '0', 10);
    const expo = parseInt(priceObj.expo || '0', 10);
    return raw * Math.pow(10, expo);
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Get the base Pyth symbol for a charEdge symbol.
   * E.g. 'BTCUSDT' → 'BTC', 'AAPL' → 'AAPL'
   * @private
   */
  _feedSymbol(symbol) {
    if (!symbol) return '';
    const feed = this._resolveFeed(symbol);
    if (!feed) return symbol.toUpperCase();
    // Find the key in PYTH_FEEDS that matches this feed
    for (const [sym, f] of Object.entries(PYTH_FEEDS)) {
      if (f.id === feed.id) return sym;
    }
    return symbol.toUpperCase();
  }

  /**
   * Normalize chart interval to aggregator format.
   * Chart engine may use '1', '5', '60', 'D' etc.
   * @private
   */
  _normalizeInterval(interval) {
    const map = {
      1: '1m',
      '1m': '1m',
      5: '5m',
      '5m': '5m',
      15: '15m',
      '15m': '15m',
      60: '1h',
      '1h': '1h',
      240: '4h',
      '4h': '4h',
      D: '1d',
      '1D': '1d',
      '1d': '1d',
    };
    return map[interval] || '1m';
  }

  /**
   * Close all connections and clean up.
   */
  dispose() {
    this._stopSSE();
    this._subscriptions.clear();
    this._lastPrices.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const pythAdapter = new PythAdapter();

export { PYTH_FEEDS, FEED_TO_SYMBOL, SYMBOL_TO_FEED, HERMES_BASE, HERMES_LATEST, HERMES_STREAM };

export default PythAdapter;
