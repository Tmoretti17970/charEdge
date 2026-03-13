// ═══════════════════════════════════════════════════════════════════
// charEdge — computeWatchlistIntel
//
// Pure computation module: takes OHLC bars + ticker data, returns
// real intelligence using the charting engine's indicator functions.
//
// NO React, NO side effects — just math.
//
// Usage:
//   import { computeIntel, fetchBarsForIntel } from './computeWatchlistIntel.js';
//   const bars = await fetchBarsForIntel('BTC');
//   const intel = computeIntel('BTC', bars, ticker);
// ═══════════════════════════════════════════════════════════════════

import { rsi } from '../../charting_library/studies/indicators/rsi.js';
import { sma, ema } from '../../charting_library/studies/indicators/movingAverages.js';
import { atr } from '../../charting_library/studies/indicators/atr.js';
import { pivotPoints } from '../../charting_library/studies/indicators/pivotPoints.js';
import { bollingerBands } from '../../charting_library/studies/indicators/bollingerBands.js';
import { closes, highs, lows, volumes } from '../../charting_library/studies/indicators/helpers.js';

// ─── Configuration ─────────────────────────────────────────────

const RSI_PERIOD = 14;
const SMA_FAST = 10;
const SMA_SLOW = 50;
const ATR_PERIOD = 14;
const BB_PERIOD = 20;
const BB_MULT = 2;
const MIN_BARS = 60; // Need at least 60 bars for meaningful indicators

// ─── Fetch bars for intel computation ──────────────────────────

/**
 * Fetch OHLC bars for a symbol. Tries DataCache first, falls back to FetchService.
 * @param {string} symbol
 * @param {string} tf - timeframe, default '1h'
 * @returns {Promise<Array>} OHLC bars array
 */
export async function fetchBarsForIntel(symbol, tf = '1h') {
  // Try DataCache (prefetched data from WatchlistPrefetcher)
  try {
    const { dataCache } = await import('../DataCache.js');
    const cached = await dataCache.getCandles(symbol, tf);
    if (cached && cached.length >= MIN_BARS) return cached;
  } catch { /* DataCache unavailable */ }

  // Try OPFSBarStore
  try {
    const { opfsBarStore } = await import('../engine/infra/OPFSBarStore.js');
    const opfs = await opfsBarStore.getCandles(symbol, tf);
    if (opfs && opfs.length >= MIN_BARS) return opfs;
  } catch { /* OPFS unavailable */ }

  // Fallback: fetch fresh via FetchService
  try {
    const { default: fetchOHLC } = await import('../FetchService');
    const bars = await fetchOHLC(symbol, tf);
    return bars || [];
  } catch { return []; }
}

// ─── Core computation ──────────────────────────────────────────

/**
 * Compute real intelligence for a single symbol.
 *
 * @param {string} symbol
 * @param {Array} bars - OHLC bars [{time, open, high, low, close, volume}, ...]
 * @param {Object} ticker - 24h ticker data {lastPrice, priceChangePercent, volume, ...}
 * @returns {Object} intelligence object
 */
export function computeIntel(symbol, bars, ticker) {
  const result = {
    symbol,
    price: 0,
    change: 0,
    changePercent: 0,
    rsi14: null,
    smaFast: null,
    smaSlow: null,
    emaFast: null,
    support: null,
    resistance: null,
    atr14: null,
    bbUpper: null,
    bbLower: null,
    bbWidth: null,
    sentiment: 'neutral',
    sentimentConfidence: 50,
    pattern: 'Analyzing...',
    priority: 0,
    sparkline: [],
    trendDirection: 'neutral', // 'up', 'down', 'neutral'
    volatilityRank: 'normal',  // 'low', 'normal', 'high'
  };

  // ─── Price from ticker ───────────────────────────────────────
  if (ticker) {
    result.price = parseFloat(ticker.lastPrice) || 0;
    result.change = parseFloat(ticker.priceChange) || 0;
    result.changePercent = parseFloat(ticker.priceChangePercent) || 0;
  }

  // ─── Short-circuit if insufficient bars ──────────────────────
  if (!bars || bars.length < MIN_BARS) {
    result.pattern = bars ? `Insufficient data (${bars.length} bars)` : 'No data available';
    if (result.price) {
      result.sparkline = [result.price];
    }
    return result;
  }

  // ─── Extract price arrays ────────────────────────────────────
  const c = closes(bars);
  const h = highs(bars);
  const l = lows(bars);
  const v = volumes(bars);
  const len = c.length;
  const lastPrice = result.price || c[len - 1];

  // Use last price from bars if ticker unavailable
  if (!result.price) result.price = lastPrice;

  // ─── RSI ─────────────────────────────────────────────────────
  const rsiValues = rsi(c, RSI_PERIOD);
  const latestRsi = rsiValues[len - 1];
  result.rsi14 = isNaN(latestRsi) ? null : +latestRsi.toFixed(1);

  // ─── Moving Averages ─────────────────────────────────────────
  const smaFastValues = sma(c, SMA_FAST);
  const smaSlowValues = sma(c, SMA_SLOW);
  const emaFastValues = ema(c, SMA_FAST);
  result.smaFast = smaFastValues[len - 1] || null;
  result.smaSlow = smaSlowValues[len - 1] || null;
  result.emaFast = emaFastValues[len - 1] || null;

  // ─── Trend Direction ─────────────────────────────────────────
  if (result.smaFast && result.smaSlow) {
    if (result.smaFast > result.smaSlow && lastPrice > result.smaFast) {
      result.trendDirection = 'up';
    } else if (result.smaFast < result.smaSlow && lastPrice < result.smaFast) {
      result.trendDirection = 'down';
    }
  }

  // ─── ATR ─────────────────────────────────────────────────────
  const atrValues = atr(bars, ATR_PERIOD);
  const latestAtr = atrValues[len - 1];
  result.atr14 = isNaN(latestAtr) ? null : latestAtr;

  // Volatility rank based on ATR as % of price
  if (result.atr14 && lastPrice) {
    const atrPct = (result.atr14 / lastPrice) * 100;
    result.volatilityRank = atrPct > 3 ? 'high' : atrPct < 1 ? 'low' : 'normal';
  }

  // ─── Bollinger Bands ─────────────────────────────────────────
  const bb = bollingerBands(c, BB_PERIOD, BB_MULT);
  if (bb && bb.upper && bb.lower) {
    result.bbUpper = bb.upper[len - 1] || null;
    result.bbLower = bb.lower[len - 1] || null;
    if (result.bbUpper && result.bbLower) {
      result.bbWidth = ((result.bbUpper - result.bbLower) / lastPrice * 100).toFixed(2);
    }
  }

  // ─── Pivot Points (Support / Resistance) ─────────────────────
  try {
    const pivots = pivotPoints(bars, 1);
    if (pivots) {
      // Find last non-NaN support and resistance
      for (let i = len - 1; i >= 0; i--) {
        if (!result.support && pivots.s1 && !isNaN(pivots.s1[i])) {
          result.support = +pivots.s1[i].toFixed(2);
        }
        if (!result.resistance && pivots.r1 && !isNaN(pivots.r1[i])) {
          result.resistance = +pivots.r1[i].toFixed(2);
        }
        if (result.support && result.resistance) break;
      }
    }
  } catch { /* pivot computation may fail with insufficient data */ }

  // ─── Sparkline (last 24 closes) ──────────────────────────────
  result.sparkline = c.slice(-24);

  // ─── Sentiment Derivation ────────────────────────────────────
  const sentimentScore = deriveSentiment(result);
  result.sentiment = sentimentScore.label;
  result.sentimentConfidence = sentimentScore.confidence;

  // ─── Pattern Detection ───────────────────────────────────────
  result.pattern = detectPattern(result, c, h, l, v);

  // ─── Priority Score (higher = more actionable) ───────────────
  result.priority = computePriority(result);

  return result;
}

// ─── Sentiment Derivation ──────────────────────────────────────

function deriveSentiment(intel) {
  let score = 50; // 0 = max bearish, 100 = max bullish

  // RSI contribution (±20)
  if (intel.rsi14 !== null) {
    if (intel.rsi14 > 60) score += Math.min((intel.rsi14 - 60) * 0.5, 20);
    if (intel.rsi14 < 40) score -= Math.min((40 - intel.rsi14) * 0.5, 20);
  }

  // Change % contribution (±15)
  if (intel.changePercent) {
    score += Math.max(-15, Math.min(15, intel.changePercent * 3));
  }

  // Trend contribution (±10)
  if (intel.trendDirection === 'up') score += 10;
  if (intel.trendDirection === 'down') score -= 10;

  // BB position contribution (±5)
  if (intel.bbUpper && intel.bbLower && intel.price) {
    const bbRange = intel.bbUpper - intel.bbLower;
    if (bbRange > 0) {
      const bbPos = (intel.price - intel.bbLower) / bbRange; // 0–1
      score += (bbPos - 0.5) * 10; // ±5
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  const confidence = Math.round(Math.abs(score - 50) * 2); // 0–100
  const label = score > 62 ? 'bullish' : score < 38 ? 'bearish' : 'neutral';

  return { score, confidence, label };
}

// ─── Pattern Detection ─────────────────────────────────────────

function detectPattern(intel, c, h, l, v) {
  const patterns = [];
  const len = c.length;

  // RSI extremes
  if (intel.rsi14 !== null) {
    if (intel.rsi14 > 70) patterns.push(`Overbought — RSI ${intel.rsi14}`);
    else if (intel.rsi14 < 30) patterns.push(`Oversold — RSI ${intel.rsi14}`);
    else if (intel.rsi14 > 55 && intel.rsi14 < 70) patterns.push(`Bullish momentum — RSI ${intel.rsi14}`);
    else if (intel.rsi14 > 30 && intel.rsi14 < 45) patterns.push(`Bearish momentum — RSI ${intel.rsi14}`);
  }

  // Support/Resistance proximity
  if (intel.support && intel.price) {
    const distPct = ((intel.price - intel.support) / intel.price) * 100;
    if (distPct < 1.5 && distPct > 0) patterns.push(`Near support $${intel.support}`);
    if (distPct < 0) patterns.push(`Broke below support $${intel.support}`);
  }
  if (intel.resistance && intel.price) {
    const distPct = ((intel.resistance - intel.price) / intel.price) * 100;
    if (distPct < 1.5 && distPct > 0) patterns.push(`Testing resistance $${intel.resistance}`);
    if (distPct < 0) patterns.push(`Broke above resistance $${intel.resistance}`);
  }

  // Bollinger Band squeeze
  if (intel.bbWidth && parseFloat(intel.bbWidth) < 2) {
    patterns.push('BB squeeze — breakout imminent');
  }

  // Trend
  if (intel.trendDirection === 'up') patterns.push('Uptrend (SMA10 > SMA50)');
  else if (intel.trendDirection === 'down') patterns.push('Downtrend (SMA10 < SMA50)');

  // Higher lows check (last 5 lows)
  if (len >= 5) {
    const recentLows = l.slice(-5);
    const higherLows = recentLows.every((val, i) => i === 0 || val >= recentLows[i - 1]);
    if (higherLows && recentLows[4] > recentLows[0]) {
      patterns.push('Higher lows forming');
    }
  }

  // Volume spike
  if (len >= 20 && v) {
    const avgVol = v.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const lastVol = v[len - 1];
    if (lastVol > avgVol * 2) patterns.push('Volume spike (2×avg)');
  }

  // Consolidation (range < 2% over last 5 bars)
  if (len >= 5) {
    const recentHigh = Math.max(...h.slice(-5));
    const recentLow = Math.min(...l.slice(-5));
    const rangePct = ((recentHigh - recentLow) / recentLow) * 100;
    if (rangePct < 2) patterns.push('Consolidation range');
  }

  // Return most relevant pattern (or first one)
  return patterns.length > 0 ? patterns[0] : 'No notable pattern';
}

// ─── Priority Computation ──────────────────────────────────────

function computePriority(intel) {
  let priority = 0;

  // Large change = actionable
  priority += Math.min(Math.abs(intel.changePercent) * 8, 30);

  // Extreme RSI
  if (intel.rsi14 !== null) {
    if (intel.rsi14 > 70 || intel.rsi14 < 30) priority += 25;
    else if (intel.rsi14 > 60 || intel.rsi14 < 40) priority += 10;
  }

  // Near S/R levels
  if (intel.support && intel.price) {
    const dist = Math.abs(intel.price - intel.support) / intel.price;
    if (dist < 0.015) priority += 20;
  }
  if (intel.resistance && intel.price) {
    const dist = Math.abs(intel.price - intel.resistance) / intel.price;
    if (dist < 0.015) priority += 20;
  }

  // Strong sentiment
  if (intel.sentimentConfidence > 60) priority += 15;

  // Volatility
  if (intel.volatilityRank === 'high') priority += 10;

  return Math.min(Math.round(priority), 100);
}

// ─── Batch computation ─────────────────────────────────────────

/**
 * Compute intel for multiple symbols in parallel.
 * @param {string[]} symbols
 * @param {Object} tickerMap - { symbol: ticker }
 * @param {string} tf - timeframe
 * @returns {Promise<Object[]>} array of intel objects, sorted by priority desc
 */
export async function batchComputeIntel(symbols, tickerMap = {}, tf = '1h') {
  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const bars = await fetchBarsForIntel(sym, tf);
        return computeIntel(sym, bars, tickerMap[sym]);
      } catch {
        return computeIntel(sym, [], tickerMap[sym]);
      }
    })
  );
  return results.sort((a, b) => b.priority - a.priority);
}
