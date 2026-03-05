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
export function getAssetClass(sym) {
  const s = (sym || '').toUpperCase();
  if (isCrypto(s)) return 'crypto';
  // Strip futures contract month/year suffix: ESH5 → ES, ESH25 → ES, MES03-25 → MES
  const root = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').replace(/\d{2}-\d{2}$/, '');
  if (FUTURES_ROOTS.has(root)) return 'futures';
  if (FOREX_PAIRS.has(s)) return 'forex';
  return 'stock';
}
