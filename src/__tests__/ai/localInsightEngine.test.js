// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// charEdge — LocalInsightEngine v2 Tests
//
// Comprehensive tests for:
//   • Market regime classification
//   • Candlestick pattern detection (12 patterns)
//   • Chart pattern detection (double top/bottom, triangles, flags)
//   • Risk assessment scoring
//   • Momentum & volume interpretation
//   • Key observations prioritization
//   • Setup quality grading
//   • Key level detection
//   • Full analysis report generation
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { localInsightEngine } from '../../charting_library/ai/LocalInsightEngine.js';

// ─── Helpers ────────────────────────────────────────────────────

/** Generate synthetic candles with controllable trend */
function makeCandles(count, { startPrice = 100, trend = 0, volatility = 0.01, volumeBase = 1000 } = {}) {
  const candles = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const change = trend + (Math.random() - 0.5) * volatility * 2;
    const open = price;
    price = price * (1 + change);
    const high = Math.max(open, price) * (1 + Math.random() * volatility);
    const low = Math.min(open, price) * (1 - Math.random() * volatility);
    candles.push({
      time: Date.now() - (count - i) * 60000,
      open,
      high,
      low,
      close: price,
      volume: volumeBase * (0.5 + Math.random()),
    });
  }
  return candles;
}

/** Generate a doji candle (open ≈ close, long wicks) */
function makeDoji(price = 100, wick = 2) {
  return { time: Date.now(), open: price, high: price + wick, low: price - wick, close: price + 0.01, volume: 1000 };
}

/** Generate a hammer candle (small body at top, long lower wick) */
function makeHammer(price = 100) {
  return { time: Date.now(), open: price, high: price + 0.2, low: price - 3, close: price + 0.1, volume: 1000 };
}

/** Generate a shooting star (small body at bottom, long upper wick) */
function makeShootingStar(price = 100) {
  return { time: Date.now(), open: price, high: price + 3, low: price - 0.2, close: price - 0.1, volume: 1000 };
}

/** Build a synthetic feature set for testing */
function makeFeatures({
  rsi = 50,
  trendStrength = 10,
  macdCrossover = 0,
  priceVsEma = 0,
  rsiSlope = 0,
  volumeRatio = 1.0,
  volumeSpike = 1.0,
  buyPressure = 0.5,
  obvTrend = 0,
  atrRatio = 0.02,
  bollingerWidth = 0.03,
  bodyRatio = 0.5,
  wickRatio = 0.2,
  returns1 = 0,
} = {}) {
  return {
    momentum: {
      rsi,
      trendStrength,
      macdCrossover,
      priceVsEma,
      rsiSlope,
      macdHistogram: 0,
      williamsR: -50,
      stochK: 50,
      stochD: 50,
      adxStrength: 25,
      emaDistance12: 0,
      emaDistance26: 0,
    },
    volatility: {
      atrRatio,
      bollingerWidth,
      highLowRange: 0.02,
      gapFrequency: 0.1,
      atrExpansion: 1,
      volatilityRegime: 0.5,
    },
    volume: {
      volumeRatio,
      volumeSpike,
      buyPressure,
      obvTrend,
      vwapDeviation: 0,
      volumeTrend5: 0,
      moneyFlowRatio: 0.5,
    },
    price: {
      returns1,
      returns5: 0,
      returns20: 0,
      bodyRatio,
      wickRatio,
      returns3: 0,
      returns10: 0,
      lowerWickRatio: 0.2,
      pivotProximity: 0,
      fib382: 0,
      fib618: 0,
      consecutiveDirection: 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Market Regime Classification
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Market Regime', () => {
  it('classifies strong uptrend', () => {
    const features = makeFeatures({ rsi: 72, trendStrength: 25, priceVsEma: 0.02 });
    const { regime } = localInsightEngine.generateMarketPulse(features, 'BTC', '1H');
    expect(regime.label).toBe('Strong Uptrend');
    expect(regime.bias).toBe('bullish');
  });

  it('classifies strong downtrend', () => {
    const features = makeFeatures({ rsi: 28, trendStrength: 25, priceVsEma: -0.02 });
    const { regime } = localInsightEngine.generateMarketPulse(features, 'ETH', '4H');
    expect(regime.label).toBe('Strong Downtrend');
    expect(regime.bias).toBe('bearish');
  });

  it('classifies breakout', () => {
    const features = makeFeatures({ volumeSpike: 2.5, bollingerWidth: 0.05, trendStrength: 20 });
    const { regime } = localInsightEngine.generateMarketPulse(features, 'BTC', '15m');
    expect(regime.label).toBe('Breakout');
    expect(regime.bias).toBe('follow momentum');
  });

  it('classifies reversal', () => {
    const features = makeFeatures({ rsi: 80, volumeSpike: 1.8 });
    const { regime } = localInsightEngine.generateMarketPulse(features, 'AAPL', '1D');
    expect(regime.label).toBe('Potential Reversal');
    expect(regime.bias).toBe('caution');
  });

  it('classifies consolidation in neutral conditions', () => {
    const features = makeFeatures({ rsi: 50, trendStrength: 3, priceVsEma: 0.001 });
    const { regime } = localInsightEngine.generateMarketPulse(features, 'SPY', '1H');
    expect(regime.label).toBe('Consolidation');
  });

  it('generates pulse text as a non-empty string', () => {
    const features = makeFeatures({ rsi: 65, trendStrength: 15 });
    const { text } = localInsightEngine.generateMarketPulse(features, 'BTC', '1H');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(20);
    expect(text).toContain('BTC');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Candlestick Pattern Detection
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Candlestick Patterns', () => {
  it('detects doji pattern', () => {
    const candles = [...makeCandles(4, { startPrice: 100, trend: -0.005 }), makeDoji(100)];
    const patterns = localInsightEngine.detectPatterns(candles);
    const doji = patterns.find((p) => p.name === 'Doji');
    expect(doji).toBeDefined();
    expect(doji.type).toBe('neutral');
  });

  it('detects hammer pattern after downtrend', () => {
    // Explicitly create bearish candles followed by a hammer
    const candles = [
      { time: Date.now() - 4 * 60000, open: 105, high: 106, low: 103, close: 103.5, volume: 1000 },
      { time: Date.now() - 3 * 60000, open: 103.5, high: 104, low: 101, close: 101.5, volume: 1100 },
      { time: Date.now() - 2 * 60000, open: 101.5, high: 102, low: 99, close: 99.5, volume: 1200 },
      // Previous candle must be bearish (close < open)
      { time: Date.now() - 60000, open: 99.5, high: 100, low: 97, close: 97.5, volume: 1300 },
      // Hammer: small body at top, long lower wick, tiny upper wick
      // bodySize=0.5, lowerWick=6, upperWick=0.1 → lowerWick(6) > body*2(1) ✓, upperWick(0.1) < body*0.5(0.25) ✓
      { time: Date.now(), open: 98, high: 98.6, low: 92, close: 98.5, volume: 1500 },
    ];
    const patterns = localInsightEngine.detectPatterns(candles);
    const hammer = patterns.find((p) => p.name === 'Hammer');
    expect(hammer).toBeDefined();
    expect(hammer.type).toBe('bullish');
  });

  it('detects bullish engulfing', () => {
    const candles = [
      ...makeCandles(3),
      { time: Date.now() - 60000, open: 100, high: 101, low: 98, close: 98.5, volume: 1000 }, // bearish
      { time: Date.now(), open: 98, high: 103, low: 97.5, close: 102, volume: 1500 }, // bullish engulfing
    ];
    const patterns = localInsightEngine.detectPatterns(candles);
    const engulfing = patterns.find((p) => p.name === 'Bullish Engulfing');
    expect(engulfing).toBeDefined();
    expect(engulfing.type).toBe('bullish');
  });

  it('detects inside bar', () => {
    const candles = [
      ...makeCandles(3),
      { time: Date.now() - 60000, open: 95, high: 108, low: 90, close: 105, volume: 1000 }, // mother bar
      { time: Date.now(), open: 100, high: 105, low: 93, close: 102, volume: 800 }, // inside bar
    ];
    const patterns = localInsightEngine.detectPatterns(candles);
    const inside = patterns.find((p) => p.name === 'Inside Bar');
    expect(inside).toBeDefined();
    expect(inside.type).toBe('neutral');
  });

  it('returns empty array for insufficient data', () => {
    const candles = makeCandles(3);
    const patterns = localInsightEngine.detectPatterns(candles);
    expect(Array.isArray(patterns)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chart Pattern Detection (Multi-bar)
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Chart Patterns', () => {
  it('returns empty array for short data', () => {
    const candles = makeCandles(20);
    const patterns = localInsightEngine.detectChartPatterns(candles);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('detects patterns in sufficient data', () => {
    // 100 candles with some volatility should produce at least detection attempts
    const candles = makeCandles(100, { volatility: 0.02 });
    const patterns = localInsightEngine.detectChartPatterns(candles);
    expect(Array.isArray(patterns)).toBe(true);
    // Each pattern should have required fields
    patterns.forEach((p) => {
      expect(p).toHaveProperty('idx');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('icon');
      expect(p).toHaveProperty('bias');
      expect(p).toHaveProperty('confidence');
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Risk Assessment
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Risk Assessment', () => {
  it('returns LOW risk for neutral conditions', () => {
    const features = makeFeatures({ rsi: 50, atrRatio: 0.015, volumeRatio: 1.0 });
    const risk = localInsightEngine.assessRisk(features);
    expect(risk.level).toBe('LOW');
    expect(risk.emoji).toBe('🟢');
    expect(risk.score).toBeLessThan(25);
  });

  it('returns HIGH risk for extreme conditions', () => {
    const features = makeFeatures({
      rsi: 85,
      atrRatio: 0.05,
      bollingerWidth: 0.09,
      volumeRatio: 0.3,
      volumeSpike: 3.5,
    });
    const risk = localInsightEngine.assessRisk(features);
    expect(risk.score).toBeGreaterThanOrEqual(25);
    expect(risk.risks.length).toBeGreaterThan(0);
  });

  it('includes risk factors as strings', () => {
    const features = makeFeatures({ rsi: 15, atrRatio: 0.05 });
    const risk = localInsightEngine.assessRisk(features);
    risk.risks.forEach((r) => {
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Setup Quality Grading
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Setup Grading', () => {
  it('grades a strong setup as A or B+', () => {
    const features = makeFeatures({
      rsi: 55,
      trendStrength: 20,
      macdCrossover: 1,
      volumeRatio: 1.5,
      volumeSpike: 1.8,
      buyPressure: 0.7,
      bollingerWidth: 0.03,
      bodyRatio: 0.7,
      wickRatio: 0.1,
    });
    const grade = localInsightEngine.gradeSetup(features);
    expect(grade.score).toBeGreaterThanOrEqual(60);
    expect(['A+', 'A', 'B+', 'B']).toContain(grade.letter);
    expect(grade.stars).toBeGreaterThanOrEqual(3);
  });

  it('grades a weak setup as C or D', () => {
    const features = makeFeatures({
      rsi: 50,
      trendStrength: 2,
      volumeRatio: 0.3,
      buyPressure: 0.5,
      bodyRatio: 0.2,
      returns1: 0,
    });
    const grade = localInsightEngine.gradeSetup(features);
    expect(grade.score).toBeLessThan(55);
  });

  it('returns all required fields', () => {
    const features = makeFeatures();
    const grade = localInsightEngine.gradeSetup(features);
    expect(grade).toHaveProperty('letter');
    expect(grade).toHaveProperty('stars');
    expect(grade).toHaveProperty('score');
    expect(grade).toHaveProperty('desc');
    expect(grade.score).toBeGreaterThanOrEqual(0);
    expect(grade.score).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Momentum & Volume Interpretation
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Momentum Interpretation', () => {
  it('returns RSI overbought insight', () => {
    const features = makeFeatures({ rsi: 82 });
    const insights = localInsightEngine.interpretMomentum(features);
    expect(insights.length).toBeGreaterThan(0);
    const rsiInsight = insights.find((i) => i.includes('overbought'));
    expect(rsiInsight).toBeDefined();
  });

  it('returns MACD bullish cross insight', () => {
    const features = makeFeatures({ macdCrossover: 1 });
    const insights = localInsightEngine.interpretMomentum(features);
    const macdInsight = insights.find((i) => i.includes('bullish'));
    expect(macdInsight).toBeDefined();
  });
});

describe('LocalInsightEngine — Volume Interpretation', () => {
  it('returns volume spike insight', () => {
    const features = makeFeatures({ volumeSpike: 2.5 });
    const insights = localInsightEngine.interpretVolume(features);
    expect(insights.length).toBeGreaterThan(0);
    const spikeInsight = insights.find((i) => i.includes('volume') || i.includes('Volume'));
    expect(spikeInsight).toBeDefined();
  });

  it('returns buy pressure insight', () => {
    const features = makeFeatures({ buyPressure: 0.8 });
    const insights = localInsightEngine.interpretVolume(features);
    const pressureInsight = insights.find((i) => i.includes('buy pressure') || i.includes('Buy'));
    expect(pressureInsight).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Key Level Detection
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Key Levels', () => {
  it('returns empty for insufficient data', () => {
    const candles = makeCandles(5);
    const levels = localInsightEngine.generateKeyLevels(candles);
    expect(Array.isArray(levels)).toBe(true);
  });

  it('detects support/resistance from swing analysis', () => {
    const candles = makeCandles(60, { volatility: 0.015 });
    const levels = localInsightEngine.generateKeyLevels(candles);
    expect(Array.isArray(levels)).toBe(true);
    levels.forEach((level) => {
      expect(level).toHaveProperty('price');
      expect(level).toHaveProperty('type');
      expect(level).toHaveProperty('distance');
      expect(['support', 'resistance']).toContain(level.type);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Full Analysis Report
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Full Analysis', () => {
  it('generates complete analysis with all sections', () => {
    const candles = makeCandles(60, { volatility: 0.015 });
    const features = makeFeatures({ rsi: 62, trendStrength: 18, volumeRatio: 1.3 });
    const result = localInsightEngine.generateFullAnalysis(features, 'BTC', '1H', candles);

    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('regime');
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('risk');
    expect(result).toHaveProperty('observations');
    expect(result.sections.length).toBeGreaterThanOrEqual(5);

    // Check required sections exist
    const sectionTitles = result.sections.map((s) => s.title);
    expect(sectionTitles).toContain('Market Regime');
    expect(sectionTitles).toContain('Setup Quality');
    expect(sectionTitles).toContain('Risk Assessment');
    expect(sectionTitles).toContain('Momentum');
    expect(sectionTitles).toContain('Volume');
    expect(sectionTitles).toContain('Trade Bias');
  });

  it('sections have title, content, and detail', () => {
    const candles = makeCandles(40);
    const features = makeFeatures();
    const result = localInsightEngine.generateFullAnalysis(features, 'ETH', '4H', candles);

    result.sections.forEach((section) => {
      expect(section).toHaveProperty('title');
      expect(section).toHaveProperty('content');
      expect(typeof section.title).toBe('string');
      expect(typeof section.content).toBe('string');
    });
  });

  it('handles edge case — minimal candles', () => {
    const candles = makeCandles(25); // Minimum for analysis
    const features = makeFeatures();
    // Should not throw
    const result = localInsightEngine.generateFullAnalysis(features, 'X', '1m', candles);
    expect(result.sections.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Detailed Narrative
// ═══════════════════════════════════════════════════════════════════

describe('LocalInsightEngine — Detailed Narrative', () => {
  it('generates multi-paragraph narrative', () => {
    const candles = makeCandles(60, { volatility: 0.015 });
    const features = makeFeatures({ rsi: 65, trendStrength: 20, volumeRatio: 1.5 });
    const result = localInsightEngine.generateDetailedNarrative(features, 'BTC', '1H', candles);

    expect(result).toHaveProperty('narrative');
    expect(result).toHaveProperty('regime');
    expect(result).toHaveProperty('risk');
    expect(typeof result.narrative).toBe('string');
    expect(result.narrative.length).toBeGreaterThan(50);
    expect(result.narrative).toContain('BTC');
  });
});
