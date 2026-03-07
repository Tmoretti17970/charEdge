// ═══════════════════════════════════════════════════════════════════
// charEdge — Screener Service
//
// Generates mock screener data for the Smart Screener component.
// Pre-built scan presets + custom filter support.
// Designed for future API integration.
// ═══════════════════════════════════════════════════════════════════

import { C } from '../constants/theme.js';

// ─── Mock Asset Universe ────────────────────────────────────────

const ASSET_UNIVERSE = [
  { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto', sector: 'L1', price: 68420, change: 3.2, volume: 42.1e9, avgVolume: 35e9, rsi: 62, ma20: 65800, ma50: 62100, marketCap: '1.35T' },
  { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto', sector: 'L1', price: 3850, change: 2.1, volume: 18.5e9, avgVolume: 15e9, rsi: 58, ma20: 3680, ma50: 3520, marketCap: '463B' },
  { symbol: 'SOL', name: 'Solana', assetClass: 'crypto', sector: 'L1', price: 148.5, change: 5.8, volume: 4.2e9, avgVolume: 2.1e9, rsi: 71, ma20: 138, ma50: 125, marketCap: '65B' },
  { symbol: 'DOGE', name: 'Dogecoin', assetClass: 'crypto', sector: 'Meme', price: 0.142, change: 8.2, volume: 2.8e9, avgVolume: 1.2e9, rsi: 74, ma20: 0.128, ma50: 0.115, marketCap: '20B' },
  { symbol: 'LINK', name: 'Chainlink', assetClass: 'crypto', sector: 'Oracle', price: 18.9, change: 4.3, volume: 980e6, avgVolume: 650e6, rsi: 65, ma20: 17.2, ma50: 15.8, marketCap: '11B' },
  { symbol: 'AVAX', name: 'Avalanche', assetClass: 'crypto', sector: 'L1', price: 42.1, change: 3.5, volume: 620e6, avgVolume: 450e6, rsi: 59, ma20: 39.5, ma50: 36.2, marketCap: '16B' },
  { symbol: 'ADA', name: 'Cardano', assetClass: 'crypto', sector: 'L1', price: 0.68, change: -1.4, volume: 580e6, avgVolume: 520e6, rsi: 44, ma20: 0.72, ma50: 0.65, marketCap: '24B' },
  { symbol: 'XRP', name: 'Ripple', assetClass: 'crypto', sector: 'Payments', price: 0.62, change: 1.1, volume: 1.2e9, avgVolume: 900e6, rsi: 52, ma20: 0.60, ma50: 0.58, marketCap: '34B' },
  { symbol: 'DOT', name: 'Polkadot', assetClass: 'crypto', sector: 'L0', price: 8.45, change: 2.8, volume: 340e6, avgVolume: 280e6, rsi: 55, ma20: 8.10, ma50: 7.60, marketCap: '11B' },
  { symbol: 'UNI', name: 'Uniswap', assetClass: 'crypto', sector: 'DeFi', price: 12.3, change: 6.1, volume: 420e6, avgVolume: 180e6, rsi: 68, ma20: 11.0, ma50: 10.2, marketCap: '9.3B' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'stock', sector: 'Tech', price: 182.5, change: -0.8, volume: 52e6, avgVolume: 58e6, rsi: 48, ma20: 184, ma50: 180, marketCap: '2.85T' },
  { symbol: 'MSFT', name: 'Microsoft', assetClass: 'stock', sector: 'Tech', price: 415.2, change: 1.2, volume: 22e6, avgVolume: 25e6, rsi: 56, ma20: 408, ma50: 395, marketCap: '3.08T' },
  { symbol: 'NVDA', name: 'NVIDIA', assetClass: 'stock', sector: 'Tech', price: 878.4, change: 3.4, volume: 48e6, avgVolume: 40e6, rsi: 64, ma20: 840, ma50: 780, marketCap: '2.16T' },
  { symbol: 'TSLA', name: 'Tesla', assetClass: 'stock', sector: 'Auto', price: 198.6, change: -2.1, volume: 95e6, avgVolume: 82e6, rsi: 42, ma20: 205, ma50: 215, marketCap: '630B' },
  { symbol: 'AMZN', name: 'Amazon', assetClass: 'stock', sector: 'Tech', price: 178.9, change: 0.6, volume: 38e6, avgVolume: 42e6, rsi: 54, ma20: 176, ma50: 170, marketCap: '1.86T' },
  { symbol: 'META', name: 'Meta Platforms', assetClass: 'stock', sector: 'Tech', price: 502.1, change: 1.8, volume: 18e6, avgVolume: 20e6, rsi: 60, ma20: 490, ma50: 465, marketCap: '1.28T' },
  { symbol: 'ES', name: 'E-mini S&P 500', assetClass: 'futures', sector: 'Index', price: 5285, change: 0.4, volume: 1.8e6, avgVolume: 1.5e6, rsi: 55, ma20: 5260, ma50: 5200, marketCap: '—' },
  { symbol: 'NQ', name: 'E-mini Nasdaq', assetClass: 'futures', sector: 'Index', price: 18720, change: 0.6, volume: 620e3, avgVolume: 500e3, rsi: 57, ma20: 18500, ma50: 18100, marketCap: '—' },
  { symbol: 'GC', name: 'Gold Futures', assetClass: 'futures', sector: 'Metals', price: 2048, change: 0.2, volume: 180e3, avgVolume: 200e3, rsi: 51, ma20: 2035, ma50: 2010, marketCap: '—' },
  { symbol: 'CL', name: 'Crude Oil', assetClass: 'futures', sector: 'Energy', price: 78.4, change: -0.9, volume: 420e3, avgVolume: 380e3, rsi: 46, ma20: 79.5, ma50: 76.8, marketCap: '—' },
];

// ─── Scan Presets ───────────────────────────────────────────────

export const SCAN_PRESETS = [
  {
    id: 'breakout',
    label: 'Breakout Candidates',
    icon: '📈',
    description: 'Volume surge + testing resistance',
    color: C.g,
    filter: (item) => item.change > 2 && item.volume > item.avgVolume * 1.3 && item.rsi > 55,
  },
  {
    id: 'oversold',
    label: 'Oversold Bounces',
    icon: '📉',
    description: 'RSI < 45, near support levels',
    color: '#f0b64e',
    filter: (item) => item.rsi < 45 && item.price > item.ma50,
  },
  {
    id: 'unusual_volume',
    label: 'Unusual Volume',
    icon: '🔥',
    description: '> 1.5x average daily volume',
    color: '#e8642c',
    filter: (item) => item.volume > item.avgVolume * 1.5,
  },
  {
    id: 'momentum',
    label: 'Momentum Leaders',
    icon: '🚀',
    description: 'Strong uptrend with RSI 55-75',
    color: '#c084fc',
    filter: (item) => item.rsi >= 55 && item.rsi <= 75 && item.change > 1 && item.price > item.ma20,
  },
  {
    id: 'whale_acc',
    label: 'Whale Accumulation',
    icon: '🐋',
    description: 'Large volume + price holding',
    color: '#22d3ee',
    filter: (item) => item.volume > item.avgVolume * 1.8 && Math.abs(item.change) < 3,
  },
  {
    id: 'ma_crossover',
    label: 'MA Crossover',
    icon: '✂️',
    description: 'Price crossing key moving averages',
    color: '#f472b6',
    filter: (item) => {
      const crossUp = item.price > item.ma20 && item.price > item.ma50 && item.ma20 > item.ma50;
      return crossUp && item.change > 0;
    },
  },
];

// ─── Data Fetching ──────────────────────────────────────────────

/**
 * Fetch screener results based on a preset or custom filters.
 * @param {Object} opts
 * @param {string} [opts.presetId] — ID of a SCAN_PRESETS preset
 * @param {string} [opts.assetClass] — Filter by asset class ('all', 'crypto', 'stock', 'futures')
 * @param {string} [opts.sortBy] — Sort field ('change', 'volume', 'rsi', 'price')
 * @param {string} [opts.sortDir] — Sort direction ('asc', 'desc')
 * @returns {Promise<Array>} Filtered and sorted results
 */
export async function fetchScreenerResults({
  presetId = null,
  assetClass = 'all',
  sortBy = 'change',
  sortDir = 'desc',
} = {}) {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 300));

  let results = [...ASSET_UNIVERSE];

  // Apply asset class filter
  if (assetClass && assetClass !== 'all') {
    results = results.filter((item) => item.assetClass === assetClass);
  }

  // Apply preset filter
  if (presetId) {
    const preset = SCAN_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      results = results.filter(preset.filter);
    }
  }

  // Sort
  results.sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Add signal for each result
  return results.map((item) => ({
    ...item,
    signal: getSignal(item),
    volumeRatio: (item.volume / item.avgVolume).toFixed(1),
    aboveMa20: item.price > item.ma20,
    aboveMa50: item.price > item.ma50,
  }));
}

function getSignal(item) {
  if (item.rsi > 70 && item.change > 3) return { label: 'Overbought', color: C.r, strength: 'strong' };
  if (item.rsi < 30) return { label: 'Oversold', color: '#f0b64e', strength: 'strong' };
  if (item.change > 3 && item.volume > item.avgVolume * 1.5) return { label: 'Breakout', color: C.g, strength: 'strong' };
  if (item.price > item.ma20 && item.rsi > 55) return { label: 'Bullish', color: C.g, strength: 'moderate' };
  if (item.price < item.ma20 && item.rsi < 45) return { label: 'Bearish', color: C.r, strength: 'moderate' };
  return { label: 'Neutral', color: '#8b8fa2', strength: 'weak' };
}
