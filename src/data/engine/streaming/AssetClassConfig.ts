// ═══════════════════════════════════════════════════════════════════
// charEdge — Asset-Class-Aware Staleness Configuration
//
// Sprint 5 Task 5.3: Dynamic staleness thresholds per asset class
// and market hours. Used by PriceAggregator and cache TTL system.
// ═══════════════════════════════════════════════════════════════════

// ─── Asset class detection ──────────────────────────────────────

const CRYPTO_BASES = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT',
  'MATIC', 'LINK', 'UNI', 'ATOM', 'FTM', 'NEAR', 'APT', 'ARB', 'OP',
  'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'LTC', 'FIL',
]);

const FOREX_PAIRS = new Set([
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF',
  'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
]);

const FUTURES_SYMBOLS = new Set(['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6J']);

export type AssetClass = 'crypto' | 'equity' | 'forex' | 'futures' | 'unknown';

/**
 * Classify a symbol into an asset class.
 */
export function getAssetClass(symbol: string): AssetClass {
  const s = (symbol || '').toUpperCase().replace(/USDT$|BUSD$|USDC$/, '');

  if (CRYPTO_BASES.has(s) || symbol.endsWith('USDT') || symbol.endsWith('BUSD')) return 'crypto';
  if (FOREX_PAIRS.has(symbol.toUpperCase()) || symbol.includes('/')) return 'forex';
  if (FUTURES_SYMBOLS.has(s)) return 'futures';
  if (/^[A-Z]{1,5}$/.test(s)) return 'equity';  // Most stock tickers
  return 'unknown';
}

// ─── Staleness thresholds (ms) ──────────────────────────────────

export const STALENESS_THRESHOLDS: Record<string, number> = {
  crypto:           5_000,       // 24/7 market — 5s
  equity_market:   15_000,       // US market hours — 15s
  equity_off:     300_000,       // Off-hours — 5min (slow polling)
  forex:           10_000,       // FX — 10s
  futures:         10_000,       // Futures — 10s
  default:         10_000,       // Fallback
};

/**
 * Check if US equity market is currently open (ET: 9:30am-4pm Mon-Fri).
 */
export function isUSMarketOpen(): boolean {
  const now = new Date();
  // Convert to ET (UTC-5 or UTC-4 during DST)
  const etHour = now.getUTCHours() - 5; // Simplified — ignores DST
  const adjustedHour = etHour < 0 ? etHour + 24 : etHour;
  const day = now.getUTCDay();

  // Mon-Fri (1-5), 9:30-16:00 ET
  if (day === 0 || day === 6) return false;
  if (adjustedHour < 9 || adjustedHour >= 16) return false;
  if (adjustedHour === 9 && now.getUTCMinutes() < 30) return false;
  return true;
}

/**
 * Get the staleness threshold for a given symbol.
 */
export function getStalenessThreshold(symbol: string): number {
  const assetClass = getAssetClass(symbol);

  switch (assetClass) {
    case 'crypto':
      return STALENESS_THRESHOLDS.crypto!;
    case 'equity':
      return isUSMarketOpen()
        ? STALENESS_THRESHOLDS.equity_market!
        : STALENESS_THRESHOLDS.equity_off!;
    case 'forex':
      return STALENESS_THRESHOLDS.forex!;
    case 'futures':
      return STALENESS_THRESHOLDS.futures!;
    default:
      return STALENESS_THRESHOLDS.default!;
  }
}
