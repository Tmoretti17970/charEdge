// ═══════════════════════════════════════════════════════════════════
// charEdge — Timeframe Constants
//
// Timeframe definitions for equities and crypto.
// ═══════════════════════════════════════════════════════════════════

export const TFS = [
  { id: '1m', label: '1m', cgDays: 1, yhInt: '1m', yhRange: '1d', fb: 120, binance: '1m' },
  { id: '5m', label: '5m', cgDays: 1, yhInt: '5m', yhRange: '5d', fb: 120, binance: '5m' },
  { id: '15m', label: '15m', cgDays: 5, yhInt: '15m', yhRange: '5d', fb: 120, binance: '15m' },
  { id: '30m', label: '30m', cgDays: 5, yhInt: '15m', yhRange: '5d', fb: 120, binance: '30m' },
  { id: '1h', label: '1H', cgDays: 30, yhInt: '60m', yhRange: '1mo', fb: 120, binance: '1h' },
  { id: '4h', label: '4H', cgDays: 90, yhInt: '60m', yhRange: '3mo', fb: 120, binance: '4h' },
  { id: '1D', label: '1D', cgDays: 365, yhInt: '1d', yhRange: '1y', fb: 120, binance: '1d' },
  { id: '1w', label: '1W', cgDays: 365, yhInt: '1wk', yhRange: '5y', fb: 120, binance: '1w' },
];

// Binance-native intervals for direct crypto charting
export const CRYPTO_TFS = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1D', label: '1D' },
  { id: '1w', label: '1W' },
];
