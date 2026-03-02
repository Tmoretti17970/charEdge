// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Chart Analysis Engine
//
// Rule-based technical analysis that reads a chart's current state
// and produces a structured analysis report. Covers trend, support/
// resistance, momentum, volume character, and a bias score.
//
// Future: Hook into Gemini/LLM for narrative-quality reports.
// ═══════════════════════════════════════════════════════════════════

import { Calc } from '../model/Calc.js';

/** Financial disclaimer required on all AI-generated outputs (Task 2.1.2). */
export const AI_DISCLAIMER = 'Educational analysis only — not financial advice. Past performance does not guarantee future results.';

/**
 * Analyze a chart and return a structured report.
 * @param {Object[]} bars - OHLCV bar data
 * @param {string} symbol - Symbol being analyzed
 * @param {string} timeframe - Current timeframe
 * @returns {ChartAnalysis}
 */
export function analyzeChart(bars, symbol = 'Unknown', timeframe = '1H') {
  if (!bars?.length || bars.length < 50) {
    return { error: 'Need at least 50 bars for analysis', sections: [] };
  }

  const closes = bars.map(b => b.close);
  const n = bars.length;
  const last = bars[n - 1];

  // Compute indicators
  const sma20 = Calc.sma(closes, 20);
  const sma50 = Calc.sma(closes, 50);
  const sma200 = n >= 200 ? Calc.sma(closes, 200) : null;
  const emaArr = Calc.ema(closes, 9);
  const rsiArr = Calc.rsi(closes, 14);
  const macdArr = Calc.macd(closes);
  const atrArr = Calc.atr(bars, 14);
  const bbArr = Calc.bollinger(closes, 20);

  const rsi = rsiArr[n - 1];
  const macd = macdArr[n - 1];
  const atr = atrArr[n - 1];
  const bb = bbArr[n - 1];
  const sma20Val = sma20[n - 1];
  const sma50Val = sma50[n - 1];
  const sma200Val = sma200?.[n - 1];

  const sections = [];
  let bullishPoints = 0;
  let bearishPoints = 0;

  // ─── 1. Trend Analysis ─────────────────────────────────────────

  const trendDetails = [];

  if (sma20Val && sma50Val) {
    if (sma20Val > sma50Val) {
      trendDetails.push({ text: 'SMA(20) above SMA(50) — bullish structure', sentiment: 'bullish' });
      bullishPoints += 2;
    } else {
      trendDetails.push({ text: 'SMA(20) below SMA(50) — bearish structure', sentiment: 'bearish' });
      bearishPoints += 2;
    }
  }

  if (sma200Val) {
    if (last.close > sma200Val) {
      trendDetails.push({ text: `Price above 200 SMA ($${sma200Val.toFixed(2)}) — long-term uptrend`, sentiment: 'bullish' });
      bullishPoints += 2;
    } else {
      trendDetails.push({ text: `Price below 200 SMA ($${sma200Val.toFixed(2)}) — long-term downtrend`, sentiment: 'bearish' });
      bearishPoints += 2;
    }
  }

  // Price vs EMAs
  if (last.close > sma20Val) {
    trendDetails.push({ text: 'Price above 20-period MA — short-term bullish', sentiment: 'bullish' });
    bullishPoints++;
  } else {
    trendDetails.push({ text: 'Price below 20-period MA — short-term bearish', sentiment: 'bearish' });
    bearishPoints++;
  }

  // Recent price action (last 10 bars)
  const recentHigh = Math.max(...bars.slice(-10).map(b => b.high));
  const recentLow = Math.min(...bars.slice(-10).map(b => b.low));
  const recentRange = recentHigh - recentLow;
  const recentPosition = recentRange > 0 ? (last.close - recentLow) / recentRange : 0.5;

  if (recentPosition > 0.7) {
    trendDetails.push({ text: 'Trading near the top of the recent range', sentiment: 'bullish' });
    bullishPoints++;
  } else if (recentPosition < 0.3) {
    trendDetails.push({ text: 'Trading near the bottom of the recent range', sentiment: 'bearish' });
    bearishPoints++;
  }

  sections.push({
    title: '📈 Trend Analysis',
    icon: '📈',
    details: trendDetails,
  });

  // ─── 2. Support & Resistance ───────────────────────────────────

  const srDetails = [];
  const lookback = Math.min(n, 100);
  const recentBars = bars.slice(n - lookback);

  // Find swing highs/lows
  const swingHighs = [];
  const swingLows = [];
  for (let i = 2; i < recentBars.length - 2; i++) {
    if (recentBars[i].high > recentBars[i - 1].high && recentBars[i].high > recentBars[i - 2].high &&
        recentBars[i].high > recentBars[i + 1].high && recentBars[i].high > recentBars[i + 2].high) {
      swingHighs.push(recentBars[i].high);
    }
    if (recentBars[i].low < recentBars[i - 1].low && recentBars[i].low < recentBars[i - 2].low &&
        recentBars[i].low < recentBars[i + 1].low && recentBars[i].low < recentBars[i + 2].low) {
      swingLows.push(recentBars[i].low);
    }
  }

  if (swingHighs.length > 0) {
    const nearestResistance = swingHighs.sort((a, b) => Math.abs(a - last.close) - Math.abs(b - last.close))[0];
    const distPct = ((nearestResistance - last.close) / last.close * 100).toFixed(2);
    srDetails.push({
      text: `Nearest resistance at $${nearestResistance.toFixed(2)} (${distPct}% away)`,
      sentiment: distPct < 1 ? 'bearish' : 'neutral',
    });
  }

  if (swingLows.length > 0) {
    const nearestSupport = swingLows.sort((a, b) => Math.abs(a - last.close) - Math.abs(b - last.close))[0];
    const distPct = ((last.close - nearestSupport) / last.close * 100).toFixed(2);
    srDetails.push({
      text: `Nearest support at $${nearestSupport.toFixed(2)} (${distPct}% away)`,
      sentiment: distPct < 1 ? 'bullish' : 'neutral',
    });
  }

  if (bb) {
    srDetails.push({ text: `Bollinger upper: $${bb.upper.toFixed(2)}`, sentiment: 'neutral' });
    srDetails.push({ text: `Bollinger lower: $${bb.lower.toFixed(2)}`, sentiment: 'neutral' });

    const bbWidth = ((bb.upper - bb.lower) / bb.middle * 100).toFixed(1);
    if (bbWidth < 3) {
      srDetails.push({ text: `Bollinger squeeze detected (width: ${bbWidth}%) — breakout likely`, sentiment: 'neutral' });
    }
  }

  sections.push({ title: '🎯 Support & Resistance', icon: '🎯', details: srDetails });

  // ─── 3. Momentum ───────────────────────────────────────────────

  const momDetails = [];

  if (rsi != null) {
    if (rsi > 70) {
      momDetails.push({ text: `RSI at ${rsi.toFixed(1)} — overbought, potential reversal zone`, sentiment: 'bearish' });
      bearishPoints += 2;
    } else if (rsi < 30) {
      momDetails.push({ text: `RSI at ${rsi.toFixed(1)} — oversold, potential bounce zone`, sentiment: 'bullish' });
      bullishPoints += 2;
    } else if (rsi > 50) {
      momDetails.push({ text: `RSI at ${rsi.toFixed(1)} — bullish momentum`, sentiment: 'bullish' });
      bullishPoints++;
    } else {
      momDetails.push({ text: `RSI at ${rsi.toFixed(1)} — bearish momentum`, sentiment: 'bearish' });
      bearishPoints++;
    }
  }

  if (macd) {
    if (macd.histogram > 0 && macdArr[n - 2]?.histogram <= 0) {
      momDetails.push({ text: 'MACD histogram turned positive — bullish crossover', sentiment: 'bullish' });
      bullishPoints += 2;
    } else if (macd.histogram < 0 && macdArr[n - 2]?.histogram >= 0) {
      momDetails.push({ text: 'MACD histogram turned negative — bearish crossover', sentiment: 'bearish' });
      bearishPoints += 2;
    } else if (macd.histogram > 0) {
      momDetails.push({ text: `MACD histogram: ${macd.histogram.toFixed(2)} (positive)`, sentiment: 'bullish' });
    } else {
      momDetails.push({ text: `MACD histogram: ${macd.histogram.toFixed(2)} (negative)`, sentiment: 'bearish' });
    }
  }

  sections.push({ title: '⚡ Momentum', icon: '⚡', details: momDetails });

  // ─── 4. Volume Character ───────────────────────────────────────

  const volDetails = [];
  const recentVolumes = bars.slice(-20).map(b => b.volume || 0);
  const avgVol = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  const lastVol = last.volume || 0;

  if (avgVol > 0) {
    const volRatio = lastVol / avgVol;
    if (volRatio > 2) {
      volDetails.push({ text: `Volume surge: ${(volRatio).toFixed(1)}x average — strong conviction`, sentiment: last.close > last.open ? 'bullish' : 'bearish' });
    } else if (volRatio > 1.5) {
      volDetails.push({ text: `Above-average volume (${(volRatio).toFixed(1)}x)`, sentiment: 'neutral' });
    } else if (volRatio < 0.5) {
      volDetails.push({ text: `Low volume (${(volRatio).toFixed(1)}x avg) — weak participation`, sentiment: 'neutral' });
    } else {
      volDetails.push({ text: `Normal volume (${(volRatio).toFixed(1)}x avg)`, sentiment: 'neutral' });
    }
  }

  sections.push({ title: '📊 Volume', icon: '📊', details: volDetails });

  // ─── 5. Volatility ─────────────────────────────────────────────

  const volat = [];
  if (atr) {
    const atrPct = (atr / last.close * 100).toFixed(2);
    volat.push({ text: `ATR(14): $${atr.toFixed(2)} (${atrPct}% of price)`, sentiment: 'neutral' });
  }

  sections.push({ title: '🌊 Volatility', icon: '🌊', details: volat });

  // ─── Overall Bias ──────────────────────────────────────────────

  const totalPoints = bullishPoints + bearishPoints;
  const biasScore = totalPoints > 0 ? Math.round((bullishPoints / totalPoints) * 100) : 50;
  const bias = biasScore >= 65 ? 'Bullish' : biasScore <= 35 ? 'Bearish' : 'Neutral';
  const biasColor = bias === 'Bullish' ? '#26A69A' : bias === 'Bearish' ? '#EF5350' : '#FFA726';

  return {
    symbol,
    timeframe,
    timestamp: Date.now(),
    price: last.close,
    bias,
    biasScore,
    biasColor,
    bullishPoints,
    bearishPoints,
    sections,
    keyLevels: {
      sma20: sma20Val,
      sma50: sma50Val,
      sma200: sma200Val,
      atr,
      rsi,
    },
    disclaimer: AI_DISCLAIMER,
  };
}
