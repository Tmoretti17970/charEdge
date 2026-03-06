// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Chart Analysis Engine (v2)
//
// Rule-based technical analysis that reads a chart's current state
// and produces a structured analysis report. Covers trend, support/
// resistance, momentum, volume character, candlestick patterns,
// RSI divergences, and a bias score.
//
// v2: Improved accuracy via multi-lookback S/R clustering,
// candlestick pattern recognition, RSI divergence detection,
// and efficient single-pass computations.
// ═══════════════════════════════════════════════════════════════════

import { Calc } from '../model/Calc.js';

/** Financial disclaimer required on all AI-generated outputs. */
export const AI_DISCLAIMER =
  'Educational analysis only — not financial advice. Past performance does not guarantee future results.';

// ─── Helper: cluster nearby price levels ────────────────────────
function clusterLevels(prices, threshold) {
  if (!prices.length) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters = [];
  let cluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i] - sorted[i - 1]) / sorted[i - 1] < threshold) {
      cluster.push(sorted[i]);
    } else {
      clusters.push(cluster);
      cluster = [sorted[i]];
    }
  }
  clusters.push(cluster);

  // Return average of each cluster, weighted by touch count
  return clusters.map((c) => ({
    level: c.reduce((s, v) => s + v, 0) / c.length,
    touches: c.length,
  }));
}

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

  const closes = bars.map((b) => b.close);
  const n = bars.length;
  const last = bars[n - 1];

  // ── Compute indicators (single pass where possible) ────────────
  const sma20 = Calc.sma(closes, 20);
  const sma50 = Calc.sma(closes, 50);
  const sma200 = n >= 200 ? Calc.sma(closes, 200) : null;
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

  // MA structure
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

  // Price vs 20 MA
  if (last.close > sma20Val) {
    trendDetails.push({ text: 'Price above 20-period MA — short-term bullish', sentiment: 'bullish' });
    bullishPoints++;
  } else {
    trendDetails.push({ text: 'Price below 20-period MA — short-term bearish', sentiment: 'bearish' });
    bearishPoints++;
  }

  // Higher highs / lower lows (last 20 bars, looking at 4-bar swings)
  const last20 = bars.slice(-20);
  const swingsRecent = [];
  for (let i = 2; i < last20.length - 2; i++) {
    const b = last20[i];
    if (b.high > last20[i - 1].high && b.high > last20[i + 1].high) swingsRecent.push({ type: 'H', val: b.high });
    if (b.low < last20[i - 1].low && b.low < last20[i + 1].low) swingsRecent.push({ type: 'L', val: b.low });
  }
  const recentHighs = swingsRecent.filter((s) => s.type === 'H').map((s) => s.val);
  const recentLows = swingsRecent.filter((s) => s.type === 'L').map((s) => s.val);

  if (recentHighs.length >= 2) {
    const lastH = recentHighs[recentHighs.length - 1];
    const prevH = recentHighs[recentHighs.length - 2];
    if (lastH > prevH) {
      trendDetails.push({ text: 'Higher highs forming — uptrend continuation', sentiment: 'bullish' });
      bullishPoints++;
    } else if (lastH < prevH) {
      trendDetails.push({ text: 'Lower highs forming — potential breakdown', sentiment: 'bearish' });
      bearishPoints++;
    }
  }

  sections.push({ title: '📈 Trend Analysis', icon: '📈', details: trendDetails });

  // ─── 2. Support & Resistance (clustered, multi-lookback) ───────

  const srDetails = [];
  const lookback = Math.min(n, 100);
  const srBars = bars.slice(n - lookback);

  // Find swing highs/lows with 2-bar confirmation
  const rawHighs = [];
  const rawLows = [];
  for (let i = 2; i < srBars.length - 2; i++) {
    const b = srBars[i];
    if (b.high > srBars[i - 1].high && b.high > srBars[i - 2].high &&
      b.high > srBars[i + 1].high && b.high > srBars[i + 2].high) {
      rawHighs.push(b.high);
    }
    if (b.low < srBars[i - 1].low && b.low < srBars[i - 2].low &&
      b.low < srBars[i + 1].low && b.low < srBars[i + 2].low) {
      rawLows.push(b.low);
    }
  }

  // Cluster levels within 0.5% — stronger levels have more touches
  const resistanceLevels = clusterLevels(rawHighs, 0.005);
  const supportLevels = clusterLevels(rawLows, 0.005);

  // Sort by proximity to current price
  resistanceLevels.sort((a, b) => Math.abs(a.level - last.close) - Math.abs(b.level - last.close));
  supportLevels.sort((a, b) => Math.abs(a.level - last.close) - Math.abs(b.level - last.close));

  // Show top 2 resistance and support levels
  for (const r of resistanceLevels.slice(0, 2)) {
    if (r.level > last.close) {
      const distPct = ((r.level - last.close) / last.close * 100).toFixed(2);
      const strength = r.touches >= 3 ? 'strong' : r.touches >= 2 ? 'moderate' : 'weak';
      srDetails.push({
        text: `Resistance at $${r.level.toFixed(2)} (${distPct}% away, ${strength} — ${r.touches} touches)`,
        sentiment: distPct < 1 ? 'bearish' : 'neutral',
      });
    }
  }
  for (const s of supportLevels.slice(0, 2)) {
    if (s.level < last.close) {
      const distPct = ((last.close - s.level) / last.close * 100).toFixed(2);
      const strength = s.touches >= 3 ? 'strong' : s.touches >= 2 ? 'moderate' : 'weak';
      srDetails.push({
        text: `Support at $${s.level.toFixed(2)} (${distPct}% away, ${strength} — ${s.touches} touches)`,
        sentiment: distPct < 1 ? 'bullish' : 'neutral',
      });
    }
  }

  if (bb) {
    const bbWidth = ((bb.upper - bb.lower) / bb.middle * 100).toFixed(1);
    if (bbWidth < 3) {
      srDetails.push({ text: `Bollinger squeeze detected (width: ${bbWidth}%) — breakout imminent`, sentiment: 'neutral' });
    }
  }

  sections.push({ title: '🎯 Support & Resistance', icon: '🎯', details: srDetails });

  // ─── 3. Candlestick Patterns (last 5 bars) ─────────────────────

  const patternDetails = [];
  const patternBars = bars.slice(-5);
  const p = patternBars;

  // Engulfing
  if (p.length >= 2) {
    const prev = p[p.length - 2];
    const curr = p[p.length - 1];
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);

    if (prev.close < prev.open && curr.close > curr.open &&
      curr.open <= prev.close && curr.close >= prev.open && currBody > prevBody) {
      patternDetails.push({ text: 'Bullish Engulfing — strong reversal signal', sentiment: 'bullish' });
      bullishPoints += 3;
    } else if (prev.close > prev.open && curr.close < curr.open &&
      curr.open >= prev.close && curr.close <= prev.open && currBody > prevBody) {
      patternDetails.push({ text: 'Bearish Engulfing — strong reversal signal', sentiment: 'bearish' });
      bearishPoints += 3;
    }
  }

  // Hammer / Shooting Star (last bar)
  if (p.length >= 1) {
    const c = p[p.length - 1];
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const totalRange = c.high - c.low;

    if (totalRange > 0 && body / totalRange < 0.3 && lowerWick / totalRange > 0.6) {
      if (recentLows.length > 0 && c.low <= Math.min(...recentLows) * 1.01) {
        patternDetails.push({ text: 'Hammer candle at support — bullish reversal', sentiment: 'bullish' });
        bullishPoints += 2;
      } else {
        patternDetails.push({ text: 'Hammer candle detected — watch for reversal', sentiment: 'bullish' });
        bullishPoints++;
      }
    } else if (totalRange > 0 && body / totalRange < 0.3 && upperWick / totalRange > 0.6) {
      if (recentHighs.length > 0 && c.high >= Math.max(...recentHighs) * 0.99) {
        patternDetails.push({ text: 'Shooting star at resistance — bearish reversal', sentiment: 'bearish' });
        bearishPoints += 2;
      } else {
        patternDetails.push({ text: 'Shooting star detected — watch for reversal', sentiment: 'bearish' });
        bearishPoints++;
      }
    }

    // Doji
    if (totalRange > 0 && body / totalRange < 0.1 && totalRange > atr * 0.5) {
      patternDetails.push({ text: 'Doji candle — indecision, potential reversal', sentiment: 'neutral' });
    }
  }

  // Three white soldiers / Three black crows
  if (p.length >= 3) {
    const l3 = p.slice(-3);
    const allGreen = l3.every((b) => b.close > b.open);
    const allRed = l3.every((b) => b.close < b.open);
    const ascending = l3[0].close < l3[1].close && l3[1].close < l3[2].close;
    const descending = l3[0].close > l3[1].close && l3[1].close > l3[2].close;

    if (allGreen && ascending) {
      patternDetails.push({ text: 'Three White Soldiers — strong bullish continuation', sentiment: 'bullish' });
      bullishPoints += 2;
    } else if (allRed && descending) {
      patternDetails.push({ text: 'Three Black Crows — strong bearish continuation', sentiment: 'bearish' });
      bearishPoints += 2;
    }
  }

  if (patternDetails.length === 0) {
    patternDetails.push({ text: 'No significant candlestick patterns detected', sentiment: 'neutral' });
  }

  sections.push({ title: '🕯️ Candlestick Patterns', icon: '🕯️', details: patternDetails });

  // ─── 4. Momentum ───────────────────────────────────────────────

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

  // ─── 5. RSI Divergences ────────────────────────────────────────

  const divDetails = [];

  // Look for divergences in the last 30 bars
  if (rsiArr.length >= 30) {
    const divBars = bars.slice(-30);
    const divRsi = rsiArr.slice(-30);

    // Find local price lows and corresponding RSI
    const priceLows = [];
    const priceHighs = [];
    for (let i = 2; i < divBars.length - 2; i++) {
      if (divBars[i].low < divBars[i - 1].low && divBars[i].low < divBars[i - 2].low &&
        divBars[i].low < divBars[i + 1].low && divBars[i].low < divBars[i + 2].low) {
        priceLows.push({ idx: i, price: divBars[i].low, rsi: divRsi[i] });
      }
      if (divBars[i].high > divBars[i - 1].high && divBars[i].high > divBars[i - 2].high &&
        divBars[i].high > divBars[i + 1].high && divBars[i].high > divBars[i + 2].high) {
        priceHighs.push({ idx: i, price: divBars[i].high, rsi: divRsi[i] });
      }
    }

    // Bullish divergence: lower price low, higher RSI low
    if (priceLows.length >= 2) {
      const a = priceLows[priceLows.length - 2];
      const b = priceLows[priceLows.length - 1];
      if (b.price < a.price && b.rsi > a.rsi) {
        divDetails.push({ text: 'Bullish RSI divergence — price making lower lows, RSI making higher lows', sentiment: 'bullish' });
        bullishPoints += 2;
      }
    }

    // Bearish divergence: higher price high, lower RSI high
    if (priceHighs.length >= 2) {
      const a = priceHighs[priceHighs.length - 2];
      const b = priceHighs[priceHighs.length - 1];
      if (b.price > a.price && b.rsi < a.rsi) {
        divDetails.push({ text: 'Bearish RSI divergence — price making higher highs, RSI making lower highs', sentiment: 'bearish' });
        bearishPoints += 2;
      }
    }
  }

  if (divDetails.length === 0) {
    divDetails.push({ text: 'No RSI divergences detected in the last 30 bars', sentiment: 'neutral' });
  }

  sections.push({ title: '🔀 RSI Divergences', icon: '🔀', details: divDetails });

  // ─── 6. Volume Character ───────────────────────────────────────

  const volDetails = [];
  const recentVolumes = bars.slice(-20).map((b) => b.volume || 0);
  const avgVol = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  const lastVol = last.volume || 0;

  if (avgVol > 0) {
    const volRatio = lastVol / avgVol;
    if (volRatio > 2) {
      volDetails.push({
        text: `Volume surge: ${volRatio.toFixed(1)}x average — strong conviction`,
        sentiment: last.close > last.open ? 'bullish' : 'bearish',
      });
    } else if (volRatio > 1.5) {
      volDetails.push({ text: `Above-average volume (${volRatio.toFixed(1)}x)`, sentiment: 'neutral' });
    } else if (volRatio < 0.5) {
      volDetails.push({ text: `Low volume (${volRatio.toFixed(1)}x avg) — weak participation`, sentiment: 'neutral' });
    } else {
      volDetails.push({ text: `Normal volume (${volRatio.toFixed(1)}x avg)`, sentiment: 'neutral' });
    }

    // Volume trend (ascending/descending last 5 bars)
    const vol5 = bars.slice(-5).map((b) => b.volume || 0);
    const volIncreasing = vol5.every((v, i) => i === 0 || v >= vol5[i - 1] * 0.9);
    const volDecreasing = vol5.every((v, i) => i === 0 || v <= vol5[i - 1] * 1.1);

    if (volIncreasing && last.close > last.open) {
      volDetails.push({ text: 'Volume expanding with up-moves — accumulation', sentiment: 'bullish' });
      bullishPoints++;
    } else if (volIncreasing && last.close < last.open) {
      volDetails.push({ text: 'Volume expanding with down-moves — distribution', sentiment: 'bearish' });
      bearishPoints++;
    } else if (volDecreasing) {
      volDetails.push({ text: 'Volume declining — momentum fading', sentiment: 'neutral' });
    }
  }

  sections.push({ title: '📊 Volume', icon: '📊', details: volDetails });

  // ─── 7. Volatility ─────────────────────────────────────────────

  const volat = [];
  if (atr) {
    const atrPct = ((atr / last.close) * 100).toFixed(2);
    volat.push({ text: `ATR(14): $${atr.toFixed(2)} (${atrPct}% of price)`, sentiment: 'neutral' });

    // Compare current ATR to 50-bar average ATR
    if (atrArr.length >= 50) {
      const avgAtr = atrArr.slice(-50).reduce((s, v) => s + (v || 0), 0) / 50;
      const atrRatio = atr / avgAtr;
      if (atrRatio > 1.5) {
        volat.push({ text: `Volatility expanding (${atrRatio.toFixed(1)}x normal) — expect large moves`, sentiment: 'neutral' });
      } else if (atrRatio < 0.6) {
        volat.push({ text: `Volatility contracting (${atrRatio.toFixed(1)}x normal) — breakout building`, sentiment: 'neutral' });
      }
    }
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
