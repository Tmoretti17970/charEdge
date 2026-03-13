// ═══════════════════════════════════════════════════════════════════
// symbolClassifier — Infer asset class from ticker symbol
// Used by useTradeForm to auto-set assetClass on symbol entry.
// ═══════════════════════════════════════════════════════════════════

const CRYPTO =
  /^(BTC|ETH|SOL|XRP|DOGE|ADA|AVAX|DOT|MATIC|LINK|UNI|AAVE|ATOM|NEAR|OP|ARB|APT|SUI|PEPE|SHIB|LTC|BCH|FIL|INJ|SEI|TIA|JUP|WIF|BONK)/i;
const FUTURES = /^(ES|NQ|YM|RTY|CL|GC|SI|ZB|ZN|ZF|ZT|HG|NG|6E|6J|6B|MES|MNQ|MCL|MGC|MYM|M2K)/i;
const FOREX = /^(EUR|GBP|JPY|AUD|NZD|CAD|CHF|USD)\/(EUR|GBP|JPY|AUD|NZD|CAD|CHF|USD)/i;

/**
 * Infer asset class from a trading symbol.
 * @param {string} symbol - Ticker symbol (e.g. 'BTC', 'ES', 'AAPL', 'EUR/USD')
 * @returns {string|null} Asset class or null if symbol is empty
 */
export function inferAssetClass(symbol) {
  if (!symbol) return null;
  const s = symbol.trim().toUpperCase();
  if (!s) return null;
  if (CRYPTO.test(s)) return 'crypto';
  if (FUTURES.test(s)) return 'futures';
  if (FOREX.test(s)) return 'forex';
  // Default: anything not matching known patterns is stock/ETF
  return 'stocks';
}
