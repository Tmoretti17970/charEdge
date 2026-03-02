// ═══════════════════════════════════════════════════════════════════
// charEdge — Confluence Engine (Sprint 8)
// Detects when multiple indicators and price levels agree,
// generating high-confluence signals with visual markers.
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze confluence: when multiple signals align.
 * @param {Object} data - { bars, indicatorOutputs, srLevels }
 * @returns {Object} { signals, heatStrip, summary }
 */
export function analyzeConfluence(data) {
  const { bars, indicatorOutputs = {}, srLevels = [] } = data;
  if (!bars || bars.length < 30) return { signals: [], heatStrip: [], summary: { bullish: 0, bearish: 0, neutral: 0 } };

  const signals = [];
  const heatStrip = new Array(bars.length).fill(0); // -1 to +1 sentiment per bar
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  const lastIdx = bars.length - 1;
  const lastClose = bars[lastIdx].close;
  const prevClose = bars[lastIdx - 1]?.close || lastClose;

  // ── Individual signal checks ──

  // 1. RSI Signals
  const rsi = indicatorOutputs.rsi?.rsi;
  if (rsi && rsi.length > lastIdx) {
    const rsiVal = rsi[lastIdx];
    const prevRsi = rsi[lastIdx - 1] || 50;
    if (rsiVal < 30) { signals.push({ type: 'rsi_oversold', bias: 'bullish', strength: 1 - rsiVal / 30 }); bullishCount++; }
    else if (rsiVal > 70) { signals.push({ type: 'rsi_overbought', bias: 'bearish', strength: (rsiVal - 70) / 30 }); bearishCount++; }
    else { neutralCount++; }

    // RSI divergence (basic)
    if (lastClose < prevClose && rsiVal > prevRsi) {
      signals.push({ type: 'bullish_divergence', bias: 'bullish', strength: 0.7, desc: 'Price lower, RSI higher' });
      bullishCount++;
    } else if (lastClose > prevClose && rsiVal < prevRsi) {
      signals.push({ type: 'bearish_divergence', bias: 'bearish', strength: 0.7, desc: 'Price higher, RSI lower' });
      bearishCount++;
    }
  }

  // 2. MACD Signals
  const macd = indicatorOutputs.macd;
  if (macd?.macd && macd.signal && macd.macd.length > lastIdx) {
    const macdVal = macd.macd[lastIdx];
    const macdSig = macd.signal[lastIdx];
    const prevMacd = macd.macd[lastIdx - 1] || 0;
    const prevSig = macd.signal[lastIdx - 1] || 0;

    // MACD crossover
    if (prevMacd <= prevSig && macdVal > macdSig) {
      signals.push({ type: 'macd_bull_cross', bias: 'bullish', strength: 0.8 });
      bullishCount++;
    } else if (prevMacd >= prevSig && macdVal < macdSig) {
      signals.push({ type: 'macd_bear_cross', bias: 'bearish', strength: 0.8 });
      bearishCount++;
    }
    // MACD above/below zero
    if (macdVal > 0) bullishCount += 0.5;
    else bearishCount += 0.5;
  }

  // 3. Moving Average Signals
  const sma = indicatorOutputs.sma?.sma;
  const ema = indicatorOutputs.ema?.ema;
  if (sma && sma.length > lastIdx) {
    if (lastClose > sma[lastIdx]) { bullishCount += 0.5; }
    else { bearishCount += 0.5; }
  }
  if (ema && ema.length > lastIdx) {
    if (lastClose > ema[lastIdx]) { bullishCount += 0.5; }
    else { bearishCount += 0.5; }
  }

  // 4. Price at S/R Level
  for (const level of srLevels) {
    const pctDist = Math.abs(lastClose - level.price) / level.price;
    if (pctDist < 0.005) { // Within 0.5% of a level
      signals.push({
        type: level.type === 'support' ? 'at_support' : 'at_resistance',
        bias: level.type === 'support' ? 'bullish' : 'bearish',
        strength: level.strength || 0.5,
        desc: `Price at ${level.type} ${level.price.toFixed(2)}`,
      });
      if (level.type === 'support') bullishCount++;
      else bearishCount++;
    }
  }

  // 5. Volume spike
  if (bars.length > 20) {
    const avgVol = bars.slice(-20).reduce((s, b) => s + (b.volume || 0), 0) / 20;
    const lastVol = bars[lastIdx].volume || 0;
    if (lastVol > avgVol * 2) {
      signals.push({ type: 'volume_spike', bias: lastClose > prevClose ? 'bullish' : 'bearish', strength: lastVol / avgVol / 3 });
    }
  }

  // ── Build heat strip ──
  const windowSize = 5;
  for (let i = 0; i < bars.length; i++) {
    let score = 0;
    // Simple trend direction
    if (i >= windowSize) {
      const diff = bars[i].close - bars[i - windowSize].close;
      score = Math.max(-1, Math.min(1, diff / (bars[i].close * 0.01)));
    }
    heatStrip[i] = score;
  }

  // ── Confluence detection ──
  const total = bullishCount + bearishCount + neutralCount || 1;
  const bullishPct = Math.round((bullishCount / total) * 100);
  const bearishPct = Math.round((bearishCount / total) * 100);

  if (bullishCount >= 3 && bullishCount > bearishCount * 1.5) {
    signals.push({
      type: 'high_confluence',
      bias: 'bullish',
      strength: 1,
      desc: `${bullishPct}% of signals are bullish`,
    });
  } else if (bearishCount >= 3 && bearishCount > bullishCount * 1.5) {
    signals.push({
      type: 'high_confluence',
      bias: 'bearish',
      strength: 1,
      desc: `${bearishPct}% of signals are bearish`,
    });
  }

  return {
    signals,
    heatStrip,
    summary: {
      bullish: Math.round(bullishCount),
      bearish: Math.round(bearishCount),
      neutral: Math.round(neutralCount),
      total: signals.length,
      bias: bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral',
      biasStrength: Math.abs(bullishCount - bearishCount) / total,
    },
  };
}

/**
 * Detect divergences between price and an indicator.
 * @param {number[]} closes - Price closes
 * @param {number[]} indicator - Indicator values (RSI, MACD, etc.)
 * @param {number} lookback - Bars to look back
 * @returns {Object[]} Divergence events
 */
export function detectDivergences(closes, indicator, lookback = 50) {
  if (!closes || !indicator || closes.length < lookback) return [];
  const divergences = [];
  const start = Math.max(0, closes.length - lookback);

  for (let i = start + 10; i < closes.length - 1; i++) {
    // Check for local extremes in price
    const priceHigh = closes[i] > closes[i - 1] && closes[i] > closes[i + 1];
    const priceLow = closes[i] < closes[i - 1] && closes[i] < closes[i + 1];

    if (priceHigh && i > start + 5) {
      // Look for previous high in both price and indicator
      for (let j = i - 5; j >= start; j--) {
        if (closes[j] > closes[j - 1] && closes[j] > closes[j + 1]) {
          // Price making higher high but indicator making lower high = bearish divergence
          if (closes[i] > closes[j] && indicator[i] < indicator[j]) {
            divergences.push({ type: 'bearish', barIdx: i, prevBarIdx: j, price: closes[i], indVal: indicator[i] });
          }
          break;
        }
      }
    }

    if (priceLow && i > start + 5) {
      for (let j = i - 5; j >= start; j--) {
        if (closes[j] < closes[j - 1] && closes[j] < closes[j + 1]) {
          // Price making lower low but indicator making higher low = bullish divergence
          if (closes[i] < closes[j] && indicator[i] > indicator[j]) {
            divergences.push({ type: 'bullish', barIdx: i, prevBarIdx: j, price: closes[i], indVal: indicator[i] });
          }
          break;
        }
      }
    }
  }

  return divergences;
}
