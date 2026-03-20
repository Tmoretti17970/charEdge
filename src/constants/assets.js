// ═══════════════════════════════════════════════════════════════════
// charEdge — Asset Constants
//
// Crypto IDs, futures roots, forex pairs, and asset class detection.
// ═══════════════════════════════════════════════════════════════════

export const CRYPTO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  XRP: 'ripple',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  LTC: 'litecoin',
  FIL: 'filecoin',
  NEAR: 'near',
  OP: 'optimism',
  ARB: 'arbitrum',
  SUI: 'sui',
  APT: 'aptos',
  FTM: 'fantom',
  SEI: 'sei-network',
  TIA: 'celestia',
  JUP: 'jupiter-exchange-solana',
  WIF: 'dogwifcoin',
  PEPE: 'pepe',
  RENDER: 'render-token',
  INJ: 'injective-protocol',
  TRX: 'tron',
  SHIB: 'shiba-inu',
  FLOKI: 'floki',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  RUNE: 'thorchain',
  ALGO: 'algorand',
  MANA: 'decentraland',
  SAND: 'the-sandbox',
  AXS: 'axie-infinity',
  // 6.5.1: Expanded to 55+ pairs
  HBAR: 'hedera-hashgraph',
  VET: 'vechain',
  XLM: 'stellar',
  ICP: 'internet-computer',
  FET: 'fetch-ai',
  GRT: 'the-graph',
  THETA: 'theta-token',
  EOS: 'eos',
  FLOW: 'flow',
  XTZ: 'tezos',
  EGLD: 'multiversx',
  NEO: 'neo',
  KAVA: 'kava',
  ZIL: 'zilliqa',
  ENJ: 'enjincoin',
  CHZ: 'chiliz',
  GALA: 'gala',
};

/**
 * Check if a symbol is a known crypto asset.
 * Handles raw symbols ('BTC') and USDT/BUSD/USDC-suffixed pairs ('BTCUSDT').
 */
export const isCrypto = (sym) => {
  const upper = (sym || '').toUpperCase();
  if (CRYPTO_IDS[upper]) return true;
  // Strip common quote-currency suffixes
  const base = upper.replace(/(?:USDT|BUSD|USDC|USD)$/, '');
  return base !== upper && !!CRYPTO_IDS[base];
};

// Asset class hints for symbol routing + UI badges
export const FUTURES_ROOTS = new Set([
  'ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN',
  'ZC', 'ZS', 'ZW', 'NG', 'HG', '6E', '6J', '6B', '6A',
  '6C', '6S', 'MES', 'MNQ', 'MYM', 'M2K', 'MCL', 'MGC',
  'HE', 'LE', 'KC', 'SB', 'CT', 'CC',
]);

export const FOREX_PAIRS = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF',
  'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY',
  'EURAUD', 'EURCHF',
]);

/**
 * Detect asset class from symbol string.
 * Used for data provider routing, UI badges, and import classification.
 * @param {string} sym
 * @returns {'crypto'|'futures'|'forex'|'stock'}
 */
/**
 * Check if a symbol is a known futures contract.
 * Handles raw roots ('ES'), Yahoo-style ('ES=F'), and contract codes ('ESH25').
 */
export function isFutures(sym) {
  const s = (sym || '').toUpperCase();
  const stripped = s.replace(/=F$/, '');
  const root = stripped.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').replace(/\d{2}-\d{2}$/, '');
  return FUTURES_ROOTS.has(root) || FUTURES_ROOTS.has(stripped);
}

/**
 * Check if a symbol is a known forex pair.
 */
export function isForex(sym) {
  const s = (sym || '').toUpperCase().replace(/=X$/, '');
  return FOREX_PAIRS.has(s);
}

/**
 * Convert a charEdge symbol to its Yahoo Finance equivalent.
 * Futures: ES → ES=F, GC → GC=F
 * Forex:   EURUSD → EURUSD=X
 * Stocks:  AAPL → AAPL (unchanged)
 */
export function toYahooSymbol(sym) {
  const s = (sym || '').toUpperCase();
  // Already in Yahoo format
  if (s.endsWith('=F') || s.endsWith('=X')) return s;
  if (isFutures(s)) {
    // Strip contract month/year to get clean root, then append =F
    const stripped = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').replace(/\d{2}-\d{2}$/, '');
    return stripped + '=F';
  }
  if (isForex(s)) return s + '=X';
  return s;
}

export function getAssetClass(sym) {
  const s = (sym || '').toUpperCase();
  if (isCrypto(s)) return 'crypto';
  if (isFutures(s)) return 'futures';
  if (isForex(s)) return 'forex';
  return 'stock';
}
